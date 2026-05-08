/**
 * Order Firestore Sync Utility
 *
 * Mirrors order status updates to Firestore for real-time client updates.
 * MongoDB remains the source of truth, Firestore is read-only for clients.
 *
 * ARCHITECTURE:
 * - MongoDB: Source of truth for all order data
 * - Firestore: Real-time mirror of order status (read-only for clients)
 * - Sync triggers: Order creation, status updates, delivery updates
 */

import { getFirestore, isFirebaseReady } from "../config/firebaseAdmin.js";
import { normalizeOrderStatus } from "./orderStatus.js";

const ORDERS_COLLECTION = "orders";
const isProduction = process.env.NODE_ENV === "production";
const ORDER_SYNC_CACHE_TTL_MS = Math.max(
  Number.parseInt(
    String(process.env.ORDER_FIRESTORE_SYNC_CACHE_TTL_MS || "300000").trim(),
    10,
  ) || 300000,
  30000,
);
const recentOrderSyncFingerprints = new Map();
// Debug-only logging to keep production output clean
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

const isTruthy = (value) =>
  ["true", "1", "yes", "on"].includes(
    String(value || "")
      .trim()
      .toLowerCase(),
  );

const isOrderFirestoreSyncEnabled = () => {
  if (process.env.ORDER_FIRESTORE_SYNC_ENABLED === undefined) {
    return true;
  }

  return isTruthy(process.env.ORDER_FIRESTORE_SYNC_ENABLED);
};

