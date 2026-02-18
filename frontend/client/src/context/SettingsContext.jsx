"use client";

import { API_BASE_URL } from "@/utils/api";

import { createContext, useContext, useEffect, useState } from "react";

const SettingsContext = createContext();

const API_URL = String(API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");
const USE_DEV_PROXY = process.env.NODE_ENV !== "production";

const buildApiUrl = (path) => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path)
    : `/${String(path || "")}`;
  const apiPath = normalizedPath.startsWith("/api/")
    ? normalizedPath
    : `/api${normalizedPath}`;

  if (USE_DEV_PROXY) {
    return apiPath;
  }

  return `${API_URL}${apiPath}`;
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
    name: "BuyOneGram",
    email: "support@buyonegram.com",
    phone: "+91 9876541234",
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
  // Traffic notice
  highTrafficNotice: {
    enabled: true,
    message:
      "High traffic — availability may vary. Your order will be processed once confirmed.",
  },
  // Maintenance
  maintenanceMode: false,
  // Payment
  paymentGatewayEnabled: true,
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

  /**
   * Fetch public settings from API
   */
  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(buildApiUrl("/settings/public"), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }

      const data = await response.json();

      if (data.success && data.data) {
        // Merge with defaults to ensure all keys exist
        setSettings({
          ...defaultSettings,
          ...data.data,
        });
        setLastFetched(new Date());
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError(err.message);
      // Keep using default settings on error
    } finally {
      setLoading(false);
    }
  };

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  /**
   * Get a specific setting value with fallback
   * @param {string} key - The setting key (e.g., "shippingSettings.freeShippingThreshold")
   * @param {any} fallback - Fallback value if key not found
   */
  const getSetting = (key, fallback = null) => {
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
  };

  /**
   * Calculate shipping cost based on cart total
   * @param {number} cartTotal - Cart subtotal
   * @param {string} shippingType - "standard" or "express"
   */
  const calculateShipping = (cartTotal, shippingType = "standard") => {
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
  };

  /**
   * Calculate tax amount based on subtotal
   * @param {number} subtotal - Subtotal amount
   */
  const calculateTax = (subtotal) => {
    const tax = settings.taxSettings;

    if (!tax.enabled || tax.taxIncludedInPrice) {
      return 0;
    }

    return Math.round((subtotal * tax.taxRate) / 100);
  };

  /**
   * Format price with store currency symbol
   * @param {number} amount - Amount to format
   */
  const formatPrice = (amount) => {
    const symbol = settings.storeInfo?.currencySymbol || "₹";
    return `${symbol}${Number(amount || 0).toLocaleString("en-IN")}`;
  };

  /**
   * Check if COD is available for given amount
   * @param {number} orderTotal - Order total
   */
  const isCODAvailable = (orderTotal) => {
    const order = settings.orderSettings;

    if (!order.codEnabled) return false;
    if (orderTotal < order.codMinOrder) return false;
    if (orderTotal > order.codMaxOrder) return false;

    return true;
  };

  /**
   * Check if order amount is valid
   * @param {number} orderTotal - Order total
   */
  const isValidOrderAmount = (orderTotal) => {
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
  };

  const value = {
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
    // Other flags
    highTrafficNotice: settings.highTrafficNotice,
    maintenanceMode: settings.maintenanceMode,
    paymentGatewayEnabled: settings.paymentGatewayEnabled,
  };

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
