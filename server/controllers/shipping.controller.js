import OrderModel from "../models/order.model.js";
import {
  AppError,
  asyncHandler,
  logger,
  sendError,
  sendSuccess,
  validateMongoId,
} from "../utils/errorHandler.js";
import {
  bookShipment,
  cancelShipment,
  checkServiceability,
  createManifest,
  createNdrAction,
  createReverseShipment,
  getNdrList,
  listCouriers,
  loginXpressbees,
  trackShipment,
} from "../services/xpressbees.service.js";
import {
  getShippingDisplayMetrics,
  getShippingQuote,
  validateIndianPincode,
} from "../services/shippingRate.service.js";
import { emitOrderStatusUpdate } from "../realtime/orderEvents.js";
import { syncShipmentStateOnOrder } from "../services/automatedShipping.service.js";
import { syncOrderToFirestore } from "../utils/orderFirestoreSync.js";
import {
  applyOrderStatusTransition,
  mapExpressbeesToOrderStatus,
  mapExpressbeesToShipmentStatus,
} from "../utils/orderStatus.js";

const normalizeShipmentStatus = (status) => {
  const mapped = mapExpressbeesToShipmentStatus(status);
  return mapped || "pending";
};

const validatePincode = (value, field) => {
  if (!value || !/^\d{6}$/.test(String(value))) {
    throw new AppError("INVALID_FORMAT", { field, message: "Pincode must be 6 digits" });
  }
};

const validatePhone = (value, field) => {
  if (!value || !/^\d{10}$/.test(String(value))) {
    throw new AppError("INVALID_FORMAT", { field, message: "Phone must be 10 digits" });
  }
};

const validatePaymentType = (value) => {
  const allowed = ["cod", "prepaid", "reverse"];
  if (!value || !allowed.includes(String(value).toLowerCase())) {
    throw new AppError("INVALID_FORMAT", {
      field: "payment_type",
      validValues: allowed,
    });
  }
};

const normalizePreviewPincode = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, 6);

const toSafeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const resolvePublicPreviewOriginPincode = () =>
  normalizePreviewPincode(
    process.env.XPRESSBEES_PICKUP_PINCODE ||
      process.env.XPRESSBEES_ORIGIN_PINCODE ||
      process.env.SHIPPER_PINCODE ||
      "",
  );

const resolveEtaLabel = (entry = {}) => {
  const directCandidates = [
    entry?.estimated_delivery_date,
    entry?.estimatedDeliveryDate,
    entry?.estimated_delivery,
    entry?.estimatedDelivery,
    entry?.eta,
    entry?.edd,
    entry?.delivery_date,
    entry?.deliveryDate,
  ];

  const directMatch = directCandidates.find(
    (candidate) => String(candidate || "").trim().length > 0,
  );
  if (directMatch) {
    return String(directMatch).trim();
  }

  const rangeStart = String(
    entry?.min_delivery_days ?? entry?.minDeliveryDays ?? "",
  ).trim();
  const rangeEnd = String(
    entry?.max_delivery_days ?? entry?.maxDeliveryDays ?? "",
  ).trim();

  if (rangeStart && rangeEnd) {
    return `${rangeStart}-${rangeEnd} business days`;
  }

  return "";
};

const normalizePreviewOption = (entry = {}) => ({
  courierName: String(
    entry?.name || entry?.courier_name || entry?.courierName || "",
  ).trim(),
  estimatedDelivery: resolveEtaLabel(entry),
  totalCharges: toSafeNumber(
    entry?.total_charges ??
      entry?.totalCharges ??
      entry?.charges ??
      entry?.freight_charges ??
      0,
    Number.POSITIVE_INFINITY,
  ),
});

const pickBestPreviewOption = (response) => {
  const options = Array.isArray(response?.data)
    ? response.data.map(normalizePreviewOption).filter(Boolean)
    : [];

  if (!options.length) return null;

  return options.reduce((best, current) => {
    if (!best) return current;
    return current.totalCharges < best.totalCharges ? current : best;
  }, null);
};

