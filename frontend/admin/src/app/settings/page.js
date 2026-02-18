"use client";

import { API_BASE_URL } from "@/utils/api";

import { useAdmin } from "@/context/AdminContext";
import {
  Alert,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  InputAdornment,
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
    email: "support@buyonegram.com",
    phone: "+91 9876541234",
    address: "",
    gstNumber: "",
    currency: "INR",
    currencySymbol: "₹",
  });

  // Offer Popup Settings
  const [offerSettings, setOfferSettings] = useState({
    showOfferPopup: false,
    offerCouponCode: "",
    offerTitle: "Special Offer!",
    offerDescription: "Use this code to get a discount on your order!",
    offerDiscountText: "Get Discount",
  });

  // High Traffic Notice
  const [highTrafficNotice, setHighTrafficNotice] = useState({
    enabled: false,
    message:
      "High traffic — availability may vary. Your order will be processed once confirmed.",
  });

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
            case "showOfferPopup":
              setOfferSettings((prev) => ({
                ...prev,
                showOfferPopup: setting.value,
              }));
              break;
            case "offerCouponCode":
              setOfferSettings((prev) => ({
                ...prev,
                offerCouponCode: setting.value,
              }));
              break;
            case "offerTitle":
              setOfferSettings((prev) => ({
                ...prev,
                offerTitle: setting.value,
              }));
              break;
            case "offerDescription":
              setOfferSettings((prev) => ({
                ...prev,
                offerDescription: setting.value,
              }));
              break;
            case "offerDiscountText":
              setOfferSettings((prev) => ({
                ...prev,
                offerDiscountText: setting.value,
              }));
              break;
            case "highTrafficNotice":
              setHighTrafficNotice(setting.value);
              break;
          }
        });
      }
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
  }, [token]);

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
    setSaving(true);
    try {
      const results = await Promise.all([
        saveSetting("shippingSettings", shippingSettings),
        saveSetting("orderSettings", orderSettings),
        saveSetting("discountSettings", discountSettings),
        saveSetting("storeInfo", storeInfo),
        // Offer popup settings
        saveSetting("showOfferPopup", offerSettings.showOfferPopup),
        saveSetting("offerCouponCode", offerSettings.offerCouponCode),
        saveSetting("offerTitle", offerSettings.offerTitle),
        saveSetting("offerDescription", offerSettings.offerDescription),
        saveSetting("offerDiscountText", offerSettings.offerDiscountText),
        // High traffic notice
        saveSetting("highTrafficNotice", highTrafficNotice),
        // Site controls
        saveSetting("paymentGatewayEnabled", siteControls.paymentGatewayEnabled),
        saveSetting("maintenanceMode", siteControls.maintenanceMode),
      ]);

      if (results.every(Boolean)) {
        setSnackbar({
          open: true,
          message: "All settings saved successfully!",
          severity: "success",
        });
      } else {
        setSnackbar({
          open: true,
          message: "Some settings failed to save",
          severity: "warning",
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to save settings",
        severity: "error",
      });
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

      {/* Offer Popup Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MdLocalOffer className="text-2xl text-pink-500" />
          <h2 className="text-lg font-semibold text-gray-800">
            Offer Popup Settings
          </h2>
        </div>
        <Divider className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormControlLabel
            control={
              <Switch
                checked={offerSettings.showOfferPopup}
                onChange={(e) =>
                  setOfferSettings({
                    ...offerSettings,
                    showOfferPopup: e.target.checked,
                  })
                }
                color="warning"
              />
            }
            label="Show Offer Popup on Homepage"
          />

          <TextField
            label="Coupon Code"
            value={offerSettings.offerCouponCode}
            onChange={(e) =>
              setOfferSettings({
                ...offerSettings,
                offerCouponCode: e.target.value,
              })
            }
            size="small"
            fullWidth
            placeholder="e.g., SAVE10"
            disabled={!offerSettings.showOfferPopup}
          />

          <TextField
            label="Popup Title"
            value={offerSettings.offerTitle}
            onChange={(e) =>
              setOfferSettings({
                ...offerSettings,
                offerTitle: e.target.value,
              })
            }
            size="small"
            fullWidth
            placeholder="e.g., Special Offer!"
            disabled={!offerSettings.showOfferPopup}
          />

          <TextField
            label="Button Text"
            value={offerSettings.offerDiscountText}
            onChange={(e) =>
              setOfferSettings({
                ...offerSettings,
                offerDiscountText: e.target.value,
              })
            }
            size="small"
            fullWidth
            placeholder="e.g., Get Discount"
            disabled={!offerSettings.showOfferPopup}
          />

          <TextField
            label="Description"
            value={offerSettings.offerDescription}
            onChange={(e) =>
              setOfferSettings({
                ...offerSettings,
                offerDescription: e.target.value,
              })
            }
            size="small"
            fullWidth
            multiline
            rows={2}
            className="md:col-span-2"
            placeholder="e.g., Use this code to get a discount on your order!"
            disabled={!offerSettings.showOfferPopup}
          />
        </div>

        {offerSettings.showOfferPopup && (
          <p className="text-sm text-gray-500 mt-3">
            A popup will appear on the homepage offering customers the coupon
            code &quot;{offerSettings.offerCouponCode || "COUPON"}&quot;.
          </p>
        )}
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
