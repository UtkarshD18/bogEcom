"use client";

import { axiosClient, fetchDataFromApi, getStoredAccessToken } from "@/utils/api";

const toErrorPayload = (error, fallbackMessage) => ({
  success: false,
  message:
    error?.response?.data?.message || error?.message || fallbackMessage,
  data: error?.response?.data?.data || {},
});

export const fetchSupportOrderOptions = async () => {
  const accessToken = getStoredAccessToken();
  if (!accessToken) {
    return [];
  }

  const response = await fetchDataFromApi("/api/orders/my-orders");
  if (!response?.success) {
    return [];
  }

  const orders = Array.isArray(response.data) ? response.data : [];
  return orders
    .filter(
      (order) =>
        String(order?.order_status || "").trim().toLowerCase() === "delivered",
    )
    .map((order) => ({
      id: order?._id,
      displayId:
        order?.displayOrderId ||
        String(order?._id || "")
          .slice(0, 8)
          .toUpperCase(),
      createdAt: order?.createdAt,
    }));
};

export const createSupportTicket = async (formData) => {
  try {
    const response = await axiosClient.post("/api/support/create", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    return toErrorPayload(error, "Failed to create support ticket.");
  }
};
