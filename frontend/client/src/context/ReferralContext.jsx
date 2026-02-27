"use client";

import { API_BASE_URL } from "@/utils/api";
import { createContext, useContext, useEffect, useState } from "react";

const ReferralContext = createContext({
  referralCode: null,
  referralData: null,
  isValidating: false,
  clearReferral: () => {},
  applyReferralCode: () => ({}),
});

const REFERRAL_STORAGE_KEY = "bogearth_referral";
const REFERRAL_EXPIRY_DAYS = 30; // Referral session expires in 30 days
const API_ROOT = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL;

const parseResponsePayload = async (response) => {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return { success: false, message: raw };
  }
};

export const ReferralProvider = ({ children }) => {
  const [referralCode, setReferralCode] = useState(null);
  const [referralData, setReferralData] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  const getStorage = () => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  };

  const clearStoredReferralState = () => {
    const storage = getStorage();
    if (storage) {
      storage.removeItem(REFERRAL_STORAGE_KEY);
    }
    setReferralCode(null);
    setReferralData(null);
  };

  // Check URL for referral code on initial load
  useEffect(() => {
    const detectReferral = async () => {
      if (typeof window === "undefined") return;

      const urlParams = new URLSearchParams(window.location.search);
      const refCode =
        urlParams.get("ref") ||
        urlParams.get("affiliate") ||
        urlParams.get("referral") ||
        urlParams.get("influencer") ||
        urlParams.get("code");
      const source = urlParams.get("ref")
        ? "link"
        : urlParams.get("affiliate") || urlParams.get("influencer")
          ? "influencer"
          : "referral";

      if (refCode) {
        // New referral code from URL - validate and store (session only)
        await validateAndStoreReferral(refCode.toUpperCase(), source);

        // Clean URL (remove ref param) without reload
        const newUrl = new URL(window.location.href);
        ["ref", "affiliate", "referral", "influencer", "code"].forEach(
          (key) => newUrl.searchParams.delete(key),
        );
        window.history.replaceState({}, "", newUrl.toString());
      } else {
        // Load stored referral and revalidate before applying any discount.
        await loadStoredReferral();
      }
    };

    detectReferral();
  }, []);

  const loadStoredReferral = async () => {
    try {
      const storage = getStorage();
      if (!storage) return;
      const stored = storage.getItem(REFERRAL_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // Check if not expired
        if (data.expiresAt && new Date(data.expiresAt) > new Date()) {
          const validateResult = await validateAndStoreReferral(
            String(data.code || "").toUpperCase(),
            data.source || "session",
            { clearOnFailure: true },
          );
          if (!validateResult?.success) {
            clearStoredReferralState();
          }
        } else {
          // Expired - clear it
          clearStoredReferralState();
        }
      }
    } catch (error) {
      console.error("Error loading stored referral:", error);
      clearStoredReferralState();
    }
  };

  const validateAndStoreReferral = async (
    code,
    source = "link",
    options = {},
  ) => {
    const normalizedCode = String(code || "").trim().toUpperCase();
    const clearOnFailure = Boolean(options?.clearOnFailure);
    if (!normalizedCode) {
      if (clearOnFailure) {
        clearStoredReferralState();
      }
      return { success: false, message: "Referral code is required" };
    }

    setIsValidating(true);
    try {
      const response = await fetch(
        `${API_ROOT}/api/influencers/validate?code=${encodeURIComponent(normalizedCode)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        },
      );
      const result = await parseResponsePayload(response);

      if (!response.ok) {
        const message =
          result?.message || `Failed to validate referral code (${response.status})`;
        console.warn("Referral validation request failed:", message);
        if (clearOnFailure) {
          clearStoredReferralState();
        }
        return { success: false, message };
      }

      if (result?.success && result?.valid && result?.data) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFERRAL_EXPIRY_DAYS);

        const referralInfo = {
          code: result.data.code,
          discountType: result.data.discountType,
          discountValue: result.data.discountValue,
          maxDiscountAmount: result.data.maxDiscountAmount,
          minOrderAmount: result.data.minOrderAmount,
          source,
          storedAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
        };

        // Store in sessionStorage (only for this session)
        const storage = getStorage();
        if (storage) {
          storage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referralInfo));
        }

        setReferralCode(referralInfo.code);
        setReferralData(referralInfo);

        console.log("Referral code validated and stored:", referralInfo.code);
        return { success: true, data: referralInfo };
      }

      const message = result?.message || "Invalid referral code";
      console.log("Invalid referral code:", normalizedCode);
      if (clearOnFailure) {
        clearStoredReferralState();
      }
      return { success: false, message };
    } catch (error) {
      console.error("Error validating referral code:", error);
      if (clearOnFailure) {
        clearStoredReferralState();
      }
      return { success: false, message: "Failed to validate referral code" };
    } finally {
      setIsValidating(false);
    }
  };

  const clearReferral = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
      window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
    }
    clearStoredReferralState();
  };

  // Calculate discount for a given amount (for display purposes)
  const calculateDiscount = (orderAmount) => {
    if (!referralData || !orderAmount) return 0;
    if (
      referralData.minOrderAmount &&
      orderAmount < referralData.minOrderAmount
    ) {
      return 0;
    }

    let discount = 0;
    if (referralData.discountType === "PERCENT") {
      discount = (orderAmount * referralData.discountValue) / 100;
    } else {
      discount = referralData.discountValue;
    }

    // Apply max discount cap if set
    if (
      referralData.maxDiscountAmount &&
      discount > referralData.maxDiscountAmount
    ) {
      discount = referralData.maxDiscountAmount;
    }

    return Math.round(discount * 100) / 100;
  };

  return (
    <ReferralContext.Provider
      value={{
        referralCode,
        referralData,
        isValidating,
        clearReferral,
        applyReferralCode: validateAndStoreReferral,
        calculateDiscount,
      }}
    >
      {children}
    </ReferralContext.Provider>
  );
};

export const useReferral = () => {
  const context = useContext(ReferralContext);
  if (!context) {
    throw new Error("useReferral must be used within a ReferralProvider");
  }
  return context;
};

export default ReferralContext;
