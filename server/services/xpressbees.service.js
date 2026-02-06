const DEFAULT_BASE_URL = "https://shipment.xpressbees.com/api";

const BASE_URL =
  process.env.XPRESSBEES_BASE_URL?.trim() || DEFAULT_BASE_URL;

const TOKEN_TTL_MINUTES = Number(
  process.env.XPRESSBEES_TOKEN_TTL_MINUTES || 720,
);

let cachedToken = null;
let cachedAtMs = 0;

const ensureFetch = () => {
  if (typeof fetch === "function") {
    return fetch;
  }
  throw new Error(
    "Global fetch is not available. Use Node.js 18+ or provide a fetch polyfill.",
  );
};

const buildUrl = (path) => {
  if (!path.startsWith("/")) return `${BASE_URL}/${path}`;
  return `${BASE_URL}${path}`;
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

const normalizeError = (data, statusCode) => {
  const message =
    data?.message ||
    data?.error ||
    `Xpressbees request failed (${statusCode})`;
  const error = new Error(message);
  error.status = statusCode;
  error.data = data;
  return error;
};

const xpressbeesRequest = async (path, options = {}) => {
  const {
    method = "GET",
    body = null,
    token = null,
    skipAuth = false,
  } = options;

  const headers = {
    "Content-Type": "application/json",
  };

  if (!skipAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const doFetch = ensureFetch();
  const response = await doFetch(buildUrl(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw normalizeError(data, response.status);
  }

  if (data?.status === false) {
    throw normalizeError(data, response.status);
  }

  return data;
};

export const getAuthToken = async () => {
  const envToken = process.env.XPRESSBEES_TOKEN;
  if (envToken && envToken.trim().length > 0) {
    return envToken.trim();
  }

  const now = Date.now();
  const ttlMs = Math.max(TOKEN_TTL_MINUTES, 10) * 60 * 1000;

  if (cachedToken && now - cachedAtMs < ttlMs) {
    return cachedToken;
  }

  const email = process.env.XPRESSBEES_EMAIL;
  const password = process.env.XPRESSBEES_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Xpressbees credentials missing. Set XPRESSBEES_TOKEN or XPRESSBEES_EMAIL/XPRESSBEES_PASSWORD.",
    );
  }

  const loginResponse = await xpressbeesRequest("/users/login", {
    method: "POST",
    body: { email, password },
    skipAuth: true,
  });

  if (!loginResponse?.status || !loginResponse?.data) {
    throw new Error(
      loginResponse?.message || "Failed to authenticate with Xpressbees",
    );
  }

  cachedToken = String(loginResponse.data);
  cachedAtMs = now;

  return cachedToken;
};

export const loginXpressbees = async () => {
  const token = await getAuthToken();
  return { status: true, data: token };
};

export const listCouriers = async () => {
  const token = await getAuthToken();
  return xpressbeesRequest("/courier", { token });
};

export const bookShipment = async (payload) => {
  const token = await getAuthToken();
  return xpressbeesRequest("/shipments2", {
    method: "POST",
    body: payload,
    token,
  });
};

export const trackShipment = async (awb) => {
  const token = await getAuthToken();
  return xpressbeesRequest(`/shipments2/track/${awb}`, { token });
};

export const createManifest = async (awbs) => {
  const token = await getAuthToken();
  return xpressbeesRequest("/shipments2/manifest", {
    method: "POST",
    body: { awbs },
    token,
  });
};

export const cancelShipment = async (awb) => {
  const token = await getAuthToken();
  return xpressbeesRequest("/shipments2/cancel", {
    method: "POST",
    body: { awb },
    token,
  });
};

export const checkServiceability = async (payload) => {
  const token = await getAuthToken();
  return xpressbeesRequest("/courier/serviceability", {
    method: "POST",
    body: payload,
    token,
  });
};

export const getNdrList = async () => {
  const token = await getAuthToken();
  return xpressbeesRequest("/ndr", { token });
};

export const createNdrAction = async (payload) => {
  const token = await getAuthToken();
  return xpressbeesRequest("/ndr/create", {
    method: "POST",
    body: payload,
    token,
  });
};

export const createReverseShipment = async (payload) => {
  const token = await getAuthToken();
  return xpressbeesRequest("/ReverseShipments", {
    method: "POST",
    body: payload,
    token,
  });
};
