"use client";

import { getData, putData, uploadFile } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import Image from "next/image";

import { useAdmin } from "@/context/AdminContext";
import {
  Alert,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  TextField,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MdAdd,
  MdDeleteOutline,
  MdFolder,
  MdFolderOpen,
  MdOutlineArticle,
  MdLocalOffer,
  MdLocalShipping,
  MdPercent,
  MdReceiptLong,
  MdRefresh,
  MdSave,
  MdShoppingCart,
  MdStore,
  MdWarning,
} from "react-icons/md";

const POPUP_REDIRECT_TYPES = {
  product: "product",
  category: "category",
  custom: "custom",
};
const defaultPopupSettings = {
  id: "",
  title: "Limited Time Offer",
  description: "Discover our latest products and exclusive offers.",
  imageUrl: "",
  redirectType: POPUP_REDIRECT_TYPES.custom,
  redirectValue: "",
  startDate: "",
  expiryDate: "",
  isActive: false,
  showOncePerSession: false,
  backgroundColor: "#f7f1ef",
  buttonText: "Shop Now",
  couponCode: "",
};
const DEFAULT_FLAVOUR_BUTTON_SETTINGS = {
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
};
const DEFAULT_HOMEPAGE_TRUST_SETTINGS = {
  homepage_trust_1_text: "100% Natural",
  homepage_trust_2_text: "No Palm Oil",
  homepage_trust_3_text: "High Protein",
  homepage_trust_4_text: "Fast Moving Picks",
};
const FLAVOUR_BUTTON_FIELDS = [
  {
    label: "Creamy",
    textKey: "flavour_button_1_text",
    bgKey: "flavour_button_1_bg_color",
    textColorKey: "flavour_button_1_text_color",
  },
  {
    label: "Chocolate",
    textKey: "flavour_button_2_text",
    bgKey: "flavour_button_2_bg_color",
    textColorKey: "flavour_button_2_text_color",
  },
  {
    label: "Daizu",
    textKey: "flavour_button_3_text",
    bgKey: "flavour_button_3_bg_color",
    textColorKey: "flavour_button_3_text_color",
  },
  {
    label: "Low-calorie",
    textKey: "flavour_button_4_text",
    bgKey: "flavour_button_4_bg_color",
    textColorKey: "flavour_button_4_text_color",
  },
];
const HOMEPAGE_TRUST_FIELDS = [
  {
    label: "Trust Pill 1",
    key: "homepage_trust_1_text",
    fallback: "100% Natural",
  },
  {
    label: "Trust Pill 2",
    key: "homepage_trust_2_text",
    fallback: "No Palm Oil",
  },
  {
    label: "Trust Pill 3",
    key: "homepage_trust_3_text",
    fallback: "High Protein",
  },
  {
    label: "Trust Pill 4",
    key: "homepage_trust_4_text",
    fallback: "Fast Moving Picks",
  },
];
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const SERIES_PREFIX_PATTERN = /^[a-z0-9-]{1,10}$/i;
const FISCAL_YEAR_CODE_PATTERN = /^\d{4}$/;

const isHexColor = (value) =>
  HEX_COLOR_PATTERN.test(String(value || "").trim());

const resolveFiscalYearCode = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based
  // India FY: Apr (3) -> Mar (2)
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  const yy = (num) => String(num).slice(-2);
  return `${yy(startYear)}${yy(endYear)}`;
};

const toDateTimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const toIsoIfPresent = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
};

const ORDER_SETTINGS_DEFAULTS = {
  minimumOrderValue: 0,
  maximumOrderValue: 50000,
  maxItemsPerOrder: 20,
  codEnabled: false,
  codMinOrder: 200,
  codMaxOrder: 5000,
  orderSeriesPrefix: "H1G",
  orderSeriesPadding: 4,
};

const DEFAULT_MAINTENANCE_SETTINGS = {
  maintenanceEnabled: false,
  maintenanceStartTime: "",
  maintenanceEndTime: "",
  maintenanceMessage:
    "We are currently undergoing scheduled maintenance. Please check back soon.",
  showCountdown: true,
};

const buildOrderSeriesPreview = (settings = {}) => {
  const prefix =
    String(settings.orderSeriesPrefix || "H1G")
      .trim()
      .toUpperCase() || "H1G";
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const fyStart = month >= 3 ? year : year - 1;
  const fyEnd = fyStart + 1;
  const fyCode = `${String(fyStart).slice(-2)}${String(fyEnd).slice(-2)}`;
  const padding = Math.min(
    8,
    Math.max(3, Number(settings.orderSeriesPadding) || 4),
  );
  const sequence = String(1).padStart(padding, "0");
  return `${prefix}${fyCode}/${sequence}`;
};

const DEFAULT_SEO_PAGE_ENTRIES = [
  {
    label: "Blank SEO Page",
    path: "",
    metaTitle: "",
    metaDescription: "",
    keywords: "",
    indexable: false,
    notes: "Use this row as a blank SEO template for a new page.",
  },
  {
    label: "Home",
    path: "/",
    metaTitle: "Buy OneGram - Premium Health Products",
    metaDescription:
      "Shop premium quality peanut butter and healthy food products at Buy OneGram.",
    keywords: "peanut butter, healthy food, organic, natural, protein",
    indexable: true,
    notes: "Main homepage SEO entry.",
  },
  {
    label: "Products",
    path: "/products",
    metaTitle: "Healthy Products | Buy OneGram",
    metaDescription:
      "Browse healthy pantry essentials, protein-rich snacks, and wellness products from Buy OneGram.",
    keywords: "healthy products, peanut butter, snacks, protein, wellness",
    indexable: true,
    notes: "Catalog landing page.",
  },
  {
    label: "Blogs",
    path: "/blogs",
    metaTitle: "Wellness Blog | Buy OneGram",
    metaDescription:
      "Read nutrition tips, healthy eating guides, and product advice from Buy OneGram.",
    keywords: "health blog, nutrition tips, wellness, healthy eating",
    indexable: true,
    notes: "Content hub for search traffic.",
  },
  {
    label: "About",
    path: "/about",
    metaTitle: "About Buy OneGram",
    metaDescription:
      "Learn more about Buy OneGram, our story, and the healthy products we build for everyday use.",
    keywords: "about buy onegram, healthy brand, peanut butter store",
    indexable: true,
    notes: "Brand story page.",
  },
  {
    label: "Membership",
    path: "/membership",
    metaTitle: "Membership Benefits | Buy OneGram",
    metaDescription:
      "Unlock premium membership benefits, savings, and rewards with Buy OneGram.",
    keywords: "membership benefits, rewards, savings, healthy products",
    indexable: true,
    notes: "Membership landing page.",
  },
  {
    label: "Healthy Peanut Butter Guide",
    path: "/healthy-peanut-butter-guide",
    metaTitle: "Healthy Peanut Butter Guide | Buy OneGram",
    metaDescription:
      "Explore how to choose healthy peanut butter, simple snack ideas, and ingredient tips from Buy OneGram.",
    keywords:
      "healthy peanut butter, snack ideas, ingredient tips, wellness guide",
    indexable: true,
    notes: "SEO guide page.",
  },
  {
    label: "Login",
    path: "/login",
    metaTitle: "Login | Buy OneGram",
    metaDescription: "Sign in to your Buy OneGram account.",
    keywords: "login, account sign in",
    indexable: false,
    notes: "Usually noindex.",
  },
  {
    label: "Register",
    path: "/register",
    metaTitle: "Register | Buy OneGram",
    metaDescription: "Create your Buy OneGram account.",
    keywords: "register, create account",
    indexable: false,
    notes: "Usually noindex.",
  },
];

const DEFAULT_SEO_IMAGE_ENTRIES = [
  {
    label: "Logo",
    target: "/logo.png",
    altText: "Buy OneGram logo",
    titleText: "Buy OneGram",
    notes: "Keep the brand logo alt text short.",
  },
  {
    label: "Homepage banners",
    target: "Homepage hero and promotional sliders",
    altText: "Buy OneGram premium health products banner",
    titleText: "Homepage banner",
    notes: "Use for hero banners and promotional creatives.",
  },
  {
    label: "Product images",
    target: "/product/[id]",
    altText: "Product image",
    titleText: "Product image",
    notes: "Prefer descriptive product names in the storefront component.",
  },
  {
    label: "Blog covers",
    target: "/blogs/[slug]",
    altText: "Blog cover image",
    titleText: "Blog image",
    notes: "Pair the blog title with the topic when used dynamically.",
  },
];

const cloneSeoPageEntry = (entry = {}) => ({
  label: String(entry.label || "Page").trim() || "Page",
  path: String(entry.path || "/").trim() || "/",
  metaTitle: String(entry.metaTitle || "").trim(),
  metaDescription: String(entry.metaDescription || "").trim(),
  keywords: String(entry.keywords || "").trim(),
  indexable: entry.indexable === undefined ? true : Boolean(entry.indexable),
  notes: String(entry.notes || "").trim(),
});

