"use client";

import { firebaseApp } from "@/firebase";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";

/**
 * useOrderUpdates Hook
 *
 * Listens for real-time order status updates from Firestore.
 * MongoDB is the source of truth, Firestore is a read-only mirror.
 *
 * @param {string|null} orderId - Single order ID to watch
 * @param {string|null} userId - User ID to watch all user orders
 * @param {Object} options - Options { enabled: boolean }
 *
 * @returns {Object} { order, orders, loading, error, lastUpdate }
 */
export const useOrderUpdates = (
  orderId = null,
  userId = null,
  options = {},
) => {
  const { enabled = true } = options;

  const [order, setOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Single order listener
  useEffect(() => {
    if (!enabled || !orderId) {
      setLoading(false);
      return;
    }

    if (!firebaseApp) {
      setLoading(false);
      return;
    }

    let unsubscribe;

    try {
      const db = getFirestore(firebaseApp);
      const orderRef = doc(db, "orders", orderId);

      unsubscribe = onSnapshot(
        orderRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            setOrder({
              id: docSnapshot.id,
              ...data,
              // Convert Firestore timestamps
              createdAt: data.createdAt?.toDate?.() || data.createdAt,
              updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
            });
            setLastUpdate(new Date());
          } else {
            setOrder(null);
          }
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("[Firestore] Order listener error:", err);
          setError(err.message);
          setLoading(false);
        },
      );
    } catch (err) {
      console.error("[Firestore] Setup error:", err);
      setError(err.message);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [orderId, enabled]);

  // User orders listener
  useEffect(() => {
    if (!enabled || !userId || orderId) {
      // Skip if watching single order or disabled
      return;
    }

    if (!firebaseApp) {
      setLoading(false);
      return;
    }

    let unsubscribe;

    try {
      const db = getFirestore(firebaseApp);
      const ordersRef = collection(db, "orders");
      const userOrdersQuery = query(ordersRef, where("userId", "==", userId));

      unsubscribe = onSnapshot(
        userOrdersQuery,
        (querySnapshot) => {
          const userOrders = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            userOrders.push({
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate?.() || data.createdAt,
              updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
            });
          });
          // Sort by creation date, newest first
          userOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setOrders(userOrders);
          setLastUpdate(new Date());
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("[Firestore] Orders listener error:", err);
          setError(err.message);
          setLoading(false);
        },
      );
    } catch (err) {
      console.error("[Firestore] Setup error:", err);
      setError(err.message);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userId, orderId, enabled]);

  return {
    order,
    orders,
    loading,
    error,
    lastUpdate,
  };
};

/**
 * useOrderStatus Hook
 *
 * Simple hook to get real-time status of a single order.
 * Returns just the status string for simple UI updates.
 *
 * @param {string} orderId - The order ID to watch
 * @returns {Object} { status, paymentStatus, loading, error }
 */
export const useOrderStatus = (orderId) => {
  const { order, loading, error } = useOrderUpdates(orderId);

  return {
    status: order?.status || null,
    paymentStatus: order?.paymentStatus || null,
    loading,
    error,
    order,
  };
};

export default useOrderUpdates;
