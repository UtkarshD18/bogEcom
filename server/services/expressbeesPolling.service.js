import OrderModel from "../models/order.model.js";
import { trackShipment } from "./xpressbees.service.js";
import { logger } from "../utils/errorHandler.js";
import {
  applyOrderStatusTransition,
  mapExpressbeesToOrderStatus,
  mapExpressbeesToShipmentStatus,
  ORDER_STATUS,
} from "../utils/orderStatus.js";
import { syncOrderToFirestore } from "../utils/orderFirestoreSync.js";
import { emitOrderStatusUpdate } from "../realtime/orderEvents.js";

let pollingTimer = null;
let pollingInFlight = false;

const isEnabled = () => {
  const flag = process.env.XPRESSBEES_POLL_ENABLED;
  if (flag === undefined || flag === null) return false;
  return String(flag).toLowerCase() === "true";
};

const parseTrackingStatus = (data) => {
  return (
    data?.data?.status ||
    data?.data?.status_code ||
    data?.data?.shipment_status ||
    data?.data?.current_status ||
    data?.status_code ||
    data?.status ||
    null
  );
};

const getPollingConfig = () => {
  const intervalMinutes = Number(process.env.XPRESSBEES_POLL_INTERVAL_MINUTES || 15);
  const batchSize = Number(process.env.XPRESSBEES_POLL_BATCH_SIZE || 25);
  return {
    intervalMs: Math.max(intervalMinutes, 2) * 60 * 1000,
    batchSize: Math.max(batchSize, 5),
  };
};

export const pollExpressbeesTracking = async () => {
  if (pollingInFlight) return;
  pollingInFlight = true;

  try {
    const { batchSize } = getPollingConfig();

    const orders = await OrderModel.find({
      shipping_provider: "XPRESSBEES",
      awb_number: { $ne: null },
      order_status: { $nin: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED] },
    })
      .limit(batchSize);

    for (const order of orders) {
      try {
        const awb = order.awb_number;
        if (!awb) continue;

        const data = await trackShipment(awb);
        const rawStatus = parseTrackingStatus(data);
        if (!rawStatus) continue;

        const mappedOrderStatus = mapExpressbeesToOrderStatus(rawStatus);
        const transition = mappedOrderStatus
          ? applyOrderStatusTransition(order, mappedOrderStatus, {
              source: "EXPRESSBEES_POLL",
            })
          : { updated: false, reason: "no_status" };

        if (!transition.updated) {
          continue;
        }

        const shipmentStatus = mapExpressbeesToShipmentStatus(rawStatus);
        if (shipmentStatus) {
          order.shipment_status = shipmentStatus;
          order.shipping_provider = order.shipping_provider || "XPRESSBEES";
        }

        if (transition.updated) {
          order.updatedAt = new Date();
          await order.save();

          syncOrderToFirestore(order, "update").catch((err) =>
            logger.error("expressbeesPoll", "Failed to sync to Firestore", {
              orderId: order._id,
              error: err.message,
            }),
          );

          emitOrderStatusUpdate(order, "EXPRESSBEES_POLL");
        }

        logger.info("expressbeesPoll", "Tracking polled", {
          source: "EXPRESSBEES_POLL",
          orderId: order._id,
          awb,
          status: rawStatus,
          mappedStatus: mappedOrderStatus || null,
          shipmentStatus: shipmentStatus || null,
          transition: transition.reason || (transition.updated ? "updated" : "skipped"),
        });
      } catch (err) {
        logger.error("expressbeesPoll", "Tracking poll failed", {
          orderId: order?._id,
          awb: order?.awb_number,
          error: err.message,
        });
      }
    }
  } finally {
    pollingInFlight = false;
  }
};

export const startExpressbeesPolling = () => {
  if (!isEnabled()) {
    logger.info("expressbeesPoll", "Polling disabled");
    return null;
  }

  const { intervalMs } = getPollingConfig();
  pollingTimer = setInterval(pollExpressbeesTracking, intervalMs);
  logger.info("expressbeesPoll", "Polling started", { intervalMs });
  return pollingTimer;
};

export const stopExpressbeesPolling = () => {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
};
