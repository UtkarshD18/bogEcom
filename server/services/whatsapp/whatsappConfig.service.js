import mongoose from "mongoose";
import SettingsModel from "../../models/settings.model.js";

const WHATSAPP_RUNTIME_CONFIG_KEY = "whatsappRuntimeConfig";
const DEFAULT_GRAPH_API_VERSION = "v25.0";
const CACHE_TTL_MS = Math.max(
  Number.parseInt(process.env.WHATSAPP_CONFIG_CACHE_TTL_MS || "5000", 10) ||
    5000,
  0,
);

let cachedStoredRecord = null;
let cacheExpiresAt = 0;

const trimToLength = (value, maxLength) =>
  String(value || "")
    .trim()
    .slice(0, maxLength);

const normalizeStoredWhatsappRuntimeConfig = (value = {}) => {
  const source = value && typeof value === "object" ? value : {};

  return {
    accessToken: trimToLength(source.accessToken, 4000),
    phoneNumberId: trimToLength(source.phoneNumberId, 120),
    businessAccountId: trimToLength(source.businessAccountId, 120),
    graphApiVersion:
      trimToLength(source.graphApiVersion, 16) || DEFAULT_GRAPH_API_VERSION,
    webhookVerifyToken: trimToLength(source.webhookVerifyToken, 500),
    appSecret: trimToLength(source.appSecret, 500),
  };
};

const buildEmptyStoredWhatsappRuntimeConfig = () =>
  normalizeStoredWhatsappRuntimeConfig();

const buildEnvWhatsappRuntimeConfig = () => ({
  accessToken: trimToLength(process.env.WHATSAPP_ACCESS_TOKEN, 4000),
  phoneNumberId: trimToLength(process.env.WHATSAPP_PHONE_NUMBER_ID, 120),
  businessAccountId: trimToLength(
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    120,
  ),
  graphApiVersion:
    trimToLength(process.env.WHATSAPP_GRAPH_API_VERSION, 16) ||
    DEFAULT_GRAPH_API_VERSION,
  webhookVerifyToken: trimToLength(
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    500,
  ),
  appSecret: trimToLength(process.env.WHATSAPP_APP_SECRET, 500),
});

const mergeWhatsappRuntimeConfig = ({ envConfig, storedConfig }) => ({
  accessToken: storedConfig?.accessToken || envConfig.accessToken,
  phoneNumberId: storedConfig?.phoneNumberId || envConfig.phoneNumberId,
  businessAccountId:
    storedConfig?.businessAccountId || envConfig.businessAccountId,
  graphApiVersion:
    storedConfig?.graphApiVersion || envConfig.graphApiVersion,
  webhookVerifyToken:
    storedConfig?.webhookVerifyToken || envConfig.webhookVerifyToken,
  appSecret: storedConfig?.appSecret || envConfig.appSecret,
});

const buildConfigSources = ({ envConfig, storedConfig }) => ({
  accessToken: storedConfig?.accessToken
    ? "database"
    : envConfig.accessToken
      ? "environment"
      : "missing",
  phoneNumberId: storedConfig?.phoneNumberId
    ? "database"
    : envConfig.phoneNumberId
      ? "environment"
      : "missing",
  businessAccountId: storedConfig?.businessAccountId
    ? "database"
    : envConfig.businessAccountId
      ? "environment"
      : "missing",
  graphApiVersion: storedConfig?.graphApiVersion
    ? "database"
    : envConfig.graphApiVersion
      ? "environment"
      : "default",
  webhookVerifyToken: storedConfig?.webhookVerifyToken
    ? "database"
    : envConfig.webhookVerifyToken
      ? "environment"
      : "missing",
  appSecret: storedConfig?.appSecret
    ? "database"
    : envConfig.appSecret
      ? "environment"
      : "missing",
});

const readStoredWhatsappRuntimeConfig = async ({ forceFresh = false } = {}) => {
  if (!forceFresh && cachedStoredRecord && Date.now() < cacheExpiresAt) {
    return cachedStoredRecord;
  }

  if (mongoose.connection.readyState !== 1) {
    return cachedStoredRecord;
  }

  try {
    const setting = await SettingsModel.findOne({
      key: WHATSAPP_RUNTIME_CONFIG_KEY,
    })
      .select("value updatedAt updatedBy")
      .lean();

    if (!setting) {
      cachedStoredRecord = null;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return null;
    }

    cachedStoredRecord = {
      ...normalizeStoredWhatsappRuntimeConfig(setting.value),
      updatedAt: setting.updatedAt || null,
      updatedBy: setting.updatedBy || null,
    };
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return cachedStoredRecord;
  } catch {
    return cachedStoredRecord;
  }
};

