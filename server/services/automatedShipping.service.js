import OrderModel from "../models/order.model.js";
import { sendEmail } from "../config/emailService.js";
import { emitOrderStatusUpdate } from "../realtime/orderEvents.js";
import { bookShipment } from "./xpressbees.service.js";
import { syncOrderToFirestore } from "../utils/orderFirestoreSync.js";
import {
  applyOrderStatusTransition,
  mapExpressbeesToShipmentStatus,
  ORDER_STATUS,
} from "../utils/orderStatus.js";
import { logger } from "../utils/errorHandler.js";

const DEFAULT_PRODUCT_WEIGHT_GRAMS = 500;
const DEFAULT_PACKAGE_DIMENSION_CM = 10;

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.max(Number(ms || 0), 0));
  });

const resolveOrderDisplayId = (order) => {
  const explicit =
    order?.displayOrderId || order?.orderNumber || order?.order_id || "";
  if (String(explicit || "").trim()) {
    return String(explicit).trim().toUpperCase();
  }

  const rawOrderId = String(order?._id || "").trim();
  if (!rawOrderId) return "BOG-UNKNOWN";
  const prefix = String(process.env.XPRESSBEES_ORDER_PREFIX || "BOG")
    .trim()
    .toUpperCase();
  return `${prefix}-${rawOrderId.slice(-8).toUpperCase()}`;
};

const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(-10);
};

const normalizePincode = (value) => String(value || "").replace(/\D/g, "").slice(0, 6);

const normalizeText = (value, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const resolveAddress = (order) => {
  const delivery = order?.delivery_address || {};
  const billing = order?.billingDetails || {};
  const guest = order?.guestDetails || {};

  const name = normalizeText(
    delivery?.name || billing?.fullName || guest?.fullName || "Customer",
  );
  const phone = normalizePhone(
    delivery?.mobile || billing?.phone || guest?.phone || "",
  );
  const addressLine1 = normalizeText(
    delivery?.address_line1 || billing?.address || guest?.address || "",
  );
  const addressLine2 = normalizeText(
    delivery?.address_line2 || delivery?.landmark || "",
  );
  const city = normalizeText(delivery?.city || "");
  const state = normalizeText(delivery?.state || billing?.state || guest?.state || "");
  const pincode = normalizePincode(
    delivery?.pincode || billing?.pincode || guest?.pincode || "",
  );
  const email = normalizeText(
    billing?.email || guest?.email || order?.user?.email || "",
  ).toLowerCase();

  return {
    name,
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    pincode,
    email,
  };
};

const resolvePickupAddress = () => {
  const originPincode = normalizePincode(
    process.env.XPRESSBEES_PICKUP_PINCODE ||
      process.env.XPRESSBEES_ORIGIN_PINCODE ||
      process.env.SHIPPER_PINCODE ||
      "",
  );

  return {
    warehouse_name: normalizeText(
      process.env.XPRESSBEES_PICKUP_WAREHOUSE,
      "Primary Warehouse",
    ),
    name: normalizeText(process.env.XPRESSBEES_PICKUP_NAME, "Shipping Desk"),
    address: normalizeText(
      process.env.XPRESSBEES_PICKUP_ADDRESS1,
      "Warehouse address is not configured",
    ),
    address_2: normalizeText(process.env.XPRESSBEES_PICKUP_ADDRESS2, ""),
    city: normalizeText(process.env.XPRESSBEES_PICKUP_CITY, "Jaipur"),
    state: normalizeText(process.env.XPRESSBEES_PICKUP_STATE, "Rajasthan"),
    pincode: originPincode,
    phone: normalizePhone(process.env.XPRESSBEES_PICKUP_PHONE || ""),
  };
};

const buildOrderItems = (order) => {
  const products = Array.isArray(order?.products) ? order.products : [];
  return products
    .map((item, index) => ({
      name: normalizeText(item?.productTitle || item?.name || "Item"),
      qty: Math.max(toSafeNumber(item?.quantity, 1), 1),
      price: Math.max(toSafeNumber(item?.price, 0), 0),
      sku: normalizeText(
        item?.productId || item?.variantId || `SKU-${String(index + 1).padStart(3, "0")}`,
      ),
    }))
    .filter((item) => item.qty > 0);
};

const mapCanonicalShipmentStatus = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "pending";

  if (raw.includes("pickup")) return "pickup_scheduled";
  if (
    raw.includes("out_for_delivery") ||
    raw.includes("out for delivery") ||
    raw === "ofd"
  ) {
    return "out_for_delivery";
  }
  if (raw.includes("transit") || raw === "it" || raw.includes("shipped")) {
    return "in_transit";
  }
  if (raw.includes("deliver")) return "delivered";
  if (raw.includes("rto")) return "rto";
  if (raw.includes("cancel")) return "cancelled";
  if (raw.includes("book") || raw.includes("created")) return "shipment_created";

  const mappedLegacy = mapExpressbeesToShipmentStatus(value);
  if (mappedLegacy === "delivered") return "delivered";
  if (mappedLegacy === "cancelled") return "cancelled";
  if (mappedLegacy === "booked") return "shipment_created";
  if (mappedLegacy === "shipped") return "in_transit";
  if (mappedLegacy?.startsWith("rto_")) return "rto";

  return "pending";
};

