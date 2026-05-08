import OrderModel from "../models/order.model.js";
import { releaseInventory } from "./inventory.service.js";
import { releaseComboStock } from "./combos/combo.service.js";
import { logger } from "../utils/errorHandler.js";
import { runWithBackgroundJobLease } from "../utils/backgroundJobLease.js";

let reservationTimer = null;
let reservationInFlight = false;
const reservationExpiryListeners = new Set();

const DEFAULT_RESERVATION_INTERVAL_SECONDS = 30;
const DEFAULT_RESERVATION_BATCH_SIZE = 100;

const isFalsy = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["false", "0", "no", "off"].includes(normalized);
};

const resolveIntervalMs = () => {
  const intervalSeconds = Number(
    process.env.INVENTORY_RESERVATION_INTERVAL_SECONDS,
  );
  if (Number.isFinite(intervalSeconds) && intervalSeconds > 0) {
    return intervalSeconds * 1000;
  }

  const intervalMinutes = Number(
    process.env.INVENTORY_RESERVATION_INTERVAL_MINUTES,
  );
  if (Number.isFinite(intervalMinutes) && intervalMinutes > 0) {
    return intervalMinutes * 60 * 1000;
  }

  return DEFAULT_RESERVATION_INTERVAL_SECONDS * 1000;
};

const isEnabled = () => {
  const flag = process.env.INVENTORY_RESERVATION_ENABLED;
  if (flag === undefined || flag === null || String(flag).trim() === "") {
    return true;
  }
  return !isFalsy(flag);
};

const getConfig = () => {
  const batchSize = Number(
    process.env.INVENTORY_RESERVATION_BATCH_SIZE ||
      DEFAULT_RESERVATION_BATCH_SIZE,
  );
  return {
    intervalMs: Math.max(Math.round(resolveIntervalMs()), 5_000),
    batchSize: Math.max(batchSize, 10),
  };
};

const isReservationExpired = (order, now = new Date()) => {
  const expiry = order?.reservationExpiresAt
    ? new Date(order.reservationExpiresAt)
    : null;
  if (!expiry || Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() <= now.getTime();
};

export const registerReservationExpiryListener = (listener) => {
  if (typeof listener !== "function") {
    return () => {};
  }

  reservationExpiryListeners.add(listener);
  return () => {
    reservationExpiryListeners.delete(listener);
  };
};

const notifyReservationExpired = async (order, context = {}) => {
  if (reservationExpiryListeners.size === 0) return;

  for (const listener of reservationExpiryListeners) {
    try {
      await listener(order, context);
    } catch (error) {
      logger.error(
        "reservationExpiry",
        "Reservation expiry listener failed",
        {
          orderId: order?._id,
          error: error?.message || String(error),
        },
      );
    }
  }
};

export const expireOrderReservation = async (
  order,
  { now = new Date(), source = "RESERVATION_EXPIRED" } = {},
) => {
  if (!order) return { status: "noop", reason: "missing_order" };

  const isPaid =
    String(order.payment_status || "")
      .trim()
      .toLowerCase() === "paid";
  if (isPaid) return { status: "noop", reason: "already_paid" };

  const inventoryStatus = String(order.inventoryStatus || "")
    .trim()
    .toLowerCase();
  if (inventoryStatus !== "reserved") {
    return { status: "noop", reason: "not_reserved" };
  }

  if (!isReservationExpired(order, now)) {
    return { status: "noop", reason: "not_expired" };
  }

  const inventoryRelease = await releaseInventory(order, source);
  if (inventoryRelease.status !== "released") {
    return { status: "noop", reason: inventoryRelease.reason || "not_released" };
  }

  try {
    await releaseComboStock(order, source);
  } catch (comboReleaseError) {
    logger.error("reservationExpiry", "Failed to release combo reservation", {
      orderId: order?._id,
      error: comboReleaseError?.message,
    });
  }

  order.reservationExpiresAt = null;
  order.updatedAt = new Date();

  if (order?._id) {
    await OrderModel.updateOne(
      { _id: order._id },
      {
        $set: {
          inventoryStatus: order.inventoryStatus,
          inventoryUpdatedAt: order.inventoryUpdatedAt,
          inventorySource: order.inventorySource,
          reservationExpiresAt: null,
          updatedAt: order.updatedAt,
        },
      },
    );
  }

  await notifyReservationExpired(order, { now, source });

  return { status: "released" };
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
      .select("inventoryStatus reservationExpiresAt payment_status order_status products combos")
      .limit(batchSize);

    for (const order of orders) {
      try {
        const result = await expireOrderReservation(order, {
          now,
          source: "RESERVATION_EXPIRED",
        });
        if (result.status === "released") {
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

  if (reservationTimer) {
    return reservationTimer;
  }

  const { intervalMs } = getConfig();
  const runScheduledJob = () =>
    runWithBackgroundJobLease({
      jobKey: "inventory-reservation-expiry",
      intervalMs,
      task: releaseExpiredReservations,
    }).catch((error) => {
      logger.error(
        "reservationExpiry",
        "Failed reservation expiry lease coordination",
        {
          error: error?.message,
        },
      );
    });

  runScheduledJob().catch((error) => {
    logger.error(
      "reservationExpiry",
      "Failed initial reservation expiry cleanup",
      {
        error: error?.message,
      },
    );
  });

  reservationTimer = setInterval(runScheduledJob, intervalMs);
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
