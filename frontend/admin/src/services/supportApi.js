"use client";

import { getData, putData } from "@/utils/api";

const toQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value).trim());
    }
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
};

export const fetchSupportTickets = async ({ page, limit, filters }, token) => {
  const query = toQueryString({
    page,
    limit,
    status: filters?.status,
    email: filters?.email,
    orderId: filters?.orderId,
    dateFrom: filters?.dateFrom,
    dateTo: filters?.dateTo,
  });

  return getData(`/api/support/admin/all${query}`, token);
};

export const fetchSupportTicketById = async (ticketId, token) =>
  getData(`/api/support/admin/${ticketId}`, token);

export const updateSupportTicket = async (ticketId, payload, token) =>
  putData(`/api/support/admin/update/${ticketId}`, payload, token);

export const fetchUnresolvedSupportCount = async (token) =>
  getData("/api/support/admin/unresolved-count", token);
