import { useEffect, useState } from "react";

/**
 * Custom hook to fetch order notifications for admin
 * Checks localStorage for pending/new orders
 */
export const useOrderNotifications = () => {
  const [notificationCount, setNotificationCount] = useState(0);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchOrderNotifications = async () => {
    try {
      setLoading(true);
      // Fetch orders from localStorage (saved from client checkout)
      const savedOrders = JSON.parse(localStorage.getItem("orders") || "[]");

      // Get admin-seen orders from sessionStorage
      const seenOrderIds = JSON.parse(
        sessionStorage.getItem("seenOrderIds") || "[]",
      );

      // Filter out seen orders
      const newOrders = savedOrders.filter(
        (order) => !seenOrderIds.includes(order.id),
      );

      setOrders(newOrders);
      setNotificationCount(newOrders.length);
    } catch (error) {
      console.error("Error fetching order notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch on mount
    fetchOrderNotifications();

    // Poll every 3 seconds
    const interval = setInterval(fetchOrderNotifications, 3000);

    return () => clearInterval(interval);
  }, []);

  const markOrderAsSeen = (orderId) => {
    try {
      const seenOrderIds = JSON.parse(
        sessionStorage.getItem("seenOrderIds") || "[]",
      );
      if (!seenOrderIds.includes(orderId)) {
        seenOrderIds.push(orderId);
        sessionStorage.setItem("seenOrderIds", JSON.stringify(seenOrderIds));
      }
      // Refetch to update count
      fetchOrderNotifications();
    } catch (error) {
      console.error("Error marking order as seen:", error);
    }
  };

  const clearAllNotifications = () => {
    try {
      const savedOrders = JSON.parse(localStorage.getItem("orders") || "[]");
      sessionStorage.setItem(
        "seenOrderIds",
        JSON.stringify(savedOrders.map((order) => order.id)),
      );
      setNotificationCount(0);
      setOrders([]);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
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
