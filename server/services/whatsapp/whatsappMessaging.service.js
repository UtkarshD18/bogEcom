import { randomUUID } from "node:crypto";
import CrmContact from "../../models/crmContact.model.js";
import CrmInteraction from "../../models/crmInteraction.model.js";
import { logger } from "../../utils/errorHandler.js";
import {
  buildCrmValidationError,
  normalizeObjectId,
  normalizePhone,
  sanitizeText,
} from "../crm/channelResolver.service.js";
import { captureCrmTouchpointSafely } from "../crm/crmTracking.service.js";
import {
  getWhatsappRuntimeConfig,
  getWhatsappRuntimeConfigLayers,
} from "./whatsappConfig.service.js";

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = Math.max(
  Number.parseInt(process.env.WHATSAPP_HEALTH_CHECK_TIMEOUT_MS || "3500", 10) ||
    3500,
  500,
);
const WHATSAPP_PROVIDER = "meta_cloud_api";
const WHATSAPP_SOURCE = "whatsapp_admin_api";

const normalizeStringList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) =>
        sanitizeText(entry, { maxLength: 500, allowNewLines: true }),
      )
      .filter(Boolean);
  }

  return String(value || "")
    .split(/[\n,]+/)
    .map((entry) =>
      sanitizeText(entry, { maxLength: 500, allowNewLines: true }),
    )
    .filter(Boolean);
};

const buildWhatsAppServiceError = (
  message,
  statusCode = 500,
  details = null,
) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) {
    error.details = details;
  }
  return error;
};

const resolveWhatsappConfig = async ({ forceFresh = false } = {}) =>
  getWhatsappRuntimeConfig({ forceFresh });
const resolveWhatsappConfigLayers = async ({ forceFresh = false } = {}) =>
  getWhatsappRuntimeConfigLayers({ forceFresh });

const ensureWhatsappMessagingConfig = async () => {
  const config = await resolveWhatsappConfig();
  const missing = [];

  if (!config.accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!config.phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");

  if (missing.length > 0) {
    throw buildWhatsAppServiceError(
      `WhatsApp messaging is not configured. Missing: ${missing.join(", ")}`,
      503,
      { missing },
    );
  }

  return config;
};

const buildFetchSignal = (timeoutMs = DEFAULT_TIMEOUT_MS) => {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return AbortSignal.timeout(timeoutMs);
  }

  return undefined;
};

const safeParseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const toOptionalNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildProviderErrorDetails = (data = {}) => ({
  providerCode: toOptionalNumber(data?.error?.code),
  providerType:
    sanitizeText(data?.error?.type || "", { maxLength: 80 }) || null,
  providerSubcode: toOptionalNumber(data?.error?.error_subcode),
  raw: data,
});

const isMetaAccessTokenExpired = (details = {}) =>
  Number(details?.providerCode) === 190 &&
  Number(details?.providerSubcode) === 463;

const toFriendlyProviderMessage = (providerMessage = "", details = {}) => {
  if (isMetaAccessTokenExpired(details)) {
    return "WhatsApp access token is expired. Update WHATSAPP_ACCESS_TOKEN with a fresh permanent system user token.";
  }

  return providerMessage;
};

const attachWhatsappRequestRuntime = (data, runtime = {}) => {
  if (!data || typeof data !== "object") return data;

  Object.defineProperty(data, "__runtime", {
    value: runtime,
    enumerable: false,
    configurable: true,
  });

  return data;
};

const buildTextPayload = ({
  to,
  body,
  previewUrl = false,
  replyToMessageId = "",
}) => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to,
  type: "text",
  ...(replyToMessageId ? { context: { message_id: replyToMessageId } } : {}),
  text: {
    body,
    preview_url: Boolean(previewUrl),
  },
});

const buildImagePayload = ({ to, link, caption = "" }) => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to,
  type: "image",
  image: {
    link,
    ...(caption ? { caption } : {}),
  },
});

const buildVideoPayload = ({ to, link, caption = "" }) => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to,
  type: "video",
  video: {
    link,
    ...(caption ? { caption } : {}),
  },
});

const buildDocumentPayload = ({ to, link, caption = "", filename = "" }) => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to,
  type: "document",
  document: {
    link,
    ...(caption ? { caption } : {}),
    ...(filename ? { filename } : {}),
  },
});

