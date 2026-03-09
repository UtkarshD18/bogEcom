import { normalizePincode } from "../utils/addressUtils.js";

const INDIA_POST_BASE_URL = "https://api.postalpincode.in/pincode";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map();

const isCacheValid = (record) =>
  Boolean(record && Date.now() - Number(record.cachedAt || 0) < CACHE_TTL_MS);

const buildCacheRecord = (value) => ({
  ...value,
  cachedAt: Date.now(),
});

const parseIndiaPostResponse = (payload, pincode) => {
  const firstResult = Array.isArray(payload) ? payload[0] : payload;
  const postOffices = Array.isArray(firstResult?.PostOffice)
    ? firstResult.PostOffice.filter(Boolean)
    : [];

  if (!postOffices.length) {
    return {
      pincode,
      city: "",
      state: "",
      district: "",
      areaSuggestions: [],
      status: "empty",
    };
  }

  const primary = postOffices[0];
  const uniqueAreas = [];
  const seen = new Set();

  postOffices.forEach((office) => {
    const name = String(office?.Name || "").trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    uniqueAreas.push({
      name,
      district: String(office?.District || "").trim(),
      state: String(office?.State || "").trim(),
      block: String(office?.Block || "").trim(),
      branchType: String(office?.BranchType || "").trim(),
      deliveryStatus: String(office?.DeliveryStatus || "").trim(),
    });
  });

  return {
    pincode,
    city: String(primary?.Block || primary?.District || "").trim(),
    state: String(primary?.State || "").trim(),
    district: String(primary?.District || "").trim(),
    areaSuggestions: uniqueAreas,
    status: "ok",
  };
};

export const getCachedPincodeLookup = (rawPincode) => {
  const pincode = normalizePincode(rawPincode);
  const record = cache.get(pincode);
  if (!isCacheValid(record)) return null;
  return { ...record, cacheHit: true };
};

export const lookupIndiaPostPincode = async (
  rawPincode,
  { fetchImpl } = {},
) => {
  const pincode = normalizePincode(rawPincode);
  if (!/^[0-9]{6}$/.test(pincode)) {
    const error = new Error("Pincode must be 6 digits");
    error.code = "INVALID_PINCODE";
    throw error;
  }

  const cached = getCachedPincodeLookup(pincode);
  if (cached) return cached;

  const doFetch = fetchImpl || globalThis.fetch;
  if (typeof doFetch !== "function") {
    const error = new Error("Fetch is not available");
    error.code = "FETCH_UNAVAILABLE";
    throw error;
  }

  const response = await doFetch(`${INDIA_POST_BASE_URL}/${pincode}`);
  if (!response.ok) {
    const error = new Error(`India Post lookup failed (${response.status})`);
    error.code = "INDIA_POST_HTTP_ERROR";
    throw error;
  }

  const payload = await response.json();
  const parsed = parseIndiaPostResponse(payload, pincode);
  const record = buildCacheRecord(parsed);
  cache.set(pincode, record);
  return { ...record, cacheHit: false };
};

export const primePincodeLookupCache = (pincode, value) => {
  const normalized = normalizePincode(pincode);
  if (!normalized) return null;
  const record = buildCacheRecord({
    pincode: normalized,
    city: String(value?.city || "").trim(),
    state: String(value?.state || "").trim(),
    district: String(value?.district || "").trim(),
    areaSuggestions: Array.isArray(value?.areaSuggestions)
      ? value.areaSuggestions
      : [],
    status: value?.status || "ok",
  });
  cache.set(normalized, record);
  return record;
};

export const clearPincodeLookupCache = () => {
  cache.clear();
};

export default {
  clearPincodeLookupCache,
  getCachedPincodeLookup,
  lookupIndiaPostPincode,
  primePincodeLookupCache,
};
