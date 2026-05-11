"use client";

import { getData, patchData, postData, putData } from "@/utils/api";

const toQueryString = (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (String(value).trim() === "") return;
    query.set(key, String(value).trim());
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
};

export const fetchCrmOverview = async (token) =>
  getData("/api/admin/crm/overview", token);

export const fetchCrmContacts = async ({ page, limit, filters = {} }, token) => {
  const query = toQueryString({
    page,
    limit,
    q: filters.q,
    channel: filters.channel,
    lifecycleStage: filters.lifecycleStage,
    status: filters.status,
  });

  return getData(`/api/admin/crm/contacts${query}`, token);
};

export const fetchCrmContactTimeline = async (
  contactId,
  { page = 1, limit = 25 } = {},
  token,
) =>
  getData(
    `/api/admin/crm/contacts/${contactId}/timeline${toQueryString({ page, limit })}`,
    token,
  );

export const updateCrmContact = async (contactId, payload, token) =>
  patchData(`/api/admin/crm/contacts/${contactId}`, payload, token);

export const fetchCrmWhatsappOverview = async (token) =>
  getData("/api/admin/crm/whatsapp/overview", token);

export const fetchCrmWhatsappTemplates = async (token) =>
  getData("/api/admin/crm/whatsapp/templates", token);

export const fetchCrmWhatsappConfig = async (token) =>
  getData("/api/admin/crm/whatsapp/config", token);

export const saveCrmWhatsappConfig = async (payload, token) =>
  putData("/api/admin/crm/whatsapp/config", payload, token);

export const generateCrmWhatsappVerifyToken = async (token) =>
  postData("/api/admin/crm/whatsapp/config/generate-verify-token", {}, token);

export const fetchCrmWhatsappAudiencePreview = async (
  { segment = "all", inactiveDays = 45 } = {},
  token,
) =>
  getData(
    `/api/admin/crm/whatsapp/audience-preview${toQueryString({
      segment,
      inactiveDays,
    })}`,
    token,
  );

export const sendCrmWhatsappMessage = async (contactId, payload, token) =>
  postData(`/api/admin/crm/contacts/${contactId}/whatsapp/send`, payload, token);

export const sendCrmWhatsappCampaign = async (payload, token) =>
  postData("/api/admin/crm/whatsapp/campaign/send", payload, token);
