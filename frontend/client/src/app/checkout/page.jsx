"use client";

import { API_BASE_URL, getStoredAccessToken } from "@/utils/api";

import PaymentUnavailableModal from "@/components/PaymentUnavailableModal";
import UseCurrentLocationGoogleMaps from "@/components/UseCurrentLocationGoogleMaps";
import { useCart } from "@/context/CartContext";
import { useReferral } from "@/context/ReferralContext";
import { useSettings } from "@/context/SettingsContext";
import { MyContext } from "@/context/ThemeProvider";
import { useShippingDisplayCharge } from "@/hooks/useShippingDisplayCharge";
import {
  getStoredAffiliateData,
  initAffiliateTracking,
  setAffiliateFromCoupon,
} from "@/utils/affiliateTracking";
import { calculateOrderTotals } from "@/utils/calculateOrderTotals.mjs";
import {
  calculatePercentageDiscount,
  getGstRatePercentFromSettings,
  round2,
} from "@/utils/gst";
import { getDisplayTaxBreakup } from "@/utils/shippingDisplay";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useState } from "react";
import { FiCheck, FiEdit2, FiPlus, FiTag, FiX } from "react-icons/fi";
import { HiOutlineFire } from "react-icons/hi";
import { IoCartOutline } from "react-icons/io5";
import { MdHome, MdInfo, MdLocationOn, MdWork } from "react-icons/md";

const API_URL = API_BASE_URL;
const ORDER_PENDING_PAYMENT_KEY = "orderPaymentPending";

const buildAuthHeaders = (extraHeaders = {}) => {
  const token = getStoredAccessToken();
  return token
    ? { ...extraHeaders, Authorization: `Bearer ${token}` }
    : extraHeaders;
};

/**
 * Checkout Page
 *
 * Mobile-first, production-ready checkout with:
 * - PhonePe payment modal (payments temporarily unavailable)
 * - Coupon validation (backend)
 * - Influencer/Referral tracking (automatic discount)
 * - Affiliate tracking
 * - Save order for later
 */
