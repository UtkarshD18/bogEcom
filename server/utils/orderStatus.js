export const ORDER_STATUS = {
  PENDING: "pending",
  PAYMENT_PENDING: "pending_payment",
  ACCEPTED: "accepted",
  IN_WAREHOUSE: "in_warehouse",
  SHIPPED: "shipped",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  RTO: "rto",
  RTO_COMPLETED: "rto_completed",
  CONFIRMED_LEGACY: "confirmed",
};

const NORMALIZED_ALIAS = {
  confirmed: ORDER_STATUS.ACCEPTED,
  payment_pending: ORDER_STATUS.PAYMENT_PENDING,
  pending_payment: ORDER_STATUS.PAYMENT_PENDING,
  inwarehouse: ORDER_STATUS.IN_WAREHOUSE,
  "in-warehouse": ORDER_STATUS.IN_WAREHOUSE,
  out_for_delivery: ORDER_STATUS.OUT_FOR_DELIVERY,
  "out-for-delivery": ORDER_STATUS.OUT_FOR_DELIVERY,
  outfordelivery: ORDER_STATUS.OUT_FOR_DELIVERY,
};

export const STATUS_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [
    ORDER_STATUS.PAYMENT_PENDING,
    ORDER_STATUS.ACCEPTED,
    ORDER_STATUS.IN_WAREHOUSE,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.PAYMENT_PENDING]: [
    ORDER_STATUS.ACCEPTED,
    ORDER_STATUS.IN_WAREHOUSE,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.ACCEPTED]: [
    ORDER_STATUS.IN_WAREHOUSE,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.IN_WAREHOUSE]: [
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.SHIPPED]: [
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.RTO,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.RTO,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.COMPLETED]: [],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.RTO]: [ORDER_STATUS.RTO_COMPLETED],
  [ORDER_STATUS.RTO_COMPLETED]: [],
};

export const FINAL_STATUSES = new Set([
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.RTO_COMPLETED,
]);

export const normalizeOrderStatus = (status) => {
  if (!status) return null;
  const raw = String(status).trim().toLowerCase();
  const normalized = raw.replace(/\s+/g, "_");
  return NORMALIZED_ALIAS[normalized] || normalized;
};

export const isFinalStatus = (status) =>
  FINAL_STATUSES.has(normalizeOrderStatus(status));

export const canTransitionStatus = (fromStatus, toStatus) => {
  const from = normalizeOrderStatus(fromStatus) || ORDER_STATUS.PENDING;
  const to = normalizeOrderStatus(toStatus);
  if (!to) return false;
  if (from === to) return true;
  const allowed = STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
};

export const ensureTimeline = (order, source = "SYSTEM_INIT") => {
  if (!order) return;
  if (!Array.isArray(order.statusTimeline)) {
    order.statusTimeline = [];
  }
  if (order.statusTimeline.length === 0) {
    const currentStatus = normalizeOrderStatus(order.order_status) || ORDER_STATUS.PENDING;
    order.statusTimeline.push({
      status: currentStatus,
      source,
      timestamp: order.createdAt || new Date(),
    });
    return true;
  }
  return false;
};

export const hasTimelineStatus = (order, status) => {
  const target = normalizeOrderStatus(status);
  if (!target || !Array.isArray(order?.statusTimeline)) return false;
  return order.statusTimeline.some(
    (entry) => normalizeOrderStatus(entry?.status) === target,
  );
};

