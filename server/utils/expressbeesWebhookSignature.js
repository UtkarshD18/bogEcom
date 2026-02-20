import crypto from "crypto";

export const XPRESSBEES_SIGNATURE_HEADERS = [
  "x-hmac-sha256",
  "x-webhook-signature",
  "x-xpressbees-signature",
  "x-expressbees-signature",
  "x-signature",
];

export const XPRESSBEES_LEGACY_SECRET_HEADERS = [
  "x-webhook-secret",
  "x-expressbees-secret",
];

const asString = (value) => String(value || "").trim();

const readHeader = (headers, name) => {
  if (!headers || typeof headers !== "object") return "";
  const value = headers[name];
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = asString(item);
      if (normalized) return normalized;
    }
    return "";
  }
  return asString(value);
};

const readFirstHeader = (headers, names) => {
  for (const name of names) {
    const value = readHeader(headers, name);
    if (value) return value;
  }
  return "";
};

export const normalizeSignature = (signature) =>
  asString(signature).replace(/^sha256[=:]\s*/i, "");

export const resolvePayloadString = ({ rawBody, body }) => {
  if (typeof rawBody === "string" && rawBody.length > 0) {
    return rawBody;
  }
  if (Buffer.isBuffer(rawBody) && rawBody.length > 0) {
    return rawBody.toString("utf8");
  }
  if (typeof body === "string" && body.length > 0) {
    return body;
  }
  if (Buffer.isBuffer(body) && body.length > 0) {
    return body.toString("utf8");
  }
  if (body && typeof body === "object") {
    try {
      return JSON.stringify(body);
    } catch {
      return "";
    }
  }
  return "";
};

export const createHmacSha256Base64 = (payload, secret) =>
  crypto
    .createHmac("sha256", asString(secret))
    .update(String(payload || ""), "utf8")
    .digest("base64");

const safeStringCompare = (expected, provided) => {
  const expectedBuffer = Buffer.from(asString(expected), "utf8");
  const providedBuffer = Buffer.from(asString(provided), "utf8");
  return (
    expectedBuffer.length > 0 &&
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  );
};

export const verifyExpressbeesWebhookAuth = ({
  headers,
  rawBody,
  body,
  secret,
}) => {
  const configuredSecret = asString(secret);
  if (!configuredSecret) {
    return { ok: false, reason: "missing_secret" };
  }

  const signatureHeaderRaw = readFirstHeader(headers, XPRESSBEES_SIGNATURE_HEADERS);
  if (signatureHeaderRaw) {
    const payload = resolvePayloadString({ rawBody, body });
    if (!payload) {
      return { ok: false, reason: "missing_payload" };
    }

    const expectedSignature = createHmacSha256Base64(payload, configuredSecret);
    const providedSignature = normalizeSignature(signatureHeaderRaw);
    if (safeStringCompare(expectedSignature, providedSignature)) {
      return { ok: true, mode: "hmac_sha256_base64" };
    }
    return { ok: false, reason: "signature_mismatch" };
  }

  const legacySecret = readFirstHeader(headers, XPRESSBEES_LEGACY_SECRET_HEADERS);
  if (legacySecret) {
    if (safeStringCompare(configuredSecret, legacySecret)) {
      return { ok: true, mode: "legacy_secret_header" };
    }
    return { ok: false, reason: "legacy_secret_mismatch" };
  }

  return { ok: false, reason: "missing_auth_header" };
};

