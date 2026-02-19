import OrderModel from "../models/order.model.js";
import {
  asyncHandler,
  logger,
  sendError,
} from "../utils/errorHandler.js";
import {
  applyOrderStatusTransition,
  isFinalStatus,
  mapExpressbeesToOrderStatus,
  mapExpressbeesToShipmentStatus,
  normalizeOrderStatus,
} from "../utils/orderStatus.js";
import { syncOrderToFirestore } from "../utils/orderFirestoreSync.js";
import { emitOrderStatusUpdate } from "../realtime/orderEvents.js";

const extractPayload = (body) => {
  if (!body) return {};
  if (body.data && typeof body.data === "object") return body.data;
  if (body.payload && typeof body.payload === "object") return body.payload;
  return body;
};

const pickFirst = (...values) => values.find((value) => value !== undefined && value !== null);

const extractAwb = (payload) => {
  return pickFirst(
    payload?.awb,
    payload?.awb_number,
    payload?.waybill,
    payload?.tracking_number,
    payload?.trackingNo,
    payload?.shipment?.awb,
    payload?.shipment?.awb_number,
    payload?.shipment?.waybill,
  );
};

const extractStatus = (payload) => {
  return pickFirst(
    payload?.status,
    payload?.shipment_status,
    payload?.current_status,
    payload?.event_status,
    payload?.event,
    payload?.status_code,
    payload?.tracking_status,
    payload?.shipment?.status,
    payload?.shipment?.current_status,
  );
};

const extractTimestamp = (payload) => {
  return pickFirst(
    payload?.timestamp,
    payload?.event_time,
    payload?.event_date,
    payload?.updated_at,
    payload?.event_timestamp,
    payload?.shipment?.event_time,
    payload?.shipment?.timestamp,
  );
};

const acknowledgeWebhook = (res, state, details = {}) =>
  res.status(200).json({
    ok: true,
    state,
    ...details,
  });

export const handleExpressbeesWebhook = asyncHandler(async (req, res) => {
  try {
    const payload = extractPayload(req.body);
    const awbRaw = extractAwb(payload);
    const statusRaw = extractStatus(payload);
    const timestampRaw = extractTimestamp(payload);

    if (!awbRaw || !statusRaw) {
      logger.warn("expressbeesWebhook", "Missing awb or status", {
        awb: awbRaw || null,
        status: statusRaw || null,
      });
      return acknowledgeWebhook(res, "ignored_missing_fields");
    }

    const awb = String(awbRaw).trim();
    const order = await OrderModel.findOne({ awb_number: awb });
    if (!order) {
      logger.warn("expressbeesWebhook", "Order not found for awb", { awb });
      return acknowledgeWebhook(res, "ignored_unknown_awb");
    }

    const mappedOrderStatus = mapExpressbeesToOrderStatus(statusRaw);
    if (!mappedOrderStatus) {
      logger.warn("expressbeesWebhook", "Unknown status received", {
        awb,
        status: statusRaw,
      });
      return acknowledgeWebhook(res, "ignored_unknown_status");
    }

    if (isFinalStatus(order.order_status) && normalizeOrderStatus(order.order_status) !== mappedOrderStatus) {
      return acknowledgeWebhook(res, "ignored_final_state");
    }

    const transitionResult = applyOrderStatusTransition(order, mappedOrderStatus, {
      source: "EXPRESSBEES_WEBHOOK",
      timestamp: timestampRaw,
    });

    if (!transitionResult.updated) {
      if (transitionResult.reason === "invalid_transition") {
        return acknowledgeWebhook(res, "ignored_invalid_transition");
      }

      return acknowledgeWebhook(res, "duplicate_or_noop");
    }

    const shipmentStatus = mapExpressbeesToShipmentStatus(statusRaw);
    if (shipmentStatus) {
      order.shipment_status = shipmentStatus;
      order.shipping_provider = order.shipping_provider || "XPRESSBEES";
    }

    if (transitionResult.updated) {
      order.updatedAt = new Date();
      await order.save();

      syncOrderToFirestore(order, "update").catch((err) =>
        logger.error("expressbeesWebhook", "Failed to sync to Firestore", {
          orderId: order._id,
          error: err.message,
        }),
      );

      emitOrderStatusUpdate(order, "EXPRESSBEES_WEBHOOK");
    }

    logger.info("expressbeesWebhook", "Webhook processed", {
      source: "EXPRESSBEES_WEBHOOK",
      authMode: req.expressbeesAuthMode || null,
      orderId: order._id,
      awb,
      status: statusRaw,
      mappedStatus: mappedOrderStatus || null,
      shipmentStatus: shipmentStatus || null,
      transition: transitionResult.reason || (transitionResult.updated ? "updated" : "skipped"),
    });

    return acknowledgeWebhook(res, "processed", {
      orderId: String(order._id),
    });
  } catch (error) {
    return sendError(res, error);
  }
});
