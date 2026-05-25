"use client";

import { API_BASE_URL } from "@/utils/api";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const SettingsContext = createContext();

const API_URL = String(API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

const LOCAL_SETTINGS_API_FALLBACKS = [
  "http://127.0.0.1:8002",
  "http://127.0.0.1:8001",
  "http://127.0.0.1:8000",
  "http://localhost:8002",
  "http://localhost:8001",
  "http://localhost:8000",
];

const SETTINGS_FOCUS_REFRESH_MIN_MS = 90 * 1000;
let preferredSettingsApiBase = "";

const sanitizeBaseUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "");

const isLocalhostUrl = (value) => {
  try {
    const parsed = new URL(String(value || ""));
    const hostname = String(parsed.hostname || "").toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

const buildApiUrlCandidates = (path) => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path)
    : `/${String(path || "")}`;
  const apiPath = normalizedPath.startsWith("/api/")
    ? normalizedPath
    : `/api${normalizedPath}`;

  const candidates = [];
  if (preferredSettingsApiBase) {
    candidates.push(`${preferredSettingsApiBase}${apiPath}`);
  }
  if (API_URL) {
    candidates.push(`${API_URL}${apiPath}`);
  }

  if (typeof window !== "undefined") {
    const hostname = String(window.location.hostname || "").toLowerCase();
    const isLocalhostHost =
      hostname === "localhost" || hostname === "127.0.0.1";

    if (isLocalhostHost) {
      const fallbackBases =
        LOCAL_SETTINGS_API_FALLBACKS.map(sanitizeBaseUrl).filter(Boolean);

      if (isLocalhostUrl(API_URL)) {
        candidates.push(
          ...fallbackBases
            .filter(
              (base) => sanitizeBaseUrl(base) !== sanitizeBaseUrl(API_URL),
            )
            .map((base) => `${base}${apiPath}`),
        );
      } else {
        candidates.push(...fallbackBases.map((base) => `${base}${apiPath}`));
      }
    }
  }

  candidates.push(apiPath);

  return [...new Set(candidates)];
};

const fetchSettingsPayload = async (url) => {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    // Public settings do not require cookies/auth.
    cache: "no-store",
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_err) {
    payload = null;
  }

  if (!response.ok) {
    const backendMessage =
      payload?.message || payload?.error?.message || payload?.error || null;
    throw new Error(
      backendMessage || `Failed to fetch settings (${response.status})`,
    );
  }

  return payload;
};

/**
 * Default settings values (fallbacks when API fails)
 */
