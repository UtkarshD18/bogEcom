import crypto from "crypto";

const DEFAULT_UAT_BASE_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const DEFAULT_PROD_BASE_URL = "https://api.phonepe.com/apis/hermes";

const getBaseUrl = () => {
  const env = (process.env.PHONEPE_ENV || "UAT").toUpperCase();
  if (process.env.PHONEPE_BASE_URL) {
    return process.env.PHONEPE_BASE_URL.trim();
  }
  return env === "PROD" ? DEFAULT_PROD_BASE_URL : DEFAULT_UAT_BASE_URL;
};

const getPayPath = () => process.env.PHONEPE_PAY_PATH || "/pg/v1/pay";
const getStatusPath = () => process.env.PHONEPE_STATUS_PATH || "/pg/v1/status";

const ensureConfig = () => {
  const merchantId = process.env.PHONEPE_MERCHANT_ID;
  const saltKey = process.env.PHONEPE_SALT_KEY;
  const saltIndex = process.env.PHONEPE_SALT_INDEX;

  if (!merchantId || !saltKey || !saltIndex) {
    throw new Error(
      "PhonePe credentials missing. Set PHONEPE_MERCHANT_ID, PHONEPE_SALT_KEY, PHONEPE_SALT_INDEX.",
    );
  }

  return { merchantId, saltKey, saltIndex };
};

const buildChecksum = (payloadBase64, path, saltKey, saltIndex) => {
  const hash = crypto
    .createHash("sha256")
    .update(payloadBase64 + path + saltKey)
    .digest("hex");
  return `${hash}###${saltIndex}`;
};

const parseJsonSafe = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

export const createPhonePePayment = async ({
  amount,
  merchantTransactionId,
  merchantUserId,
  redirectUrl,
  callbackUrl,
  mobileNumber,
}) => {
  const { merchantId, saltKey, saltIndex } = ensureConfig();
  const baseUrl = getBaseUrl();
  const path = getPayPath();

  if (!redirectUrl || !callbackUrl) {
    throw new Error("PhonePe redirectUrl and callbackUrl are required.");
  }

  const payload = {
    merchantId,
    merchantTransactionId,
    merchantUserId,
    amount: Math.round(Number(amount) * 100),
    redirectUrl,
    redirectMode: "POST",
    callbackUrl,
    paymentInstrument: { type: "PAY_PAGE" },
  };

  if (mobileNumber) {
    payload.mobileNumber = String(mobileNumber);
  }

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const checksum = buildChecksum(payloadBase64, path, saltKey, saltIndex);

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": checksum,
      accept: "application/json",
    },
    body: JSON.stringify({ request: payloadBase64 }),
  });

  const data = await parseJsonSafe(response);

  if (!response.ok || data?.success === false) {
    const message = data?.message || "PhonePe payment request failed";
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const getPhonePeStatus = async ({
  merchantTransactionId,
}) => {
  const { merchantId, saltKey, saltIndex } = ensureConfig();
  const baseUrl = getBaseUrl();
  const path = `${getStatusPath()}/${merchantId}/${merchantTransactionId}`;

  const checksum = buildChecksum("", path, saltKey, saltIndex);

  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": checksum,
      "X-MERCHANT-ID": merchantId,
      accept: "application/json",
    },
  });

  const data = await parseJsonSafe(response);

  if (!response.ok || data?.success === false) {
    const message = data?.message || "PhonePe status request failed";
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

