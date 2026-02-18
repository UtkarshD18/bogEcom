"use client";

import { axiosClient, fetchDataFromApi } from "@/utils/api";

const toErrorPayload = (error, fallbackMessage) => ({
  success: false,
  message:
    error?.response?.data?.message || error?.message || fallbackMessage,
  data: error?.response?.data?.data || {},
});

export const fetchSupportOrderOptions = async () => {
  const response = await fetchDataFromApi("/api/orders/my-orders");
  if (!response?.success) {
    return [];
  }

  const orders = Array.isArray(response.data) ? response.data : [];
  return orders.map((order) => ({
    id: order?._id,
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