export const clearWhatsappRuntimeConfigCache = () => {
  cachedStoredRecord = null;
  cacheExpiresAt = 0;
};

export const getWhatsappRuntimeConfigLayers = async ({
  forceFresh = false,
} = {}) => {
  const envConfig = buildEnvWhatsappRuntimeConfig();
  const storedConfig = await readStoredWhatsappRuntimeConfig({ forceFresh });
  const mergedConfig = mergeWhatsappRuntimeConfig({ envConfig, storedConfig });

  return {
    envConfig,
    storedConfig,
    mergedConfig,
    sources: buildConfigSources({ envConfig, storedConfig }),
  };
};

export const getWhatsappRuntimeConfig = async ({ forceFresh = false } = {}) => {
  const { mergedConfig } = await getWhatsappRuntimeConfigLayers({
    forceFresh,
  });
  return mergedConfig;
};

export const getWhatsappRuntimeConfigSnapshot = async ({
  forceFresh = false,
} = {}) => {
  const { envConfig, storedConfig, mergedConfig, sources } =
    await getWhatsappRuntimeConfigLayers({
      forceFresh,
    });
  const storedOverrides = normalizeStoredWhatsappRuntimeConfig(storedConfig);

  return {
    key: WHATSAPP_RUNTIME_CONFIG_KEY,
    ...mergedConfig,
    stored: storedConfig
      ? storedOverrides
      : buildEmptyStoredWhatsappRuntimeConfig(),
    effective: mergedConfig,
    environmentAvailable: {
      accessToken: Boolean(envConfig.accessToken),
      phoneNumberId: Boolean(envConfig.phoneNumberId),
      businessAccountId: Boolean(envConfig.businessAccountId),
      webhookVerifyToken: Boolean(envConfig.webhookVerifyToken),
      appSecret: Boolean(envConfig.appSecret),
    },
    sources,
    updatedAt: storedConfig?.updatedAt || null,
    updatedBy: storedConfig?.updatedBy || null,
  };
};

export const saveWhatsappRuntimeConfig = async (payload = {}, adminId = null) => {
  const existingStoredConfig =
    (await readStoredWhatsappRuntimeConfig({ forceFresh: true })) || {};

  const value = normalizeStoredWhatsappRuntimeConfig({
    accessToken:
      payload?.accessToken !== undefined
        ? payload.accessToken
        : existingStoredConfig.accessToken,
    phoneNumberId:
      payload?.phoneNumberId !== undefined
        ? payload.phoneNumberId
        : existingStoredConfig.phoneNumberId,
    businessAccountId:
      payload?.businessAccountId !== undefined
        ? payload.businessAccountId
        : existingStoredConfig.businessAccountId,
    graphApiVersion:
      payload?.graphApiVersion !== undefined
        ? payload.graphApiVersion
        : existingStoredConfig.graphApiVersion,
    webhookVerifyToken:
      payload?.webhookVerifyToken !== undefined
        ? payload.webhookVerifyToken
        : existingStoredConfig.webhookVerifyToken,
    appSecret:
      payload?.appSecret !== undefined
        ? payload.appSecret
        : existingStoredConfig.appSecret,
  });

  const setting = await SettingsModel.findOneAndUpdate(
    { key: WHATSAPP_RUNTIME_CONFIG_KEY },
    {
      $set: {
        value,
        description:
          "Runtime WhatsApp Cloud API credentials and webhook verification settings",
        category: "notification",
        isActive: true,
        updatedBy: adminId || null,
      },
      $setOnInsert: {
        key: WHATSAPP_RUNTIME_CONFIG_KEY,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    },
  ).lean();

  cachedStoredRecord = {
    ...normalizeStoredWhatsappRuntimeConfig(setting?.value),
    updatedAt: setting?.updatedAt || null,
    updatedBy: setting?.updatedBy || null,
  };
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  return getWhatsappRuntimeConfigSnapshot({ forceFresh: true });
};
