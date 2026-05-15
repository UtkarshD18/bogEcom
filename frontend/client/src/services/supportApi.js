"use client";

import {
  API_BASE_URL,
  fetchDataFromApi,
  getStoredAccessToken,
  postData,
} from "@/utils/api";

const BASE_HAS_API_SUFFIX = /\/api$/i.test(String(API_BASE_URL || ""));

const normalizeApiPath = (url) => {
  const normalized = url?.startsWith("/") ? url : `/${url}`;
  if (!BASE_HAS_API_SUFFIX) return normalized;
  if (/^\/api(\/|$)/i.test(normalized)) {
    return normalized.replace(/^\/api/i, "");
  }
  return normalized;
};

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
    .filter((order) => {
      const normalizedStatus = String(order?.order_status || "")
        .trim()
        .toLowerCase();
      return normalizedStatus === "delivered" || normalizedStatus === "completed";
    })
    .map((order) => ({
      id: order?._id || order?.id || "",
      displayId:
        order?.displayOrderId ||
        String(order?._id || order?.id || "")
          .slice(0, 8)
          .toUpperCase(),
      createdAt: order?.createdAt,
    }))
    .filter((order) => Boolean(String(order.id || "").trim()));
};

export const fetchSupportOrderContext = async (orderId) => {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) {
    return { success: false, message: "Order ID is required.", data: null };
  }

  const response = await fetchDataFromApi(
    `/api/orders/${encodeURIComponent(normalizedOrderId)}`,
    {
      skipCache: true,
    },
  );

  if (!response?.success || !response?.data) {
    return {
      success: false,
      message: response?.message || "Failed to fetch order support context.",
      data: null,
    };
  }

  return {
    success: true,
    message: "Order support context fetched successfully.",
    data: response.data,
  };
};

export const createSupportTicket = async (formData) => {
  try {
    return await postData(normalizeApiPath("/api/support/create-ticket"), formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  } catch (error) {
    return toErrorPayload(error, "Failed to create support ticket.");
  }
};

export const fetchMySupportTickets = async () => {
  try {
    return await fetchDataFromApi(normalizeApiPath("/api/support/my-tickets"), {
      skipCache: true,
    });
  } catch (error) {
    return toErrorPayload(error, "Failed to fetch support tickets.");
  }
};

export const fetchMySupportTicketById = async (ticketId) => {
  const normalizedTicketId = String(ticketId || "").trim();
  if (!normalizedTicketId) {
    return { success: false, message: "Ticket ID is required.", data: null };
  }

  try {
    return await fetchDataFromApi(
      normalizeApiPath(
        `/api/support/my-tickets/${encodeURIComponent(normalizedTicketId)}`,
      ),
      { skipCache: true },
    );
  } catch (error) {
    return toErrorPayload(error, "Failed to fetch support ticket.");
  }
};

export const replyToMySupportTicket = async (ticketId, messageOrFormData) => {
  const normalizedTicketId = String(ticketId || "").trim();
  const isFormData =
    typeof FormData !== "undefined" && messageOrFormData instanceof FormData;
  const payload = isFormData ? messageOrFormData : { message: messageOrFormData };
  try {
    return await postData(
      normalizeApiPath(
        `/api/support/my-tickets/${encodeURIComponent(normalizedTicketId)}/reply`,
      ),
      payload,
      isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : {},
    );
  } catch (error) {
    return toErrorPayload(error, "Failed to send support reply.");
  }
};

export const closeMySupportTicket = async (ticketId) => {
  const normalizedTicketId = String(ticketId || "").trim();
  try {
    return await postData(
      normalizeApiPath(
        `/api/support/my-tickets/${encodeURIComponent(normalizedTicketId)}/close`,
      ),
      {},
    );
  } catch (error) {
    return toErrorPayload(error, "Failed to close support ticket.");
  }
};
