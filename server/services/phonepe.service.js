const DEFAULT_PHONEPE_UAT_BASE_URL = "https://api-preprod.phonepe.com/apis";
const DEFAULT_PHONEPE_PROD_BASE_URL = "https://api.phonepe.com/apis";

const normalizeBaseUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const getPhonePeBaseUrl = () => {
  const custom = normalizeBaseUrl(process.env.PHONEPE_BASE_URL);
  if (custom) return custom;

  const env = String(process.env.PHONEPE_ENV || "PROD")
    .trim()
    .toUpperCase();
  return env === "PROD"
    ? DEFAULT_PHONEPE_PROD_BASE_URL
    : DEFAULT_PHONEPE_UAT_BASE_URL;
};

const getPhonePeCredentials = () => {
  const clientId = String(process.env.PHONEPE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.PHONEPE_CLIENT_SECRET || "").trim();
  const clientVersion =
    String(process.env.PHONEPE_CLIENT_VERSION || "1").trim() || "1";

  if (!clientId || !clientSecret) {
    throw new Error(
      "PhonePe credentials missing. Set PHONEPE_CLIENT_ID and PHONEPE_CLIENT_SECRET.",
    );
  }

  return { clientId, clientSecret, clientVersion };
};

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

let cachedAccessToken = "";
let cachedAccessTokenExpiry = 0;

const getPhonePeAccessToken = async () => {
  const now = Date.now();
  if (
    cachedAccessToken &&
    Number.isFinite(cachedAccessTokenExpiry) &&
    cachedAccessTokenExpiry - now > 30 * 1000
  ) {
    return cachedAccessToken;
  }

  const { clientId, clientSecret, clientVersion } = getPhonePeCredentials();
  const baseUrl = getPhonePeBaseUrl();
  const endpoint = `${baseUrl}/identity-manager/v1/oauth/token`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_version: clientVersion,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }).toString(),
  });
  const data = await parseJsonSafely(response);
  const token = String(data?.access_token || "").trim();

  if (!response.ok || !token) {
    const message =
      data?.message ||
      data?.error_description ||
      data?.error ||
      `HTTP_${response.status}`;
    throw new Error(`PhonePe token fetch failed: ${message}`);
  }

  const expiresInSeconds = Number(data?.expires_in || 0);
  cachedAccessToken = token;
  cachedAccessTokenExpiry =
    now + (Number.isFinite(expiresInSeconds) ? expiresInSeconds * 1000 : 0);

  return token;
};

const normalizePhonePeState = (payload = {}) =>
  String(payload?.state || payload?.status || "")
    .trim()
    .toUpperCase();

export const createPhonePePayment = async ({
  amount,
  merchantOrderId,
  redirectUrl,
  callbackUrl,
  customerId = "guest",
  message = "Secure order payment",
}) => {
  const baseUrl = getPhonePeBaseUrl();
  const token = await getPhonePeAccessToken();

  const normalizedMerchantOrderId = String(merchantOrderId || "").trim();
  const normalizedRedirectUrl = String(redirectUrl || "").trim();
  const normalizedCallbackUrl = String(callbackUrl || "").trim();

  if (!normalizedMerchantOrderId) {
    throw new Error("PhonePe merchantOrderId is required");
  }
  if (!normalizedRedirectUrl) {
    throw new Error("PhonePe redirectUrl is required");
  }
  if (!normalizedCallbackUrl) {
    throw new Error("PhonePe callbackUrl is required");
  }

  const amountPaise = Math.max(Math.round(Number(amount || 0) * 100), 100);
  const expireAfter = Math.max(
    Math.min(Number(process.env.PHONEPE_EXPIRE_AFTER || 1800), 7200),
    300,
  );

  const payload = {
    merchantOrderId: normalizedMerchantOrderId,
    amount: amountPaise,
    expireAfter,
    metaInfo: {
      udf1: String(customerId || "guest").trim().slice(0, 64),
    },
    paymentFlow: {
      type: "PG_CHECKOUT",
      message: String(message || "Secure order payment").trim().slice(0, 120),
      merchantUrls: {
        redirectUrl: normalizedRedirectUrl,
        callbackUrl: normalizedCallbackUrl,
      },
    },
  };

  const response = await fetch(`${baseUrl}/pg/checkout/v2/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `O-Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafely(response);
  const state = normalizePhonePeState(data || {});

  if (!response.ok || !String(data?.redirectUrl || "").trim()) {
    const message =
      data?.message || data?.code || data?.error || `HTTP_${response.status}`;
    throw new Error(`PhonePe create payment failed: ${message}`);
  }

  return {
    merchantOrderId: normalizedMerchantOrderId,
    phonepeOrderId: String(data?.orderId || "").trim() || null,
    redirectUrl: String(data?.redirectUrl || "").trim(),
    state,
    expireAt: data?.expireAt || null,
    response: data,
  };
};

export const getPhonePeOrderStatus = async ({ merchantOrderId }) => {
  const baseUrl = getPhonePeBaseUrl();
  const token = await getPhonePeAccessToken();
  const normalizedMerchantOrderId = String(merchantOrderId || "").trim();

  if (!normalizedMerchantOrderId) {
    throw new Error("PhonePe merchantOrderId is required for status check");
  }

  const response = await fetch(
    `${baseUrl}/pg/checkout/v2/order/${encodeURIComponent(
      normalizedMerchantOrderId,
    )}/status`,
    {
      headers: {
        Authorization: `O-Bearer ${token}`,
      },
    },
  );
  const data = await parseJsonSafely(response);

  if (!response.ok) {
    const message =
      data?.message || data?.code || data?.error || `HTTP_${response.status}`;
    throw new Error(`PhonePe status API error: ${message}`);
  }

  return data || {};
};

