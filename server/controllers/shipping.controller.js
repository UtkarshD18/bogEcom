import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import SettingsModel from "../models/settings.model.js";
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
import { syncOrderToFirestore } from "../utils/orderFirestoreSync.js";
import { normalizeOrderStatus, ORDER_STATUS } from "../utils/orderStatus.js";
import {
  getOrderDisplayId,
  resolveOrderDisplayTotal,
} from "../utils/orderPresentation.js";

const normalizeShipmentStatus = (status) => {
  const mapped = mapExpressbeesToShipmentStatus(status);
  return mapped || "pending";
};

const DEFAULT_PACKAGE_WEIGHT_G = 500;
const DEFAULT_PACKAGE_DIMENSION_CM = 10;

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePhoneDigits = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

const sanitizeText = (value) => String(value || "").trim();

const extractPincode = (value) => {
  const match = String(value || "").match(/\b(\d{6})\b/);
  return match ? match[1] : "";
};

const parseStoreAddress = (rawAddress) => {
  const normalized = sanitizeText(rawAddress);
  if (!normalized) {
    return { address: "", address_2: "", city: "", state: "", pincode: "" };
  }

  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const firstLine = parts[0] || normalized;
  const secondLine = parts.length > 3 ? parts.slice(1, -2).join(", ") : "";
  const city = parts.length > 1 ? parts[parts.length - 2] || "" : "";
  const stateSource = parts.length > 0 ? parts[parts.length - 1] || "" : "";
  const pincode = extractPincode(normalized) || extractPincode(stateSource);
  const state = stateSource.replace(/\b\d{6}\b/g, "").trim();

  return {
    address: firstLine,
    address_2: secondLine,
    city,
    state,
    pincode,
  };
};

const resolvePickupAddress = async () => {
  const storeSetting = await SettingsModel.findOne({ key: "storeInfo" })
    .select("value")
    .lean();
  const storeInfo = storeSetting?.value || {};
  const parsedStoreAddress = parseStoreAddress(storeInfo?.address);

  const fallbackPincode =
    sanitizeText(process.env.XPRESSBEES_PICKUP_PINCODE) ||
    sanitizeText(process.env.XPRESSBEES_ORIGIN_PINCODE) ||
    sanitizeText(process.env.SHIPPER_PINCODE) ||
    parsedStoreAddress.pincode;

  return {
    warehouse_name:
      sanitizeText(process.env.XPRESSBEES_PICKUP_WAREHOUSE_NAME) ||
      sanitizeText(storeInfo?.name) ||
      "BuyOneGram Warehouse",
    name:
      sanitizeText(process.env.XPRESSBEES_PICKUP_CONTACT_NAME) ||
      sanitizeText(storeInfo?.name) ||
      "BuyOneGram Office",
    address:
      sanitizeText(process.env.XPRESSBEES_PICKUP_ADDRESS_LINE1) ||
      parsedStoreAddress.address,
    address_2:
      sanitizeText(process.env.XPRESSBEES_PICKUP_ADDRESS_LINE2) ||
      parsedStoreAddress.address_2,
    city:
      sanitizeText(process.env.XPRESSBEES_PICKUP_CITY) || parsedStoreAddress.city,
    state:
      sanitizeText(process.env.XPRESSBEES_PICKUP_STATE) || parsedStoreAddress.state,
    pincode: fallbackPincode,
    phone: normalizePhoneDigits(
      process.env.XPRESSBEES_PICKUP_PHONE || storeInfo?.phone || "",
    ),
  };
};