const buildOrderItemsFromOrder = (orderDoc) => {
  const products = Array.isArray(orderDoc?.products) ? orderDoc.products : [];
  return products
    .map((item, index) => ({
      name: String(item?.productTitle || "Item"),
      qty: Math.max(Number(item?.quantity || 1), 1),
      price: Math.max(Number(item?.price || 0), 0),
      sku: String(
        item?.productId ||
          item?.variantId ||
          `SKU-${String(index + 1).padStart(3, "0")}`,
      ),
    }))
    .filter((item) => item.qty > 0);
};

const normalizeShipmentPayload = async ({ shipment, orderId }) => {
  const normalized = {
    ...shipment,
  };

  const paymentType = String(normalized.payment_type || "").toLowerCase();
  const orderAmount = Number(normalized.order_amount || 0);
  const collectable = Number(normalized.collectable_amount);

  if (
    normalized.collectable_amount === undefined ||
    normalized.collectable_amount === null ||
    Number.isNaN(collectable)
  ) {
    normalized.collectable_amount =
      paymentType === "cod" ? Math.max(orderAmount, 0) : 0;
  } else {
    normalized.collectable_amount = Math.max(collectable, 0);
  }

  const hasOrderItems =
    Array.isArray(normalized.order_items) && normalized.order_items.length > 0;

  if (!hasOrderItems && orderId) {
    const orderDoc = await OrderModel.findById(orderId)
      .select("products")
      .lean();
    if (orderDoc) {
      normalized.order_items = buildOrderItemsFromOrder(orderDoc);
    }
  }

  return normalized;
};

const updateOrderShipping = async (orderId, updates, context = "shipping") => {
  if (!orderId) return null;
  validateMongoId(orderId, "orderId");

  const existingOrder = await OrderModel.findById(orderId)
    .select("_id isDemoOrder")
    .lean();

  if (!existingOrder) {
    throw new AppError("ORDER_NOT_FOUND");
  }

  if (existingOrder.isDemoOrder) {
    throw new AppError("FORBIDDEN", {
      message: "Shipping updates are disabled for demo test orders",
      orderId,
    });
  }

  const order = await OrderModel.findByIdAndUpdate(orderId, updates, {
    new: true,
    runValidators: true,
  });

  syncOrderToFirestore(order, "update").catch((err) =>
    logger.error(context, "Failed to sync order to Firestore", {
      orderId,
      error: err.message,
    }),
  );

  return order;
};

const snapshotOrderShippingState = (order) => ({
  order_status: order?.order_status || null,
  awb_number: order?.awb_number || null,
  awbNumber: order?.awbNumber || null,
  shipment_status: order?.shipment_status || null,
  shipmentStatus: order?.shipmentStatus || null,
  trackingUrl: order?.trackingUrl || null,
  manifestId: order?.manifestId || null,
  shipmentId: order?.shipmentId || null,
  shipping_provider: order?.shipping_provider || null,
  courierName: order?.courierName || null,
});

const hasShippingStateChanged = (beforeState, order) => {
  const afterState = snapshotOrderShippingState(order);
  return Object.keys(beforeState).some(
    (key) => beforeState[key] !== afterState[key],
  );
};

