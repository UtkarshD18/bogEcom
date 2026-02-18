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

export const ReferralProvider = ({ children }) => {
  const [referralCode, setReferralCode] = useState(null);
  const [referralData, setReferralData] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  const getStorage = () => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  };

  // Check URL for referral code on initial load
  useEffect(() => {
    const detectReferral = async () => {
      if (typeof window === "undefined") return;

      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get("ref");

      if (refCode) {
        // New referral code from URL - validate and store (session only)
        await validateAndStoreReferral(refCode.toUpperCase(), "link");

        // Clean URL (remove ref param) without reload
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("ref");
        window.history.replaceState({}, "", newUrl.toString());
      } else {
        // Load referral only for this browser session
        loadStoredReferral();
      }
    };

    detectReferral();
  }, []);

  const loadStoredReferral = () => {
    try {
      const storage = getStorage();
      if (!storage) return;
      const stored = storage.getItem(REFERRAL_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // Check if not expired
        if (data.expiresAt && new Date(data.expiresAt) > new Date()) {
          setReferralCode(data.code);
          setReferralData(data);
        } else {
          // Expired - clear it
          storage.removeItem(REFERRAL_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error("Error loading stored referral:", error);
    }
  };

  const validateAndStoreReferral = async (code, source = "link") => {
    if (!code) return { success: false, message: "Referral code is required" };

    setIsValidating(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/influencers/validate?code=${encodeURIComponent(code)}`,
      );
      const result = await response.json();

      if (result.success && result.valid) {
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

      console.log("Invalid referral code:", code);
      return { success: false, message: "Invalid referral code" };
    } catch (error) {
      console.error("Error validating referral code:", error);
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
    setReferralCode(null);
    setReferralData(null);
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