const buildTemplateComponents = ({
  bodyVariables = [],
  headerVariables = [],
  headerMediaType = "",
  headerMediaUrl = "",
  headerMediaFilename = "",
} = {}) => {
  const components = [];

  if (headerMediaUrl) {
    const normalizedHeaderMediaType =
      sanitizeText(headerMediaType || "", { maxLength: 20 }).toLowerCase() ||
      "image";

    components.push({
      type: "header",
      parameters: [
        {
          type: normalizedHeaderMediaType,
          [normalizedHeaderMediaType]: {
            link: headerMediaUrl,
            ...(normalizedHeaderMediaType === "document" && headerMediaFilename
              ? { filename: headerMediaFilename }
              : {}),
          },
        },
      ],
    });
  } else if (headerVariables.length > 0) {
    components.push({
      type: "header",
      parameters: headerVariables.map((value) => ({
        type: "text",
        text: value,
      })),
    });
  }

  if (bodyVariables.length > 0) {
    components.push({
      type: "body",
      parameters: bodyVariables.map((value) => ({
        type: "text",
        text: value,
      })),
    });
  }

  return components;
};

const buildTemplatePayload = ({
  to,
  templateName,
  languageCode = "en",
  bodyVariables = [],
  headerVariables = [],
  headerMediaType = "",
  headerMediaUrl = "",
  headerMediaFilename = "",
}) => {
  const components = buildTemplateComponents({
    bodyVariables,
    headerVariables,
    headerMediaType,
    headerMediaUrl,
    headerMediaFilename,
  });

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      ...(components.length > 0 ? { components } : {}),
    },
  };
};

const buildTemplateSummary = (templateName, bodyVariables = []) => {
  const variablesSummary =
    bodyVariables.length > 0 ? ` | ${bodyVariables.join(" | ")}` : "";
  return `Template: ${templateName}${variablesSummary}`;
};

const normalizeTemplateLanguageCode = (value = "", fallback = "en") => {
  const normalized = sanitizeText(value || "", { maxLength: 20 }).replaceAll(
    "-",
    "_",
  );
  return normalized || fallback;
};

const isHttpUrl = (value = "") => {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const isVideoUrl = (value = "") =>
  /\.(mp4|webm|mov)(\?.*)?$/i.test(String(value || ""));
const isGifUrl = (value = "") => /\.gif(\?.*)?$/i.test(String(value || ""));

const toCloudinaryGifMp4Url = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized || !normalized.includes("res.cloudinary.com")) return "";
  if (!isGifUrl(normalized)) return "";
  if (!normalized.includes("/upload/")) return "";

  let transformed = normalized;
  if (transformed.includes("/image/upload/")) {
    transformed = transformed.replace("/image/upload/", "/video/upload/f_mp4/");
  } else if (transformed.includes("/video/upload/")) {
    transformed = transformed.replace("/video/upload/", "/video/upload/f_mp4/");
  }

  return transformed.replace(/\.gif(\?.*)?$/i, ".mp4$1");
};

const resolveRequestedSendMode = ({
  mode = "",
  mediaType = "",
  templateName = "",
  mediaUrl = "",
} = {}) => {
  const normalizedMode = sanitizeText(mode || "", {
    maxLength: 20,
  }).toLowerCase();
  if (
    ["text", "template", "image", "gif", "document"].includes(normalizedMode)
  ) {
    return normalizedMode;
  }

  const normalizedMediaType = sanitizeText(mediaType || "", {
    maxLength: 20,
  }).toLowerCase();
  if (["image", "gif", "document"].includes(normalizedMediaType)) {
    return normalizedMediaType;
  }

  if (sanitizeText(templateName || "", { maxLength: 120 })) {
    return "template";
  }

  if (sanitizeText(mediaUrl || "", { maxLength: 1500 })) {
    return "image";
  }

  return "text";
};

const buildMediaSummary = ({ mode = "image", caption = "" } = {}) => {
  const label = mode === "gif" ? "[GIF]" : "[Image]";
  const normalizedCaption = sanitizeText(caption || "", {
    maxLength: 320,
    allowNewLines: true,
  });
  return normalizedCaption ? `${label} ${normalizedCaption}` : label;
};