const syncCarrierStateToOrder = async ({
  orderId,
  awb = null,
  status = null,
  manifestId = null,
  trackingUrl = null,
  shipmentId = null,
  courierName = "Xpressbees",
  source = "XPRESSBEES_ADMIN_SYNC",
}) => {
  if (!orderId) return null;
  validateMongoId(orderId, "orderId");

  const order = await OrderModel.findById(orderId);
  if (!order) {
    throw new AppError("ORDER_NOT_FOUND");
  }

  if (order.isDemoOrder) {
    throw new AppError("FORBIDDEN", {
      message: "Shipping updates are disabled for demo test orders",
      orderId,
    });
  }

  const previousState = snapshotOrderShippingState(order);

  await syncShipmentStateOnOrder({
    order,
    awb,
    status,
    manifestId,
    trackingUrl,
    shipmentId,
    courierName,
    source,
  });

  const mappedOrderStatus = mapExpressbeesToOrderStatus(status);
  const transitionResult = mappedOrderStatus
    ? applyOrderStatusTransition(order, mappedOrderStatus, {
        source,
        timestamp: new Date(),
      })
    : { updated: false, reason: "no_status_mapping" };

  const shipmentChanged = hasShippingStateChanged(previousState, order);
  if (!shipmentChanged && !transitionResult.updated) {
    return order;
  }

  order.updatedAt = new Date();
  await order.save();

  syncOrderToFirestore(order, "update").catch((err) =>
    logger.error(source, "Failed to sync order to Firestore", {
      orderId,
      error: err.message,
    }),
  );
  emitOrderStatusUpdate(order, source);

  return order;
};

export const getShippingQuoteController = asyncHandler(async (req, res) => {
  try {
    const { pincode, subtotal = 0, paymentType = "prepaid" } = req.body || {};

    if (!validateIndianPincode(pincode)) {
      throw new AppError("INVALID_FORMAT", {
        field: "pincode",
        message: "Pincode must be 6 digits",
      });
    }

    const quote = await getShippingQuote({
      destinationPincode: pincode,
      subtotal: Number(subtotal || 0),
      paymentType,
    });

    return sendSuccess(res, quote, "Shipping quote fetched");
  } catch (error) {
    return sendError(res, error);
  }
});

export const getShippingDisplayMetricsController = asyncHandler(async (req, res) => {
  try {
    const metrics = await getShippingDisplayMetrics();
    return sendSuccess(res, metrics, "Shipping display metrics fetched");
  } catch (error) {
    return sendError(res, error);
  }
});

export const getDeliveryPreviewController = asyncHandler(async (req, res) => {
  try {
    const pincode = normalizePreviewPincode(req.body?.pincode);
    if (!validateIndianPincode(pincode)) {
      throw new AppError("INVALID_FORMAT", {
        field: "pincode",
        message: "Pincode must be 6 digits",
      });
    }

    const origin = resolvePublicPreviewOriginPincode();
    if (!validateIndianPincode(origin)) {
      return sendSuccess(
        res,
        {
          available: false,
          pincode,
          courierName: "",
          estimatedDelivery: "",
          reason: "ORIGIN_PINCODE_NOT_CONFIGURED",
        },
        "Delivery preview unavailable",
      );
    }

    const payload = {
      origin,
      destination: pincode,
      payment_type: "prepaid",
      order_amount: Math.max(toSafeNumber(req.body?.orderAmount, 0), 0),
      weight: Math.max(toSafeNumber(req.body?.weightGrams, 500), 1),
      length: Math.max(toSafeNumber(req.body?.lengthCm, 10), 1),
      breadth: Math.max(toSafeNumber(req.body?.breadthCm, 10), 1),
      height: Math.max(toSafeNumber(req.body?.heightCm, 10), 1),
    };

    const response = await checkServiceability(payload);
    const selected = pickBestPreviewOption(response);

    return sendSuccess(
      res,
      {
        available: Boolean(selected),
        pincode,
        courierName: selected?.courierName || "",
        estimatedDelivery: selected?.estimatedDelivery || "",
      },
      selected ? "Delivery preview fetched" : "Delivery preview unavailable",
    );
  } catch (error) {
    if (
      error?.code === "INVALID_FORMAT" ||
      error?.code === "INVALID_PINCODE" ||
      error?.statusCode === 400
    ) {
      return sendError(res, error);
    }

    return sendSuccess(
      res,
      {
        available: false,
        pincode: normalizePreviewPincode(req.body?.pincode),
        courierName: "",
        estimatedDelivery: "",
      },
      "Delivery preview unavailable",
    );
  }
});

