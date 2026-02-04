/**
 * Affiliate Tracking Utility
 *
 * Handles referral/affiliate code tracking from URLs and storage.
 * Codes are persisted in localStorage and attached to orders.
 */

const AFFILIATE_STORAGE_KEY = "bogecom_affiliate";
const AFFILIATE_EXPIRY_DAYS = 30;

/**
 * Get affiliate data from URL query params
 * Supports: ?ref=CODE, ?affiliate=CODE, ?campaign=CODE
 */
export const getAffiliateFromURL = () => {
  if (typeof window === "undefined") return null;

  const urlParams = new URLSearchParams(window.location.search);

  // Check various affiliate parameter names
  const refCode =
    urlParams.get("ref") ||
    urlParams.get("affiliate") ||
    urlParams.get("campaign") ||
    urlParams.get("referral");

  if (refCode) {
    // Determine source based on URL structure
    let source = "organic";
    if (urlParams.get("ref")) source = "referral";
    if (urlParams.get("affiliate")) source = "influencer";
    if (urlParams.get("campaign")) source = "campaign";

    return {
      code: refCode.toUpperCase().trim(),
      source,
      capturedAt: new Date().toISOString(),
    };
  }

  return null;
};

/**
 * Save affiliate data to localStorage
 */
export const saveAffiliateData = (affiliateData) => {
  if (typeof window === "undefined" || !affiliateData) return;

  try {
    const data = {
      ...affiliateData,
      expiresAt: new Date(
        Date.now() + AFFILIATE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    localStorage.setItem(AFFILIATE_STORAGE_KEY, JSON.stringify(data));
    console.log("✓ Affiliate code saved:", data.code);
  } catch (error) {
    console.error("Failed to save affiliate data:", error);
  }
};

/**
 * Get stored affiliate data (if not expired)
 */
export const getStoredAffiliateData = () => {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(AFFILIATE_STORAGE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored);

    // Check if expired
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
      localStorage.removeItem(AFFILIATE_STORAGE_KEY);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Failed to get affiliate data:", error);
    return null;
  }
};

/**
 * Clear affiliate data
 */
export const clearAffiliateData = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AFFILIATE_STORAGE_KEY);
};

/**
 * Initialize affiliate tracking
 * Call this on app load or when user lands on the site
 */
export const initAffiliateTracking = () => {
  const urlAffiliate = getAffiliateFromURL();

  if (urlAffiliate) {
    // New affiliate from URL takes precedence
    saveAffiliateData(urlAffiliate);
    return urlAffiliate;
  }

  // Return existing stored affiliate
  return getStoredAffiliateData();
};

/**
 * Set affiliate from coupon code
 * Some coupons are tagged as affiliate/influencer codes
 */
export const setAffiliateFromCoupon = (couponCode, source = "influencer") => {
  if (!couponCode) return;

  saveAffiliateData({
    code: couponCode.toUpperCase().trim(),
    source,
    capturedAt: new Date().toISOString(),
    fromCoupon: true,
  });
};

export default {
  getAffiliateFromURL,
  saveAffiliateData,
  getStoredAffiliateData,
  clearAffiliateData,
  initAffiliateTracking,
  setAffiliateFromCoupon,
};