const buildGifPayload = ({
  to,
  mediaUrl,
  mediaCaption = "",
  mediaFilename = "",
}) => {
  if (isVideoUrl(mediaUrl)) {
    return {
      payload: buildVideoPayload({
        to,
        link: mediaUrl,
        caption: mediaCaption,
      }),
      providerPayloadType: "video",
      resolvedMediaUrl: mediaUrl,
    };
  }

  const cloudinaryMp4 = toCloudinaryGifMp4Url(mediaUrl);
  if (cloudinaryMp4) {
    return {
      payload: buildVideoPayload({
        to,
        link: cloudinaryMp4,
        caption: mediaCaption,
      }),
      providerPayloadType: "video",
      resolvedMediaUrl: cloudinaryMp4,
    };
  }

  return {
    payload: buildDocumentPayload({
      to,
      link: mediaUrl,
      caption: mediaCaption,
      filename: mediaFilename || "animation.gif",
    }),
    providerPayloadType: "document",
    resolvedMediaUrl: mediaUrl,
  };
};

const performWhatsappRequest = async ({
  config,
  endpoint,
  method = "GET",
  payload,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  const url = `https://graph.facebook.com/${config.graphApiVersion}/${endpoint}`;

  const response = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: buildFetchSignal(timeoutMs),
  });

  const data = await safeParseJson(response);

  if (!response.ok) {
    const providerMessage = sanitizeText(
      data?.error?.message ||
        response.statusText ||
        "WhatsApp API request failed.",
      { maxLength: 400 },
    );
    const details = buildProviderErrorDetails(data);
    throw buildWhatsAppServiceError(
      toFriendlyProviderMessage(providerMessage, details),
      response.status,
      {
        ...details,
        providerMessage,
      },
    );
  }

  return data;
};

