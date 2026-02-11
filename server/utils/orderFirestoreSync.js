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
// Debug-only logging to keep production output clean
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

/**
 * Sync order to Firestore
 * @param {Object} order - The order document from MongoDB
 * @param {String} action - The action type: 'create', 'update', 'delete'
 */
export const syncOrderToFirestore = async (order, action = "update") => {
  try {
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
      debugLog(`[Firestore] Order ${orderId} deleted`);
      return { success: true, action: "deleted" };
    }

    // Prepare order data for Firestore (minimal data for real-time updates)
    const firestoreData = {
      orderId: order.orderId || orderId,
      userId: order.userId?.toString() || order.user?.toString() || null,
      status: normalizeOrderStatus(order.order_status || order.status || "pending"),
      paymentStatus: order.payment_status || order.paymentStatus || "pending",

      // Order amounts
      totalAmount: order.totalAmt || order.totalAmount || 0,
      itemCount: order.products?.length || 0,

      // Timestamps
      createdAt: order.createdAt || new Date(),
      updatedAt: new Date(),

      // Status history for tracking
      statusHistory:
        order.statusTimeline?.map((h) => ({
          status: normalizeOrderStatus(h.status),
          timestamp: h.timestamp,
          note: h.source || null,
        })) ||
        order.status_history?.map((h) => ({
          status: normalizeOrderStatus(h.status),
          timestamp: h.timestamp,
          note: h.note || null,
        })) ||
        [],

      // Delivery info
      delivery: {
        estimatedDate: order.estimatedDeliveryDate || null,
        trackingNumber: order.awb_number || order.trackingNumber || null,
        carrier: order.shipping_provider || order.shippingCarrier || null,
        labelUrl: order.shipping_label || null,
        manifestUrl: order.shipping_manifest || null,
        shipmentStatus: order.shipment_status || null,
      },

      // Metadata
      lastSyncedAt: new Date(),
    };

    if (action === "create") {
      await docRef.set(firestoreData);
      debugLog(`[Firestore] Order ${orderId} created`);
    } else {
      await docRef.set(firestoreData, { merge: true });
      debugLog(`[Firestore] Order ${orderId} updated`);
    }

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
    if (!isFirebaseReady()) {
      return { success: false, reason: "firebase_not_configured" };
    }

    const db = getFirestore();
    if (!db) {
      return { success: false, reason: "firestore_not_available" };
    }

    const batch = db.batch();
    let count = 0;

    for (const order of orders) {
      const orderId = order._id?.toString() || order.id;
      const docRef = db.collection(ORDERS_COLLECTION).doc(orderId);

      batch.set(
        docRef,
        {
          orderId: order.orderId || orderId,
          userId: order.userId?.toString() || null,
          status: order.order_status || order.status || "pending",
          paymentStatus: order.payment_status || order.paymentStatus || "pending",
          totalAmount: order.totalAmt || order.totalAmount || 0,
          itemCount: order.products?.length || 0,
          createdAt: order.createdAt || new Date(),
          updatedAt: new Date(),
          lastSyncedAt: new Date(),
        },
        { merge: true },
      );

      count++;
    }

    await batch.commit();
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
