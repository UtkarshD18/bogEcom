"use client";

import { getImageUrl } from "@/utils/imageUtils";
import { API_BASE_URL, uploadFile } from "@/utils/api";

import { useAdmin } from "@/context/AdminContext";
import {
  Alert,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  InputAdornment,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  TextField,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import {
  MdLocalOffer,
  MdLocalShipping,
  MdPercent,
  MdRefresh,
  MdSave,
  MdShoppingCart,
  MdStore,
  MdWarning,
} from "react-icons/md";

const API_URL = API_BASE_URL;
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
  showOncePerSession: true,
  backgroundColor: "#fff7ed",
  buttonText: "Shop Now",
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

  const [orderSettings, setOrderSettings] = useState({
    minimumOrderValue: 0,
    maximumOrderValue: 50000,
    maxItemsPerOrder: 20,
    codEnabled: false,
    codMinOrder: 200,
    codMaxOrder: 5000,
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
    maintenanceMode: false,
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

    if (!value.startDate || !value.expiryDate) {
      return {
        valid: false,
        message: "Start date and expiry date are required.",
      };
    }

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
        message: "Background color must be a valid hex color (e.g. #fff7ed).",
      };
    }

    return { valid: true, message: "" };
  }, []);

  const mapPopupPayloadToState = useCallback((popupData) => {
    if (!popupData) return defaultPopupSettings;
    return {
      ...defaultPopupSettings,
      ...popupData,
      startDate: toDateTimeLocal(popupData.startDate),
      expiryDate: toDateTimeLocal(popupData.expiryDate),
    };
  }, []);

  const fetchPopupResources = useCallback(
    async (adminToken) => {
      try {
        const popupResponse = await fetch(`${API_URL}/api/admin/popup`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          credentials: "include",
        });
        const popupData = await popupResponse.json();
        if (popupData?.success && popupData?.data) {
          setPopupSettings(mapPopupPayloadToState(popupData.data));
        }
      } catch (error) {
        console.warn("Popup settings fetch failed:", error);
      }

      try {
        const [productResponse, categoryResponse] = await Promise.all([
          fetch(`${API_URL}/api/products?limit=250&sortBy=name&order=asc`, {
            method: "GET",
            credentials: "include",
          }),
          fetch(`${API_URL}/api/categories?flat=true&active=true`, {
            method: "GET",
            credentials: "include",
          }),
        ]);

        const [productData, categoryData] = await Promise.all([
          productResponse.json(),
          categoryResponse.json(),
        ]);

        if (productData?.success && Array.isArray(productData?.data)) {
          const productOptions = productData.data
            .filter((product) => product?._id)
            .map((product) => ({
              value: product._id,
              label: product.name || product._id,
            }));
          setPopupProducts(productOptions);
        }

        if (categoryData?.success && Array.isArray(categoryData?.data)) {
          const categoryOptions = categoryData.data
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

      const response = await fetch(`${API_URL}/api/admin/popup`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        credentials: "include",
        body: JSON.stringify({
          title: String(value.title || "").trim(),
          description: String(value.description || "").trim(),
          imageUrl: String(value.imageUrl || "").trim(),
          redirectType: value.redirectType,
          redirectValue: String(value.redirectValue || "").trim(),
          startDate: toIsoIfPresent(value.startDate),
          expiryDate: toIsoIfPresent(value.expiryDate),
          isActive: !!value.isActive,
          showOncePerSession: !!value.showOncePerSession,
          backgroundColor: String(value.backgroundColor || "").trim(),
          buttonText: String(value.buttonText || "").trim(),
        }),
      });

      const data = await response.json();
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

      const response = await fetch(`${API_URL}/api/settings/admin/all`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        credentials: "include",
      });

      const data = await response.json();

      if (data.success && data.data) {
        // Map settings by key
        data.data.forEach((setting) => {
          switch (setting.key) {
            case "shippingSettings":
              setShippingSettings(setting.value);
              break;
            case "orderSettings":
              setOrderSettings(setting.value);
              break;
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
            case "maintenanceMode":
              setSiteControls((prev) => ({
                ...prev,
                maintenanceMode: !!setting.value,
              }));
              break;
            case "highTrafficNotice":
              setHighTrafficNotice(setting.value);
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
      const response = await fetch(`${API_URL}/api/settings/admin/${key}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        credentials: "include",
        body: JSON.stringify({ value }),
      });

      const data = await response.json();
      return data.success;
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

    setSaving(true);
    try {
      const [
        popupSaveResult,
        shippingSaved,
        orderSaved,
        discountSaved,
        storeSaved,
        trafficSaved,
        paymentSaved,
        maintenanceSaved,
      ] = await Promise.all([
        savePopupConfig(popupSettings),
        saveSetting("shippingSettings", shippingSettings),
        saveSetting("orderSettings", orderSettings),
        saveSetting("discountSettings", discountSettings),
        saveSetting("storeInfo", storeInfo),
        saveSetting("highTrafficNotice", highTrafficNotice),
        saveSetting("paymentGatewayEnabled", siteControls.paymentGatewayEnabled),
        saveSetting("maintenanceMode", siteControls.maintenanceMode),
      ]);

      const coreSettingsSaved =
        shippingSaved &&
        orderSaved &&
        discountSaved &&
        storeSaved &&
        trafficSaved &&
        paymentSaved &&
        maintenanceSaved;

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
          <h2 className="text-lg font-semibold text-gray-800">
            Site Controls
          </h2>
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
                checked={siteControls.maintenanceMode}
                onChange={(e) =>
                  setSiteControls({
                    ...siteControls,
                    maintenanceMode: e.target.checked,
                  })
                }
                color="warning"
              />
            }
            label="Maintenance Mode"
          />
        </div>

        <p className="text-sm text-gray-500 mt-3">
          Payment gateway toggle respects environment credentials. Maintenance
          mode disables checkout while enabled.
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

          <FormControlLabel
            control={
              <Switch
                checked={popupSettings.showOncePerSession}
                onChange={(e) =>
                  setPopupSettings((prev) => ({
                    ...prev,
                    showOncePerSession: e.target.checked,
                  }))
                }
                color="warning"
              />
            }
            label="Show Once Per Session"
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
            <InputLabel id="popup-redirect-type-label">Redirect Type</InputLabel>
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
              backgroundColor: popupSettings.backgroundColor || "#fff7ed",
              borderColor: "rgba(17, 24, 39, 0.1)",
            }}
          >
            {popupSettings.imageUrl ? (
              <img
                src={getImageUrl(popupSettings.imageUrl, popupSettings.imageUrl)}
                alt="Popup preview"
                className="w-full h-[140px] object-cover"
              />
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