const executeWhatsappRequest = async ({
  endpoint,
  method = "GET",
  payload,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  requirePhoneNumberId = true,
}) => {
  if (typeof fetchImpl !== "function") {
    throw buildWhatsAppServiceError(
      "Fetch implementation is not available.",
      500,
    );
  }

  const configLayers = await resolveWhatsappConfigLayers();
  const config = configLayers.mergedConfig;
  const missing = [];
  if (!config.accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (requirePhoneNumberId && !config.phoneNumberId) {
    missing.push("WHATSAPP_PHONE_NUMBER_ID");
  }

  if (missing.length > 0) {
    throw buildWhatsAppServiceError(
      `WhatsApp messaging is not configured. Missing: ${missing.join(", ")}`,
      503,
      { missing },
    );
  }

  try {
    const data = await performWhatsappRequest({
      config,
      endpoint,
      method,
      payload,
      fetchImpl,
      timeoutMs,
    });

    return attachWhatsappRequestRuntime(data, {
      accessTokenSource: configLayers?.sources?.accessToken || "unknown",
    });
  } catch (error) {
    const accessTokenSource = configLayers?.sources?.accessToken || "unknown";
    error.accessTokenSource = accessTokenSource;
    error.details = {
      ...(error?.details || {}),
      accessTokenSource,
    };
    throw error;
  }
};

const countTemplatePlaceholders = (text = "") => {
  const matches = String(text || "").match(/{{\d+}}/g);
  return Array.isArray(matches) ? matches.length : 0;
};

const toPlainWhatsappTemplate = (template = {}) => {
  const components = Array.isArray(template?.components)
    ? template.components
    : [];
  const bodyComponent = components.find(
    (entry) => String(entry?.type || "").toUpperCase() === "BODY",
  );

  return {
    id: String(template?.id || ""),
    name: sanitizeText(template?.name || "", { maxLength: 120 }),
    status: sanitizeText(template?.status || "", {
      maxLength: 40,
    }).toLowerCase(),
    category: sanitizeText(template?.category || "", {
      maxLength: 40,
    }).toLowerCase(),
    language: normalizeTemplateLanguageCode(template?.language || "", ""),
    bodyVariableCount: countTemplatePlaceholders(bodyComponent?.text || ""),
    bodyPreview: sanitizeText(bodyComponent?.text || "", {
      maxLength: 220,
      allowNewLines: true,
    }),
  };
};

const normalizeMetaStatusValue = (value = "", maxLength = 80) =>
  sanitizeText(value || "", { maxLength }).toLowerCase();

const hasSenderDeliveryWarning = ({
  codeVerificationStatus = "",
  nameStatus = "",
  qualityRating = "",
  senderStatus = "",
} = {}) => {
  const flaggedCodeVerificationStates = new Set([
    "expired",
    "failed",
    "revoked",
  ]);
  const flaggedNameStates = new Set(["declined", "rejected"]);
  const flaggedQualityStates = new Set(["red"]);
  const flaggedSenderStates = new Set(["flagged", "restricted"]);

  return (
    flaggedCodeVerificationStates.has(codeVerificationStatus) ||
    flaggedNameStates.has(nameStatus) ||
    flaggedQualityStates.has(qualityRating) ||
    flaggedSenderStates.has(senderStatus)
  );
};

const findWhatsappContact = async ({ contactId = "", phone = "" }) => {
  const normalizedContactId = normalizeObjectId(contactId);
  if (normalizedContactId) {
    return CrmContact.findById(normalizedContactId).lean();
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  return CrmContact.findOne({
    phone: { $in: [normalizedPhone, normalizedPhone.replace(/^\+/, "")] },
  }).lean();
};

const recordFailedWhatsappAttempt = async ({
  contact,
  phone,
  sendMode,
  templateName,
  languageCode,
  body,
  bodyVariables,
  headerVariables,
  mediaUrl,
  mediaCaption,
  mediaFilename,
  campaignName,
  segment,
  adminUserId,
  error,
}) => {
  await captureCrmTouchpointSafely({
    userId: contact?.user || null,
    email: contact?.email || "",
    phone: contact?.phone || phone,
    name: contact?.name || "",
    channel: "whatsapp",
    eventType: "custom",
    direction: "system",
    source: WHATSAPP_SOURCE,
    eventName: "whatsapp_send_failed",
    message: sanitizeText(
      `Failed to send WhatsApp ${sendMode} message: ${
        error?.message || "Unknown provider error"
      }`,
      { maxLength: 4000, allowNewLines: true },
    ),
    happenedAt: new Date(),
    idempotencyKey: `whatsapp:send_failed:${randomUUID()}`,
    ...(campaignName
      ? {
          campaign: {
            source: WHATSAPP_SOURCE,
            medium: sendMode,
            campaign: campaignName,
            content: segment || "",
          },
        }
      : {}),
    metadata: {
      source: WHATSAPP_SOURCE,
      provider: WHATSAPP_PROVIDER,
      status: "failed",
      messageType: sendMode,
      templateName: templateName || null,
      languageCode: languageCode || null,
      bodyPreview:
        sendMode === "template"
          ? buildTemplateSummary(templateName, bodyVariables)
          : sendMode === "text"
            ? sanitizeText(body || "", { maxLength: 220, allowNewLines: true })
            : buildMediaSummary({ mode: sendMode, caption: mediaCaption }),
      bodyVariables,
      headerVariables,
      mediaUrl: mediaUrl || null,
      mediaCaption: mediaCaption || null,
      mediaFilename: mediaFilename || null,
      segment: segment || null,
      sentByAdminId: adminUserId ? String(adminUserId) : null,
    },
  });
};

export const getWhatsappMessagingConfigSummary = async () => {
  const config = await resolveWhatsappConfig();
  const missing = [];

  if (!config.accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!config.phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!config.businessAccountId) missing.push("WHATSAPP_BUSINESS_ACCOUNT_ID");
  if (!config.webhookVerifyToken) missing.push("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
  if (!config.appSecret) missing.push("WHATSAPP_APP_SECRET");

  return {
    messagingReady: Boolean(config.accessToken && config.phoneNumberId),
    templateSyncReady: Boolean(config.accessToken && config.businessAccountId),
    webhookReady: Boolean(config.webhookVerifyToken && config.appSecret),
    graphApiVersion: config.graphApiVersion,
    missing,
  };
};

export const getWhatsappMessagingHealth = async ({
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
  const configSummary = await getWhatsappMessagingConfigSummary();
  const configLayers = await resolveWhatsappConfigLayers();
  const requiredMessagingKeys = [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
  ];
  const missingMessagingKeys = requiredMessagingKeys.filter((key) =>
    configSummary.missing.includes(key),
  );

  if (!configSummary.messagingReady) {
    return {
      ok: false,
      state: "not_configured",
      message: missingMessagingKeys.length
        ? `WhatsApp messaging configuration is incomplete. Missing: ${missingMessagingKeys.join(", ")}.`
        : "WhatsApp messaging configuration is incomplete.",
      missing: missingMessagingKeys,
    };
  }

  const config = configLayers.mergedConfig;

  try {
    const data = await executeWhatsappRequest({
      endpoint:
        `${config.phoneNumberId}` +
        "?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status,status,platform_type,throughput",
      fetchImpl,
      timeoutMs,
    });
    const requestRuntime = data?.__runtime || {};

    const phoneNumberId = sanitizeText(data?.id || config.phoneNumberId || "", {
      maxLength: 80,
    });
    const displayPhoneNumber = sanitizeText(data?.display_phone_number || "", {
      maxLength: 60,
    });
    const verifiedName = sanitizeText(data?.verified_name || "", {
      maxLength: 120,
    });
    const qualityRating = normalizeMetaStatusValue(data?.quality_rating, 40);
    const codeVerificationStatus = normalizeMetaStatusValue(
      data?.code_verification_status,
      60,
    );
    const nameStatus = normalizeMetaStatusValue(data?.name_status, 60);
    const senderStatus = normalizeMetaStatusValue(data?.status, 40);
    const platformType = normalizeMetaStatusValue(data?.platform_type, 40);
    const throughputLevel = normalizeMetaStatusValue(
      data?.throughput?.level,
      40,
    );
    const senderWarning = hasSenderDeliveryWarning({
      codeVerificationStatus,
      nameStatus,
      qualityRating,
      senderStatus,
    });

    return {
      ok: true,
      state: senderWarning ? "sender_warning" : "ready",
      message: senderWarning
        ? "WhatsApp API credentials are valid, but the sender number still has Meta warnings that can block reliable delivery."
        : "WhatsApp API credentials are valid.",
      deliveryReady: !senderWarning,
      phoneNumberId,
      displayPhoneNumber,
      verifiedName,
      qualityRating,
      codeVerificationStatus,
      nameStatus,
      senderStatus,
      platformType,
      throughputLevel,
      accessTokenSource: requestRuntime.accessTokenSource || "unknown",
    };
  } catch (error) {
    const providerCode = toOptionalNumber(error?.details?.providerCode);
    const providerSubcode = toOptionalNumber(error?.details?.providerSubcode);
    const statusCode = toOptionalNumber(error?.statusCode);
    const accessTokenSource =
      sanitizeText(
        error?.accessTokenSource ||
          error?.details?.accessTokenSource ||
          configLayers?.sources?.accessToken ||
          "",
        { maxLength: 40 },
      ) || "unknown";

    let state = "auth_failed";
    if (providerCode === 190 && providerSubcode === 463) {
      state = "token_expired";
    } else if (providerCode === 190) {
      state = "invalid_token";
    } else if (statusCode === 403) {
      state = "permission_denied";
    }

    return {
      ok: false,
      state,
      message:
        sanitizeText(
          error?.message || "Unable to validate WhatsApp API credentials.",
          {
            maxLength: 320,
            allowNewLines: true,
          },
        ) || "Unable to validate WhatsApp API credentials.",
      httpStatus: statusCode,
      providerCode,
      providerSubcode,
      accessTokenSource,
    };
  }
};

const buildWhatsappHealthFallback = ({
  state = "health_check_failed",
  message = "Unable to validate WhatsApp API credentials right now.",
  timedOut = false,
} = {}) => ({
  ok: false,
  state,
  message,
  ...(timedOut ? { timedOut: true } : {}),
});

export const getWhatsappMessagingHealthSnapshot = async ({
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_HEALTH_CHECK_TIMEOUT_MS,
} = {}) => {
  const normalizedTimeoutMs = Math.max(Number(timeoutMs || 0), 0);
  const healthPromise = getWhatsappMessagingHealth({
    fetchImpl,
    ...(normalizedTimeoutMs > 0 ? { timeoutMs: normalizedTimeoutMs } : {}),
  }).catch(() => buildWhatsappHealthFallback());

  if (!normalizedTimeoutMs) {
    return healthPromise;
  }

  let timeoutId = null;

  try {
    return await Promise.race([
      healthPromise,
      new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          resolve(
            buildWhatsappHealthFallback({
              state: "health_check_timeout",
              message:
                "Live WhatsApp verification is taking longer than expected. Try refreshing in a few seconds.",
              timedOut: true,
            }),
          );
        }, normalizedTimeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const getWhatsappMessageStatus = async ({
  messageId = "",
  fetchImpl = globalThis.fetch,
} = {}) => {
  if (!messageId) throw buildWhatsAppServiceError("messageId is required", 400);
  const config = await ensureWhatsappMessagingConfig();
  try {
    // Attempt to fetch the message node directly; Graph may support GET /{messageId}
    const data = await executeWhatsappRequest({
      endpoint: `${messageId}`,
      method: "GET",
      fetchImpl,
      requirePhoneNumberId: false,
    });
    return data;
  } catch (err) {
    // Fallback: try querying messages on the phoneNumberId
    try {
      const data = await executeWhatsappRequest({
        endpoint: `${config.phoneNumberId}/messages?ids=${encodeURIComponent(messageId)}`,
        method: "GET",
        fetchImpl,
      });
      return data;
    } catch (err2) {
      throw err;
    }
  }
};

export const listApprovedWhatsappTemplates = async ({
  fetchImpl = globalThis.fetch,
} = {}) => {
  const config = await resolveWhatsappConfig();
  if (!config.accessToken || !config.businessAccountId) {
    return {
      configured: false,
      templates: [],
    };
  }

  const data = await executeWhatsappRequest({
    endpoint: `${config.businessAccountId}/message_templates?limit=200&fields=name,status,category,language,components`,
    fetchImpl,
    requirePhoneNumberId: false,
  });

  return {
    configured: true,
    templates: (Array.isArray(data?.data) ? data.data : [])
      .map(toPlainWhatsappTemplate)
      .filter((template) => template.name),
  };
};

export const sendWhatsappMessage = async ({
  contactId = "",
  to = "",
  mode = "",
  body = "",
  previewUrl = false,
  templateName = "",
  languageCode = "en",
  bodyVariables = [],
  headerVariables = [],
  templateHeaderMediaType = "",
  templateHeaderMediaUrl = "",
  templateHeaderMediaFilename = "",
  mediaType = "",
  mediaUrl = "",
  mediaCaption = "",
  mediaFilename = "",
  campaignName = "",
  segment = "",
  adminUserId = "",
  fetchImpl = globalThis.fetch,
} = {}) => {
  const normalizedTemplateName = sanitizeText(templateName || "", {
    maxLength: 120,
  });
  const normalizedBody = sanitizeText(body || "", {
    maxLength: 4000,
    allowNewLines: true,
  });
  const normalizedLanguageCode = normalizeTemplateLanguageCode(
    languageCode,
    "en",
  );
  const normalizedBodyVariables = normalizeStringList(bodyVariables);
  const normalizedHeaderVariables = normalizeStringList(headerVariables);
  const normalizedTemplateHeaderMediaType = sanitizeText(
    templateHeaderMediaType || "",
    {
      maxLength: 20,
    },
  ).toLowerCase();
  const normalizedTemplateHeaderMediaUrl = sanitizeText(
    templateHeaderMediaUrl || "",
    {
      maxLength: 1500,
    },
  );
  const normalizedTemplateHeaderMediaFilename = sanitizeText(
    templateHeaderMediaFilename || "",
    {
      maxLength: 180,
    },
  );
  const normalizedMediaUrl = sanitizeText(mediaUrl || "", { maxLength: 1500 });
  const normalizedMediaCaption = sanitizeText(mediaCaption || "", {
    maxLength: 1024,
    allowNewLines: true,
  });
  const normalizedMediaFilename = sanitizeText(mediaFilename || "", {
    maxLength: 180,
  });
  const sendMode = resolveRequestedSendMode({
    mode,
    mediaType,
    templateName: normalizedTemplateName,
    mediaUrl: normalizedMediaUrl,
  });
  const useTemplate = sendMode === "template";
  const useMedia = sendMode === "image" || sendMode === "gif";
  const useDocument = sendMode === "document";

  if (
    normalizedTemplateHeaderMediaType &&
    !["image", "video", "document"].includes(normalizedTemplateHeaderMediaType)
  ) {
    throw buildCrmValidationError(
      "templateHeaderMediaType must be image, video, or document.",
    );
  }

  if (
    normalizedTemplateHeaderMediaUrl &&
    !isHttpUrl(normalizedTemplateHeaderMediaUrl)
  ) {
    throw buildCrmValidationError(
      "templateHeaderMediaUrl must start with http:// or https:// and be publicly reachable.",
    );
  }

  if (
    normalizedTemplateHeaderMediaUrl &&
    normalizedHeaderVariables.length > 0
  ) {
    throw buildCrmValidationError(
      "Use either headerVariables (text header) or templateHeaderMediaUrl (media header), not both.",
    );
  }

  const contact = await findWhatsappContact({
    contactId,
    phone: to,
  });
  const recipientPhone = normalizePhone(to || contact?.phone || "");

  if (!recipientPhone) {
    throw buildCrmValidationError(
      "A valid customer WhatsApp phone number is required.",
    );
  }

  if (sendMode === "text" && !normalizedBody) {
    throw buildCrmValidationError(
      "Message text is required for personal WhatsApp sends.",
    );
  }

  if (useMedia && !normalizedMediaUrl) {
    throw buildCrmValidationError(
      "A public media URL is required for WhatsApp image/GIF sends.",
    );
  }
  if (useDocument && !normalizedMediaUrl) {
    throw buildCrmValidationError(
      "A public media URL is required for WhatsApp document sends.",
    );
  }

  if (useMedia && !isHttpUrl(normalizedMediaUrl)) {
    throw buildCrmValidationError(
      "WhatsApp media URL must start with http:// or https:// and be publicly reachable.",
    );
  }

  if (contact?.consent?.whatsapp === false) {
    throw buildCrmValidationError(
      "This CRM contact has WhatsApp consent disabled, so the message was blocked.",
    );
  }

  if (!useTemplate && contact?._id) {
    const hasInboundConversation = Boolean(
      await CrmInteraction.exists({
        contact: contact._id,
        channel: "whatsapp",
        direction: "inbound",
      }),
    );

    if (!hasInboundConversation && contact?.consent?.whatsapp !== true) {
      throw buildCrmValidationError(
        "Text WhatsApp replies are safest for active conversations. Use a template for first outreach or promotional messaging.",
      );
    }
  }

  const recipientForApi = recipientPhone.replace(/^\+/, "");
  let payload = null;
  let providerPayloadType = sendMode;
  let summary = normalizedBody;
  let resolvedMediaUrl = normalizedMediaUrl;

  if (useTemplate) {
    payload = buildTemplatePayload({
      to: recipientForApi,
      templateName: normalizedTemplateName,
      languageCode: normalizedLanguageCode,
      bodyVariables: normalizedBodyVariables,
      headerVariables: normalizedHeaderVariables,
      headerMediaType: normalizedTemplateHeaderMediaType,
      headerMediaUrl: normalizedTemplateHeaderMediaUrl,
      headerMediaFilename: normalizedTemplateHeaderMediaFilename,
    });
    summary = buildTemplateSummary(
      normalizedTemplateName,
      normalizedBodyVariables,
    );
  } else if (sendMode === "image") {
    payload = buildImagePayload({
      to: recipientForApi,
      link: normalizedMediaUrl,
      caption: normalizedMediaCaption,
    });
    providerPayloadType = "image";
    summary = buildMediaSummary({
      mode: "image",
      caption: normalizedMediaCaption,
    });
  } else if (sendMode === "gif") {
    const gifPayload = buildGifPayload({
      to: recipientForApi,
      mediaUrl: normalizedMediaUrl,
      mediaCaption: normalizedMediaCaption,
      mediaFilename: normalizedMediaFilename,
    });
    payload = gifPayload.payload;
    providerPayloadType = gifPayload.providerPayloadType;
    resolvedMediaUrl = gifPayload.resolvedMediaUrl;
    summary = buildMediaSummary({
      mode: "gif",
      caption: normalizedMediaCaption,
    });
  } else if (useDocument) {
    payload = buildDocumentPayload({
      to: recipientForApi,
      link: normalizedMediaUrl,
      caption: normalizedMediaCaption,
      filename: normalizedMediaFilename || "file",
    });
    providerPayloadType = "document";
    summary = buildMediaSummary({
      mode: "image",
      caption: normalizedMediaCaption,
    });
  } else {
    payload = buildTextPayload({
      to: recipientForApi,
      body: normalizedBody,
      previewUrl,
    });
    providerPayloadType = "text";
    summary = normalizedBody;
  }

  try {
    const config = await ensureWhatsappMessagingConfig();
    const data = await executeWhatsappRequest({
      endpoint: `${config.phoneNumberId}/messages`,
      method: "POST",
      payload,
      fetchImpl,
    });

    const messageId = sanitizeText(data?.messages?.[0]?.id || "", {
      maxLength: 220,
    });

    await captureCrmTouchpointSafely({
      userId: contact?.user || null,
      email: contact?.email || "",
      phone: contact?.phone || recipientPhone,
      name: contact?.name || "",
      channel: "whatsapp",
      eventType: "chat_message",
      direction: "outbound",
      source: WHATSAPP_SOURCE,
      eventName: `whatsapp_${sendMode}`,
      message: summary,
      happenedAt: new Date(),
      idempotencyKey: messageId
        ? `whatsapp:message:${messageId}`
        : `whatsapp:outbound:${randomUUID()}`,
      ...(campaignName
        ? {
            campaign: {
              source: WHATSAPP_SOURCE,
              medium: sendMode,
              campaign: campaignName,
              content: segment || "",
            },
          }
        : {}),
      metadata: {
        source: WHATSAPP_SOURCE,
        provider: WHATSAPP_PROVIDER,
        phoneNumberId: config.phoneNumberId,
        messageId: messageId || null,
        messageType: sendMode,
        providerPayloadType,
        templateName: useTemplate ? normalizedTemplateName : null,
        languageCode: useTemplate ? normalizedLanguageCode : null,
        bodyVariables: normalizedBodyVariables,
        headerVariables: normalizedHeaderVariables,
        templateHeaderMediaType: useTemplate
          ? normalizedTemplateHeaderMediaType || null
          : null,
        templateHeaderMediaUrl: useTemplate
          ? normalizedTemplateHeaderMediaUrl || null
          : null,
        templateHeaderMediaFilename: useTemplate
          ? normalizedTemplateHeaderMediaFilename || null
          : null,
        previewUrl: Boolean(previewUrl),
        mediaUrl: useMedia ? resolvedMediaUrl : null,
        mediaCaption: useMedia ? normalizedMediaCaption || null : null,
        mediaFilename: useMedia ? normalizedMediaFilename || null : null,
        segment: segment || null,
        sentByAdminId: adminUserId ? String(adminUserId) : null,
        responseContactWaId: sanitizeText(data?.contacts?.[0]?.wa_id || "", {
          maxLength: 80,
        }),
        responseInput: sanitizeText(data?.contacts?.[0]?.input || "", {
          maxLength: 80,
        }),
      },
    });

    return {
      accepted: true,
      mode: sendMode,
      to: recipientPhone,
      messageId: messageId || "",
      templateName: normalizedTemplateName || "",
      languageCode: useTemplate ? normalizedLanguageCode : "",
      mediaUrl: useMedia ? resolvedMediaUrl : "",
      mediaCaption: useMedia ? normalizedMediaCaption : "",
      contact: contact
        ? {
            id: String(contact._id),
            name: contact.name || "",
            email: contact.email || "",
            phone: contact.phone || recipientPhone,
          }
        : null,
    };
  } catch (error) {
    await recordFailedWhatsappAttempt({
      contact,
      phone: recipientPhone,
      sendMode,
      templateName: normalizedTemplateName,
      languageCode: normalizedLanguageCode,
      body: normalizedBody,
      bodyVariables: normalizedBodyVariables,
      headerVariables: normalizedHeaderVariables,
      mediaUrl: useMedia ? resolvedMediaUrl : "",
      mediaCaption: useMedia ? normalizedMediaCaption : "",
      mediaFilename: useMedia ? normalizedMediaFilename : "",
      campaignName,
      segment,
      adminUserId,
      error,
    });

    logger.error("whatsapp.send", "Failed to send WhatsApp message", {
      contactId: contact?._id ? String(contact._id) : null,
      phone: recipientPhone,
      mode: sendMode,
      templateName: normalizedTemplateName || null,
      mediaUrl: useMedia ? resolvedMediaUrl : null,
      error: error?.message || String(error),
    });

    throw error;
  }
};
