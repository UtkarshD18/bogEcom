import SettingsModel from "../models/settings.model.js";
import { checkServiceability } from "./xpressbees.service.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
const shippingCache = new Map();

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const validateIndianPincode = (pincode) => /^\d{6}$/.test(String(pincode || ""));

const getFallbackShippingAmount = async (subtotal) => {
  const safeSubtotal = Math.max(round2(subtotal), 0);
  const setting = await SettingsModel.findOne({ key: "shippingSettings" })
    .select("value")
    .lean();

  const shipping = setting?.value || {};
  const freeEnabled = Boolean(shipping.freeShippingEnabled);
  const freeThreshold = Number(shipping.freeShippingThreshold || 500);
  const standardShippingCost = Number(shipping.standardShippingCost || 50);

  if (freeEnabled && safeSubtotal >= freeThreshold) {
    return 0;
  }

  return Math.max(round2(standardShippingCost), 0);
};

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

export const getShippingQuote = async ({
  destinationPincode,
  subtotal,
  paymentType = "prepaid",
}) => {
  if (!validateIndianPincode(destinationPincode)) {
    const error = new Error("Invalid pincode. Pincode must be 6 digits.");
    error.code = "INVALID_PINCODE";
    throw error;
  }

  const safeSubtotal = Math.max(round2(subtotal), 0);
  const origin = process.env.SHIPPER_PINCODE || process.env.XPRESSBEES_ORIGIN_PINCODE;
  const normalizedPaymentType = String(paymentType || "prepaid").toLowerCase();
  const cacheKey = `${origin || "na"}:${destinationPincode}:${normalizedPaymentType}:${safeSubtotal}`;

  const cached = getCached(cacheKey);
  if (cached) return cached;

  const fallbackAmount = await getFallbackShippingAmount(safeSubtotal);

  if (!origin || !validateIndianPincode(origin)) {
    const fallback = {
      amount: fallbackAmount,
      source: "fallback",
      provider: "INTERNAL",
      reason: "Origin pincode not configured for ExpressBees",
    };
    setCached(cacheKey, fallback);
    return fallback;
  }

  try {
    const payload = {
      origin,
      destination: destinationPincode,
      payment_type: normalizedPaymentType,
      order_amount: safeSubtotal,
    };

    const serviceability = await checkServiceability(payload);
    const data = serviceability?.data || serviceability || {};
    const responseAmount =
      Number(
        data?.shipping_charge ??
          data?.shippingCost ??
          data?.freight_charge ??
          data?.charge,
      ) || NaN;

    const amount = Number.isFinite(responseAmount)
      ? Math.max(round2(responseAmount), 0)
      : fallbackAmount;

    const quote = {
      amount,
      source: Number.isFinite(responseAmount) ? "xpressbees" : "fallback",
      provider: "XPRESSBEES",
      serviceability: data,
      reason: Number.isFinite(responseAmount)
        ? ""
        : "ExpressBees returned no shipping amount, fallback applied",
    };

    setCached(cacheKey, quote);
    return quote;
  } catch (error) {
    const fallback = {
      amount: fallbackAmount,
      source: "fallback",
      provider: "INTERNAL",
      reason: `ExpressBees unavailable: ${error.message}`,
    };
    setCached(cacheKey, fallback);
    return fallback;
  }
};

export default {
  getShippingQuote,
  validateIndianPincode,
};
