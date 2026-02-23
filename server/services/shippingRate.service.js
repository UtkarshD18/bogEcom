import SettingsModel from "../models/settings.model.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
const shippingCache = new Map();

const DISPLAY_MARKUP_PERCENT = 30;
const DISPLAY_METRICS_CACHE_KEY = "shipping_display_metrics";
const SHIPPING_QUOTE_CONFIG_CACHE_KEY = "shipping_quote_config";

const DEFAULT_RATE_CHART = Object.freeze({
  A: { base500: 24, add500: 14 },
  B: { base500: 42, add500: 26 },
  C: { base500: 50, add500: 30 },
});

const ZONE_C_PREFIXES = ["19", "18", "79", "78", "77", "68", "67", "74", "93"];
const ZONE_A_PREFIXES = ["302"];

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getCached = (cacheKey) => {
  const cached = shippingCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.ts > CACHE_TTL_MS) {
    shippingCache.delete(cacheKey);
    return null;
  }
  return cached.value;
};

const setCached = (cacheKey, value) => {
  shippingCache.set(cacheKey, { ts: Date.now(), value });
};

const detectZoneByPincode = (pincode) => {
  const pin = String(pincode || "");
  if (ZONE_A_PREFIXES.some((prefix) => pin.startsWith(prefix))) return "A";
  if (ZONE_C_PREFIXES.some((prefix) => pin.startsWith(prefix))) return "C";
  return "B";
};

const getWeightSlab = (totalWeight) => {
  const weight = Math.max(Number(totalWeight || 0), 1);
  return Math.ceil(weight / 500) * 500;
};

const collectNumericValues = (value, bucket = []) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectNumericValues(item, bucket));
    return bucket;
  }

  if (isPlainObject(value)) {
    Object.values(value).forEach((item) => collectNumericValues(item, bucket));
    return bucket;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    bucket.push(numeric);
  }

  return bucket;
};

const getMaxConfiguredCharge = (value) => {
  const numericValues = collectNumericValues(value, []);
  if (numericValues.length === 0) return 0;
  return Math.max(...numericValues.map((entry) => round2(entry)));
};

const resolveDisplayRateChart = async () => {
  try {
    const setting = await SettingsModel.findOne({ key: "shippingSettings" })
      .select("value")
      .lean();
    const shippingSettings = setting?.value || {};

    const candidates = [
      shippingSettings.distanceRateChart,
      shippingSettings.distanceCharges,
      shippingSettings.shippingRateChart,
      shippingSettings.zoneRates,
      shippingSettings.rates,
    ];

    const configuredChart = candidates.find((candidate) => isPlainObject(candidate));
    return configuredChart || DEFAULT_RATE_CHART;
  } catch (_error) {
    return DEFAULT_RATE_CHART;
  }
};

const getShippingQuoteConfig = async () => {
  const cached = getCached(SHIPPING_QUOTE_CONFIG_CACHE_KEY);
  if (cached) return cached;

  try {
    const setting = await SettingsModel.findOne({ key: "shippingSettings" })
      .select("value")
      .lean();
    const shippingSettings = setting?.value || {};
    setCached(SHIPPING_QUOTE_CONFIG_CACHE_KEY, shippingSettings);
    return shippingSettings;
  } catch (_error) {
    const fallback = {};
    setCached(SHIPPING_QUOTE_CONFIG_CACHE_KEY, fallback);
    return fallback;
  }
};

const resolveRajasthanLocalCandidate = (rateChart) => {
  if (!isPlainObject(rateChart)) return [];

  const preferredKeys = Object.keys(rateChart).filter((key) => {
    const normalized = String(key).trim().toLowerCase();
    return (
      normalized.includes("rajasthan") ||
      normalized.includes("local") ||
      normalized.includes("intra")
    );
  });

  if (preferredKeys.length > 0) {
    return preferredKeys.map((key) => rateChart[key]);
  }

  // Fallback to Zone A (current local shipping setup).
  if (rateChart.A || rateChart.a) {
    return [rateChart.A || rateChart.a];
  }

  return [];
};

export const validateIndianPincode = (pincode) =>
  /^\d{6}$/.test(String(pincode || ""));

/**
 * DISPLAY-ONLY metrics used by cart/checkout UI.
 * This does not affect payable shipping or backend order totals.
 */
export const getShippingDisplayMetrics = async () => {
  const cached = getCached(DISPLAY_METRICS_CACHE_KEY);
  if (cached) return cached;

  const rateChart = await resolveDisplayRateChart();
  const rajasthanCandidates = resolveRajasthanLocalCandidate(rateChart);

  const maxLocalBaseCharge = round2(
    Math.max(
      0,
      ...rajasthanCandidates.map((candidate) => getMaxConfiguredCharge(candidate)),
    ),
  );
  const maxIndiaBaseCharge = round2(getMaxConfiguredCharge(rateChart));
  const markupMultiplier = 1 + DISPLAY_MARKUP_PERCENT / 100;

  const metrics = {
    markupPercent: DISPLAY_MARKUP_PERCENT,
    maxLocalBaseCharge,
    maxIndiaBaseCharge,
    maxLocalDisplayCharge: round2(maxLocalBaseCharge * markupMultiplier),
    maxIndiaDisplayCharge: round2(maxIndiaBaseCharge * markupMultiplier),
  };

  setCached(DISPLAY_METRICS_CACHE_KEY, metrics);
  return metrics;
};

export const getShippingQuote = async ({
  destinationPincode,
  subtotal = 0,
  paymentType = "prepaid",
  totalWeightGrams = 0,
}) => {
  const orderValue = Math.max(Number(subtotal || 0), 0);
  const estimatedWeight =
    totalWeightGrams > 0
      ? Number(totalWeightGrams)
      : orderValue <= 500
        ? 500
        : Math.ceil(orderValue / 500) * 500;
  const weight = getWeightSlab(estimatedWeight);
  const zone = detectZoneByPincode(destinationPincode);

  const shippingSettings = await getShippingQuoteConfig();
  const forceFreeShipping = shippingSettings?.forceFreeShipping !== false;

  let charge = 0;
  let freeDelivery = true;

  if (!forceFreeShipping) {
    const freeShippingEnabled = shippingSettings?.freeShippingEnabled === true;
    const freeShippingThreshold = Number(
      shippingSettings?.freeShippingThreshold || 0,
    );

    if (
      freeShippingEnabled &&
      Number.isFinite(freeShippingThreshold) &&
      orderValue >= freeShippingThreshold
    ) {
      charge = 0;
      freeDelivery = true;
    } else {
      const standardCost = Number(shippingSettings?.standardShippingCost || 0);
      const expressCost = Number(shippingSettings?.expressShippingCost || 0);
      const selectedCost =
        String(paymentType || "").toLowerCase() === "express"
          ? expressCost
          : standardCost;
      charge = round2(Math.max(selectedCost, 0));
      freeDelivery = charge <= 0;
    }
  }

  return {
    success: true,
    zone,
    charge,
    amount: charge,
    weight,
    freeDelivery,
    source: forceFreeShipping ? "force_free_shipping" : "settings",
  };
};

export default {
  getShippingDisplayMetrics,
  getShippingQuote,
  validateIndianPincode,
};
