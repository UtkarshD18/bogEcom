import SettingsModel from "../models/settings.model.js";
import { checkServiceability } from "./xpressbees.service.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
const shippingCache = new Map();

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const ZONE_C_PREFIXES = ["19", "18", "79", "78", "77", "68", "67", "74", "93"];
const ZONE_A_PREFIXES = ["302"];

const detectZoneByPincode = (pincode) => {
  const pin = String(pincode);
  if (ZONE_A_PREFIXES.some((p) => pin.startsWith(p))) return "A";
  if (ZONE_C_PREFIXES.some((p) => pin.startsWith(p))) return "C";
  return "B";
};

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
  subtotal = 0,
  paymentType = "prepaid",
}) => {
  // ---- RATE CHART (base500 + incremental add500 per extra 500g) ----
  const RATE_CHART = {
    A: { base500: 24, add500: 14 },
    B: { base500: 42, add500: 26 },
    C: { base500: 50, add500: 30 },
  };

  // ---- DYNAMIC WEIGHT SLAB ----
  // Snaps weight to nearest 500g ceiling: 0-500→500, 501-1000→1000, etc.
  const getWeightSlab = (totalWeight) => {
    const w = Math.max(Number(totalWeight || 0), 1);
    return Math.ceil(w / 500) * 500;
  };

  // ---- ZONE DETECTION BY PINCODE PREFIX ----
  const detectZoneByPincode = (pin) => {
    const pincode = String(pin || "");

    // Zone A → Jaipur (302)
    if (pincode.startsWith("302")) {
      return "A";
    }

    // Zone C → NE / J&K / KL / AN
    const zoneCPrefix = [
      "19", // Jammu & Kashmir
      "18",
      "79",
      "78",
      "77", // North East
      "68",
      "67", // Kerala
      "74",
      "93", // Andaman
    ];

    if (zoneCPrefix.some((p) => pincode.startsWith(p))) {
      return "C";
    }

    // Default
    return "B";
  };

  // ---- WEIGHT SLAB FROM SUBTOTAL ----
  // Estimate weight: subtotal ≤ 500 → 500g base, then +500g per ₹500 bracket
  const estimatedWeight = subtotal <= 500 ? 500 : Math.ceil(subtotal / 500) * 500;
  const weight = getWeightSlab(estimatedWeight);

  // ---- ZONE FROM PINCODE ----
  const zone = detectZoneByPincode(destinationPincode);

  // ---- FINAL PRICE (dynamic slab pricing) ----
  const rate = RATE_CHART[zone];
  const charge =
    weight <= 500
      ? rate.base500
      : round2(rate.base500 + ((weight - 500) / 500) * rate.add500);

  return {
    success: true,
    zone,
    charge,
    weight,
  };
};


export default {
  getShippingQuote,
  validateIndianPincode,
};