const resolveConsigneeAddress = (orderDoc) => {
  const deliveryAddress =
    orderDoc?.delivery_address && typeof orderDoc.delivery_address === "object"
      ? orderDoc.delivery_address
      : {};
  const billing = orderDoc?.billingDetails || {};
  const guest = orderDoc?.guestDetails || {};
  const user =
    orderDoc?.user && typeof orderDoc.user === "object" ? orderDoc.user : {};

  return {
    name:
      sanitizeText(deliveryAddress?.name) ||
      sanitizeText(billing?.fullName) ||
      sanitizeText(guest?.fullName) ||
      sanitizeText(user?.name) ||
      "Customer",
    address:
      sanitizeText(
        deliveryAddress?.address_line1 ||
          deliveryAddress?.address_line ||
          billing?.address ||
          guest?.address,
      ) || "Address not available",
    address_2: sanitizeText(deliveryAddress?.address_line2 || ""),
    city: sanitizeText(deliveryAddress?.city || ""),
    state:
      sanitizeText(deliveryAddress?.state) ||
      sanitizeText(billing?.state) ||
      sanitizeText(guest?.state),
    pincode:
      sanitizeText(deliveryAddress?.pincode) ||
      sanitizeText(billing?.pincode) ||
      sanitizeText(guest?.pincode),
    phone: normalizePhoneDigits(
      deliveryAddress?.mobile ||
        deliveryAddress?.phone ||
        billing?.phone ||
        guest?.phone ||
        user?.mobile ||
        "",
    ),
  };
};

const buildProductWeightMap = async (orderDoc) => {
  const productIds = Array.from(
    new Set(
      (orderDoc?.products || [])
        .map((item) => String(item?.productId || "").trim())
        .filter((value) => value && /^[a-fA-F0-9]{24}$/.test(value)),
    ),
  );

  if (productIds.length === 0) {
    return new Map();
  }

  const products = await ProductModel.find({ _id: { $in: productIds } })
    .select("_id weight dimensions variants")
    .lean();

  return new Map(products.map((product) => [String(product._id), product]));
};

const resolveVariantWeight = (product, orderItem) => {
  if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
    return 0;
  }

  const variantId = String(orderItem?.variantId || "").trim();
  const variantName = String(orderItem?.variantName || "").trim().toLowerCase();
  const variant = product.variants.find((entry) => {
    const entryId = String(entry?._id || "").trim();
    const entrySku = String(entry?.sku || "").trim().toLowerCase();
    const entryName = String(entry?.name || "").trim().toLowerCase();

    if (variantId && entryId && entryId === variantId) return true;
    if (variantId && entrySku && entrySku === variantId.toLowerCase()) return true;
    if (variantName && entryName && entryName === variantName) return true;
    return false;
  });

  return toSafeNumber(variant?.weight, 0);
};

const resolvePackageMetrics = async (orderDoc) => {
  const products = Array.isArray(orderDoc?.products) ? orderDoc.products : [];
  if (products.length === 0) {
    return {
      package_weight: DEFAULT_PACKAGE_WEIGHT_G,
      package_length: DEFAULT_PACKAGE_DIMENSION_CM,
      package_breadth: DEFAULT_PACKAGE_DIMENSION_CM,
      package_height: DEFAULT_PACKAGE_DIMENSION_CM,
    };
  }

  const productWeightMap = await buildProductWeightMap(orderDoc);
  let totalWeight = 0;
  let maxLength = 0;
  let maxBreadth = 0;
  let maxHeight = 0;

  products.forEach((item) => {
    const quantity = Math.max(Math.round(toSafeNumber(item?.quantity, 1)), 1);
    const product = productWeightMap.get(String(item?.productId || "").trim());

    const variantWeight = resolveVariantWeight(product, item);
    const baseWeight = toSafeNumber(product?.weight, 0);
    const unitWeight =
      variantWeight > 0
        ? variantWeight
        : baseWeight > 0
          ? baseWeight
          : DEFAULT_PACKAGE_WEIGHT_G;

    totalWeight += unitWeight * quantity;

    const dimensions = product?.dimensions || {};
    maxLength = Math.max(maxLength, toSafeNumber(dimensions.length, 0));
    maxBreadth = Math.max(maxBreadth, toSafeNumber(dimensions.width, 0));
    maxHeight = Math.max(maxHeight, toSafeNumber(dimensions.height, 0));
  });

  return {
    package_weight: Math.max(Math.round(totalWeight), DEFAULT_PACKAGE_WEIGHT_G),
    package_length: Math.max(Math.round(maxLength), DEFAULT_PACKAGE_DIMENSION_CM),
    package_breadth: Math.max(Math.round(maxBreadth), DEFAULT_PACKAGE_DIMENSION_CM),
    package_height: Math.max(Math.round(maxHeight), DEFAULT_PACKAGE_DIMENSION_CM),
  };
};