export const applyOrderStatusTransition = (
  order,
  nextStatus,
  { source = "SYSTEM", timestamp = null } = {},
) => {
  if (!order) {
    return { updated: false, reason: "missing_order" };
  }

  const currentStatus =
    normalizeOrderStatus(order.order_status) || ORDER_STATUS.PENDING;
  const targetStatus = normalizeOrderStatus(nextStatus);

  if (!targetStatus) {
    return { updated: false, reason: "invalid_status" };
  }

  const timelineInitialized = ensureTimeline(order);

  if (hasTimelineStatus(order, targetStatus)) {
    return { updated: false, reason: "duplicate_status", timelineInitialized };
  }

  if (currentStatus === targetStatus) {
    return { updated: false, reason: "same_status", timelineInitialized };
  }

  if (isFinalStatus(currentStatus)) {
    return { updated: false, reason: "final_state", timelineInitialized };
  }

  if (!canTransitionStatus(currentStatus, targetStatus)) {
    return { updated: false, reason: "invalid_transition", timelineInitialized };
  }

  order.order_status = targetStatus;
  order.statusTimeline.push({
    status: targetStatus,
    source,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
  });

  return {
    updated: true,
    previousStatus: currentStatus,
    nextStatus: targetStatus,
    timelineInitialized,
  };
};

export const normalizeExpressbeesStatus = (status) => {
  if (!status) return null;
  const raw = String(status).trim().toLowerCase();
  const compactCode = raw.toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");

  if (compactCode === "PP") return ORDER_STATUS.IN_WAREHOUSE;
  if (compactCode === "IT") return ORDER_STATUS.SHIPPED;
  if (compactCode === "EX") return ORDER_STATUS.SHIPPED;
  if (compactCode === "OFD") return ORDER_STATUS.OUT_FOR_DELIVERY;
  if (compactCode === "DL") return ORDER_STATUS.DELIVERED;
  if (compactCode === "LT" || compactCode === "DG") return "rto_initiated";
  if (compactCode === "RT") return "rto_initiated";
  if (compactCode === "RT-IT" || compactCode === "RTIT") {
    return "rto_in_transit";
  }
  if (compactCode === "RT-LT" || compactCode === "RTLT") {
    return "rto_in_transit";
  }
  if (compactCode === "RT-DG" || compactCode === "RTDG") {
    return "rto_in_transit";
  }
  if (compactCode === "RT-DL" || compactCode === "RTDL") {
    return "rto_delivered";
  }

  if (raw.includes("rto") && raw.includes("deliver")) return "rto_delivered";
  if (raw.includes("rto") && raw.includes("transit")) return "rto_in_transit";
  if (raw.includes("rto") && (raw.includes("init") || raw.includes("pickup"))) {
    return "rto_initiated";
  }
  if (raw.includes("lost") || raw.includes("damage")) return "rto_initiated";
  if (raw.includes("exception")) return ORDER_STATUS.SHIPPED;
  if (raw.includes("out for delivery") || raw.includes("out_for_delivery") || raw.includes("ofd")) {
    return ORDER_STATUS.OUT_FOR_DELIVERY;
  }
  if (raw.includes("deliver")) return ORDER_STATUS.DELIVERED;
  if (raw.includes("ship") || raw.includes("transit")) return ORDER_STATUS.SHIPPED;
  if (raw.includes("book")) return ORDER_STATUS.IN_WAREHOUSE;
  if (raw.includes("cancel")) return ORDER_STATUS.CANCELLED;

  return null;
};

export const mapExpressbeesToOrderStatus = (expressStatus) => {
  const normalized = normalizeExpressbeesStatus(expressStatus);
  if (!normalized) return null;
  if (normalized === "rto_delivered") return ORDER_STATUS.RTO_COMPLETED;
  if (normalized === "rto_in_transit" || normalized === "rto_initiated") {
    return ORDER_STATUS.RTO;
  }
  return normalized;
};

export const mapExpressbeesToShipmentStatus = (expressStatus) => {
  const normalized = normalizeExpressbeesStatus(expressStatus);
  if (!normalized) return null;
  if (normalized === ORDER_STATUS.CANCELLED) return "cancelled";
  if (normalized === ORDER_STATUS.DELIVERED) return "delivered";
  if (normalized === ORDER_STATUS.SHIPPED || normalized === ORDER_STATUS.OUT_FOR_DELIVERY) {
    return "shipped";
  }
  if (normalized === ORDER_STATUS.IN_WAREHOUSE) return "booked";
  if (normalized.startsWith("rto_")) return normalized;
  return null;
};