const toIdString = (value) => {
  if (!value) return null;
  if (value && typeof value === "object" && value._id) {
    return String(value._id);
  }
  if (value && typeof value === "object" && value.id) {
    return String(value.id);
  }

  const normalized = String(value).trim();
  return normalized || null;
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toIsoOrNull = (value) => {
  const date = toDateOrNull(value);
  return date ? date.toISOString() : null;
};

const cleanupExpiredOrderSyncCache = () => {
  if (recentOrderSyncFingerprints.size === 0) return;

  const now = Date.now();
  for (const [orderId, entry] of recentOrderSyncFingerprints.entries()) {
    if (!entry || now - Number(entry.syncedAt || 0) > ORDER_SYNC_CACHE_TTL_MS) {
      recentOrderSyncFingerprints.delete(orderId);
    }
  }
};

const rememberOrderSyncFingerprint = (orderId, fingerprint) => {
  cleanupExpiredOrderSyncCache();
  recentOrderSyncFingerprints.set(orderId, {
    fingerprint,
    syncedAt: Date.now(),
  });
};

const clearOrderSyncFingerprint = (orderId) => {
  if (!orderId) return;
  recentOrderSyncFingerprints.delete(orderId);
};

const shouldSkipCachedOrderSync = (orderId, fingerprint) => {
  cleanupExpiredOrderSyncCache();
  const cached = recentOrderSyncFingerprints.get(orderId);
  if (!cached) return false;

  return (
    String(cached.fingerprint || "") === String(fingerprint || "") &&
    Date.now() - Number(cached.syncedAt || 0) <= ORDER_SYNC_CACHE_TTL_MS
  );
};

const buildComparableStatusHistory = (order) =>
  (
    order.statusTimeline?.map((entry) => ({
      status: normalizeOrderStatus(entry?.status),
      timestamp: toIsoOrNull(entry?.timestamp),
      note: String(entry?.source || "").trim() || null,
    })) ||
    order.status_history?.map((entry) => ({
      status: normalizeOrderStatus(entry?.status),
      timestamp: toIsoOrNull(entry?.timestamp),
      note: String(entry?.note || "").trim() || null,
    })) ||
    []
  ).filter(
    (entry) =>
      entry.status || entry.timestamp || entry.note,
  );

const buildComparableDelivery = (order) => ({
  estimatedDate: toIsoOrNull(order.estimatedDeliveryDate),
  trackingNumber:
    String(order.awb_number || order.trackingNumber || "")
      .trim() || null,
  carrier:
    String(order.shipping_provider || order.shippingCarrier || "")
      .trim() || null,
  labelUrl: String(order.shipping_label || "").trim() || null,
  manifestUrl: String(order.shipping_manifest || "").trim() || null,
  shipmentStatus:
    String(order.shipment_status || order.shipmentStatus || "").trim() || null,
});

export const buildComparableOrderFirestorePayload = (order = {}) => ({
  orderId:
    String(order.orderId || order._id || order.id || "")
      .trim() || null,
  userId: toIdString(order.userId || order.user),
  status: normalizeOrderStatus(order.order_status || order.status || "pending"),
  paymentStatus:
    String(order.payment_status || order.paymentStatus || "pending").trim() ||
    "pending",
  totalAmount: Number(order.totalAmt || order.totalAmount || 0) || 0,
  itemCount: Array.isArray(order.products) ? order.products.length : 0,
  statusHistory: buildComparableStatusHistory(order),
  delivery: buildComparableDelivery(order),
});

export const buildOrderFirestoreFingerprint = (payload = {}) =>
  JSON.stringify(payload);

const buildOrderFirestoreWritePayload = (order, comparablePayload) => ({
  ...comparablePayload,
  createdAt: toDateOrNull(order.createdAt) || new Date(),
  updatedAt: new Date(),
  lastSyncedAt: new Date(),
});

/**
 * Sync order to Firestore
 * @param {Object} order - The order document from MongoDB
 * @param {String} action - The action type: 'create', 'update', 'delete'
 */
export const syncOrderToFirestore = async (order, action = "update") => {
  try {
    if (!isOrderFirestoreSyncEnabled()) {
      return { success: false, reason: "order_firestore_sync_disabled" };
    }

    // Check if Firebase is configured
    if (!isFirebaseReady()) {
      // Firebase not configured, skip sync silently
      return { success: false, reason: "firebase_not_configured" };
    }

    const db = getFirestore();
    if (!db) {
      return { success: false, reason: "firestore_not_available" };
    }

    const orderId = order._id?.toString() || order.id;
    const docRef = db.collection(ORDERS_COLLECTION).doc(orderId);

    if (action === "delete") {
      await docRef.delete();
      clearOrderSyncFingerprint(orderId);
      debugLog(`[Firestore] Order ${orderId} deleted`);
      return { success: true, action: "deleted" };
    }

    const comparablePayload = buildComparableOrderFirestorePayload(order);
    const fingerprint = buildOrderFirestoreFingerprint(comparablePayload);

    if (shouldSkipCachedOrderSync(orderId, fingerprint)) {
      debugLog(`[Firestore] Order ${orderId} unchanged, skipped`);
      return { success: true, action: "skipped", reason: "unchanged" };
    }

    const firestoreData = buildOrderFirestoreWritePayload(
      order,
      comparablePayload,
    );

    if (action === "create") {
      await docRef.set(firestoreData);
      debugLog(`[Firestore] Order ${orderId} created`);
    } else {
      await docRef.set(firestoreData, { merge: true });
      debugLog(`[Firestore] Order ${orderId} updated`);
    }

    rememberOrderSyncFingerprint(orderId, fingerprint);
    return { success: true, action };
  } catch (error) {
    console.error(`[Firestore] Sync error for order:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Sync order status change
 * Lightweight sync for status-only updates
 */
export const syncOrderStatus = async (
  orderId,
  status,
  paymentStatus = null,
) => {
  try {
    if (!isOrderFirestoreSyncEnabled()) {
      return { success: false, reason: "order_firestore_sync_disabled" };
    }

    if (!isFirebaseReady()) {
      return { success: false, reason: "firebase_not_configured" };
    }

    const db = getFirestore();
    if (!db) {
      return { success: false, reason: "firestore_not_available" };
    }

    const docRef = db.collection(ORDERS_COLLECTION).doc(orderId.toString());

    const updateData = {
      status: normalizeOrderStatus(status),
      updatedAt: new Date(),
      lastSyncedAt: new Date(),
    };

    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus;
    }

    await docRef.update(updateData);
    clearOrderSyncFingerprint(orderId.toString());
    debugLog(`[Firestore] Order ${orderId} status updated to ${status}`);

    return { success: true };
  } catch (error) {
    // If document doesn't exist, that's okay (might not have been synced initially)
    if (error.code === 5) {
      debugLog(`[Firestore] Order ${orderId} not found for status update`);
      return { success: false, reason: "not_found" };
    }
    console.error(`[Firestore] Status sync error:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Batch sync multiple orders (for initial sync or recovery)
 */
export const batchSyncOrders = async (orders) => {
  try {
    if (!isOrderFirestoreSyncEnabled()) {
      return { success: false, reason: "order_firestore_sync_disabled" };
    }

    if (!isFirebaseReady()) {
      return { success: false, reason: "firebase_not_configured" };
    }

    const db = getFirestore();
    if (!db) {
      return { success: false, reason: "firestore_not_available" };
    }

    const batch = db.batch();
    let count = 0;
    const syncedFingerprints = [];

    for (const order of orders) {
      const orderId = order._id?.toString() || order.id;
      const docRef = db.collection(ORDERS_COLLECTION).doc(orderId);
      const comparablePayload = buildComparableOrderFirestorePayload(order);
      const fingerprint = buildOrderFirestoreFingerprint(comparablePayload);

      batch.set(
        docRef,
        {
          ...buildOrderFirestoreWritePayload(order, comparablePayload),
        },
        { merge: true },
      );

      syncedFingerprints.push({ orderId, fingerprint });
      count++;
    }

    await batch.commit();
    syncedFingerprints.forEach(({ orderId, fingerprint }) => {
      rememberOrderSyncFingerprint(orderId, fingerprint);
    });
    debugLog(`[Firestore] Batch synced ${count} orders`);

    return { success: true, count };
  } catch (error) {
    console.error(`[Firestore] Batch sync error:`, error.message);
    return { success: false, error: error.message };
  }
};

export default {
  syncOrderToFirestore,
  syncOrderStatus,
  batchSyncOrders,
};

export const __orderFirestoreSyncTestUtils = {
  buildComparableOrderFirestorePayload,
  buildOrderFirestoreFingerprint,
  clearOrderSyncFingerprint,
  rememberOrderSyncFingerprint,
  shouldSkipCachedOrderSync,
  cleanupExpiredOrderSyncCache,
};