const isAutoBookingEligibleStatus = (status) => {
  const normalized = normalizeOrderStatus(status);
  return [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.PAYMENT_PENDING,
    ORDER_STATUS.ACCEPTED,
    ORDER_STATUS.IN_WAREHOUSE,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERED,
  ].includes(normalized);
};

const toPlainOrderObject = (orderDoc) =>
  orderDoc && typeof orderDoc.toObject === "function"
    ? orderDoc.toObject()
    : orderDoc;

export const buildShipmentPayloadFromOrder = async ({ orderId, orderDoc = null }) => {
  const resolvedOrderId = String(orderId || orderDoc?._id || "").trim();
  if (!resolvedOrderId) {
    throw new AppError("MISSING_FIELD", { field: "orderId" });
  }

  let hydratedOrder = toPlainOrderObject(orderDoc);
  if (
    !hydratedOrder ||
    !hydratedOrder?._id ||
    !hydratedOrder?.delivery_address ||
    typeof hydratedOrder.delivery_address !== "object"
  ) {
    hydratedOrder = await OrderModel.findById(resolvedOrderId)
      .populate("delivery_address")
      .populate("user", "name email mobile")
      .lean();
  }

  if (!hydratedOrder) {
    throw new AppError("ORDER_NOT_FOUND");
  }

  const [packageMetrics, pickup] = await Promise.all([
    resolvePackageMetrics(hydratedOrder),
    resolvePickupAddress(),
  ]);

  const orderAmount = Math.max(round2(resolveOrderDisplayTotal(hydratedOrder)), 0);
  const orderItems = buildOrderItemsFromOrder(hydratedOrder);

  const shipment = {
    order_number: `#${getOrderDisplayId(hydratedOrder) || "00000000"}`,
    payment_type: "prepaid",
    order_amount: orderAmount,
    collectable_amount: 0,
    order_items:
      orderItems.length > 0
        ? orderItems
        : [
            {
              name: "Order Item",
              qty: 1,
              price: orderAmount,
              sku: `ORD-${getOrderDisplayId(hydratedOrder) || "00000000"}`,
            },
          ],
    ...packageMetrics,
    request_auto_pickup: "yes",
    consignee: resolveConsigneeAddress(hydratedOrder),
    pickup,
  };

  validatePincode(shipment?.consignee?.pincode, "consignee.pincode");
  validatePhone(shipment?.consignee?.phone, "consignee.phone");
  validatePincode(shipment?.pickup?.pincode, "pickup.pincode");
  validatePhone(shipment?.pickup?.phone, "pickup.phone");

  return {
    order: hydratedOrder,
    shipment,
  };
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

  const normalizedOrderId = String(orderId || "").trim();
  const orderAmount = Number(normalized.order_amount || 0);

  // Forward orders are always prepaid with auto-pickup enabled.
  normalized.payment_type = "prepaid";
  normalized.collectable_amount = 0;
  normalized.request_auto_pickup = "yes";

  const hasOrderItems =
    Array.isArray(normalized.order_items) && normalized.order_items.length > 0;

  if (!hasOrderItems && normalizedOrderId) {
    const orderDoc = await OrderModel.findById(normalizedOrderId)
      .select("_id products")
      .lean();
    if (orderDoc) {
      if (!normalized.order_number) {
        normalized.order_number = `#${getOrderDisplayId(orderDoc) || "00000000"}`;
      }
      normalized.order_items = buildOrderItemsFromOrder(orderDoc);
    }
  }

  if (Number.isNaN(orderAmount) || orderAmount < 0) {
    normalized.order_amount = 0;
  } else {
    normalized.order_amount = Math.max(orderAmount, 0);
  }

  return normalized;
};

const isOrderAutoBookingReady = (orderDoc) => {
  if (!orderDoc) return { ready: false, reason: "order_missing" };
  if (String(orderDoc.payment_status || "").toLowerCase() !== "paid") {
    return { ready: false, reason: "payment_not_paid" };
  }

  const normalizedStatus = normalizeOrderStatus(orderDoc.order_status);
  if (!isAutoBookingEligibleStatus(normalizedStatus)) {
    return { ready: false, reason: "status_not_eligible" };
  }

  if (String(orderDoc.awb_number || "").trim()) {
    return { ready: false, reason: "already_booked" };
  }

  return { ready: true, reason: "eligible" };
};