const cloneSeoImageEntry = (entry = {}) => ({
  label: String(entry.label || "Image").trim() || "Image",
  target: String(entry.target || "").trim(),
  altText: String(entry.altText || "").trim(),
  titleText: String(entry.titleText || "").trim(),
  notes: String(entry.notes || "").trim(),
});

const DEFAULT_SEO_SETTINGS = {
  pages: DEFAULT_SEO_PAGE_ENTRIES.map(cloneSeoPageEntry),
  imageAltTexts: DEFAULT_SEO_IMAGE_ENTRIES.map(cloneSeoImageEntry),
};

const createBlankSeoPageEntry = () =>
  cloneSeoPageEntry({
    label: "Blank SEO Page",
    path: "",
    metaTitle: "",
    metaDescription: "",
    keywords: "",
    indexable: false,
    notes: "Use this row as a blank SEO template for a new page.",
  });

const normalizeSeoSettings = (value) => {
  const raw = value && typeof value === "object" ? value : {};
  const pages = Array.isArray(raw.pages) ? raw.pages : [];
  const imageAltTexts = Array.isArray(raw.imageAltTexts)
    ? raw.imageAltTexts
    : [];

  return {
    pages:
      pages.length > 0
        ? pages.map(cloneSeoPageEntry)
        : DEFAULT_SEO_SETTINGS.pages.map(cloneSeoPageEntry),
    imageAltTexts:
      imageAltTexts.length > 0
        ? imageAltTexts.map(cloneSeoImageEntry)
        : DEFAULT_SEO_SETTINGS.imageAltTexts.map(cloneSeoImageEntry),
  };
};

/**
 * Store Settings Page
 * Admin panel for managing shipping, store, and order settings
 */