export const xpressbeesLogin = asyncHandler(async (req, res) => {
  try {
    const data = await loginXpressbees();
    return sendSuccess(res, data, "Xpressbees token retrieved");
  } catch (error) {
    return sendError(res, error);
  }
});

export const xpressbeesCouriers = asyncHandler(async (req, res) => {
  try {
    const data = await listCouriers();
    return sendSuccess(res, data, "Courier list fetched");
  } catch (error) {
    return sendError(res, error);
  }
});

export const xpressbeesServiceability = asyncHandler(async (req, res) => {
  try {
    const payload = req.body || {};
    const { origin, destination, payment_type, order_amount } = payload;

    validatePincode(origin, "origin");
    validatePincode(destination, "destination");
    validatePaymentType(payment_type);
    if (order_amount === undefined || order_amount === null) {
      throw new AppError("MISSING_FIELD", { field: "order_amount" });
    }

    const data = await checkServiceability(payload);
    return sendSuccess(res, data, "Serviceability fetched");
  } catch (error) {
    return sendError(res, error);
  }
});

export const xpressbeesBookShipment = asyncHandler(async (req, res) => {
  try {
    const { orderId, shipment } = req.body || {};
    if (!shipment) {
      throw new AppError("MISSING_FIELD", { field: "shipment" });
    }

    if (!shipment.order_number) {
      throw new AppError("MISSING_FIELD", { field: "order_number" });
    }
    validatePaymentType(shipment.payment_type);
    if (shipment.order_amount === undefined || shipment.order_amount === null) {
      throw new AppError("MISSING_FIELD", { field: "order_amount" });
    }

    validatePincode(shipment?.consignee?.pincode, "consignee.pincode");
    validatePhone(shipment?.consignee?.phone, "consignee.phone");
    validatePincode(shipment?.pickup?.pincode, "pickup.pincode");
    validatePhone(shipment?.pickup?.phone, "pickup.phone");

    const normalizedShipment = await normalizeShipmentPayload({
      shipment,
      orderId,
    });

    if (
      !Array.isArray(normalizedShipment.order_items) ||
      normalizedShipment.order_items.length === 0
    ) {
      throw new AppError("MISSING_FIELD", {
        field: "order_items",
        message: "At least one order item is required for shipment booking",
      });
    }

    const data = await bookShipment(normalizedShipment);

    if (orderId && data?.status && data?.data?.awb_number) {
      const order = await syncCarrierStateToOrder({
        orderId,
        awb: data.data.awb_number,
        status: data?.data?.status || "PP",
        manifestId: data?.data?.manifest_id || data?.data?.manifestId || null,
        trackingUrl:
          data?.data?.tracking_url || data?.data?.trackingUrl || null,
        shipmentId:
          data?.data?.shipment_id || data?.data?.shipmentId || null,
        courierName: "Xpressbees",
        source: "XPRESSBEES_BOOK",
      });

      if (order) {
        order.shipment_created_at = new Date();
        await order.save();
      }
    }

    return sendSuccess(res, data, "Shipment booked");
  } catch (error) {
    return sendError(res, error);
  }
});

export const xpressbeesTrackShipment = asyncHandler(async (req, res) => {
  try {
    const { awb } = req.params;
    const { orderId } = req.query || {};

    if (!awb) {
      throw new AppError("MISSING_FIELD", { field: "awb" });
    }

    const data = await trackShipment(awb);

    if (orderId && data?.status) {
      const status =
        data?.data?.status ||
        data?.data?.status_code ||
        data?.data?.shipment_status ||
        data?.data?.current_status ||
        data?.status_code ||
        data?.status;

      await syncCarrierStateToOrder({
        orderId,
        awb,
        status,
        manifestId:
          data?.data?.manifest_id || data?.data?.manifestId || null,
        trackingUrl:
          data?.data?.tracking_url || data?.data?.trackingUrl || null,
        shipmentId:
          data?.data?.shipment_id || data?.data?.shipmentId || null,
        courierName: "Xpressbees",
        source: "XPRESSBEES_TRACK",
      });
    }

    return sendSuccess(res, data, "Shipment tracking fetched");
  } catch (error) {
    return sendError(res, error);
  }
});

