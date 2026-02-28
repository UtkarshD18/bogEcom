import PaytmChecksum from "paytmchecksum";

const DEFAULT_PAYTM_STAGE_URL = "https://securestage.paytmpayments.com";
const DEFAULT_PAYTM_PROD_URL = "https://secure.paytmpayments.com";

const normalizeBaseUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const getPaytmBaseUrl = () => {
  const custom = normalizeBaseUrl(process.env.PAYTM_BASE_URL);
  if (custom) return custom;

  const env = String(process.env.PAYTM_ENV || "UAT")
    .trim()
    .toUpperCase();
  return env === "PROD" ? DEFAULT_PAYTM_PROD_URL : DEFAULT_PAYTM_STAGE_URL;
};

const getPaytmCredentials = () => {
  const mid = String(process.env.PAYTM_MERCHANT_ID || "").trim();
  const merchantKey = String(process.env.PAYTM_MERCHANT_KEY || "").trim();

  if (!mid || !merchantKey) {
    throw new Error(
      "Paytm credentials missing. Set PAYTM_MERCHANT_ID and PAYTM_MERCHANT_KEY.",
    );
  }

  return {
    mid,
    merchantKey,
    websiteName:
      String(process.env.PAYTM_WEBSITE || "WEBSTAGING").trim() || "WEBSTAGING",
    channelId:
      String(process.env.PAYTM_CHANNEL_ID_WEB || "WEB").trim() || "WEB",
  };
};

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const normalizeResultStatus = (payload = {}) =>
  String(
    payload?.body?.resultInfo?.resultStatus ||
      payload?.resultInfo?.resultStatus ||
      payload?.STATUS ||
      payload?.status ||
      "",
  )
    .trim()
    .toUpperCase();

export const createPaytmPayment = async ({
  amount,
  orderId,
  callbackUrl,
  customerId = "guest",
  mobileNumber = null,
  email = null,
}) => {
  const { mid, merchantKey, websiteName, channelId } = getPaytmCredentials();
  const baseUrl = getPaytmBaseUrl();

  const normalizedAmount = Math.max(Number(amount || 0), 1).toFixed(2);
  const normalizedOrderId = String(orderId || "").trim();
  const normalizedCallbackUrl = String(callbackUrl || "").trim();
  const normalizedCustomerId = String(customerId || "guest").trim() || "guest";

  if (!normalizedOrderId) {
    throw new Error("Paytm orderId is required");
  }
  if (!normalizedCallbackUrl) {
    throw new Error("Paytm callbackUrl is required");
  }

  const body = {
    requestType: "Payment",
    mid,
    websiteName,
    orderId: normalizedOrderId,
    callbackUrl: normalizedCallbackUrl,
    txnAmount: {
      value: normalizedAmount,
      currency: "INR",
    },
    userInfo: {
      custId: normalizedCustomerId,
      ...(mobileNumber ? { mobile: String(mobileNumber).trim() } : {}),
      ...(email ? { email: String(email).trim() } : {}),
    },
    channelId,
  };

  const bodyString = JSON.stringify(body);
  const signature = await PaytmChecksum.generateSignature(bodyString, merchantKey);

  const payload = {
    body,
    head: {
      signature,
    },
  };

  const endpoint = `${baseUrl}/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(
    mid,
  )}&orderId=${encodeURIComponent(normalizedOrderId)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafely(response);
  const resultStatus = normalizeResultStatus(data || {});

  if (!response.ok || resultStatus !== "S") {
    const resultMessage =
      data?.body?.resultInfo?.resultMsg ||
      data?.body?.resultInfo?.resultCode ||
      `HTTP_${response.status}`;
    throw new Error(`Paytm initiate transaction failed: ${resultMessage}`);
  }

  const txnToken = String(data?.body?.txnToken || "").trim();
  if (!txnToken) {
    throw new Error("Paytm initiate transaction succeeded but txnToken is missing");
  }

  return {
    mid,
    orderId: normalizedOrderId,
    txnToken,
    gatewayUrl: `${baseUrl}/theia/api/v1/showPaymentPage?mid=${encodeURIComponent(
      mid,
    )}&orderId=${encodeURIComponent(normalizedOrderId)}`,
    response: data,
  };
};

export const getPaytmStatus = async ({ orderId }) => {
  const { mid, merchantKey } = getPaytmCredentials();
  const baseUrl = getPaytmBaseUrl();

  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) {
    throw new Error("Paytm orderId is required for status check");
  }

  const body = {
    mid,
    orderId: normalizedOrderId,
  };
  const bodyString = JSON.stringify(body);
  const signature = await PaytmChecksum.generateSignature(bodyString, merchantKey);

  const response = await fetch(`${baseUrl}/v3/order/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      body,
      head: { signature },
    }),
  });
  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(`Paytm status API error: HTTP_${response.status}`);
  }

  return data?.body || data || {};
};