const SettingsPage = () => {
  const { token } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Settings State
  const [shippingSettings, setShippingSettings] = useState({
    freeShippingThreshold: 500,
    standardShippingCost: 50,
    expressShippingCost: 100,
    freeShippingEnabled: true,
    estimatedDelivery: {
      standard: "5-7 business days",
      express: "2-3 business days",
    },
  });

  const [orderSettings, setOrderSettings] = useState(ORDER_SETTINGS_DEFAULTS);

  const [orderNumberSeries, setOrderNumberSeries] = useState({
    enabled: false,
    prefix: "H1G",
    fiscalYearCode: "",
  });

  const [discountSettings, setDiscountSettings] = useState({
    maxDiscountPercentage: 50,
    stackableCoupons: false,
    firstOrderDiscount: {
      enabled: true,
      percentage: 10,
      maxDiscount: 100,
    },
  });

  const [siteControls, setSiteControls] = useState({
    paymentGatewayEnabled: false,
    defaultPaymentProvider: "PHONEPE",
  });
  const [maintenanceSettings, setMaintenanceSettings] = useState(
    DEFAULT_MAINTENANCE_SETTINGS,
  );
  const [offerPopupSettings, setOfferPopupSettings] = useState({
    showOfferPopup: true,
    offerCouponCode: "",
    offerTitle: "Special Offer!",
    offerDescription: "Use this code to get a discount on your order!",
    offerDiscountText: "Get Discount",
  });

  const [storeInfo, setStoreInfo] = useState({
    name: "BuyOneGram",
    email: "healthyonegram.com",
    phone: "+91 9876541234",
    address: "",
    gstNumber: "",
    currency: "INR",
    currencySymbol: "₹",
  });

  const [popupSettings, setPopupSettings] = useState(defaultPopupSettings);
  const [popupProducts, setPopupProducts] = useState([]);
  const [popupCategories, setPopupCategories] = useState([]);
  const [popupImageUploading, setPopupImageUploading] = useState(false);
  const [flavourButtonSettings, setFlavourButtonSettings] = useState(
    DEFAULT_FLAVOUR_BUTTON_SETTINGS,
  );
  const [homepageTrustSettings, setHomepageTrustSettings] = useState(
    DEFAULT_HOMEPAGE_TRUST_SETTINGS,
  );

  // High Traffic Notice
  const [highTrafficNotice, setHighTrafficNotice] = useState({
    enabled: false,
    message:
      "High traffic — availability may vary. Your order will be processed once confirmed.",
  });

  const setToast = useCallback((message, severity = "success") => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  }, []);

  const orderSeriesPreview = useMemo(
    () => buildOrderSeriesPreview(orderSettings),
    [orderSettings],
  );

  const validatePopupConfig = useCallback((value) => {
    if (!String(value.title || "").trim()) {
      return { valid: false, message: "Popup title is required." };
    }

    if (!String(value.description || "").trim()) {
      return { valid: false, message: "Popup description is required." };
    }

    if (!String(value.buttonText || "").trim()) {
      return { valid: false, message: "CTA button text is required." };
    }

    const hasStartDate = Boolean(value.startDate);
    const hasExpiryDate = Boolean(value.expiryDate);
    const requiresSchedule = Boolean(
      value.isActive || hasStartDate || hasExpiryDate,
    );

    if (requiresSchedule && (!hasStartDate || !hasExpiryDate)) {
      return {
        valid: false,
        message: "Start date and expiry date are required.",
      };
    }

    if (requiresSchedule) {
      const startDate = new Date(value.startDate);
      const expiryDate = new Date(value.expiryDate);
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(expiryDate.getTime()) ||
        expiryDate <= startDate
      ) {
        return {
          valid: false,
          message: "Expiry date must be greater than start date.",
        };
      }
    }

    const requiresRedirect =
      value.redirectType === POPUP_REDIRECT_TYPES.product ||
      value.redirectType === POPUP_REDIRECT_TYPES.category;
    if (requiresRedirect && !String(value.redirectValue || "").trim()) {
      return {
        valid: false,
        message: "Please select a redirect target for product/category popup.",
      };
    }

    if (
      value.redirectType === POPUP_REDIRECT_TYPES.custom &&
      value.isActive &&
      !String(value.redirectValue || "").trim()
    ) {
      return {
        valid: false,
        message: "Custom redirect URL is required when popup is active.",
      };
    }

    if (
      !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(
        String(value.backgroundColor || "").trim(),
      )
    ) {
      return {
        valid: false,
        message: "Background color must be a valid hex color (e.g. #f7f1ef).",
      };
    }

    if (
      String(value.couponCode || "").trim() &&
      !/^[A-Z0-9_-]{3,50}$/.test(
        String(value.couponCode || "")
          .trim()
          .toUpperCase(),
      )
    ) {
      return {
        valid: false,
        message:
          "Popup coupon code must be 3-50 characters and contain only letters, numbers, underscore, or hyphen.",
      };
    }

    return { valid: true, message: "" };
  }, []);

  const mapPopupPayloadToState = useCallback((popupData) => {
    if (!popupData) return defaultPopupSettings;
    return {
      ...defaultPopupSettings,
      ...popupData,
      showOncePerSession: false,
      startDate: toDateTimeLocal(popupData.startDate),
      expiryDate: toDateTimeLocal(popupData.expiryDate),
    };
  }, []);

  const fetchPopupResources = useCallback(
    async (adminToken) => {
      try {
        const popupData = await getData("/api/admin/popup", adminToken);
        if (popupData?.success && popupData?.data) {
          setPopupSettings(mapPopupPayloadToState(popupData.data));
        }
      } catch (error) {
        console.warn("Popup settings fetch failed:", error);
      }

      try {
        const [productResponse, categoryResponse] = await Promise.all([
          getData("/api/products?limit=250&sortBy=name&order=asc", adminToken),
          getData("/api/categories?flat=true&active=true", adminToken),
        ]);

        if (productResponse?.success && Array.isArray(productResponse?.data)) {
          const productOptions = productResponse.data
            .filter((product) => product?._id)
            .map((product) => ({
              value: product._id,
              label: product.name || product._id,
            }));
          setPopupProducts(productOptions);
        }

        if (
          categoryResponse?.success &&
          Array.isArray(categoryResponse?.data)
        ) {
          const categoryOptions = categoryResponse.data
            .filter((category) => category?.slug)
            .map((category) => ({
              value: category.slug,
              label: category.name || category.slug,
            }));
          setPopupCategories(categoryOptions);
        }
      } catch (error) {
        console.warn("Popup redirect options fetch failed:", error);
      }
    },
    [mapPopupPayloadToState],
  );

  const savePopupConfig = useCallback(
    async (value) => {
      const adminToken = token || localStorage.getItem("adminToken");
      if (!adminToken) {
        return {
          success: false,
          message: "Admin session expired. Please login again.",
        };
      }

      const data = await putData(
        "/api/admin/popup",
        {
          title: String(value.title || "").trim(),
          description: String(value.description || "").trim(),
          imageUrl: String(value.imageUrl || "").trim(),
          redirectType: value.redirectType,
          redirectValue: String(value.redirectValue || "").trim(),
          startDate: toIsoIfPresent(value.startDate),
          expiryDate: toIsoIfPresent(value.expiryDate),
          isActive: !!value.isActive,
          showOncePerSession: false,
          backgroundColor: String(value.backgroundColor || "").trim(),
          buttonText: String(value.buttonText || "").trim(),
          couponCode: String(value.couponCode || "")
            .trim()
            .toUpperCase(),
        },
        adminToken,
      );

      if (data?.success && data?.data) {
        setPopupSettings(mapPopupPayloadToState(data.data));
        return { success: true, message: data?.message || "Popup saved." };
      }

      return {
        success: false,
        message: data?.message || "Failed to save popup settings",
      };
    },
    [mapPopupPayloadToState, token],
  );

  const handlePopupImageUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const adminToken = token || localStorage.getItem("adminToken");
      if (!adminToken) {
        setToast("Admin session expired. Please login again.", "error");
        event.target.value = "";
        return;
      }

      try {
        setPopupImageUploading(true);
        const uploadResponse = await uploadFile(file, adminToken);
        if (uploadResponse?.success && uploadResponse?.data?.url) {
          setPopupSettings((prev) => ({
            ...prev,
            imageUrl: uploadResponse.data.url,
          }));
          setToast("Popup image uploaded.");
        } else {
          setToast(uploadResponse?.message || "Image upload failed", "error");
        }
      } catch (error) {
        console.error("Popup image upload failed:", error);
        setToast("Image upload failed", "error");
      } finally {
        setPopupImageUploading(false);
        event.target.value = "";
      }
    },
    [setToast, token],
  );

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const adminToken = token || localStorage.getItem("adminToken");
      if (!adminToken) {
        setLoading(false);
        return;
      }

      const data = await getData("/api/settings/admin/all", adminToken);

      if (data.success && data.data) {
        // Map settings by key
        data.data.forEach((setting) => {
          if (
            Object.prototype.hasOwnProperty.call(
              DEFAULT_FLAVOUR_BUTTON_SETTINGS,
              setting.key,
            )
          ) {
            setFlavourButtonSettings((prev) => ({
              ...prev,
              [setting.key]: String(setting.value ?? ""),
            }));
            return;
          }

          if (
            Object.prototype.hasOwnProperty.call(
              DEFAULT_HOMEPAGE_TRUST_SETTINGS,
              setting.key,
            )
          ) {
            setHomepageTrustSettings((prev) => ({
              ...prev,
              [setting.key]: String(setting.value ?? ""),
            }));
            return;
          }

          switch (setting.key) {
            case "shippingSettings":
              setShippingSettings(setting.value);
              break;
            case "orderSettings":
              setOrderSettings({
                ...ORDER_SETTINGS_DEFAULTS,
                ...(setting.value || {}),
              });
              break;
            case "orderNumberSeries": {
              const raw =
                setting?.value && typeof setting.value === "object"
                  ? setting.value
                  : null;
              setOrderNumberSeries((prev) => ({
                ...prev,
                ...(raw
                  ? {
                      enabled: raw.enabled === true,
                      prefix: String(raw.prefix || prev.prefix || "H1G")
                        .trim()
                        .toUpperCase(),
                      fiscalYearCode: String(raw.fiscalYearCode || "").trim(),
                    }
                  : {}),
              }));
              break;
            }
            case "discountSettings":
              setDiscountSettings(setting.value);
              break;
            case "storeInfo":
              setStoreInfo(setting.value);
              break;
            case "paymentGatewayEnabled":
              setSiteControls((prev) => ({
                ...prev,
                paymentGatewayEnabled: !!setting.value,
              }));
              break;
            case "defaultPaymentProvider":
              setSiteControls((prev) => ({
                ...prev,
                defaultPaymentProvider:
                  String(setting.value || "")
                    .trim()
                    .toUpperCase() === "PAYTM"
                    ? "PAYTM"
                    : "PHONEPE",
              }));
              break;
            case "maintenanceMode":
              setMaintenanceSettings((prev) => ({
                ...prev,
                maintenanceEnabled: !!setting.value,
              }));
              break;
            case "maintenanceSettings":
              setMaintenanceSettings((prev) => ({
                ...prev,
                ...DEFAULT_MAINTENANCE_SETTINGS,
                ...(setting?.value && typeof setting.value === "object"
                  ? {
                      maintenanceEnabled: !!setting.value.maintenanceEnabled,
                      maintenanceStartTime: toDateTimeLocal(
                        setting.value.maintenanceStartTime,
                      ),
                      maintenanceEndTime: toDateTimeLocal(
                        setting.value.maintenanceEndTime,
                      ),
                      maintenanceMessage: String(
                        setting.value.maintenanceMessage ||
                          DEFAULT_MAINTENANCE_SETTINGS.maintenanceMessage,
                      ).trim(),
                      showCountdown:
                        setting.value.showCountdown === undefined
                          ? true
                          : !!setting.value.showCountdown,
                    }
                  : {}),
              }));
              break;
            case "highTrafficNotice":
              setHighTrafficNotice(setting.value);
              break;
            case "showOfferPopup":
              setOfferPopupSettings((prev) => ({
                ...prev,
                showOfferPopup: !!setting.value,
              }));
              break;
            case "offerCouponCode":
              setOfferPopupSettings((prev) => ({
                ...prev,
                offerCouponCode: String(setting.value || "")
                  .trim()
                  .toUpperCase(),
              }));
              break;
            case "offerTitle":
              setOfferPopupSettings((prev) => ({
                ...prev,
                offerTitle: String(setting.value || "").trim(),
              }));
              break;
            case "offerDescription":
              setOfferPopupSettings((prev) => ({
                ...prev,
                offerDescription: String(setting.value || "").trim(),
              }));
              break;
            case "offerDiscountText":
              setOfferPopupSettings((prev) => ({
                ...prev,
                offerDiscountText: String(setting.value || "").trim(),
              }));
              break;
          }
        });
      }

      await fetchPopupResources(adminToken);
    } catch (error) {
      console.warn("Settings fetch failed:", error);
      setSnackbar({
        open: true,
        message: "Failed to load settings",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [fetchPopupResources, token]);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, [token, fetchSettings]);

  const saveSetting = async (key, value) => {
    try {
      const adminToken = token || localStorage.getItem("adminToken");
      const response = await putData(
        `/api/settings/admin/${key}`,
        { value },
        adminToken,
      );
      return Boolean(response?.success);
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
      return false;
    }
  };

  const handleSaveAll = async () => {
    const popupValidation = validatePopupConfig(popupSettings);
    if (!popupValidation.valid) {
      setToast(popupValidation.message, "error");
      return;
    }
    if (
      offerPopupSettings.showOfferPopup &&
      !String(offerPopupSettings.offerCouponCode || "").trim()
    ) {
      setToast(
        "Coupon code is required when Welcome Offer Popup is enabled.",
        "error",
      );
      return;
    }

    const invalidFlavourColorField = FLAVOUR_BUTTON_FIELDS.flatMap((field) => [
      {
        key: field.bgKey,
        label: `${field.label} background color`,
      },
      {
        key: field.textColorKey,
        label: `${field.label} text color`,
      },
    ]).find((field) => {
      const value = String(flavourButtonSettings[field.key] || "").trim();
      return value && !isHexColor(value);
    });

    if (invalidFlavourColorField) {
      setToast(
        `${invalidFlavourColorField.label} must be a valid hex color.`,
        "error",
      );
      return;
    }

    if (orderNumberSeries.enabled) {
      const safePrefix = String(orderNumberSeries.prefix || "").trim();
      if (!SERIES_PREFIX_PATTERN.test(safePrefix)) {
        setToast(
          "Order series prefix must be 1-10 letters/numbers/hyphen.",
          "error",
        );
        return;
      }
      const safeFy = String(orderNumberSeries.fiscalYearCode || "").trim();
      if (safeFy && !FISCAL_YEAR_CODE_PATTERN.test(safeFy)) {
        setToast("Fiscal year code must be 4 digits (e.g., 2526).", "error");
        return;
      }
    }

    if (
      maintenanceSettings.maintenanceStartTime &&
      maintenanceSettings.maintenanceEndTime
    ) {
      const start = new Date(maintenanceSettings.maintenanceStartTime);
      const end = new Date(maintenanceSettings.maintenanceEndTime);
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
      ) {
        setToast(
          "Maintenance end time must be greater than maintenance start time.",
          "error",
        );
        return;
      }
    }

    setSaving(true);
    try {
      const flavourButtonSaveCalls = Object.entries(flavourButtonSettings).map(
        ([key, value]) => saveSetting(key, String(value || "").trim()),
      );
      const homepageTrustSaveCalls = Object.entries(homepageTrustSettings).map(
        ([key, value]) => saveSetting(key, String(value || "").trim()),
      );
      const fixedSaveResults = await Promise.all([
        savePopupConfig(popupSettings),
        saveSetting("shippingSettings", shippingSettings),
        saveSetting("orderSettings", orderSettings),
        saveSetting("orderNumberSeries", orderNumberSeries),
        saveSetting("discountSettings", discountSettings),
        saveSetting("storeInfo", storeInfo),
        saveSetting("highTrafficNotice", highTrafficNotice),
        saveSetting(
          "paymentGatewayEnabled",
          siteControls.paymentGatewayEnabled,
        ),
        saveSetting(
          "defaultPaymentProvider",
          String(siteControls.defaultPaymentProvider || "PHONEPE")
            .trim()
            .toUpperCase(),
        ),
        saveSetting("maintenanceSettings", {
          maintenanceEnabled: !!maintenanceSettings.maintenanceEnabled,
          maintenanceStartTime: toIsoIfPresent(
            maintenanceSettings.maintenanceStartTime,
          ),
          maintenanceEndTime: toIsoIfPresent(
            maintenanceSettings.maintenanceEndTime,
          ),
          maintenanceMessage: String(
            maintenanceSettings.maintenanceMessage ||
              DEFAULT_MAINTENANCE_SETTINGS.maintenanceMessage,
          ).trim(),
          showCountdown: !!maintenanceSettings.showCountdown,
        }),
        saveSetting(
          "maintenanceMode",
          !!maintenanceSettings.maintenanceEnabled,
        ),
        saveSetting("showOfferPopup", !!offerPopupSettings.showOfferPopup),
        saveSetting(
          "offerCouponCode",
          String(offerPopupSettings.offerCouponCode || "")
            .trim()
            .toUpperCase(),
        ),
        saveSetting(
          "offerTitle",
          String(offerPopupSettings.offerTitle || "").trim(),
        ),
        saveSetting(
          "offerDescription",
          String(offerPopupSettings.offerDescription || "").trim(),
        ),
        saveSetting(
          "offerDiscountText",
          String(offerPopupSettings.offerDiscountText || "").trim(),
        ),
      ]);
      const dynamicSaveResults = await Promise.all([
        ...flavourButtonSaveCalls,
        ...homepageTrustSaveCalls,
      ]);

      const [
        popupSaveResult,
        shippingSaved,
        orderSaved,
        orderNumberSeriesSaved,
        discountSaved,
        storeSaved,
        trafficSaved,
        paymentSaved,
        defaultPaymentProviderSaved,
        maintenanceSettingsSaved,
        maintenanceSaved,
        showOfferPopupSaved,
        offerCouponCodeSaved,
        offerTitleSaved,
        offerDescriptionSaved,
        offerDiscountTextSaved,
      ] = fixedSaveResults;

      const flavourButtonSavedResults = dynamicSaveResults.slice(
        0,
        flavourButtonSaveCalls.length,
      );
      const homepageTrustSavedResults = dynamicSaveResults.slice(
        flavourButtonSaveCalls.length,
      );

      const coreSettingsSaved = [
        shippingSaved,
        orderSaved,
        orderNumberSeriesSaved,
        discountSaved,
        storeSaved,
        trafficSaved,
        paymentSaved,
        defaultPaymentProviderSaved,
        maintenanceSettingsSaved,
        maintenanceSaved,
        showOfferPopupSaved,
        offerCouponCodeSaved,
        offerTitleSaved,
        offerDescriptionSaved,
        offerDiscountTextSaved,
        ...flavourButtonSavedResults,
        ...homepageTrustSavedResults,
      ].every(Boolean);

      if (popupSaveResult.success && coreSettingsSaved) {
        setToast("All settings saved successfully!", "success");
      } else {
        setToast(
          popupSaveResult.success
            ? "Some settings failed to save"
            : popupSaveResult.message || "Popup settings failed to save",
          popupSaveResult.success ? "warning" : "error",
        );
      }
    } catch (error) {
      setToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Store Settings</h1>
          <p className="text-gray-500 mt-1">
            Manage shipping, order, and store configurations
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outlined"
            startIcon={<MdRefresh />}
            onClick={fetchSettings}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={
              saving ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <MdSave />
              )
            }
            onClick={handleSaveAll}
            disabled={saving}
            sx={{ bgcolor: "#c1591c", "&:hover": { bgcolor: "#a04a15" } }}
          >
            {saving ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      </div>

      {/* Shipping Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MdLocalShipping className="text-2xl text-orange-500" />
          <h2 className="text-lg font-semibold text-gray-800">
            Shipping Settings
          </h2>
        </div>
        <Divider className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormControlLabel
            control={
              <Switch
                checked={shippingSettings.freeShippingEnabled}
                onChange={(e) =>
                  setShippingSettings({
                    ...shippingSettings,
                    freeShippingEnabled: e.target.checked,
                  })
                }
                color="warning"
              />
            }
            label="Enable Free Shipping (above threshold)"
          />

          <TextField
            label="Free Shipping Threshold"
            type="number"
            value={shippingSettings.freeShippingThreshold}
            onChange={(e) =>
              setShippingSettings({
                ...shippingSettings,
                freeShippingThreshold: Number(e.target.value),
              })
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">₹</InputAdornment>
              ),
            }}
            size="small"
            fullWidth
          />

          <TextField
            label="Standard Shipping Cost"
            type="number"
            value={shippingSettings.standardShippingCost}
            onChange={(e) =>
              setShippingSettings({
                ...shippingSettings,
                standardShippingCost: Number(e.target.value),
              })
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">₹</InputAdornment>
              ),
            }}
            size="small"
            fullWidth
          />

          <TextField
            label="Express Shipping Cost"
            type="number"
            value={shippingSettings.expressShippingCost}
            onChange={(e) =>
              setShippingSettings({
                ...shippingSettings,
                expressShippingCost: Number(e.target.value),
              })
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">₹</InputAdornment>
              ),
            }}
            size="small"
            fullWidth
          />

          <TextField
            label="Standard Delivery Time"
            value={shippingSettings.estimatedDelivery?.standard || ""}
            onChange={(e) =>
              setShippingSettings({
                ...shippingSettings,
                estimatedDelivery: {
                  ...shippingSettings.estimatedDelivery,
                  standard: e.target.value,
                },
              })
            }
            size="small"
            fullWidth
            placeholder="e.g., 5-7 business days"
          />

          <TextField
            label="Express Delivery Time"
            value={shippingSettings.estimatedDelivery?.express || ""}
            onChange={(e) =>
              setShippingSettings({
                ...shippingSettings,
                estimatedDelivery: {
                  ...shippingSettings.estimatedDelivery,
                  express: e.target.value,
                },
              })
            }
            size="small"
            fullWidth
            placeholder="e.g., 2-3 business days"
          />
        </div>
      </div>

      {/* Order Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MdShoppingCart className="text-2xl text-green-500" />
          <h2 className="text-lg font-semibold text-gray-800">
            Order Settings
          </h2>
        </div>
        <Divider className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField
            label="Minimum Order Value"
            type="number"
            value={orderSettings.minimumOrderValue}
            onChange={(e) =>
              setOrderSettings({
                ...orderSettings,
                minimumOrderValue: Number(e.target.value),
              })
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">₹</InputAdornment>
              ),
            }}
            size="small"
            fullWidth
            helperText="Set to 0 for no minimum"
          />

          <TextField
            label="Maximum Order Value"
            type="number"
            value={orderSettings.maximumOrderValue}
            onChange={(e) =>
              setOrderSettings({
                ...orderSettings,
                maximumOrderValue: Number(e.target.value),
              })
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">₹</InputAdornment>
              ),
            }}
            size="small"
            fullWidth
          />

          <TextField
            label="Max Items Per Order"
            type="number"
            value={orderSettings.maxItemsPerOrder}
            onChange={(e) =>
              setOrderSettings({
                ...orderSettings,
                maxItemsPerOrder: Number(e.target.value),
              })
            }
            size="small"
            fullWidth
          />

          <TextField
            label="Order Series Prefix"
            value={orderSettings.orderSeriesPrefix || ""}
            onChange={(e) =>
              setOrderSettings({
                ...orderSettings,
                orderSeriesPrefix: String(e.target.value || "")
                  .toUpperCase()
                  .replace(/[^A-Z0-9-]/g, "")
                  .slice(0, 6),
              })
            }
            size="small"
            fullWidth
            helperText="Letters/numbers/hyphen. Example: H1G-"
          />

          <TextField
            label="Order Series Padding"
            type="number"
            value={orderSettings.orderSeriesPadding ?? 4}
            onChange={(e) =>
              setOrderSettings({
                ...orderSettings,
                orderSeriesPadding: Math.min(
                  8,
                  Math.max(3, Number(e.target.value) || 4),
                ),
              })
            }
            size="small"
            fullWidth
            helperText="Digits after slash"
          />

          <div className="md:col-span-2 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              FY Order Series Preview
            </p>
            <p className="mt-1 text-lg font-bold text-green-900">
              {orderSeriesPreview}
            </p>
          </div>

          <FormControlLabel
            control={
              <Switch
                checked={orderSettings.codEnabled}
                onChange={(e) =>
                  setOrderSettings({
                    ...orderSettings,
                    codEnabled: e.target.checked,
                  })
                }
                color="warning"
              />
            }
            label="Enable Cash on Delivery (COD)"
          />

          {orderSettings.codEnabled && (
            <>
              <TextField
                label="COD Minimum Order"
                type="number"
                value={orderSettings.codMinOrder}
                onChange={(e) =>
                  setOrderSettings({
                    ...orderSettings,
                    codMinOrder: Number(e.target.value),
                  })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                }}
                size="small"
                fullWidth
              />

              <TextField
                label="COD Maximum Order"
                type="number"
                value={orderSettings.codMaxOrder}
                onChange={(e) =>
                  setOrderSettings({
                    ...orderSettings,
                    codMaxOrder: Number(e.target.value),
                  })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                }}
                size="small"
                fullWidth
              />
            </>
          )}
        </div>
      </div>

      {/* Invoice / Order Series */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MdReceiptLong className="text-2xl text-indigo-500" />
          <h2 className="text-lg font-semibold text-gray-800">
            Invoice / Order Series
          </h2>
        </div>
        <Divider className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormControlLabel
            control={
              <Switch
                checked={orderNumberSeries.enabled}
                onChange={(e) =>
                  setOrderNumberSeries((prev) => ({
                    ...prev,
                    enabled: e.target.checked,
                  }))
                }
                color="primary"
              />
            }
            label="Enable admin override (recommended only when changing series)"
          />

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              label="Series Prefix"
              value={orderNumberSeries.prefix}
              onChange={(e) =>
                setOrderNumberSeries((prev) => ({
                  ...prev,
                  prefix: String(e.target.value || "")
                    .toUpperCase()
                    .replace(/[^A-Z0-9-]/g, "")
                    .slice(0, 10),
                }))
              }
              size="small"
              fullWidth
              helperText="Letters/numbers/hyphen. Example: H1G-"
              disabled={!orderNumberSeries.enabled}
            />

            <TextField
              label="Fiscal Year Code (optional)"
              value={orderNumberSeries.fiscalYearCode}
              onChange={(e) =>
                setOrderNumberSeries((prev) => ({
                  ...prev,
                  fiscalYearCode: e.target.value,
                }))
              }
              size="small"
              fullWidth
              helperText="4 digits. Leave blank for auto FY (India Apr-Mar). Example: 2526"
              disabled={!orderNumberSeries.enabled}
            />
          </div>
        </div>

        {(() => {
          const now = new Date();
          const month = now.getMonth();
          const year = now.getFullYear();
          const startYear = month >= 3 ? year : year - 1;
          const currentFy = resolveFiscalYearCode(now);
          const nextFy = resolveFiscalYearCode(new Date(startYear + 1, 3, 1));
          const safePrefix = String(orderNumberSeries.prefix || "H1G")
            .trim()
            .toUpperCase();
          const safeFyOverride = String(
            orderNumberSeries.fiscalYearCode || "",
          ).trim();
          const effectivePrefix = orderNumberSeries.enabled
            ? safePrefix
            : "H1G";
          const effectiveFy =
            orderNumberSeries.enabled && safeFyOverride
              ? safeFyOverride
              : currentFy;

          return (
            <div className="mt-4 text-sm text-gray-600">
              <p>
                Current FY code:{" "}
                <span className="font-mono font-semibold">{currentFy}</span>{" "}
                (next: <span className="font-mono font-semibold">{nextFy}</span>
                )
              </p>
              <p className="mt-1">
                Preview:{" "}
                <span className="font-mono font-semibold">
                  {effectivePrefix}
                  {effectiveFy}/0001
                </span>
              </p>
            </div>
          );
        })()}
      </div>

      {/* Discount Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MdPercent className="text-2xl text-emerald-500" />
          <h2 className="text-lg font-semibold text-gray-800">
            Discount Settings
          </h2>
        </div>
        <Divider className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField
            label="Max Discount Percentage"
            type="number"
            value={discountSettings.maxDiscountPercentage}
            onChange={(e) =>
              setDiscountSettings({
                ...discountSettings,
                maxDiscountPercentage: Number(e.target.value),
              })
            }
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
            size="small"
            fullWidth
          />

          <FormControlLabel
            control={
              <Switch
                checked={discountSettings.stackableCoupons}
                onChange={(e) =>
                  setDiscountSettings({
                    ...discountSettings,
                    stackableCoupons: e.target.checked,
                  })
                }
                color="warning"
              />
            }
            label="Allow Stackable Coupons"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormControlLabel
            control={
              <Switch
                checked={discountSettings.firstOrderDiscount?.enabled}
                onChange={(e) =>
                  setDiscountSettings({
                    ...discountSettings,
                    firstOrderDiscount: {
                      ...(discountSettings.firstOrderDiscount || {}),
                      enabled: e.target.checked,
                    },
                  })
                }
                color="warning"
              />
            }
            label="Enable First Order Discount"
          />
          <TextField
            label="First Order Discount %"
            type="number"
            value={discountSettings.firstOrderDiscount?.percentage || 0}
            onChange={(e) =>
              setDiscountSettings({
                ...discountSettings,
                firstOrderDiscount: {
                  ...(discountSettings.firstOrderDiscount || {}),
                  percentage: Number(e.target.value),
                },
              })
            }
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
            size="small"
            fullWidth
            disabled={!discountSettings.firstOrderDiscount?.enabled}
          />
          <TextField
            label="First Order Max Discount"
            type="number"
            value={discountSettings.firstOrderDiscount?.maxDiscount || 0}
            onChange={(e) =>
              setDiscountSettings({
                ...discountSettings,
                firstOrderDiscount: {
                  ...(discountSettings.firstOrderDiscount || {}),
                  maxDiscount: Number(e.target.value),
                },
              })
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">â‚¹</InputAdornment>
              ),
            }}
            size="small"
            fullWidth
            disabled={!discountSettings.firstOrderDiscount?.enabled}
          />
        </div>
      </div>

      {/* Site Controls */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MdWarning className="text-2xl text-red-500" />
          <h2 className="text-lg font-semibold text-gray-800">Site Controls</h2>
        </div>
        <Divider className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormControlLabel
            control={
              <Switch
                checked={siteControls.paymentGatewayEnabled}
                onChange={(e) =>
                  setSiteControls({
                    ...siteControls,
                    paymentGatewayEnabled: e.target.checked,
                  })
                }
                color="warning"
              />
            }
            label="Enable Payment Gateway"
          />

          <FormControlLabel
            control={
              <Switch
                checked={maintenanceSettings.maintenanceEnabled}
                onChange={(e) =>
                  setMaintenanceSettings((prev) => ({
                    ...prev,
                    maintenanceEnabled: e.target.checked,
                  }))
                }
                color="warning"
              />
            }
            label="Maintenance Mode"
          />

          <FormControlLabel
            control={
              <Switch
                checked={maintenanceSettings.showCountdown}
                onChange={(e) =>
                  setMaintenanceSettings((prev) => ({
                    ...prev,
                    showCountdown: e.target.checked,
                  }))
                }
                color="warning"
              />
            }
            label="Show Maintenance Countdown"
          />

          <TextField
            label="Maintenance Start Time"
            type="datetime-local"
            value={maintenanceSettings.maintenanceStartTime}
            onChange={(e) =>
              setMaintenanceSettings((prev) => ({
                ...prev,
                maintenanceStartTime: e.target.value,
              }))
            }
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Optional. Leave empty to start maintenance immediately when enabled."
          />

          <TextField
            label="Maintenance End Time"
            type="datetime-local"
            value={maintenanceSettings.maintenanceEndTime}
            onChange={(e) =>
              setMaintenanceSettings((prev) => ({
                ...prev,
                maintenanceEndTime: e.target.value,
              }))
            }
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Optional. If set, maintenance auto-disables after this time."
          />

          <TextField
            label="Maintenance Message"
            value={maintenanceSettings.maintenanceMessage}
            onChange={(e) =>
              setMaintenanceSettings((prev) => ({
                ...prev,
                maintenanceMessage: String(e.target.value || ""),
              }))
            }
            size="small"
            fullWidth
            multiline
            minRows={2}
          />
          <FormControl fullWidth size="small">
            <InputLabel id="default-payment-provider-label">
              Default Payment Provider
            </InputLabel>
            <Select
              labelId="default-payment-provider-label"
              value={siteControls.defaultPaymentProvider}
              label="Default Payment Provider"
              onChange={(e) =>
                setSiteControls((prev) => ({
                  ...prev,
                  defaultPaymentProvider: String(e.target.value || "PHONEPE")
                    .trim()
                    .toUpperCase(),
                }))
              }
            >
              <MenuItem value="PHONEPE">PhonePe</MenuItem>
              <MenuItem value="PAYTM">Paytm</MenuItem>
            </Select>
          </FormControl>
        </div>

        <p className="text-sm text-gray-500 mt-3">
          Payment gateway toggle respects environment credentials. The default
          provider is used across checkout when both gateways are available.
          Maintenance can be enabled immediately or scheduled with optional end
          time and countdown.
        </p>
      </div>

      {/* Welcome Offer Popup (Coupon) */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MdLocalOffer className="text-2xl text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-800">
            Welcome Offer Popup
          </h2>
        </div>
        <Divider className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormControlLabel
            control={
              <Switch
                checked={offerPopupSettings.showOfferPopup}
                onChange={(e) =>
                  setOfferPopupSettings((prev) => ({
                    ...prev,
                    showOfferPopup: e.target.checked,
                  }))
                }
                color="warning"
              />
            }
            label="Enable Welcome Offer Popup"
          />

          <TextField
            label="Coupon Code"
            value={offerPopupSettings.offerCouponCode}
            onChange={(e) =>
              setOfferPopupSettings((prev) => ({
                ...prev,
                offerCouponCode: String(e.target.value || "")
                  .replace(/\s+/g, "")
                  .toUpperCase(),
              }))
            }
            size="small"
            fullWidth
            helperText="Must match an existing coupon code"
          />

          <TextField
            label="Popup Title"
            value={offerPopupSettings.offerTitle}
            onChange={(e) =>
              setOfferPopupSettings((prev) => ({
                ...prev,
                offerTitle: e.target.value,
              }))
            }
            size="small"
            fullWidth
          />

          <TextField
            label="Discount Badge Text"
            value={offerPopupSettings.offerDiscountText}
            onChange={(e) =>
              setOfferPopupSettings((prev) => ({
                ...prev,
                offerDiscountText: e.target.value,
              }))
            }
            size="small"
            fullWidth
          />

          <TextField
            label="Popup Description"
            value={offerPopupSettings.offerDescription}
            onChange={(e) =>
              setOfferPopupSettings((prev) => ({
                ...prev,
                offerDescription: e.target.value,
              }))
            }
            size="small"
            fullWidth
            multiline
            rows={3}
            className="md:col-span-2"
          />
        </div>

        <p className="text-sm text-gray-500 mt-3">
          This controls the coupon welcome popup shown on storefront load. It is
          separate from Popup Management and separate from manual notifications.
        </p>
      </div>

      {/* Popup Management */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MdLocalOffer className="text-2xl text-pink-500" />
          <h2 className="text-lg font-semibold text-gray-800">
            Popup Management
          </h2>
        </div>
        <Divider className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormControlLabel
            control={
              <Switch
                checked={popupSettings.isActive}
                onChange={(e) =>
                  setPopupSettings((prev) => ({
                    ...prev,
                    isActive: e.target.checked,
                  }))
                }
                color="warning"
              />
            }
            label="Popup Active"
          />

          <TextField
            label="Popup Title"
            value={popupSettings.title}
            onChange={(e) =>
              setPopupSettings((prev) => ({
                ...prev,
                title: e.target.value,
              }))
            }
            size="small"
            fullWidth
            required
          />

          <TextField
            label="CTA Button Text"
            value={popupSettings.buttonText}
            onChange={(e) =>
              setPopupSettings((prev) => ({
                ...prev,
                buttonText: e.target.value,
              }))
            }
            size="small"
            fullWidth
            required
          />

          <TextField
            label="Popup Coupon Code (Optional)"
            value={popupSettings.couponCode}
            onChange={(e) =>
              setPopupSettings((prev) => ({
                ...prev,
                couponCode: String(e.target.value || "")
                  .replace(/\s+/g, "")
                  .toUpperCase(),
              }))
            }
            size="small"
            fullWidth
            helperText="Optional: if set, clicking popup CTA auto-fills this coupon on checkout."
          />

          <TextField
            label="Description"
            value={popupSettings.description}
            onChange={(e) =>
              setPopupSettings((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
            size="small"
            fullWidth
            multiline
            rows={3}
            className="md:col-span-2"
            required
          />

          <div className="md:col-span-2 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outlined"
                component="label"
                disabled={popupImageUploading}
              >
                {popupImageUploading ? "Uploading..." : "Upload Popup Image"}
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handlePopupImageUpload}
                />
              </Button>
              {popupImageUploading && <CircularProgress size={20} />}
            </div>
            <TextField
              label="Image URL"
              value={popupSettings.imageUrl}
              onChange={(e) =>
                setPopupSettings((prev) => ({
                  ...prev,
                  imageUrl: e.target.value,
                }))
              }
              size="small"
              fullWidth
              placeholder="https://..."
            />
          </div>

          <FormControl size="small" fullWidth>
            <InputLabel id="popup-redirect-type-label">
              Redirect Type
            </InputLabel>
            <Select
              labelId="popup-redirect-type-label"
              value={popupSettings.redirectType}
              label="Redirect Type"
              onChange={(e) =>
                setPopupSettings((prev) => ({
                  ...prev,
                  redirectType: e.target.value,
                  redirectValue: "",
                }))
              }
            >
              <MenuItem value={POPUP_REDIRECT_TYPES.product}>Product</MenuItem>
              <MenuItem value={POPUP_REDIRECT_TYPES.category}>
                Category
              </MenuItem>
              <MenuItem value={POPUP_REDIRECT_TYPES.custom}>Custom</MenuItem>
            </Select>
          </FormControl>

          {popupSettings.redirectType === POPUP_REDIRECT_TYPES.product ? (
            <FormControl size="small" fullWidth>
              <InputLabel id="popup-product-label">Product</InputLabel>
              <Select
                labelId="popup-product-label"
                value={popupSettings.redirectValue}
                label="Product"
                onChange={(e) =>
                  setPopupSettings((prev) => ({
                    ...prev,
                    redirectValue: e.target.value,
                  }))
                }
              >
                {popupProducts.map((product) => (
                  <MenuItem key={product.value} value={product.value}>
                    {product.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}

          {popupSettings.redirectType === POPUP_REDIRECT_TYPES.category ? (
            <FormControl size="small" fullWidth>
              <InputLabel id="popup-category-label">Category</InputLabel>
              <Select
                labelId="popup-category-label"
                value={popupSettings.redirectValue}
                label="Category"
                onChange={(e) =>
                  setPopupSettings((prev) => ({
                    ...prev,
                    redirectValue: e.target.value,
                  }))
                }
              >
                {popupCategories.map((category) => (
                  <MenuItem key={category.value} value={category.value}>
                    {category.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}

          {popupSettings.redirectType === POPUP_REDIRECT_TYPES.custom ? (
            <TextField
              label="Custom URL"
              value={popupSettings.redirectValue}
              onChange={(e) =>
                setPopupSettings((prev) => ({
                  ...prev,
                  redirectValue: e.target.value,
                }))
              }
              size="small"
              fullWidth
              placeholder="https://example.com or /products"
            />
          ) : null}

          <TextField
            label="Start Date"
            type="datetime-local"
            value={popupSettings.startDate}
            onChange={(e) =>
              setPopupSettings((prev) => ({
                ...prev,
                startDate: e.target.value,
              }))
            }
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
            required
          />

          <TextField
            label="Expiry Date"
            type="datetime-local"
            value={popupSettings.expiryDate}
            onChange={(e) =>
              setPopupSettings((prev) => ({
                ...prev,
                expiryDate: e.target.value,
              }))
            }
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
            required
          />

          <div className="flex items-center gap-3">
            <TextField
              label="Background Color"
              value={popupSettings.backgroundColor}
              onChange={(e) =>
                setPopupSettings((prev) => ({
                  ...prev,
                  backgroundColor: e.target.value,
                }))
              }
              size="small"
              sx={{ flex: 1 }}
            />
            <input
              type="color"
              value={popupSettings.backgroundColor}
              onChange={(e) =>
                setPopupSettings((prev) => ({
                  ...prev,
                  backgroundColor: e.target.value,
                }))
              }
              className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
              aria-label="Popup background color"
            />
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Live Preview
          </h3>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              backgroundColor: popupSettings.backgroundColor || "#f7f1ef",
              borderColor: "rgba(17, 24, 39, 0.1)",
            }}
          >
            {popupSettings.imageUrl ? (
              <div className="relative h-35 w-full">
                <Image
                  src={getImageUrl(
                    popupSettings.imageUrl,
                    popupSettings.imageUrl,
                  )}
                  alt="Popup preview"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : null}
            <div className="p-4">
              <h4 className="text-lg font-bold text-gray-900">
                {popupSettings.title || "Popup title"}
              </h4>
              <p className="text-sm text-gray-700 mt-1">
                {popupSettings.description || "Popup description"}
              </p>
              <Button
                variant="contained"
                size="small"
                sx={{
                  mt: 2,
                  bgcolor: "#111827",
                  "&:hover": { bgcolor: "#1f2937" },
                }}
              >
                {popupSettings.buttonText || "Shop Now"}
              </Button>
              {popupSettings.couponCode ? (
                <p className="text-xs text-amber-700 font-semibold mt-2">
                  Coupon: {popupSettings.couponCode}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* High Traffic Notice */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MdWarning className="text-2xl text-yellow-500" />
          <h2 className="text-lg font-semibold text-gray-800">
            High Traffic Notice
          </h2>
        </div>
        <Divider className="mb-4" />

        <div className="grid grid-cols-1 gap-4">
          <FormControlLabel
            control={
              <Switch
                checked={highTrafficNotice.enabled}
                onChange={(e) =>
                  setHighTrafficNotice({
                    ...highTrafficNotice,
                    enabled: e.target.checked,
                  })
                }
                color="warning"
              />
            }
            label="Show High Traffic Notice Banner"
          />

          <TextField
            label="Notice Message"
            value={highTrafficNotice.message}
            onChange={(e) =>
              setHighTrafficNotice({
                ...highTrafficNotice,
                message: e.target.value,
              })
            }
            size="small"
            fullWidth
            multiline
            rows={2}
            placeholder="e.g., High traffic — availability may vary..."
            disabled={!highTrafficNotice.enabled}
          />
        </div>

        {highTrafficNotice.enabled && (
          <p className="text-sm text-gray-500 mt-3">
            A yellow banner will appear at the top of the site with the above
            message.
          </p>
        )}
      </div>

      {/* Store Info */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MdStore className="text-2xl text-purple-500" />
          <h2 className="text-lg font-semibold text-gray-800">
            Store Information
          </h2>
        </div>
        <Divider className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField
            label="Store Name"
            value={storeInfo.name}
            onChange={(e) =>
              setStoreInfo({
                ...storeInfo,
                name: e.target.value,
              })
            }
            size="small"
            fullWidth
          />

          <TextField
            label="Support Email"
            type="email"
            value={storeInfo.email}
            onChange={(e) =>
              setStoreInfo({
                ...storeInfo,
                email: e.target.value,
              })
            }
            size="small"
            fullWidth
          />

          <TextField
            label="Support Phone"
            value={storeInfo.phone}
            onChange={(e) =>
              setStoreInfo({
                ...storeInfo,
                phone: e.target.value,
              })
            }
            size="small"
            fullWidth
          />

          <TextField
            label="GST Number"
            value={storeInfo.gstNumber}
            onChange={(e) =>
              setStoreInfo({
                ...storeInfo,
                gstNumber: e.target.value,
              })
            }
            size="small"
            fullWidth
            placeholder="e.g., 27ABCDE1234F1Z5"
          />

          <TextField
            label="Store Address"
            value={storeInfo.address}
            onChange={(e) =>
              setStoreInfo({
                ...storeInfo,
                address: e.target.value,
              })
            }
            size="small"
            fullWidth
            multiline
            rows={2}
            className="md:col-span-2"
          />
        </div>
      </div>

      {/* SEO Settings moved to /seo-pages
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6" id="seo-settings">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setSeoPagesOpen((prev) => !prev)}
          aria-expanded={seoPagesOpen}
          aria-controls="seo-settings-folder"
        >
          <div className="flex items-center gap-3">
            {seoPagesOpen ? (
              <MdFolderOpen className="text-2xl text-slate-500" />
            ) : (
              <MdFolder className="text-2xl text-slate-500" />
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                SEO Pages Folder
              </h2>
              <p className="text-sm text-gray-500">
                Click to open and edit page tags, keywords, and image alt text.
              </p>
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-500">
            {seoPagesOpen ? "Collapse" : "Open"}
          </span>
        </button>

        {seoPagesOpen && (
          <div id="seo-settings-folder" className="mt-6 space-y-8">
            <div className="rounded-xl border border-dashed border-teal-200 bg-teal-50/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-teal-900">
                    Blank SEO Page Workspace
                  </h3>
                  <p className="mt-1 text-sm text-teal-800">
                    Use this area when you want to build a new SEO page from
                    scratch without touching an existing page row.
                  </p>
                </div>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<MdAdd />}
                  onClick={() => addSeoPage(true)}
                  sx={{ bgcolor: "#0f766e", "&:hover": { bgcolor: "#115e59" } }}
                >
                  Create Blank SEO Page
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-teal-900">
                <div className="rounded-lg bg-white/80 p-3 border border-teal-100">
                  <p className="font-semibold">Recommended usage</p>
                  <p className="mt-1 text-teal-800">
                    Add a blank page, fill the route, then write a custom title,
                    description, and keywords for that specific URL.
                  </p>
                </div>
                <div className="rounded-lg bg-white/80 p-3 border border-teal-100">
                  <p className="font-semibold">More effective SEO</p>
                  <p className="mt-1 text-teal-800">
                    Keep each page focused on one topic, use short route names,
                    and avoid duplicate titles or repeated keyword lists.
                  </p>
                </div>
                <div className="rounded-lg bg-white/80 p-3 border border-teal-100 md:col-span-2">
                  <p className="font-semibold">Best practice checklist</p>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2 text-teal-800">
                    <li>• Add one primary keyword theme per page.</li>
                    <li>• Keep meta descriptions natural and helpful.</li>
                    <li>• Turn off indexing for draft or private pages.</li>
                    <li>• Use the blank template for new landing pages first.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Page SEO Entries
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<MdAdd />}
                    onClick={() => addSeoPage(false)}
                  >
                    Add Page
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<MdAdd />}
                    onClick={() => addSeoPage(true)}
                    sx={{ bgcolor: "#0f766e", "&:hover": { bgcolor: "#115e59" } }}
                  >
                    Add Blank Page
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {seoSettings.pages.map((page, index) => (
                  <div
                    key={`${page.path || "page"}-${index}`}
                    className="rounded-lg border border-gray-100 p-4"
                  >
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <p className="text-sm font-semibold text-gray-800">
                        {page.label || `Page ${index + 1}`}
                      </p>
                      <Button
                        variant="text"
                        color="error"
                        size="small"
                        startIcon={<MdDeleteOutline />}
                        onClick={() =>
                          setSeoSettings((prev) => ({
                            ...prev,
                            pages: prev.pages.filter((_, pageIndex) => pageIndex !== index),
                          }))
                        }
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <TextField
                        label="Page Label"
                        value={page.label}
                        onChange={(e) =>
                          setSeoSettings((prev) => ({
                            ...prev,
                            pages: prev.pages.map((item, pageIndex) =>
                              pageIndex === index
                                ? { ...item, label: e.target.value }
                                : item,
                            ),
                          }))
                        }
                        size="small"
                        fullWidth
                      />

                      <TextField
                        label="Route Path"
                        value={page.path}
                        onChange={(e) =>
                          setSeoSettings((prev) => ({
                            ...prev,
                            pages: prev.pages.map((item, pageIndex) =>
                              pageIndex === index
                                ? { ...item, path: e.target.value }
                                : item,
                            ),
                          }))
                        }
                        size="small"
                        fullWidth
                        placeholder="/products"
                      />

                      <TextField
                        label="Meta Title"
                        value={page.metaTitle}
                        onChange={(e) =>
                          setSeoSettings((prev) => ({
                            ...prev,
                            pages: prev.pages.map((item, pageIndex) =>
                              pageIndex === index
                                ? { ...item, metaTitle: e.target.value }
                                : item,
                            ),
                          }))
                        }
                        size="small"
                        fullWidth
                        className="md:col-span-2"
                      />

                      <TextField
                        label="Meta Description"
                        value={page.metaDescription}
                        onChange={(e) =>
                          setSeoSettings((prev) => ({
                            ...prev,
                            pages: prev.pages.map((item, pageIndex) =>
                              pageIndex === index
                                ? { ...item, metaDescription: e.target.value }
                                : item,
                            ),
                          }))
                        }
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        className="md:col-span-2"
                      />

                      <TextField
                        label="Keywords"
                        value={page.keywords}
                        onChange={(e) =>
                          setSeoSettings((prev) => ({
                            ...prev,
                            pages: prev.pages.map((item, pageIndex) =>
                              pageIndex === index
                                ? { ...item, keywords: e.target.value }
                                : item,
                            ),
                          }))
                        }
                        size="small"
                        fullWidth
                        className="md:col-span-2"
                        placeholder="comma, separated, keywords"
                      />

                      <FormControlLabel
                        control={
                          <Switch
                            checked={page.indexable}
                            onChange={(e) =>
                              setSeoSettings((prev) => ({
                                ...prev,
                                pages: prev.pages.map((item, pageIndex) =>
                                  pageIndex === index
                                    ? { ...item, indexable: e.target.checked }
                                    : item,
                                ),
                              }))
                            }
                            color="warning"
                          />
                        }
                        label="Allow search indexing"
                      />

                      <TextField
                        label="Notes"
                        value={page.notes}
                        onChange={(e) =>
                          setSeoSettings((prev) => ({
                            ...prev,
                            pages: prev.pages.map((item, pageIndex) =>
                              pageIndex === index
                                ? { ...item, notes: e.target.value }
                                : item,
                            ),
                          }))
                        }
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        className="md:col-span-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Divider />

            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Image Alt Text Rules
                </h3>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<MdAdd />}
                  onClick={() =>
                    setSeoSettings((prev) => ({
                      ...prev,
                      imageAltTexts: [
                        ...prev.imageAltTexts,
                        cloneSeoImageEntry({ label: "New image" }),
                      ],
                    }))
                  }
                >
                  Add Image Rule
                </Button>
              </div>

              <div className="space-y-4">
                {seoSettings.imageAltTexts.map((imageItem, index) => (
                  <div
                    key={`${imageItem.label || "image"}-${index}`}
                    className="rounded-lg border border-gray-100 p-4"
                  >
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <p className="text-sm font-semibold text-gray-800">
                        Image Rule {index + 1}
                      </p>
                      <Button
                        variant="text"
                        color="error"
                        size="small"
                        startIcon={<MdDeleteOutline />}
                        onClick={() =>
                          setSeoSettings((prev) => ({
                            ...prev,
                            imageAltTexts: prev.imageAltTexts.filter(
                              (_, imageIndex) => imageIndex !== index,
                            ),
                          }))
                        }
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <TextField
                        label="Label"
                        value={imageItem.label}
                        onChange={(e) =>
                          setSeoSettings((prev) => ({
                            ...prev,
                            imageAltTexts: prev.imageAltTexts.map(
                              (item, imageIndex) =>
                                imageIndex === index
                                  ? { ...item, label: e.target.value }
                                  : item,
                            ),
                          }))
                        }
                        size="small"
                        fullWidth
                      />

                      <TextField
                        label="Target / Asset"
                        value={imageItem.target}
                        onChange={(e) =>
                          setSeoSettings((prev) => ({
                            ...prev,
                            imageAltTexts: prev.imageAltTexts.map(
                              (item, imageIndex) =>
                                imageIndex === index
                                  ? { ...item, target: e.target.value }
                                  : item,
                            ),
                          }))
                        }
                        size="small"
                        fullWidth
                        placeholder="/product/[id]"
                      />

                      <TextField
                        label="Alt Text"
                        value={imageItem.altText}
                        onChange={(e) =>
                          setSeoSettings((prev) => ({
                            ...prev,
                            imageAltTexts: prev.imageAltTexts.map(
                              (item, imageIndex) =>
                                imageIndex === index
                                  ? { ...item, altText: e.target.value }
                                  : item,
                            ),
                          }))
                        }
                        size="small"
                        fullWidth
                        className="md:col-span-2"
                      />

                      <TextField
                        label="Title Text"
                        value={imageItem.titleText}
                        onChange={(e) =>
                          setSeoSettings((prev) => ({
                            ...prev,
                            imageAltTexts: prev.imageAltTexts.map(
                              (item, imageIndex) =>
                                imageIndex === index
                                  ? { ...item, titleText: e.target.value }
                                  : item,
                            ),
                          }))
                        }
                        size="small"
                        fullWidth
                      />

                      <TextField
                        label="Notes"
                        value={imageItem.notes}
                        onChange={(e) =>
                          setSeoSettings((prev) => ({
                            ...prev,
                            imageAltTexts: prev.imageAltTexts.map(
                              (item, imageIndex) =>
                                imageIndex === index
                                  ? { ...item, notes: e.target.value }
                                  : item,
                            ),
                          }))
                        }
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        className="md:col-span-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-500 mt-3">
          This section stays inside the admin panel. Keep public pages indexed
          only when they should appear in search, and use descriptive alt text
          for every important image.
        </p>
      </div>
      */}

      {/* Homepage Flavour Buttons */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MdStore className="text-2xl text-amber-600" />
          <h2 className="text-lg font-semibold text-gray-800">
            Homepage Flavour Buttons
          </h2>
        </div>
        <Divider className="mb-4" />

        <div className="space-y-4">
          {FLAVOUR_BUTTON_FIELDS.map((field) => (
            <div
              key={field.textKey}
              className="rounded-lg border border-gray-100 p-4"
            >
              <div className="text-sm font-semibold text-gray-800 mb-3">
                {field.label}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <TextField
                  label="Button Text"
                  value={flavourButtonSettings[field.textKey]}
                  onChange={(e) =>
                    setFlavourButtonSettings((prev) => ({
                      ...prev,
                      [field.textKey]: e.target.value,
                    }))
                  }
                  size="small"
                  fullWidth
                />
                <div className="flex items-center gap-3">
                  <TextField
                    label="Background Color"
                    value={flavourButtonSettings[field.bgKey]}
                    onChange={(e) =>
                      setFlavourButtonSettings((prev) => ({
                        ...prev,
                        [field.bgKey]: e.target.value,
                      }))
                    }
                    size="small"
                    fullWidth
                    placeholder="#F6E6C9"
                  />
                  <input
                    type="color"
                    value={
                      isHexColor(flavourButtonSettings[field.bgKey])
                        ? flavourButtonSettings[field.bgKey]
                        : DEFAULT_FLAVOUR_BUTTON_SETTINGS[field.bgKey]
                    }
                    onChange={(e) =>
                      setFlavourButtonSettings((prev) => ({
                        ...prev,
                        [field.bgKey]: e.target.value,
                      }))
                    }
                    className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                    aria-label={`${field.label} background color picker`}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <TextField
                    label="Text Color"
                    value={flavourButtonSettings[field.textColorKey]}
                    onChange={(e) =>
                      setFlavourButtonSettings((prev) => ({
                        ...prev,
                        [field.textColorKey]: e.target.value,
                      }))
                    }
                    size="small"
                    fullWidth
                    placeholder="#6B4F2A"
                  />
                  <input
                    type="color"
                    value={
                      isHexColor(flavourButtonSettings[field.textColorKey])
                        ? flavourButtonSettings[field.textColorKey]
                        : DEFAULT_FLAVOUR_BUTTON_SETTINGS[field.textColorKey]
                    }
                    onChange={(e) =>
                      setFlavourButtonSettings((prev) => ({
                        ...prev,
                        [field.textColorKey]: e.target.value,
                      }))
                    }
                    className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                    aria-label={`${field.label} text color picker`}
                  />
                </div>
              </div>
              <div className="mt-3">
                <div
                  className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: isHexColor(
                      flavourButtonSettings[field.bgKey],
                    )
                      ? flavourButtonSettings[field.bgKey]
                      : DEFAULT_FLAVOUR_BUTTON_SETTINGS[field.bgKey],
                    color: isHexColor(flavourButtonSettings[field.textColorKey])
                      ? flavourButtonSettings[field.textColorKey]
                      : DEFAULT_FLAVOUR_BUTTON_SETTINGS[field.textColorKey],
                    borderColor: "rgba(17, 24, 39, 0.08)",
                  }}
                >
                  {String(flavourButtonSettings[field.textKey] || "").trim() ||
                    field.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-500 mt-3">
          Clear any field to fall back to the current storefront default.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MdStore className="text-2xl text-amber-600" />
          <h2 className="text-lg font-semibold text-gray-800">
            Homepage Trust Pills
          </h2>
        </div>
        <Divider className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HOMEPAGE_TRUST_FIELDS.map((field) => (
            <div
              key={field.key}
              className="rounded-lg border border-gray-100 p-4"
            >
              <div className="text-sm font-semibold text-gray-800 mb-3">
                {field.label}
              </div>
              <TextField
                label="Text"
                value={homepageTrustSettings[field.key]}
                onChange={(e) =>
                  setHomepageTrustSettings((prev) => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))
                }
                size="small"
                fullWidth
              />
              <div className="mt-3">
                <span className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-gray-900 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white">
                  {String(homepageTrustSettings[field.key] || "").trim() ||
                    field.fallback}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-500 mt-3">
          These control the four trust chips shown under the homepage hero.
        </p>
      </div>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default SettingsPage;