export const xpressbeesManifest = asyncHandler(async (req, res) => {
  try {
    const { awbs, orderId } = req.body || {};

    if (!awbs || !Array.isArray(awbs) || awbs.length === 0) {
      throw new AppError("MISSING_FIELD", { field: "awbs" });
    }

    const data = await createManifest(awbs);

    const manifestUrl =
      data?.data?.manifest ||
      data?.data?.manifest_url ||
      data?.manifest ||
      null;

    if (orderId && manifestUrl) {
      await updateOrderShipping(orderId, {
        shipping_manifest: manifestUrl,
      });
    }

    return sendSuccess(res, data, "Manifest generated");
  } catch (error) {
    return sendError(res, error);
  }
});

export const xpressbeesCancelShipment = asyncHandler(async (req, res) => {
  try {
    const { awb, orderId } = req.body || {};

    if (!awb) {
      throw new AppError("MISSING_FIELD", { field: "awb" });
    }

    const data = await cancelShipment(awb);

    if (orderId && data?.status) {
      await syncCarrierStateToOrder({
        orderId,
        awb,
        status:
          data?.data?.status ||
          data?.data?.shipment_status ||
          data?.status_code ||
          "cancelled",
        manifestId:
          data?.data?.manifest_id || data?.data?.manifestId || null,
        trackingUrl:
          data?.data?.tracking_url || data?.data?.trackingUrl || null,
        shipmentId:
          data?.data?.shipment_id || data?.data?.shipmentId || null,
        courierName: "Xpressbees",
        source: "XPRESSBEES_CANCEL",
      });
    }

    return sendSuccess(res, data, "Shipment cancelled");
  } catch (error) {
    return sendError(res, error);
  }
});

export const xpressbeesNdrList = asyncHandler(async (req, res) => {
  try {
    const data = await getNdrList();
    return sendSuccess(res, data, "NDR list fetched");
  } catch (error) {
    return sendError(res, error);
  }
});

export const xpressbeesNdrCreate = asyncHandler(async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !Array.isArray(payload)) {
      throw new AppError("INVALID_FORMAT", { field: "payload", message: "Payload must be an array" });
    }
    if (payload.length > 100) {
      throw new AppError("INVALID_INPUT", {
        field: "payload",
        message: "Maximum 100 NDR actions allowed",
      });
    }

    const data = await createNdrAction(payload);
    return sendSuccess(res, data, "NDR action submitted");
  } catch (error) {
    return sendError(res, error);
  }
});

export const xpressbeesReverseShipment = asyncHandler(async (req, res) => {
  try {
    const { orderId, shipment } = req.body || {};
    if (!shipment) {
      throw new AppError("MISSING_FIELD", { field: "shipment" });
    }
    if (!shipment.order_id) {
      throw new AppError("MISSING_FIELD", { field: "order_id" });
    }
    validatePincode(shipment?.consignee?.pincode, "consignee.pincode");
    validatePhone(shipment?.consignee?.phone, "consignee.phone");
    validatePincode(shipment?.pickup?.pincode, "pickup.pincode");
    validatePhone(shipment?.pickup?.phone, "pickup.phone");

    const data = await createReverseShipment(shipment);

    if (orderId && data?.status && data?.data?.awb_number) {
      await updateOrderShipping(orderId, {
        shipping_provider: "XPRESSBEES",
        awb_number: data.data.awb_number,
        shipment_status: normalizeShipmentStatus(data.data.status),
        shipping_label: data?.data?.label || null,
        shipping_manifest: data?.data?.manifest || null,
        shipment_created_at: new Date(),
      });
    }

    return sendSuccess(res, data, "Reverse shipment created");
  } catch (error) {
    return sendError(res, error);
  }
});