const mapLegacyShipmentStatus = (canonical) => {
  switch (canonical) {
    case "shipment_created":
    case "pickup_scheduled":
      return "booked";
    case "in_transit":
    case "out_for_delivery":
      return "shipped";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    case "rto":
      return "rto_initiated";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
};

const buildTrackingUrl = (awb) => {
  const explicit = normalizeText(process.env.XPRESSBEES_TRACKING_BASE_URL, "");
  if (!awb) return null;
  if (!explicit) {
    return `https://www.xpressbees.com/track/${encodeURIComponent(String(awb))}`;
  }
  return `${explicit.replace(/\/+$/, "")}/${encodeURIComponent(String(awb))}`;
};

const resolveAdminAlertRecipients = () => {
  const raw = String(
    process.env.ADMIN_SHIPPING_ALERT_EMAILS ||
      process.env.SUPPORT_EMAIL ||
      process.env.EMAIL_FROM_ADDRESS ||
      process.env.SMTP_USER ||
      "",
  );
  return raw
    .split(",")
    .map((email) => String(email || "").trim().toLowerCase())
    .filter(Boolean);
};

const notifyAdminsForShipmentFailure = async ({ order, reason, attemptCount }) => {
  const recipients = resolveAdminAlertRecipients();
  if (recipients.length === 0) {
    return false;
  }

  const subject = `[Shipping Failed] ${resolveOrderDisplayId(order)}`;
  const messageLines = [
    "Automatic shipment creation failed.",
    `Order ID: ${String(order?._id || "")}`,
    `Display ID: ${resolveOrderDisplayId(order)}`,
    `Reason: ${reason || "Unknown error"}`,
    `Attempts: ${Math.max(Number(attemptCount || 0), 0)}`,
    `Time: ${new Date().toISOString()}`,
  ];

  await Promise.allSettled(
    recipients.map((to) =>
      sendEmail({
        to,
        subject,
        text: messageLines.join("\n"),
        context: "shipping_automation",
      }),
    ),
  );
  return true;
};

const parseShipmentResponse = (response) => {
  const data = response?.data || {};
  const awb =
    data?.awb_number || data?.awb || data?.waybill || data?.tracking_number || null;
  const shipmentId =
    data?.shipment_id || data?.shipmentId || data?.id || data?.reference_id || null;
  const manifestId = data?.manifest_id || data?.manifestId || null;
  const trackingUrl =
    data?.tracking_url || data?.trackingUrl || buildTrackingUrl(awb) || null;
  const rawStatus = data?.status || data?.status_code || response?.status || "booked";
  const canonicalStatus = mapCanonicalShipmentStatus(rawStatus);
  const legacyStatus = mapLegacyShipmentStatus(canonicalStatus);

  return {
    awb: awb ? String(awb).trim() : null,
    shipmentId: shipmentId ? String(shipmentId).trim() : null,
    manifestId: manifestId ? String(manifestId).trim() : null,
    trackingUrl,
    rawStatus,
    canonicalStatus,
    legacyStatus,
  };
};

const validateReadyForShipping = (order) => {
  if (!order) return { ok: false, reason: "ORDER_NOT_FOUND" };
  if (order.isDemoOrder) {
    return { ok: false, reason: "DEMO_ORDER_SHIPPING_DISABLED" };
  }
  if (String(order.payment_status || "").toLowerCase() !== "paid") {
    return { ok: false, reason: "PAYMENT_NOT_CONFIRMED" };
  }

  const existingAwb = String(order.awbNumber || order.awb_number || "").trim();
  if (existingAwb) {
    return { ok: false, reason: "ALREADY_BOOKED" };
  }

  const addr = resolveAddress(order);
  if (!addr.addressLine1 || !addr.pincode || !addr.phone) {
    return { ok: false, reason: "INCOMPLETE_SHIPPING_ADDRESS" };
  }

  const pickup = resolvePickupAddress();
  if (!pickup.pincode || !pickup.phone || !pickup.address) {
    return { ok: false, reason: "PICKUP_CONFIGURATION_MISSING" };
  }

  const orderItems = buildOrderItems(order);
  if (!orderItems.length) {
    return { ok: false, reason: "EMPTY_ORDER_ITEMS" };
  }

  return { ok: true, address: addr, pickup, orderItems };
};

const buildShipmentPayload = (order, prepared) => {
  const totalAmount = round2(
    Number(order?.finalAmount || order?.totalAmt || order?.subtotal || 0),
  );
  const paymentType =
    String(order?.payment_status || "").toLowerCase() === "paid" ? "prepaid" : "cod";
  const totalWeightGrams = prepared.orderItems.reduce(
    (sum, item) => sum + Math.max(Number(item.qty || 0), 0) * DEFAULT_PRODUCT_WEIGHT_GRAMS,
    0,
  );

  return {
    order_number: resolveOrderDisplayId(order),
    payment_type: paymentType,
    order_amount: totalAmount,
    collectable_amount: paymentType === "cod" ? totalAmount : 0,
    order_items: prepared.orderItems,
    package_weight: Math.max(totalWeightGrams, DEFAULT_PRODUCT_WEIGHT_GRAMS),
    package_length: toSafeNumber(
      process.env.XPRESSBEES_PACKAGE_LENGTH_CM,
      DEFAULT_PACKAGE_DIMENSION_CM,
    ),
    package_breadth: toSafeNumber(
      process.env.XPRESSBEES_PACKAGE_BREADTH_CM,
      DEFAULT_PACKAGE_DIMENSION_CM,
    ),
    package_height: toSafeNumber(
      process.env.XPRESSBEES_PACKAGE_HEIGHT_CM,
      DEFAULT_PACKAGE_DIMENSION_CM,
    ),
    request_auto_pickup: "yes",
    consignee: {
      name: prepared.address.name,
      address: prepared.address.addressLine1,
      address_2: prepared.address.addressLine2,
      city: prepared.address.city,
      state: prepared.address.state,
      pincode: prepared.address.pincode,
      phone: prepared.address.phone,
      email: prepared.address.email,
    },
    pickup: prepared.pickup,
  };
};

const updateOrderAfterShipmentSuccess = async ({
  order,
  shipment,
  responsePayload,
  source,
}) => {
  const now = new Date();
  order.shipping_provider = "XPRESSBEES";
  order.courierName = "Xpressbees";
  order.awb_number = shipment.awb;
  order.awbNumber = shipment.awb;
  order.shipmentId = shipment.shipmentId;
  order.manifestId = shipment.manifestId;
  order.trackingUrl = shipment.trackingUrl;
  order.shipment_status = shipment.legacyStatus;
  order.shipmentStatus = shipment.canonicalStatus;
  order.shipment_created_at = now;
  order.shipmentFailureCount = 0;
  order.shipmentLastError = "";
  order.shipping_label =
    responsePayload?.data?.label || responsePayload?.data?.label_url || order.shipping_label;
  order.shipping_manifest =
    responsePayload?.data?.manifest || responsePayload?.data?.manifest_url || order.shipping_manifest;

  applyOrderStatusTransition(order, ORDER_STATUS.IN_WAREHOUSE, {
    source,
    timestamp: now,
  });

  await order.save();

  syncOrderToFirestore(order, "update").catch((err) =>
    logger.error("autoShipping", "Failed to sync order after shipment booking", {
      orderId: order._id,
      error: err.message,
    }),
  );
  emitOrderStatusUpdate(order, source);
};

const updateOrderAfterShipmentFailure = async ({ order, reason, source, attemptCount }) => {
  order.shipment_status = "failed";
  order.shipmentStatus = "failed";
  order.shipmentFailureCount = Math.max(Number(order.shipmentFailureCount || 0), 0) + 1;
  order.shipmentLastError = String(reason || "").slice(0, 500);
  order.updatedAt = new Date();
  await order.save();

  syncOrderToFirestore(order, "update").catch((err) =>
    logger.error("autoShipping", "Failed to sync order after shipment failure", {
      orderId: order._id,
      error: err.message,
    }),
  );
  emitOrderStatusUpdate(order, source);

  await notifyAdminsForShipmentFailure({
    order,
    reason,
    attemptCount,
  });
};

const loadOrderWithRelations = async (orderOrId) => {
  const rawId =
    typeof orderOrId === "string"
      ? orderOrId
      : orderOrId?._id
        ? String(orderOrId._id)
        : null;
  if (!rawId) return null;

  return OrderModel.findById(rawId)
    .populate("user", "name email mobile")
    .populate("delivery_address")
    .populate("influencerId", "name code commissionRate")
    .exec();
};

export const syncShipmentStateOnOrder = async ({
  order,
  awb = null,
  status = null,
  manifestId = null,
  trackingUrl = null,
  shipmentId = null,
  courierName = "Xpressbees",
  source = "XPRESSBEES_WEBHOOK",
}) => {
  if (!order) return null;

  const canonicalStatus = mapCanonicalShipmentStatus(status);
  const legacyStatus = mapLegacyShipmentStatus(canonicalStatus);

  if (awb) {
    const normalizedAwb = String(awb).trim();
    order.awb_number = normalizedAwb;
    order.awbNumber = normalizedAwb;
  }

  if (shipmentId) {
    order.shipmentId = String(shipmentId).trim();
  }
  if (manifestId) {
    order.manifestId = String(manifestId).trim();
  }

  order.shipping_provider = "XPRESSBEES";
  order.courierName = courierName || "Xpressbees";
  order.shipment_status = legacyStatus;
  order.shipmentStatus = canonicalStatus;

  if (trackingUrl) {
    order.trackingUrl = String(trackingUrl).trim();
  } else if (!order.trackingUrl && (order.awbNumber || order.awb_number)) {
    order.trackingUrl = buildTrackingUrl(order.awbNumber || order.awb_number);
  }

  return {
    canonicalStatus,
    legacyStatus,
    source,
  };
};

export const autoCreateShipmentForPaidOrder = async ({
  orderId,
  source = "AUTO_SHIPPING",
}) => {
  const order = await loadOrderWithRelations(orderId);
  if (!order) {
    return { ok: false, skipped: true, reason: "ORDER_NOT_FOUND" };
  }

  const readiness = validateReadyForShipping(order);
  if (!readiness.ok) {
    logger.info("autoShipping", "Skipped auto shipment booking", {
      orderId: order._id,
      reason: readiness.reason,
      source,
    });
    return { ok: true, skipped: true, reason: readiness.reason, order };
  }

  const payload = buildShipmentPayload(order, readiness);
  const maxAttempts = Math.max(
    Number(process.env.XPRESSBEES_SHIPMENT_RETRY_ATTEMPTS || 3),
    1,
  );
  const retryDelayMs = Math.max(
    Number(process.env.XPRESSBEES_SHIPMENT_RETRY_DELAY_MS || 700),
    0,
  );

  let responsePayload = null;
  let parsedShipment = null;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      responsePayload = await bookShipment(payload);
      parsedShipment = parseShipmentResponse(responsePayload);
      if (!parsedShipment?.awb) {
        throw new Error("Xpressbees response did not contain AWB number");
      }
      await updateOrderAfterShipmentSuccess({
        order,
        shipment: parsedShipment,
        responsePayload,
        source,
      });

      logger.info("autoShipping", "Shipment auto-created successfully", {
        orderId: order._id,
        awb: parsedShipment.awb,
        shipmentId: parsedShipment.shipmentId,
        source,
      });

      return {
        ok: true,
        skipped: false,
        order,
        payload,
        response: responsePayload,
        shipment: parsedShipment,
      };
    } catch (error) {
      lastError = error;
      logger.error("autoShipping", "Shipment auto-create attempt failed", {
        orderId: order._id,
        source,
        attempt,
        maxAttempts,
        error: error?.message || String(error),
      });
      if (attempt < maxAttempts) {
        await wait(retryDelayMs * attempt);
      }
    }
  }

  await updateOrderAfterShipmentFailure({
    order,
    reason: lastError?.message || "Shipment creation failed",
    source,
    attemptCount: maxAttempts,
  });

  return {
    ok: false,
    skipped: false,
    order,
    payload,
    reason: "SHIPMENT_CREATION_FAILED",
    error: lastError,
  };
};

export default {
  autoCreateShipmentForPaidOrder,
  mapCanonicalShipmentStatus,
  mapLegacyShipmentStatus,
  syncShipmentStateOnOrder,
};
