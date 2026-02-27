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
  normalizeOrderStatus,
} from "../utils/orderStatus.js";
import { syncOrderToFirestore } from "../utils/orderFirestoreSync.js";
import { emitOrderStatusUpdate } from "../realtime/orderEvents.js";
import { ensureOrderInvoice } from "./order.controller.js";
import { syncShipmentStateOnOrder } from "../services/automatedShipping.service.js";

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

const extractTrackingUrl = (payload) => {
  return pickFirst(
    payload?.tracking_url,
    payload?.trackingUrl,
    payload?.shipment?.tracking_url,
    payload?.shipment?.trackingUrl,
    payload?.data?.tracking_url,
  );
};

const extractShipmentId = (payload) => {
  return pickFirst(
    payload?.shipment_id,
    payload?.shipmentId,
    payload?.id,
    payload?.shipment?.shipment_id,
    payload?.shipment?.shipmentId,
  );
};

const extractManifestId = (payload) => {
  return pickFirst(
    payload?.manifest_id,
    payload?.manifestId,
    payload?.shipment?.manifest_id,
    payload?.shipment?.manifestId,
    payload?.manifest,
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
    const trackingUrlRaw = extractTrackingUrl(payload);
    const shipmentIdRaw = extractShipmentId(payload);
    const manifestIdRaw = extractManifestId(payload);

    if (!awbRaw || !statusRaw) {
      logger.warn("expressbeesWebhook", "Missing awb or status", {
        awb: awbRaw || null,
        status: statusRaw || null,
      });
      return acknowledgeWebhook(res, "ignored_missing_fields");
    }

    const awb = String(awbRaw).trim();
    const order = await OrderModel.findOne({
      $or: [{ awb_number: awb }, { awbNumber: awb }],
    });
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

    const normalizedExistingOrderStatus = normalizeOrderStatus(order.order_status);
    const isFinalStateLocked =
      isFinalStatus(order.order_status) &&
      normalizedExistingOrderStatus !== mappedOrderStatus;
    const transitionResult = isFinalStateLocked
      ? { updated: false, reason: "final_state_locked" }
      : applyOrderStatusTransition(order, mappedOrderStatus, {
          source: "EXPRESSBEES_WEBHOOK",
          timestamp: timestampRaw,
        });

    const previousShipmentSnapshot = {
      awb_number: order.awb_number || null,
      awbNumber: order.awbNumber || null,
      shipment_status: order.shipment_status || null,
      shipmentStatus: order.shipmentStatus || null,
      trackingUrl: order.trackingUrl || null,
      manifestId: order.manifestId || null,
      shipmentId: order.shipmentId || null,
      courierName: order.courierName || null,
    };

    const shipmentSync = await syncShipmentStateOnOrder({
      order,
      awb,
      status: statusRaw,
      manifestId: manifestIdRaw,
      trackingUrl: trackingUrlRaw,
      shipmentId: shipmentIdRaw,
      source: "XPRESSBEES_WEBHOOK",
    });

    const shipmentChanged =
      previousShipmentSnapshot.awb_number !== (order.awb_number || null) ||
      previousShipmentSnapshot.awbNumber !== (order.awbNumber || null) ||
      previousShipmentSnapshot.shipment_status !== (order.shipment_status || null) ||
      previousShipmentSnapshot.shipmentStatus !== (order.shipmentStatus || null) ||
      previousShipmentSnapshot.trackingUrl !== (order.trackingUrl || null) ||
      previousShipmentSnapshot.manifestId !== (order.manifestId || null) ||
      previousShipmentSnapshot.shipmentId !== (order.shipmentId || null) ||
      previousShipmentSnapshot.courierName !== (order.courierName || null);

    if (!transitionResult.updated && !shipmentChanged) {
      if (transitionResult.reason === "invalid_transition") {
        return acknowledgeWebhook(res, "ignored_invalid_transition");
      }
      if (transitionResult.reason === "final_state_locked") {
        return acknowledgeWebhook(res, "ignored_final_state");
      }
      return acknowledgeWebhook(res, "duplicate_or_noop");
    }

    let deliveryDateChanged = false;
    if (
      ["delivered", "completed"].includes(normalizeOrderStatus(order.order_status)) &&
      !order.deliveryDate
    ) {
      order.deliveryDate = new Date();
      deliveryDateChanged = true;
    }

    if (transitionResult.updated || shipmentChanged || deliveryDateChanged) {
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

    if (
      ["delivered", "completed"].includes(normalizeOrderStatus(order.order_status)) &&
      !order.isInvoiceGenerated
    ) {
      ensureOrderInvoice(order).catch((err) =>
        logger.error("expressbeesWebhook", "Failed to auto-generate invoice", {
          orderId: order._id,
          awb,
          error: err.message,
        }),
      );
    }

    logger.info("expressbeesWebhook", "Webhook processed", {
      source: "EXPRESSBEES_WEBHOOK",
      authMode: req.expressbeesAuthMode || null,
      orderId: order._id,
      awb,
      status: statusRaw,
      mappedStatus: mappedOrderStatus || null,
      shipmentStatus: shipmentSync?.canonicalStatus || order.shipmentStatus || null,
      transition: transitionResult.reason || (transitionResult.updated ? "updated" : "skipped"),
    });

    return acknowledgeWebhook(res, "processed", {
      orderId: String(order._id),
    });
  } catch (error) {
    return sendError(res, error);
  }
});
