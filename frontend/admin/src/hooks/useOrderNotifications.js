import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { getData } from "@/utils/api";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

const SEEN_STORAGE_KEY = "hog_admin_seen_order_ids";

const safeParse = (value, fallback = []) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getSeenIds = () => {
  if (typeof window === "undefined") return [];
  return safeParse(sessionStorage.getItem(SEEN_STORAGE_KEY) || "[]", []);
};

const setSeenIds = (ids) => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(ids));
};

const toOrderId = (value) => String(value || "").trim();

const normalizeOrder = (order = {}) => {
  const id = toOrderId(order?._id || order?.orderId || order?.id);
  if (!id) return null;

  const displayId = String(
    order?.displayOrderId ||
      order?.orderNumber ||
      (id ? `BOG-${id.slice(-8).toUpperCase()}` : "N/A"),
  ).trim();

  const total = Number(
    order?.displayTotal ??
      order?.finalAmount ??
      order?.totalAmt ??
      order?.total ??
      0,
  );

  return {
    id,
    displayId,
    total,
    status: String(order?.order_status || order?.status || "").trim(),
    createdAt: order?.createdAt || order?.updatedAt || new Date().toISOString(),
    customerName:
      order?.customerName ||
      order?.user?.name ||
      order?.guestDetails?.fullName ||
      order?.billingDetails?.fullName ||
      "Guest",
  };
};

/**
 * Custom hook to fetch order notifications for admin
 * Uses real-time socket events + API refresh for accuracy
 */
export const useOrderNotifications = () => {
  const { token } = useAdmin();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const notificationCount = useMemo(() => orders.length, [orders.length]);

  const applyOrders = useCallback((incoming = []) => {
    const seenSet = new Set(getSeenIds());
    const merged = new Map();

    incoming.forEach((order) => {
      const normalized = normalizeOrder(order);
      if (!normalized || seenSet.has(normalized.id)) return;
      merged.set(normalized.id, normalized);
    });

    setOrders((prev) => {
      prev.forEach((order) => {
        if (!order?.id || seenSet.has(order.id)) return;
        if (!merged.has(order.id)) {
          merged.set(order.id, order);
        }
      });

      const next = Array.from(merged.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return next;
    });
  }, []);

  const fetchOrderNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await getData("/api/orders/admin/dashboard-stats", token);
      if (response?.success) {
        const recentOrders = Array.isArray(response?.data?.recentOrders)
          ? response.data.recentOrders
          : [];
        applyOrders(recentOrders);
      }
    } catch (error) {
      console.error("Error fetching order notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [applyOrders, token]);

  const { trigger: triggerRefresh } = useLiveRefresh(fetchOrderNotifications, {
    minIntervalMs: 1500,
    fallbackIntervalMs: 60000,
  });

  useEffect(() => {
    if (token) {
      fetchOrderNotifications();
    }
  }, [fetchOrderNotifications, token]);

  const handleOrderUpdate = useCallback(
    (payload) => {
      const normalized = normalizeOrder(payload);
      if (!normalized) return;
      const seenSet = new Set(getSeenIds());
      if (seenSet.has(normalized.id)) return;

      setOrders((prev) => {
        const exists = prev.some((order) => order.id === normalized.id);
        if (exists) return prev;
        return [normalized, ...prev].slice(0, 20);
      });

      triggerRefresh();
    },
    [triggerRefresh],
  );

  useAdminRealtime({ token, onOrderUpdate: handleOrderUpdate });

  const markOrderAsSeen = (orderId) => {
    const id = toOrderId(orderId);
    if (!id) return;

    const seen = new Set(getSeenIds());
    if (!seen.has(id)) {
      seen.add(id);
      setSeenIds(Array.from(seen));
    }

    setOrders((prev) => prev.filter((order) => order.id !== id));
  };

  const clearAllNotifications = () => {
    const seen = new Set(getSeenIds());
    orders.forEach((order) => {
      if (order?.id) {
        seen.add(order.id);
      }
    });
    setSeenIds(Array.from(seen));
    setOrders([]);
  };

  return {
    notificationCount,
    orders,
    loading,
    markOrderAsSeen,
    clearAllNotifications,
    refetch: fetchOrderNotifications,
  };
};