const defaultSettings = {
  // Shipping settings
  shippingSettings: {
    freeShippingThreshold: 500,
    standardShippingCost: 50,
    expressShippingCost: 100,
    freeShippingEnabled: true,
    estimatedDelivery: {
      standard: "5-7 business days",
      express: "2-3 business days",
    },
  },
  // Tax settings
  taxSettings: {
    enabled: true,
    taxRate: 5,
    taxName: "GST",
    taxIncludedInPrice: true,
  },
  // Order settings
  orderSettings: {
    minimumOrderValue: 0,
    maximumOrderValue: 50000,
    maxItemsPerOrder: 20,
    codEnabled: false,
    codMinOrder: 200,
    codMaxOrder: 5000,
  },
  // Store info
  storeInfo: {
    name: "HealthyOneGram",
    email: "healthyonegram.com",
    phone: "+91 8619641968",
    whatsapp: "+918619641968",
    address: "",
    gstNumber: "",
    currency: "INR",
    currencySymbol: "₹",
  },
  // Discount settings
  discountSettings: {
    maxDiscountPercentage: 50,
    stackableCoupons: true,
    firstOrderDiscount: {
      enabled: true,
      percentage: 10,
      maxDiscount: 100,
    },
  },
  // Offer popup settings
  showOfferPopup: true,
  offerCouponCode: "",
  offerTitle: "Special Offer!",
  offerDescription: "Use this code to get a discount on your order!",
  offerDiscountText: "Get Discount",
  offerCountdownSettings: {
    enabled: false,
    title: "Limited time offer",
    subtitle: "Fresh deals are live now.",
    couponCode: "",
    discountText: "",
    endsAt: null,
    ctaLabel: "Shop offers",
    ctaHref: "/products",
  },
  homeSlidePanelSettings: {
    enabled: true,
    minimizeEnabled: true,
    minimizedLabel: "Show details",
    restoreAfterSeconds: 60,
  },
  // Traffic notice
  highTrafficNotice: {
    enabled: true,
    message:
      "High traffic — availability may vary. Your order will be processed once confirmed.",
  },
  // Maintenance
  maintenanceMode: false,
  maintenanceSettings: {
    maintenanceEnabled: false,
    maintenanceStartTime: null,
    maintenanceEndTime: null,
    maintenanceMessage:
      "We are currently undergoing scheduled maintenance. Please check back soon.",
    showCountdown: true,
  },
  // Payment
  paymentGatewayEnabled: true,
  defaultPaymentProvider: "PHONEPE",
  // Homepage flavour buttons
  flavour_button_1_text: "Creamy",
  flavour_button_1_bg_color: "#F6E6C9",
  flavour_button_1_text_color: "#6B4F2A",
  flavour_button_2_text: "Chocolate",
  flavour_button_2_bg_color: "#5A3A2E",
  flavour_button_2_text_color: "#FFFFFF",
  flavour_button_3_text: "Daizu",
  flavour_button_3_bg_color: "#8FAE5D",
  flavour_button_3_text_color: "#2F3E1F",
  flavour_button_4_text: "Low-calorie",
  flavour_button_4_bg_color: "#CFEFE8",
  flavour_button_4_text_color: "#1F4D46",
  homepage_trust_1_text: "100% Natural",
  homepage_trust_2_text: "No Palm Oil",
  homepage_trust_3_text: "High Protein",
  homepage_trust_4_text: "Fast Moving Picks",
};

/**
 * SettingsProvider Component
 * Fetches store settings from API and provides them to all client components
 * Settings are refreshed on mount and can be manually refreshed
 */
