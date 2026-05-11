import {
  getCrmContactTimeline,
  getCrmContacts,
  getCrmOverview,
  updateCrmContactAdmin,
} from "../services/crm/crmInsights.service.js";
import {
  getWhatsappAdminOverview,
  getWhatsappAudiencePreview,
  getWhatsappTemplateCatalog,
  sendWhatsappCampaign,
  sendWhatsappMessageToContact,
} from "../services/whatsapp/whatsappAdmin.service.js";
import {
  getWhatsappMessagingConfigSummary,
  getWhatsappMessagingHealthSnapshot,
} from "../services/whatsapp/whatsappMessaging.service.js";
import {
  getWhatsappRuntimeConfigSnapshot,
  rotateWhatsappWebhookVerifyToken,
  saveWhatsappRuntimeConfig,
} from "../services/whatsapp/whatsappConfig.service.js";

const buildErrorResponse = (res, error) => {
  const statusCode =
    Number(error?.statusCode || 0) >= 400 ? Number(error.statusCode) : 500;

  return res.status(statusCode).json({
    error: statusCode >= 400,
    success: false,
    message: error?.message || "CRM request failed.",
    ...(error?.details ? { details: error.details } : {}),
  });
};

export const getAdminCrmOverview = async (_req, res) => {
  try {
    const data = await getCrmOverview();
    return res.status(200).json({
      error: false,
      success: true,
      data,
    });
  } catch (error) {
    return buildErrorResponse(res, error);
  }
};

export const getAdminCrmContacts = async (req, res) => {
  try {
    const data = await getCrmContacts(req.query);
    return res.status(200).json({
      error: false,
      success: true,
      data,
    });
  } catch (error) {
    return buildErrorResponse(res, error);
  }
};

export const getAdminCrmContactTimeline = async (req, res) => {
  try {
    const data = await getCrmContactTimeline(req.params.contactId, req.query);
    return res.status(200).json({
      error: false,
      success: true,
      data,
    });
  } catch (error) {
    return buildErrorResponse(res, error);
  }
};

export const patchAdminCrmContact = async (req, res) => {
  try {
    const contact = await updateCrmContactAdmin(req.params.contactId, req.body);
    return res.status(200).json({
      error: false,
      success: true,
      message: "CRM contact updated successfully.",
      data: {
        contact,
      },
    });
  } catch (error) {
    return buildErrorResponse(res, error);
  }
};

export const getAdminCrmWhatsappOverview = async (_req, res) => {
  try {
    const data = await getWhatsappAdminOverview();
    return res.status(200).json({
      error: false,
      success: true,
      data,
    });
  } catch (error) {
    return buildErrorResponse(res, error);
  }
};

export const getAdminCrmWhatsappTemplates = async (_req, res) => {
  try {
    const data = await getWhatsappTemplateCatalog();
    return res.status(200).json({
      error: false,
      success: true,
      data,
    });
  } catch (error) {
    return buildErrorResponse(res, error);
  }
};

export const getAdminCrmWhatsappConfig = async (_req, res) => {
  try {
    const [configResult, summaryResult, healthResult] = await Promise.allSettled([
      getWhatsappRuntimeConfigSnapshot(),
      getWhatsappMessagingConfigSummary(),
      getWhatsappMessagingHealthSnapshot(),
    ]);

    const config =
      configResult.status === "fulfilled"
        ? configResult.value
        : {
            accessToken: "",
            phoneNumberId: "",
            businessAccountId: "",
            graphApiVersion: "v25.0",
            webhookVerifyToken: "",
            appSecret: "",
            sources: {},
            updatedAt: null,
          };
    const summary =
      summaryResult.status === "fulfilled"
        ? summaryResult.value
        : {
            messagingReady: false,
            templateSyncReady: false,
            webhookReady: false,
            graphApiVersion: config?.graphApiVersion || "v25.0",
            missing: [],
          };
    const health =
      healthResult.status === "fulfilled"
        ? healthResult.value
        : {
            ok: false,
            state: "health_check_failed",
            message:
              "Live WhatsApp verification is unavailable right now. Saved config can still be edited.",
          };

    return res.status(200).json({
      error: false,
      success: true,
      data: {
        config,
        summary,
        health,
      },
    });
  } catch (error) {
    return buildErrorResponse(res, error);
  }
};

export const putAdminCrmWhatsappConfig = async (req, res) => {
  try {
    const config = await saveWhatsappRuntimeConfig(
      req.body,
      req.user?.id || req.user?._id || req.user || null,
    );
    const [summary, health] = await Promise.all([
      getWhatsappMessagingConfigSummary(),
      getWhatsappMessagingHealthSnapshot(),
    ]);

    return res.status(200).json({
      error: false,
      success: true,
      message: "WhatsApp runtime configuration updated successfully.",
      data: {
        config,
        summary,
        health,
      },
    });
  } catch (error) {
    return buildErrorResponse(res, error);
  }
};

export const postAdminCrmWhatsappVerifyTokenGeneration = async (req, res) => {
  try {
    const result = await rotateWhatsappWebhookVerifyToken(
      req.user?.id || req.user?._id || req.user || null,
    );
    const [summary, health] = await Promise.all([
      getWhatsappMessagingConfigSummary(),
      getWhatsappMessagingHealthSnapshot(),
    ]);

    return res.status(200).json({
      error: false,
      success: true,
      message: "WhatsApp webhook verify token generated successfully.",
      data: {
        generatedToken: result.webhookVerifyToken,
        config: result.config,
        summary,
        health,
      },
    });
  } catch (error) {
    return buildErrorResponse(res, error);
  }
};

export const getAdminCrmWhatsappAudiencePreview = async (req, res) => {
  try {
    const data = await getWhatsappAudiencePreview(req.query);
    return res.status(200).json({
      error: false,
      success: true,
      data,
    });
  } catch (error) {
    return buildErrorResponse(res, error);
  }
};

export const postAdminCrmContactWhatsappMessage = async (req, res) => {
  try {
    const data = await sendWhatsappMessageToContact(
      req.params.contactId,
      req.body,
      req.user?.id || req.user || "",
    );
    return res.status(200).json({
      error: false,
      success: true,
      message: "WhatsApp message submitted successfully.",
      data,
    });
  } catch (error) {
    return buildErrorResponse(res, error);
  }
};

export const postAdminCrmWhatsappCampaign = async (req, res) => {
  try {
    const data = await sendWhatsappCampaign(req.body, req.user?.id || req.user || "");
    return res.status(200).json({
      error: false,
      success: true,
      message: "WhatsApp campaign processed.",
      data,
    });
  } catch (error) {
    return buildErrorResponse(res, error);
  }
};
