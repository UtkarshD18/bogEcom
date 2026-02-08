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
import { getShippingQuote, validateIndianPincode } from "../services/shippingRate.service.js";
import { syncOrderToFirestore } from "../utils/orderFirestoreSync.js";

const normalizeShipmentStatus = (status) => {
  if (!status) return "pending";
  const value = String(status).toLowerCase();

  if (value.includes("deliver")) return "delivered";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("ship") || value.includes("transit")) return "shipped";
  if (value.includes("book")) return "booked";

  return "pending";
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

    const data = await bookShipment(shipment);

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
        data?.data?.shipment_status ||
        data?.data?.current_status;

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