export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const lastFetchedAtRef = useRef(0);

  /**
   * Fetch public settings from API
   */
  const fetchSettings = useCallback(async ({ background = false } = {}) => {
    const shouldShowLoading = !background || lastFetchedAtRef.current === 0;

    try {
      if (shouldShowLoading) {
        setLoading(true);
      }
      setError(null);
      const candidates = buildApiUrlCandidates("/settings/public");
      let data = null;
      let lastError = null;

      for (const url of candidates) {
        try {
          data = await fetchSettingsPayload(url);
          try {
            const parsed = new URL(url);
            preferredSettingsApiBase = `${parsed.protocol}//${parsed.host}`;
          } catch {
            preferredSettingsApiBase = "";
          }
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!data) {
        throw lastError || new Error("Failed to fetch settings");
      }

      if (data.success && data.data) {
        // Merge with defaults to ensure all keys exist
        setSettings({
          ...defaultSettings,
          ...data.data,
        });
        const fetchedAt = new Date();
        setLastFetched(fetchedAt);
        lastFetchedAtRef.current = fetchedAt.getTime();
      } else {
        throw new Error(data?.message || "Invalid settings response");
      }
    } catch (err) {
      console.warn("Error fetching settings:", err);
      setError(err.message);
      // Keep using default settings on error
    } finally {
      if (shouldShowLoading) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch settings on mount
  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleWindowFocus = () => {
      if (document.hidden) return;
      const lastFetchedAt = Number(lastFetchedAtRef.current || 0);
      if (
        lastFetchedAt > 0 &&
        Date.now() - lastFetchedAt < SETTINGS_FOCUS_REFRESH_MIN_MS
      ) {
        return;
      }
      void fetchSettings({ background: true });
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, [fetchSettings]);

  /**
   * Get a specific setting value with fallback
   * @param {string} key - The setting key (e.g., "shippingSettings.freeShippingThreshold")
   * @param {any} fallback - Fallback value if key not found
   */
  const getSetting = useCallback(
    (key, fallback = null) => {
      const keys = key.split(".");
      let value = settings;

      for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
          value = value[k];
        } else {
          return fallback;
        }
      }

      return value ?? fallback;
    },
    [settings],
  );

  /**
   * Calculate shipping cost based on cart total
   * @param {number} cartTotal - Cart subtotal
   * @param {string} shippingType - "standard" or "express"
   */
  const calculateShipping = useCallback(
    (cartTotal, shippingType = "standard") => {
      const shipping = settings.shippingSettings;

      // Free shipping if enabled and threshold met
      if (
        shipping.freeShippingEnabled &&
        cartTotal >= shipping.freeShippingThreshold
      ) {
        return 0;
      }

      // Return shipping cost based on type
      return shippingType === "express"
        ? shipping.expressShippingCost
        : shipping.standardShippingCost;
    },
    [settings.shippingSettings],
  );

  /**
   * Calculate tax amount based on subtotal
   * @param {number} subtotal - Subtotal amount
   */
  const calculateTax = useCallback(
    (subtotal) => {
      const tax = settings.taxSettings;

      if (!tax.enabled || tax.taxIncludedInPrice) {
        return 0;
      }

      return Math.round((subtotal * tax.taxRate) / 100);
    },
    [settings.taxSettings],
  );

  /**
   * Format price with store currency symbol
   * @param {number} amount - Amount to format
   */
  const formatPrice = useCallback(
    (amount) => {
      const symbol = settings.storeInfo?.currencySymbol || "₹";
      return `${symbol}${Number(amount || 0).toLocaleString("en-IN")}`;
    },
    [settings.storeInfo?.currencySymbol],
  );

  /**
   * Check if COD is available for given amount
   * @param {number} orderTotal - Order total
   */
  const isCODAvailable = useCallback(
    (orderTotal) => {
      const order = settings.orderSettings;

      if (!order.codEnabled) return false;
      if (orderTotal < order.codMinOrder) return false;
      if (orderTotal > order.codMaxOrder) return false;

      return true;
    },
    [settings.orderSettings],
  );

  /**
   * Check if order amount is valid
   * @param {number} orderTotal - Order total
   */
  const isValidOrderAmount = useCallback(
    (orderTotal) => {
      const order = settings.orderSettings;

      if (orderTotal < order.minimumOrderValue) {
        return {
          valid: false,
          message: `Minimum order value is ${formatPrice(order.minimumOrderValue)}`,
        };
      }

      if (orderTotal > order.maximumOrderValue) {
        return {
          valid: false,
          message: `Maximum order value is ${formatPrice(order.maximumOrderValue)}`,
        };
      }

      return { valid: true, message: "" };
    },
    [settings.orderSettings, formatPrice],
  );

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      lastFetched,
      fetchSettings,
      getSetting,
      calculateShipping,
      calculateTax,
      formatPrice,
      isCODAvailable,
      isValidOrderAmount,
      // Direct access to common settings
      shippingSettings: settings.shippingSettings,
      taxSettings: settings.taxSettings,
      orderSettings: settings.orderSettings,
      storeInfo: settings.storeInfo,
      discountSettings: settings.discountSettings,
      // Offer popup
      showOfferPopup: settings.showOfferPopup,
      offerCouponCode: settings.offerCouponCode,
      offerTitle: settings.offerTitle,
      offerDescription: settings.offerDescription,
      offerDiscountText: settings.offerDiscountText,
      offerCountdownSettings: settings.offerCountdownSettings,
      homeSlidePanelSettings: settings.homeSlidePanelSettings,
      // Other flags
      highTrafficNotice: settings.highTrafficNotice,
      maintenanceMode: Boolean(
        settings?.maintenanceSettings?.maintenanceEnabled ??
        settings?.maintenanceMode,
      ),
      maintenanceSettings: settings.maintenanceSettings,
      paymentGatewayEnabled: settings.paymentGatewayEnabled,
      defaultPaymentProvider: settings.defaultPaymentProvider,
    }),
    [
      settings,
      loading,
      error,
      lastFetched,
      fetchSettings,
      getSetting,
      calculateShipping,
      calculateTax,
      formatPrice,
      isCODAvailable,
      isValidOrderAmount,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

/**
 * useSettings Hook
 * Access settings anywhere in the client app
 */
export const useSettings = () => {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }

  return context;
};

export default SettingsContext;
