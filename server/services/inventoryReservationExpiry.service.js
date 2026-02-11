import OrderModel from "../models/order.model.js";
import { releaseInventory } from "./inventory.service.js";
import { logger } from "../utils/errorHandler.js";

let reservationTimer = null;
let reservationInFlight = false;

const isEnabled = () => {
  const flag = process.env.INVENTORY_RESERVATION_ENABLED;
  if (flag === undefined || flag === null) return false;
  return String(flag).toLowerCase() === "true";
};

const getConfig = () => {
  const intervalMinutes = Number(
    process.env.INVENTORY_RESERVATION_INTERVAL_MINUTES || 5,
  );
  const batchSize = Number(
    process.env.INVENTORY_RESERVATION_BATCH_SIZE || 50,
  );
  return {
    intervalMs: Math.max(intervalMinutes, 1) * 60 * 1000,
    batchSize: Math.max(batchSize, 10),
  };
};

export const releaseExpiredReservations = async () => {
  if (reservationInFlight) return;
  reservationInFlight = true;

  try {
    const now = new Date();
    const { batchSize } = getConfig();

    const orders = await OrderModel.find({
      inventoryStatus: "reserved",
      reservationExpiresAt: { $ne: null, $lte: now },
      payment_status: { $ne: "paid" },
      order_status: { $nin: ["delivered", "cancelled"] },
    })
      .limit(batchSize);

    for (const order of orders) {
      try {
        const result = await releaseInventory(order, "RESERVATION_EXPIRED");
        if (result.status === "released") {
          order.reservationExpiresAt = null;
          await order.save();
          logger.info("reservationExpiry", "Reservation expired", {
            orderId: order._id,
          });
        }
      } catch (error) {
        logger.error("reservationExpiry", "Failed to release reservation", {
          orderId: order?._id,
          error: error?.message,
        });
      }
    }
  } finally {
    reservationInFlight = false;
  }
};

export const startInventoryReservationExpiryJob = () => {
  if (!isEnabled()) {
    logger.info("reservationExpiry", "Reservation expiry job disabled");
    return null;
  }

  const { intervalMs } = getConfig();
  reservationTimer = setInterval(releaseExpiredReservations, intervalMs);
  logger.info("reservationExpiry", "Reservation expiry job started", {
    intervalMs,
  });
  return reservationTimer;
};

export const stopInventoryReservationExpiryJob = () => {
  if (reservationTimer) {
    clearInterval(reservationTimer);
    reservationTimer = null;
  }
};