export const autoBookOrderShipment = async ({
  orderId,
  orderDoc = null,
  force = false,
  source = "AUTO",
} = {}) => {
  const { order, shipment } = await buildShipmentPayloadFromOrder({
    orderId,
    orderDoc,
  });

  if (!order?._id) {
    throw new AppError("ORDER_NOT_FOUND");
  }

  const readiness = isOrderAutoBookingReady(order);
  if (!force && !readiness.ready) {
    return {
      skipped: true,
      reason: readiness.reason,
      order,
      shipment: null,
      providerResponse: null,
    };
  }

  const normalizedShipment = await normalizeShipmentPayload({
    shipment,
    orderId: String(order._id),
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

  const providerResponse = await bookShipment(normalizedShipment);
  const awbNumber =
    providerResponse?.data?.awb_number ||
    providerResponse?.data?.awb ||
    providerResponse?.data?.awbNo ||
    null;
  const providerShipmentStatus =
    providerResponse?.data?.status ||
    providerResponse?.data?.shipment_status ||
    providerResponse?.status ||
    "booked";

  if (awbNumber) {
    await updateOrderShipping(
      String(order._id),
      {
        shipping_provider: "XPRESSBEES",
        awb_number: awbNumber,
        shipment_status: normalizeShipmentStatus(providerShipmentStatus),
        shipment_created_at: new Date(),
      },
      `autoBookOrderShipment:${source}`,
    );
  }

  return {
    skipped: false,
    reason: "booked",
    order,
    shipment: normalizedShipment,
    providerResponse,
  };
};

const updateOrderShipping = async (orderId, updates, context = "shipping") => {
  if (!orderId) return null;
  validateMongoId(orderId, "orderId");

  const order = await OrderModel.findByIdAndUpdate(orderId, updates, {
    new: true,
    runValidators: true,
  });

  if (!order) {
    throw new AppError("ORDER_NOT_FOUND");
  }

  syncOrderToFirestore(order, "update").catch((err) =>
    logger.error(context, "Failed to sync order to Firestore", {
      orderId,
      error: err.message,
    }),
  );

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
    if (!shipment && !orderId) {
      throw new AppError("MISSING_FIELD", {
        field: "orderId",
        message: "Provide orderId for automatic shipment booking",
      });
    }

    if (orderId) {
      const autoBooking = await autoBookOrderShipment({
        orderId,
        force: false,
        source: "MANUAL_API_CALL",
      });

      if (autoBooking?.skipped) {
        throw new AppError("INVALID_INPUT", {
          message: "Shipment booking skipped",
          reason: autoBooking.reason,
        });
      }

      return sendSuccess(res, autoBooking.providerResponse, "Shipment booked");
    }

    if (!shipment) {
      throw new AppError("MISSING_FIELD", { field: "shipment" });
    }

    if (!shipment.order_number) {
      throw new AppError("MISSING_FIELD", { field: "order_number" });
    }
    validatePaymentType(shipment.payment_type);
    if (String(shipment.payment_type || "").toLowerCase() !== "prepaid") {
      throw new AppError("INVALID_INPUT", {
        field: "payment_type",
        message: "Only prepaid shipment booking is supported",
      });
    }
    if (shipment.order_amount === undefined || shipment.order_amount === null) {
      throw new AppError("MISSING_FIELD", { field: "order_amount" });
    }

    validatePincode(shipment?.consignee?.pincode, "consignee.pincode");
    validatePhone(shipment?.consignee?.phone, "consignee.phone");
    validatePincode(shipment?.pickup?.pincode, "pickup.pincode");
    validatePhone(shipment?.pickup?.phone, "pickup.phone");

    const normalizedShipment = await normalizeShipmentPayload({
      shipment: {
        ...shipment,
        request_auto_pickup: "yes",
      },
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
      await updateOrderShipping(orderId, {
        shipping_provider: "XPRESSBEES",
        awb_number: data.data.awb_number,
        shipment_status: normalizeShipmentStatus(data.data.status),
        shipment_created_at: new Date(),
      });
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

      await updateOrderShipping(orderId, {
        shipment_status: normalizeShipmentStatus(status),
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
      await updateOrderShipping(orderId, {
        shipment_status: "cancelled",
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