const Checkout = () => {
  const context = useContext(MyContext);
  const { cartItems, clearCart, orderNote, setOrderNote } = useCart();
  const router = useRouter();
  const authToken = getStoredAccessToken();
  const isGuestCheckout = !authToken;

  // Get referral/influencer data from context
  const {
    referralCode,
    referralData,
    calculateDiscount: calculateReferralDiscount,
    applyReferralCode,
  } = useReferral();

  // Get settings from context
  const { highTrafficNotice, taxSettings, maintenanceMode } = useSettings();

  // Helper to normalize cart item data (handles both API and localStorage structures)
  const getItemData = (item) => {
    // Check if item.product is an object (API) or ID (localStorage fallback)
    // If it's a string, we must use item.productData. If it's an object, we use it.
    const product =
      typeof item.product === "object" && item.product
        ? item.product
        : item.productData || item;

    const availableQuantity =
      typeof product?.available_quantity === "number"
        ? product.available_quantity
        : Math.max(
            Number(product?.stock_quantity ?? product?.stock ?? 0) -
              Number(product?.reserved_quantity ?? 0),
            0,
          );
    return {
      id: product?._id || product?.id || item._id || item.id,
      name: product?.name || item.name || item.title || "Product",
      image:
        product?.thumbnail ||
        product?.images?.[0] ||
        item.image ||
        item.images?.[0] ||
        "/placeholder.png",
      price: item.price || product?.price || 0,
      quantity: item.quantity || 1,
      demandStatus: product?.demandStatus || item.demandStatus || "NORMAL",
      availableQuantity,
    };
  };

  // UI State
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isPayButtonDisabled, setIsPayButtonDisabled] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Coupon State
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");

  // Affiliate State
  const [affiliateData, setAffiliateData] = useState(null);
  const [membershipStatus, setMembershipStatus] = useState(null);
  const [coinSettings, setCoinSettings] = useState({
    coinsPerRupee: 0.05,
    redeemRate: 0.1,
    maxRedeemPercentage: 20,
    expiryDays: 365,
  });
  const [coinBalance, setCoinBalance] = useState(0);

  // Address State - Real addresses from database
  const [addresses, setAddresses] = useState([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressSaving, setAddressSaving] = useState(false);
  const [locationPayload, setLocationPayload] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    address_line1: "",
    city: "",
    state: "",
    pincode: "",
    mobile: "",
    landmark: "",
    addressType: "Home",
  });
  const [formErrors, setFormErrors] = useState({});
  const [guestDetails, setGuestDetails] = useState({
    fullName: "",
    phone: "",
    address: "",
    pincode: "",
    state: "",
    email: "",
  });
  const [guestLocationPayload, setGuestLocationPayload] = useState(null);
  const [guestErrors, setGuestErrors] = useState({});
  const [gstNumber, setGstNumber] = useState("");
  const [gstError, setGstError] = useState("");
  const [gstSaving, setGstSaving] = useState(false);
  const [gstSavedValue, setGstSavedValue] = useState("");

  const INDIAN_STATES = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Chandigarh",
    "Puducherry",
  ];

  const normalizeStateValue = (value) => {
    const incoming = String(value || "")
      .trim()
      .toLowerCase();
    if (!incoming) return "";
    const match = INDIAN_STATES.find(
      (s) => String(s).trim().toLowerCase() === incoming,
    );
    return match || "";
  };

  // Prices are GST-inclusive throughout the storefront.
  // GST rate comes from settings (defaults to 5% if missing).
  const gstRatePercent = getGstRatePercentFromSettings(taxSettings);

  // Derive the delivery state for GST display (CGST+SGST vs IGST)
  const checkoutStateForPreview = isGuestCheckout
    ? guestDetails.state
    : addresses.find((a) => a._id === selectedAddress)?.state || "";
  const hasCheckoutStateInput = Boolean(String(checkoutStateForPreview || "").trim());
  const normalizedCheckoutState = normalizeStateValue(checkoutStateForPreview);
  const isRajasthanDelivery = normalizedCheckoutState === "Rajasthan";
  const { displayShippingCharge } = useShippingDisplayCharge({
    isRajasthan: isRajasthanDelivery,
  });

  // ── Price Calculation (GST-exclusive model) ──────────────────────────
  // Product prices are GST-inclusive. We extract base (excl. GST) first,
  // apply trade discounts on the base, then recalculate GST on the discounted base.
  //
  // NOTE: All GST + payable calculations are delegated to calculateCheckoutTotals()
  // (paise-safe) which acts as the single source of truth for checkout totals.

  const checkoutItems = (cartItems || []).map((item) => {
    const data = getItemData(item);
    return {
      price: Number(data.price || 0), // GST-inclusive unit price
      quantity: Math.max(Number(data.quantity || 1), 0),
    };
  });

  // Step 1: Subtotals (before discounts)
  const preDiscountTotals = calculateOrderTotals({
    items: checkoutItems,
    shippingRules: { shippingCostOverride: 0 },
    taxRules: { gstRatePercent, pricesIncludeTax: true },
  });

  // GST-exclusive base subtotal (used for all trade discounts)
  const cartBaseSubtotal = preDiscountTotals.subtotal;

  // Step 2: Membership discount on GST-exclusive base (trade discount)
  const membershipDiscountPercentage =
    membershipStatus?.isMember && !membershipStatus?.isExpired
      ? Number(
          membershipStatus?.membershipPlan?.discountPercentage ??
            membershipStatus?.membershipPlan?.discountPercent ??
            0,
        )
      : 0;
  const membershipDiscount = calculatePercentageDiscount(
    cartBaseSubtotal,
    membershipDiscountPercentage,
  );
  const baseAfterMembership = round2(
    Math.max(cartBaseSubtotal - membershipDiscount, 0),
  );

  // Step 3: Referral/Influencer discount on GST-exclusive base (trade discount)
  // Note: Backend will recalculate for security — this is for display only.
  const referralDiscount = referralCode
    ? round2(
        Math.min(
          Math.max(
            Number(calculateReferralDiscount(baseAfterMembership) || 0),
            0,
          ),
          baseAfterMembership,
        ),
      )
    : 0;
  const baseBeforeCoupon = round2(
    Math.max(baseAfterMembership - referralDiscount, 0),
  );

  // Step 4 + 5: coupon + GST are resolved by shared calculateOrderTotals().
  const tradeDiscountBeforeCoupon = round2(
    membershipDiscount + referralDiscount,
  );
  const checkoutTotalsInput = {
    items: checkoutItems,
    couponCode: appliedCoupon?.code || "",
    couponRules: {
      discountAmountOverride: Number(appliedCoupon?.discountAmount || 0),
    },
    shippingRules: {
      shippingCostOverride: 0,
    },
    taxRules: {
      gstRatePercent,
      pricesIncludeTax: true,
    },
    baseDiscountBeforeCoupon: tradeDiscountBeforeCoupon,
  };
  const totalsBeforeCoin = calculateOrderTotals(checkoutTotalsInput);
  const couponDiscount = totalsBeforeCoin.couponDiscount;
  const subtotal = totalsBeforeCoin.discountedSubtotal; // GST-exclusive after coupon
  const tax = totalsBeforeCoin.tax; // GST on discounted base
  const payableShipping = 0;

  const productCostAfterCoupon = round2(subtotal + tax); // GST-inclusive after coupon (no shipping)

  // DISPLAY-ONLY GST breakup for summary labels (payable tax stays `tax`).
  const displayTaxBreakup = getDisplayTaxBreakup({
    taxAmount: tax,
    isRajasthan: isRajasthanDelivery,
  });
  const summaryTaxLabel = !hasCheckoutStateInput
    ? "GST"
    : isRajasthanDelivery
      ? "GST (S.GST+C.GST)"
      : "IGST";
  const summaryTaxAmount = !hasCheckoutStateInput
    ? tax
    : isRajasthanDelivery
      ? round2(displayTaxBreakup.cgst + displayTaxBreakup.sgst)
      : displayTaxBreakup.igst;

  // Coins are earned from orders, but redemption is restricted to membership checkout.
  const effectiveRedeemCoins = 0;
  const coinRedeemAmount = 0;

  // Step 8: Final payable = discounted base + GST + shipping - coinRedeem
  const finalTotals = calculateOrderTotals({
    ...checkoutTotalsInput,
    shippingCost: payableShipping,
    shippingRules: {
      shippingCostOverride: payableShipping,
    },
    coinRedeemAmount,
  });
  const total = finalTotals.totalPayable;

  // Fetch addresses from database
  const fetchAddresses = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/address`, {
        headers: buildAuthHeaders(),
        credentials: "include",
      });

      if (response.status === 401) {
        setAddresses([]);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setAddresses(data.data || []);
        // Auto-select the default address or first one
        const defaultAddr = data.data?.find((a) => a.selected);
        if (defaultAddr) {
          setSelectedAddress(defaultAddr._id);
        } else if (data.data?.length > 0) {
          setSelectedAddress(data.data[0]._id);
        }
      }
    } catch (error) {
      console.error("Error fetching addresses:", error);
    } finally {
      setAddressLoading(false);
    }
  }, []);

  // Initialize affiliate tracking on mount
  useEffect(() => {
    const affiliate = initAffiliateTracking();
    if (affiliate) {
      setAffiliateData(affiliate);
    }
    fetchAddresses();
  }, [fetchAddresses]);

  useEffect(() => {
    if (!authToken || gstSavedValue) return;

    const fetchGst = async () => {
      try {
        const response = await fetch(`${API_URL}/api/user/user-details`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          credentials: "include",
        });
        if (!response.ok) return;
        const data = await response.json();
        const storedGst = data?.data?.gstNumber || "";
        if (storedGst) {
          setGstNumber(storedGst);
          setGstSavedValue(storedGst);
        }
      } catch (error) {
        // Silent fail: GST is optional and can be entered manually.
      }
    };

    fetchGst();
  }, [authToken, gstSavedValue]);

  useEffect(() => {
    const fetchDynamicCheckoutSettings = async () => {
      try {
        const [coinSettingsRes, membershipRes] = await Promise.all([
          fetch(`${API_URL}/api/coins/settings/public`),
          authToken
            ? fetch(`${API_URL}/api/membership/status`, {
                headers: {
                  Authorization: `Bearer ${authToken}`,
                },
              })
            : Promise.resolve(null),
        ]);

        if (coinSettingsRes?.ok) {
          const coinSettingsData = await coinSettingsRes.json();
          if (coinSettingsData?.success && coinSettingsData?.data) {
            setCoinSettings({
              coinsPerRupee: Number(
                coinSettingsData.data.coinsPerRupee ?? 0.05,
              ),
              redeemRate: Number(coinSettingsData.data.redeemRate ?? 0.1),
              maxRedeemPercentage: Number(
                coinSettingsData.data.maxRedeemPercentage ?? 20,
              ),
              expiryDays: Number(coinSettingsData.data.expiryDays ?? 365),
            });
          }
        }

        if (membershipRes?.ok) {
          const membershipData = await membershipRes.json();
          if (membershipData?.success) {
            setMembershipStatus(membershipData.data || null);
          }
        } else {
          setMembershipStatus(null);
        }

        if (authToken) {
          const coinBalanceRes = await fetch(`${API_URL}/api/coins/me`, {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });
          if (coinBalanceRes.ok) {
            const coinBalanceData = await coinBalanceRes.json();
            if (coinBalanceData?.success) {
              setCoinBalance(Number(coinBalanceData?.data?.coinBalance || 0));
            }
          }
        } else {
          setCoinBalance(0);
        }
      } catch (error) {
        // Checkout should continue even if optional dynamic services fail.
      }
    };

    fetchDynamicCheckoutSettings();
  }, [authToken]);

  // Address form handlers
  const resetAddressForm = () => {
    setFormData({
      name: "",
      address_line1: "",
      city: "",
      state: "",
      pincode: "",
      mobile: "",
      landmark: "",
      addressType: "Home",
    });
    setFormErrors({});
    setEditingAddress(null);
    setLocationPayload(null);
  };

  const handleAddNewAddress = () => {
    resetAddressForm();
    setIsAddressDialogOpen(true);
  };

  const handleEditAddress = (address) => {
    setEditingAddress(address);
    setFormData({
      name: address.name || "",
      address_line1: address.address_line1 || "",
      city: address.city || "",
      state: address.state || "",
      pincode: address.pincode || "",
      mobile: address.mobile?.toString() || "",
      landmark: address.landmark || "",
      addressType: address.addressType || "Home",
    });
    setFormErrors({});
    setLocationPayload(null);
    setIsAddressDialogOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateAddressForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = "Name is required";
    if (!formData.address_line1.trim())
      errors.address_line1 = "Address is required";
    if (!formData.city.trim()) errors.city = "City is required";
    if (!formData.state) errors.state = "State is required";
    if (!formData.pincode.trim()) errors.pincode = "Pincode is required";
    else if (!/^\d{6}$/.test(formData.pincode))
      errors.pincode = "Enter valid 6-digit pincode";
    if (!formData.mobile.trim()) errors.mobile = "Mobile is required";
    else if (!/^\d{10}$/.test(formData.mobile.replace(/\D/g, "")))
      errors.mobile = "Enter valid 10-digit mobile";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveAddress = async () => {
    if (!validateAddressForm()) return;

    setAddressSaving(true);
    try {
      const url = editingAddress
        ? `${API_URL}/api/address/${editingAddress._id}`
        : `${API_URL}/api/address`;

      const response = await fetch(url, {
        method: editingAddress ? "PUT" : "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          location: locationPayload,
        }),
      });

      if (response.status === 401) {
        setSnackbar({
          open: true,
          message: "Please login again to save your address.",
          severity: "error",
        });
        router.push("/login?redirect=/checkout");
        return;
      }

      const data = await response.json();

      if (data.success) {
        setSnackbar({
          open: true,
          message: editingAddress ? "Address updated!" : "Address added!",
          severity: "success",
        });
        setIsAddressDialogOpen(false);
        resetAddressForm();
        fetchAddresses();
        // Select the newly created address
        if (!editingAddress && data.data?._id) {
          setSelectedAddress(data.data._id);
        }
      } else {
        setSnackbar({
          open: true,
          message: data.message || "Failed to save",
          severity: "error",
        });
      }
    } catch (error) {
      console.error("Error saving address:", error);
      setSnackbar({
        open: true,
        message: "Failed to save address",
        severity: "error",
      });
    } finally {
      setAddressSaving(false);
    }
  };

  const getAddressIcon = (type) => {
    switch (type) {
      case "Work":
        return <MdWork size={14} />;
      case "Other":
        return <MdLocationOn size={14} />;
      default:
        return <MdHome size={14} />;
    }
  };

  const handleGuestChange = (e) => {
    const { name, value } = e.target;
    setGuestDetails((prev) => ({ ...prev, [name]: value }));
    if (guestErrors[name]) {
      setGuestErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleGstChange = (event) => {
    const value = String(event.target.value || "").toUpperCase();
    setGstNumber(value);
    if (gstError) setGstError("");
  };

  const handleGstBlur = async () => {
    if (!gstNumber) {
      setGstError("");
      if (!authToken || !gstSavedValue) return;
      setGstSaving(true);
      try {
        const response = await fetch(`${API_URL}/api/user/gst`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          credentials: "include",
          body: JSON.stringify({ gstNumber: "" }),
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Failed to clear GST number");
        }
        setGstSavedValue("");
        setSnackbar({
          open: true,
          message: "GST number cleared",
          severity: "success",
        });
      } catch (error) {
        setSnackbar({
          open: true,
          message: error.message || "Failed to clear GST number",
          severity: "error",
        });
      } finally {
        setGstSaving(false);
      }
      return;
    }

    const normalized = gstNumber.trim().toUpperCase();
    const gstPattern = /^[0-9A-Z]{15}$/;
    if (!gstPattern.test(normalized)) {
      setGstError("Enter a valid 15-character GSTIN");
      return;
    }

    if (!authToken) return;
    if (normalized === gstSavedValue) return;

    setGstSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/user/gst`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        credentials: "include",
        body: JSON.stringify({ gstNumber: normalized }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to save GST number");
      }
      setGstSavedValue(normalized);
      setSnackbar({
        open: true,
        message: "GST number saved",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || "Failed to save GST number",
        severity: "error",
      });
    } finally {
      setGstSaving(false);
    }
  };

  const validateGuestCheckoutForm = () => {
    const errors = {};
    if (!guestDetails.fullName.trim())
      errors.fullName = "Full name is required";
    if (!/^\d{10}$/.test(guestDetails.phone.trim())) {
      errors.phone = "Enter valid 10-digit phone number";
    }
    if (!guestDetails.address.trim()) errors.address = "Address is required";
    if (!/^\d{6}$/.test(guestDetails.pincode.trim())) {
      errors.pincode = "Enter valid 6-digit pincode";
    }
    if (!guestDetails.state.trim()) errors.state = "State is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestDetails.email.trim())) {
      errors.email = "Enter valid email address";
    }

    setGuestErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate coupon with backend
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }

    setCouponLoading(true);
    setCouponError("");

    try {
      const token = getStoredAccessToken();
      const response = await fetch(`${API_URL}/api/coupons/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          code: couponCode.trim(),
          // Backend validates coupon against the GST-exclusive base amount
          // (after membership/referral, before coupon/shipping).
          orderAmount: baseBeforeCoupon,
          influencerCode: referralCode || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAppliedCoupon(data.data);
        setCouponCode("");
        setSnackbar({
          open: true,
          message: `Coupon applied! You save Rs.${data.data.discountAmount}`,
          severity: "success",
        });

        // Track if it's an affiliate coupon
        if (data.data.isAffiliateCoupon) {
          setAffiliateFromCoupon(data.data.code, data.data.affiliateSource);
          setAffiliateData({
            code: data.data.code,
            source: data.data.affiliateSource,
            fromCoupon: true,
          });
        }
      } else {
        const shouldTryReferral = response.status === 404;
        if (shouldTryReferral && applyReferralCode) {
          const referralResult = await applyReferralCode(
            couponCode.trim(),
            "manual",
          );

          if (referralResult?.success) {
            setAppliedCoupon(null);
            setCouponCode("");
            setCouponError("");
            setSnackbar({
              open: true,
              message: "Referral code applied successfully",
              severity: "success",
            });
            return;
          }
        }

        setCouponError(data.message || "Invalid coupon");
      }
    } catch (error) {
      console.error("Coupon validation error:", error);
      setCouponError("Failed to validate coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  // Remove applied coupon
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setSnackbar({
      open: true,
      message: "Coupon removed",
      severity: "info",
    });
  };

  const buildOrderProductsPayload = () =>
    (cartItems || []).map((item) => {
      const data = getItemData(item);
      return {
        productId: data.id,
        productTitle: data.name,
        quantity: data.quantity,
        price: data.price,
        image: data.image,
        subTotal: data.price * data.quantity,
      };
    });

  const buildGuestDetailsPayload = () => {
    if (isGuestCheckout) {
      return {
        fullName: guestDetails.fullName,
        phone: guestDetails.phone,
        address: guestDetails.address,
        pincode: guestDetails.pincode,
        state: guestDetails.state,
        email: guestDetails.email,
        gst: gstNumber || "",
      };
    }
    if (gstNumber) {
      return {
        gst: gstNumber,
      };
    }
    return {};
  };

  // Handle Pay Now click - PhonePe redirect flow
  const handlePayNow = async () => {
    if (isPayButtonDisabled) return;

    if (maintenanceMode) {
      setSnackbar({
        open: true,
        message:
          "Checkout is temporarily unavailable due to maintenance. Please try again later.",
        severity: "error",
      });
      return;
    }

    setIsPayButtonDisabled(true);
    try {
      if (isGuestCheckout && !validateGuestCheckoutForm()) {
        throw new Error("Please complete all required guest details");
      }

      const insufficientItems = (cartItems || [])
        .map((item) => getItemData(item))
        .filter((data) => data.quantity > data.availableQuantity);
      if (insufficientItems.length > 0) {
        const first = insufficientItems[0];
        setSnackbar({
          open: true,
          message: `Only ${first.availableQuantity} left for ${first.name}. Update your cart to continue.`,
          severity: "error",
        });
        return;
      }

      const statusRes = await fetch(`${API_URL}/api/orders/payment-status`);
      const statusData = await statusRes.json();

      if (!statusData?.data?.paymentEnabled) {
        setShowPaymentModal(true);
        return;
      }

      const token = authToken;
      const isValidObjectId =
        selectedAddress && /^[a-f\d]{24}$/i.test(selectedAddress);
      const selectedAddrObj = addresses.find((a) => a._id === selectedAddress);

      const currentAffiliate = getStoredAffiliateData();
      const originalAmount = round2(subtotal + tax + payableShipping);

      const orderData = {
        products: buildOrderProductsPayload(),
        totalAmt: total,
        originalAmount,
        finalAmount: total,
        delivery_address: isValidObjectId ? selectedAddress : null,
        location: isGuestCheckout ? guestLocationPayload : null,
        notes: orderNote,
        tax,
        shipping: payableShipping,
        // Coupon details (backend will revalidate)
        couponCode: appliedCoupon?.code || null,
        discountAmount: couponDiscount,
        // Influencer/Referral tracking
        influencerCode: referralCode || null,
        // Legacy affiliate tracking
        affiliateCode: currentAffiliate?.code || null,
        affiliateSource: currentAffiliate?.source || null,
        coinRedeem: {
          coins: 0,
        },
        paymentType: "prepaid",
        guestDetails: buildGuestDetailsPayload(),
        shippingAddress: selectedAddrObj
          ? {
              name: selectedAddrObj.name,
              address: selectedAddrObj.address_line1,
              landmark: selectedAddrObj.landmark,
              city: selectedAddrObj.city,
              state: selectedAddrObj.state,
              pincode: selectedAddrObj.pincode,
              mobile: selectedAddrObj.mobile,
              addressType: selectedAddrObj.addressType,
            }
          : isGuestCheckout
            ? {
                name: guestDetails.fullName,
                address: guestDetails.address,
                city: "",
                state: guestDetails.state,
                pincode: guestDetails.pincode,
                mobile: guestDetails.phone,
              }
            : null,
      };

      const response = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Payment initialization failed");
      }

      const paymentUrl = data?.data?.paymentUrl;
      if (!paymentUrl) {
        throw new Error("Payment URL not received. Please try again.");
      }

      if (
        typeof window !== "undefined" &&
        token &&
        data?.data?.orderId &&
        data?.data?.merchantTransactionId
      ) {
        localStorage.setItem(
          ORDER_PENDING_PAYMENT_KEY,
          JSON.stringify({
            orderId: data.data.orderId,
            merchantTransactionId: data.data.merchantTransactionId,
            createdAt: Date.now(),
          }),
        );
      }

      window.location.href = paymentUrl;
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || "Failed to initiate payment",
        severity: "error",
      });
    } finally {
      setTimeout(() => {
        setIsPayButtonDisabled(false);
      }, 2000);
    }
  };

  // Handle Save Order for Later
  const handleSaveOrder = async () => {
    setIsSavingOrder(true);

    try {
      if (isGuestCheckout && !validateGuestCheckoutForm()) {
        throw new Error("Please complete all required guest details");
      }

      const insufficientItems = (cartItems || [])
        .map((item) => getItemData(item))
        .filter((data) => data.quantity > data.availableQuantity);
      if (insufficientItems.length > 0) {
        const first = insufficientItems[0];
        setSnackbar({
          open: true,
          message: `Only ${first.availableQuantity} left for ${first.name}. Update your cart to continue.`,
          severity: "error",
        });
        return;
      }

      const token = authToken;
      const currentAffiliate = getStoredAffiliateData();

      // Get selected address - selectedAddress is now the _id directly
      const isValidObjectId =
        selectedAddress && /^[a-f\d]{24}$/i.test(selectedAddress);

      // Find the full address object for order details
      const selectedAddrObj = addresses.find((a) => a._id === selectedAddress);

      const orderData = {
        products: buildOrderProductsPayload(),
        totalAmt: total,
        delivery_address: isValidObjectId ? selectedAddress : null,
        location: isGuestCheckout ? guestLocationPayload : null,
        shippingAddress: selectedAddrObj
          ? {
              name: selectedAddrObj.name,
              address: selectedAddrObj.address_line1,
              landmark: selectedAddrObj.landmark,
              city: selectedAddrObj.city,
              state: selectedAddrObj.state,
              pincode: selectedAddrObj.pincode,
              mobile: selectedAddrObj.mobile,
              addressType: selectedAddrObj.addressType,
            }
          : isGuestCheckout
            ? {
                name: guestDetails.fullName,
                address: guestDetails.address,
                city: "",
                state: guestDetails.state,
                pincode: guestDetails.pincode,
                mobile: guestDetails.phone,
              }
            : null,
        guestDetails: buildGuestDetailsPayload(),
        // Coupon details
        couponCode: appliedCoupon?.code || null,
        discountAmount: couponDiscount,
        finalAmount: total,
        // Influencer/Referral tracking - backend recalculates for security
        influencerCode: referralCode || null,
        // Legacy affiliate tracking
        affiliateCode: currentAffiliate?.code || null,
        affiliateSource: currentAffiliate?.source || null,
        coinRedeem: {
          coins: 0,
        },
        paymentType: "prepaid",
        notes: orderNote,
      };

      const response = await fetch(`${API_URL}/api/orders/save-for-later`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (data.success) {
        setShowPaymentModal(false);
        if (clearCart) clearCart();

        setSnackbar({
          open: true,
          message: "Order saved! Complete payment when enabled.",
          severity: "success",
        });

        // Redirect to orders page after delay
        setTimeout(() => {
          router.push("/my-orders");
        }, 2000);
      } else {
        // Show detailed error from server if available
        const errorMsg = data.message || data.details || "Failed to save order";
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error("Save order error:", error);
      setSnackbar({
        open: true,
        message: error.message || "Failed to save order. Please try again.",
        severity: "error",
      });
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Close modal and re-enable button
  const handleCloseModal = () => {
    setShowPaymentModal(false);
    // Re-enable after a delay to prevent spam
    setTimeout(() => {
      setIsPayButtonDisabled(false);
    }, 3000);
  };

  // Empty cart state
  if (!cartItems || cartItems.length === 0) {
    return (
      <section className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <div className="relative z-10 bg-white/50 backdrop-blur-xl p-10 rounded-[3rem] border border-white/60 shadow-xl">
          <div className="w-24 h-24 bg-linear-to-tr from-primary to-[var(--flavor-hover)] rounded-full flex items-center justify-center mb-6 mx-auto shadow-lg shadow-primary/30 animate-bounce">
            <IoCartOutline size={48} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Your cart is empty
          </h1>
          <p className="text-gray-500 mb-8 max-w-xs mx-auto font-medium">
            Looks like you have not added any peanut butter goodness yet!
          </p>
          <Link
            href="/products"
            className="inline-block px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 hover:brightness-110 hover:scale-105 transition-all active:scale-95"
          >
            Start Shopping
          </Link>
        </div>

        {/* Background Gradients */}
        <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--flavor-glass)] blur-[120px] rounded-full pointer-events-none -z-10" />
      </section>
    );
  }

  return (
    <>
      <section className="min-h-screen pb-20 pt-10 px-4 md:px-8 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="fixed top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[150px] rounded-full pointer-events-none -z-10" />
        <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--flavor-glass)] blur-[150px] rounded-full pointer-events-none -z-10" />

        <div className="container mx-auto max-w-7xl relative z-10">
          {/* Header */}
          <div className="mb-10 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-2">
              Checkout
            </h1>
            <p className="text-gray-500 font-bold">
              Complete your purchase securely
            </p>
          </div>

          {/* High Traffic Notice */}
          {highTrafficNotice?.enabled && (
            <div className="bg-amber-50/80 backdrop-blur-md border border-amber-200 rounded-3xl p-6 mb-8 flex items-start gap-4 shadow-sm animate-pulse-slow">
              <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
                <MdInfo size={24} />
              </div>
              <div>
                <h3 className="font-black text-amber-900 text-lg mb-1">
                  High Demand Alert
                </h3>
                <p className="text-amber-800 font-medium">
                  {highTrafficNotice.message || (
                    <>
                      <strong>High traffic</strong> — availability may vary.
                      Your order will be processed once confirmed.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column - Address & Items */}
            <div className="lg:col-span-8 space-y-8">
              {/* Delivery Address */}
              <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-8 border border-white/50 shadow-xl shadow-gray-200/50">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-2xl bg-[var(--flavor-glass)] flex items-center justify-center text-primary">
                      1
                    </span>
                    {isGuestCheckout ? "Guest Details" : "Delivery Address"}
                  </h2>
                  {!isGuestCheckout && (
                    <button
                      onClick={handleAddNewAddress}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[var(--flavor-glass)] text-primary font-bold rounded-xl hover:bg-[var(--flavor-light)] transition-colors"
                    >
                      <FiPlus size={18} /> Add Address
                    </button>
                  )}
                </div>

                {isGuestCheckout ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <TextField
                      label="Full Name *"
                      name="fullName"
                      value={guestDetails.fullName}
                      onChange={handleGuestChange}
                      error={!!guestErrors.fullName}
                      helperText={guestErrors.fullName}
                      variant="outlined"
                      fullWidth
                      InputProps={{
                        sx: {
                          borderRadius: "16px",
                          bgcolor: "rgba(255,255,255,0.5)",
                        },
                      }}
                    />
                    <TextField
                      label="Phone *"
                      name="phone"
                      value={guestDetails.phone}
                      onChange={handleGuestChange}
                      error={!!guestErrors.phone}
                      helperText={guestErrors.phone}
                      variant="outlined"
                      fullWidth
                      InputProps={{
                        sx: {
                          borderRadius: "16px",
                          bgcolor: "rgba(255,255,255,0.5)",
                        },
                      }}
                    />
                    <TextField
                      label="Email *"
                      name="email"
                      value={guestDetails.email}
                      onChange={handleGuestChange}
                      error={!!guestErrors.email}
                      helperText={guestErrors.email}
                      variant="outlined"
                      fullWidth
                      InputProps={{
                        sx: {
                          borderRadius: "16px",
                          bgcolor: "rgba(255,255,255,0.5)",
                        },
                      }}
                    />
                    <div className="md:col-span-2 space-y-4 p-5 bg-gray-50/50 rounded-3xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <UseCurrentLocationGoogleMaps
                          onResolved={(loc) => {
                            setGuestLocationPayload(loc);
                            setGuestDetails((prev) => ({
                              ...prev,
                              address:
                                loc.street ||
                                loc.formattedAddress ||
                                prev.address,
                              pincode: loc.pincode || prev.pincode,
                              state:
                                normalizeStateValue(loc.state) || prev.state,
                            }));
                          }}
                          onError={(message) =>
                            setSnackbar({
                              open: true,
                              message,
                              severity: "error",
                            })
                          }
                        />
                        {guestLocationPayload?.formattedAddress && (
                          <span className="text-xs font-bold text-primary bg-[var(--flavor-glass)] px-3 py-1 rounded-full">
                            Location detected
                          </span>
                        )}
                      </div>

                      <TextField
                        label="Full Address *"
                        name="address"
                        value={guestDetails.address}
                        onChange={handleGuestChange}
                        error={!!guestErrors.address}
                        helperText={guestErrors.address}
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={2}
                        InputProps={{
                          sx: { borderRadius: "16px", bgcolor: "white" },
                        }}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <TextField
                          label="Pincode *"
                          name="pincode"
                          value={guestDetails.pincode}
                          onChange={handleGuestChange}
                          error={!!guestErrors.pincode}
                          helperText={guestErrors.pincode}
                          variant="outlined"
                          fullWidth
                          InputProps={{
                            sx: { borderRadius: "16px", bgcolor: "white" },
                          }}
                        />
                        <FormControl fullWidth error={!!guestErrors.state}>
                          <InputLabel>State *</InputLabel>
                          <Select
                            name="state"
                            value={guestDetails.state}
                            label="State *"
                            onChange={handleGuestChange}
                            sx={{ borderRadius: "16px", bgcolor: "white" }}
                          >
                            {INDIAN_STATES.map((state) => (
                              <MenuItem key={state} value={state}>
                                {state}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {addressLoading ? (
                      <div className="flex justify-center py-10">
                        <CircularProgress sx={{ color: "#10b981" }} />
                      </div>
                    ) : addresses.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-[2rem]">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                          <MdLocationOn size={32} />
                        </div>
                        <p className="text-gray-500 font-medium mb-6">
                          No saved addresses found
                        </p>
                        <Button
                          onClick={handleAddNewAddress}
                          variant="contained"
                          sx={{
                            backgroundColor: "#10b981",
                            color: "white",
                            textTransform: "none",
                            borderRadius: "12px",
                            padding: "10px 24px",
                            fontWeight: "bold",
                            "&:hover": {
                              backgroundColor: "var(--flavor-hover)",
                            },
                          }}
                        >
                          <FiPlus className="mr-2" /> Add New Address
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {addresses.map((addr) => (
                          <div
                            key={addr._id}
                            onClick={() => setSelectedAddress(addr._id)}
                            className={`relative p-5 rounded-3xl border-2 cursor-pointer transition-all duration-300 ${
                              selectedAddress === addr._id
                                ? "border-primary bg-[var(--flavor-glass)] shadow-lg shadow-primary/10"
                                : "border-gray-100 bg-white hover:border-primary/40"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                  selectedAddress === addr._id
                                    ? "bg-[var(--flavor-glass)] text-primary"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {getAddressIcon(addr.addressType)}
                                {addr.addressType || "Home"}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleEditAddress(addr);
                                }}
                                className="p-2 text-gray-400 hover:text-primary hover:bg-[var(--flavor-glass)] rounded-full transition-colors"
                              >
                                <FiEdit2 size={16} />
                              </button>
                            </div>

                            <h3 className="font-bold text-gray-900 mb-1">
                              {addr.name}
                            </h3>
                            <p className="text-sm text-gray-500 leading-relaxed mb-3">
                              {addr.address_line1}{" "}
                              {addr.landmark && `, ${addr.landmark}`} <br />
                              {addr.city}, {addr.state} - {addr.pincode}
                            </p>
                            <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-primary" />{" "}
                              +91 {addr.mobile}
                            </p>

                            {selectedAddress === addr._id && (
                              <div className="absolute top-4 right-4 text-primary">
                                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                  <FiCheck size={14} className="text-white" />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Order Items */}
              <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-8 border border-white/50 shadow-xl shadow-gray-200/50">
                <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-[var(--flavor-glass)] flex items-center justify-center text-primary">
                    2
                  </span>
                  Order Items{" "}
                  <span className="text-gray-400 text-lg font-medium">
                    ({cartItems.length})
                  </span>
                </h2>

                <div className="space-y-4">
                  {cartItems.map((item, index) => {
                    const data = getItemData(item);
                    return (
                      <div
                        key={data.id || index}
                        className="flex gap-4 p-4 rounded-3xl bg-white border border-gray-50 items-center"
                      >
                        <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center p-2 shrink-0">
                          <img
                            src={data.image}
                            alt={data.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">
                            {data.name}
                          </h3>
                          {data.demandStatus === "HIGH" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-1">
                              <HiOutlineFire /> High Demand
                            </span>
                          )}
                          <p className="text-sm text-gray-500 mt-1 font-medium">
                            Qty: {data.quantity} ×{" "}
                            <span className="text-gray-900">₹{data.price}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-lg text-gray-900">
                            ₹{(data.price * data.quantity).toFixed(0)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Notes */}
              <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-8 border border-white/50 shadow-xl shadow-gray-200/50">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Order Notes{" "}
                  <span className="text-gray-400 font-normal text-sm ml-2">
                    (Optional)
                  </span>
                </h2>
                <textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Any special instructions for delivery?"
                  className="w-full p-5 rounded-3xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none h-32 text-gray-700 bg-white"
                />
              </div>
            </div>

            {/* Right Column - Summary & Payment */}
            <div className="lg:col-span-4 space-y-6">
              <div className="sticky top-24 space-y-6">
                {/* Order Summary Card */}
                <div className="bg-gray-900 text-white rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative">
                  {/* Glow Effects */}
                  <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-primary/20 blur-[80px] rounded-full pointer-events-none" />
                  <div className="absolute bottom-[-10%] left-[-10%] w-32 h-32 bg-[var(--flavor-glass)] blur-[60px] rounded-full pointer-events-none" />

                  <h2 className="text-2xl font-black mb-6 border-b border-gray-700 pb-4">
                    Summary
                  </h2>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between text-gray-400 font-bold uppercase tracking-widest text-xs">
                      <span>Subtotal</span>
                      <span className="text-white">
                        ₹{cartBaseSubtotal.toFixed(2)}
                      </span>
                    </div>

                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-primary/80 font-bold uppercase tracking-widest text-xs">
                        <span className="flex items-center gap-1">
                          <FiTag /> Coupon
                        </span>
                        <span>-₹{couponDiscount.toFixed(2)}</span>
                      </div>
                    )}

                    {coinRedeemAmount > 0 && (
                      <div className="flex justify-between text-primary/80 font-bold uppercase tracking-widest text-xs">
                        <span className="flex items-center gap-1">
                          🪙 Coins
                        </span>
                        <span>-₹{coinRedeemAmount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-gray-400 font-bold uppercase tracking-widest text-xs">
                      <span>{summaryTaxLabel}</span>
                      <span>&#8377;{summaryTaxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400 font-bold uppercase tracking-widest text-xs">
                      <span>Shipping</span>
                      {hasCheckoutStateInput ? (
                        <span className="text-primary flex items-center gap-2">
                          {displayShippingCharge > 0 && (
                            <span className="line-through text-gray-500">
                              &#8377;{displayShippingCharge.toFixed(2)}
                            </span>
                          )}
                          <span>&#8377;0.00</span>
                        </span>
                      ) : (
                        <span className="text-gray-500">--</span>
                      )}
                    </div>

                    <div className="pt-6 border-t border-gray-700 flex justify-between items-end">
                      <div>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-1">
                          Total Payable
                        </p>
                        <p className="text-3xl font-black text-white tracking-tight">
                          ₹{total.toFixed(0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handlePayNow}
                    disabled={
                      maintenanceMode ||
                      isPayButtonDisabled ||
                      cartItems.length === 0
                    }
                    className="w-full py-4 bg-primary text-gray-900 font-black rounded-2xl shadow-lg shadow-primary/20 hover:brightness-110 transform hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isPayButtonDisabled ? (
                      <span className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        PAY NOW <FiCheck className="stroke-[3px]" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-[10px] text-gray-500 mt-4 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    <span>🔒 Secure Checkout</span>
                  </p>
                </div>

                {/* Coupon & Extras */}
                <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-6 border border-white/50 shadow-xl shadow-gray-200/50 space-y-6">
                  {/* Coupon Input */}
                  <div>
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <FiTag className="text-primary" /> Apply Coupon
                    </h3>
                    {appliedCoupon ? (
                      <div className="bg-[var(--flavor-glass)] border border-primary/20 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-primary flex items-center gap-2">
                            <FiCheck /> {appliedCoupon.code}
                          </p>
                          <p className="text-xs text-primary font-bold">
                            You saved ₹{appliedCoupon.discountAmount}
                          </p>
                        </div>
                        <button
                          onClick={handleRemoveCoupon}
                          className="p-2 bg-white rounded-full text-red-500 hover:bg-red-50 hover:scale-110 transition-all"
                        >
                          <FiX />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => {
                            setCouponCode(e.target.value.toUpperCase());
                            setCouponError("");
                          }}
                          placeholder="ENTER CODE"
                          className="flex-1 text-sm font-bold uppercase p-3 bg-white rounded-xl border border-gray-200 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                          onClick={handleApplyCoupon}
                          disabled={couponLoading}
                          className="px-5 bg-primary text-white font-bold rounded-xl hover:brightness-110 transition-colors disabled:opacity-50"
                        >
                          {couponLoading ? "..." : "APPLY"}
                        </button>
                      </div>
                    )}
                    {couponError && (
                      <p className="text-red-500 text-xs font-bold mt-2 ml-1">
                        {couponError}
                      </p>
                    )}
                  </div>

                  {/* GST Input */}
                  <div>
                    <h3 className="font-bold text-gray-800 mb-3 text-sm">
                      GST Number{" "}
                      <span className="text-gray-400 font-normal">
                        (Optional)
                      </span>
                    </h3>
                    <input
                      type="text"
                      value={gstNumber}
                      onChange={handleGstChange}
                      onBlur={handleGstBlur}
                      placeholder="15-digit GSTIN"
                      className="w-full text-sm font-medium uppercase p-3 bg-white rounded-xl border border-gray-200 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    {gstSavedValue && (
                      <p className="text-primary text-[10px] font-bold mt-1 ml-1 flex items-center gap-1">
                        <FiCheck /> Saved to profile
                      </p>
                    )}
                  </div>

                  {/* Coins */}
                  {!isGuestCheckout && coinBalance > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-gray-800 text-sm">
                          Coins
                        </h3>
                        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                          {coinBalance} Available
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium">
                        Coins are earned on orders and can be redeemed on membership
                        subscription checkout.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Unavailable Modal */}
      <PaymentUnavailableModal
        isOpen={showPaymentModal}
        onClose={handleCloseModal}
        onSaveOrder={handleSaveOrder}
        isSaving={isSavingOrder}
        orderTotal={total}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{
            width: "100%",
            borderRadius: "16px",
            fontWeight: "bold",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Address Dialog */}
      <Dialog
        open={isAddressDialogOpen}
        onClose={() => setIsAddressDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: "24px", padding: "10px" },
        }}
      >
        <DialogTitle
          sx={{
            borderBottom: "1px solid #f3f4f6",
            fontWeight: "900",
            fontSize: "1.25rem",
          }}
        >
          {editingAddress ? "Edit Address" : "Add New Address"}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <div className="grid grid-cols-1 gap-5 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <TextField
                name="name"
                label="Full Name"
                value={formData.name}
                onChange={handleFormChange}
                error={!!formErrors.name}
                helperText={formErrors.name}
                fullWidth
                size="medium"
                InputProps={{ sx: { borderRadius: "12px" } }}
              />
              <TextField
                name="mobile"
                label="Mobile"
                value={formData.mobile}
                onChange={handleFormChange}
                error={!!formErrors.mobile}
                helperText={formErrors.mobile}
                fullWidth
                size="medium"
                InputProps={{ sx: { borderRadius: "12px" } }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <UseCurrentLocationGoogleMaps
                onResolved={(loc) => {
                  setLocationPayload(loc);
                  setFormData((prev) => ({
                    ...prev,
                    address_line1:
                      loc.street || loc.formattedAddress || prev.address_line1,
                    city: loc.city || prev.city,
                    pincode: loc.pincode || prev.pincode,
                    state: normalizeStateValue(loc.state) || prev.state,
                  }));
                }}
                onError={(message) =>
                  setSnackbar({ open: true, message, severity: "error" })
                }
              />
            </div>

            <TextField
              name="address_line1"
              label="Full Address"
              value={formData.address_line1}
              onChange={handleFormChange}
              error={!!formErrors.address_line1}
              helperText={formErrors.address_line1}
              fullWidth
              multiline
              rows={2}
              InputProps={{ sx: { borderRadius: "12px" } }}
            />

            <TextField
              name="landmark"
              label="Landmark (Optional)"
              value={formData.landmark}
              onChange={handleFormChange}
              fullWidth
              size="small"
              InputProps={{ sx: { borderRadius: "12px" } }}
            />

            <div className="grid grid-cols-2 gap-4">
              <TextField
                name="city"
                label="City"
                value={formData.city}
                onChange={handleFormChange}
                error={!!formErrors.city}
                helperText={formErrors.city}
                fullWidth
                size="small"
                InputProps={{ sx: { borderRadius: "12px" } }}
              />
              <TextField
                name="pincode"
                label="Pincode"
                value={formData.pincode}
                onChange={handleFormChange}
                error={!!formErrors.pincode}
                helperText={formErrors.pincode}
                fullWidth
                size="small"
                InputProps={{ sx: { borderRadius: "12px" } }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormControl fullWidth size="small" error={!!formErrors.state}>
                <InputLabel>State</InputLabel>
                <Select
                  name="state"
                  value={formData.state}
                  onChange={handleFormChange}
                  label="State"
                  sx={{ borderRadius: "12px" }}
                >
                  {INDIAN_STATES.map((state) => (
                    <MenuItem key={state} value={state}>
                      {state}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  name="addressType"
                  value={formData.addressType}
                  onChange={handleFormChange}
                  label="Type"
                  sx={{ borderRadius: "12px" }}
                >
                  <MenuItem value="Home">Home</MenuItem>
                  <MenuItem value="Work">Work</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={() => setIsAddressDialogOpen(false)}
            sx={{ color: "#6b7280", fontWeight: "bold" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveAddress}
            disabled={addressSaving}
            variant="contained"
            sx={{
              bgcolor: "var(--primary)",
              borderRadius: "12px",
              fontWeight: "bold",
              px: 4,
              py: 1.5,
              "&:hover": { bgcolor: "var(--flavor-hover)" },
            }}
          >
            {addressSaving ? "Saving..." : "Save Address"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Checkout;
