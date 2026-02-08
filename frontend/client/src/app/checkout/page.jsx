"use client";

import PaymentUnavailableModal from "@/components/PaymentUnavailableModal";
import UseCurrentLocationGoogleMaps from "@/components/UseCurrentLocationGoogleMaps";
import { useCart } from "@/context/CartContext";
import { useReferral } from "@/context/ReferralContext";
import { useSettings } from "@/context/SettingsContext";
import { MyContext } from "@/context/ThemeProvider";
import {
  getStoredAffiliateData,
  initAffiliateTracking,
  setAffiliateFromCoupon,
} from "@/utils/affiliateTracking";
import { round2, splitGstInclusiveAmount } from "@/utils/gst";
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
import Radio from "@mui/material/Radio";
import cookies from "js-cookie";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useState } from "react";
import { FiCheck, FiEdit2, FiPlus, FiTag, FiX } from "react-icons/fi";
import { HiOutlineFire } from "react-icons/hi";
import {
  MdHome,
  MdInfo,
  MdLocalShipping,
  MdLocationOn,
  MdWork,
} from "react-icons/md";

const API_URL = (
  process.env.NEXT_PUBLIC_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
)
  .trim()
  .replace(/\/+$/, "");

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
  const authToken = cookies.get("accessToken");
  const isGuestCheckout = !authToken;

  // Get referral/influencer data from context
  const {
    referralCode,
    referralData,
    calculateDiscount: calculateReferralDiscount,
    applyReferralCode,
  } = useReferral();

  // Get settings from context
  const {
    shippingSettings,
    highTrafficNotice,
    taxSettings,
    calculateShipping,
  } = useSettings();

  // Helper to normalize cart item data (handles both API and localStorage structures)
  const getItemData = (item) => {
    const product = item.product || item.productData || item;
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
  const [requestedCoins, setRequestedCoins] = useState(0);

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
    const incoming = String(value || "").trim().toLowerCase();
    if (!incoming) return "";
    const match = INDIAN_STATES.find(
      (s) => String(s).trim().toLowerCase() === incoming,
    );
    return match || "";
  };

  // Prices are GST-inclusive throughout the storefront.
  // GST is fixed at 5% (IGST) for all orders.
  const gstRatePercent = 5;

  // Derive the delivery state for GST display (CGST+SGST vs IGST)
  const checkoutStateForPreview = isGuestCheckout
    ? guestDetails.state
    : addresses.find((a) => a._id === selectedAddress)?.state || "";

  // Per-line breakdown so rounding works for multiple items.
  const cartItemTaxLines = (cartItems || []).map((item) => {
    const data = getItemData(item);
    const quantity = Math.max(Number(data.quantity || 1), 0);
    const unitPrice = Number(data.price || 0);
    const lineAmount = round2(unitPrice * quantity);

    if (gstRatePercent > 0) {
      return splitGstInclusiveAmount(lineAmount, gstRatePercent);
    }

    const taxableAmount = lineAmount;
    const gstAmount = 0;
    return {
      ratePercent: gstRatePercent,
      grossAmount: round2(taxableAmount + gstAmount),
      taxableAmount,
      gstAmount,
    };
  });

  const cartGrossSubtotal = round2(
    cartItemTaxLines.reduce((sum, line) => sum + line.grossAmount, 0),
  );
  const originalTaxEstimate = round2(
    cartItemTaxLines.reduce((sum, line) => sum + line.gstAmount, 0),
  );

  const membershipDiscountPercentage =
    membershipStatus?.isMember && !membershipStatus?.isExpired
      ? Number(
          membershipStatus?.membershipPlan?.discountPercentage ??
            membershipStatus?.membershipPlan?.discountPercent ??
            0,
        )
      : 0;
  const membershipDiscount = Math.max(
    round2((cartGrossSubtotal * membershipDiscountPercentage) / 100),
    0,
  );
  const subtotalAfterMembership = Math.max(
    cartGrossSubtotal - membershipDiscount,
    0,
  );

  // Referral/Influencer discount (applied FIRST, calculated on subtotal)
  // Note: Backend will recalculate this for security - this is for display only
  const referralDiscount = referralCode
    ? calculateReferralDiscount(subtotalAfterMembership)
    : 0;

  // Coupon discount (applied SECOND, on amount after referral discount)
  const couponDiscount = appliedCoupon?.discountAmount || 0;

  const subtotalAfterDiscounts = Math.max(
    subtotalAfterMembership - referralDiscount - couponDiscount,
    0,
  );
  const maxCoinRedeemValue = Math.floor(
    (subtotalAfterDiscounts * Number(coinSettings.maxRedeemPercentage || 0)) /
      100,
  );
  const safeRequestedCoins = Math.max(Number(requestedCoins || 0), 0);
  const effectiveRedeemCoins = Math.min(
    safeRequestedCoins,
    Number(coinBalance || 0),
    Math.floor(maxCoinRedeemValue / Number(coinSettings.redeemRate || 1)),
  );
  const coinRedeemAmount = Math.round(
    effectiveRedeemCoins * Number(coinSettings.redeemRate || 0),
  );
  const netInclusiveSubtotal = Math.max(
    round2(subtotalAfterDiscounts - coinRedeemAmount),
    0,
  );

  const netSplit = splitGstInclusiveAmount(
    netInclusiveSubtotal,
    gstRatePercent,
  );
  const subtotal = netSplit.taxableAmount; // Subtotal (Excl. GST)
  const tax = netSplit.gstAmount; // GST (IGST)

  // Shipping calculation from context settings (thresholds use inclusive subtotal).
  const shipping = calculateShipping(netInclusiveSubtotal);

  // Total discount
  const totalDiscount =
    membershipDiscount + referralDiscount + couponDiscount + coinRedeemAmount;

  // Final total
  const total = Math.max(0, round2(netInclusiveSubtotal + shipping));

  // Fetch addresses from database
  const fetchAddresses = useCallback(async () => {
    try {
      const token = cookies.get("accessToken");
      if (!token) {
        setAddressLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/address`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
          setRequestedCoins(0);
        }
      } catch (error) {
        // Checkout should continue even if optional dynamic services fail.
      }
    };

    fetchDynamicCheckoutSettings();
  }, [authToken]);

  useEffect(() => {
    const maxCoinsByRule = Math.floor(
      maxCoinRedeemValue / Number(coinSettings.redeemRate || 1),
    );
    setRequestedCoins((prev) =>
      Math.min(Math.max(Number(prev || 0), 0), coinBalance, maxCoinsByRule),
    );
  }, [coinBalance, maxCoinRedeemValue, coinSettings.redeemRate]);

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
      const token = cookies.get("accessToken");
      const url = editingAddress
        ? `${API_URL}/api/address/${editingAddress._id}`
        : `${API_URL}/api/address`;

      const response = await fetch(url, {
        method: editingAddress ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          location: locationPayload,
        }),
      });

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
      const token = cookies.get("accessToken");
      const response = await fetch(`${API_URL}/api/coupons/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          code: couponCode.trim(),
          // Backend validates coupon against the net order amount
          // (after membership/referral, before coupon/shipping).
          orderAmount: Math.max(subtotalAfterMembership - referralDiscount, 0),
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

  const createPurchaseOrderDraft = async ({ token, deliveryAddressId }) => {
    const poPayload = {
      products: buildOrderProductsPayload(),
      delivery_address: deliveryAddressId || null,
      guestDetails: buildGuestDetailsPayload(),
      paymentType: "prepaid",
    };

    const poResponse = await fetch(`${API_URL}/api/purchase-orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(poPayload),
    });
    const poData = await poResponse.json();
    if (poData.success) {
      return poData?.data?.purchaseOrder?._id || null;
    }
    return null;
  };

  // Handle Pay Now click - PhonePe redirect flow
  const handlePayNow = async () => {
    if (isPayButtonDisabled) return;

    setIsPayButtonDisabled(true);
    try {
      if (isGuestCheckout && !validateGuestCheckoutForm()) {
        throw new Error("Please complete all required guest details");
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
      const originalAmount = round2(subtotal + shipping + originalTaxEstimate);

      let purchaseOrderId = null;
      try {
        purchaseOrderId = await createPurchaseOrderDraft({
          token,
          deliveryAddressId: isValidObjectId ? selectedAddress : null,
        });
      } catch (error) {
        // Do not block checkout if PO generation fails.
      }

      const orderData = {
        products: buildOrderProductsPayload(),
        totalAmt: total,
        originalAmount,
        finalAmount: total,
        delivery_address: isValidObjectId ? selectedAddress : null,
        location: isGuestCheckout ? guestLocationPayload : null,
        notes: orderNote,
        tax,
        shipping,
        // Coupon details (backend will revalidate)
        couponCode: appliedCoupon?.code || null,
        discountAmount: couponDiscount,
        // Influencer/Referral tracking
        influencerCode: referralCode || null,
        // Legacy affiliate tracking
        affiliateCode: currentAffiliate?.code || null,
        affiliateSource: currentAffiliate?.source || null,
        coinRedeem: {
          coins: effectiveRedeemCoins,
        },
        paymentType: "prepaid",
        guestDetails: buildGuestDetailsPayload(),
        purchaseOrderId,
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

      const token = authToken;
      const currentAffiliate = getStoredAffiliateData();

      // Get selected address - selectedAddress is now the _id directly
      const isValidObjectId =
        selectedAddress && /^[a-f\d]{24}$/i.test(selectedAddress);

      // Find the full address object for order details
      const selectedAddrObj = addresses.find((a) => a._id === selectedAddress);

      let purchaseOrderId = null;
      try {
        purchaseOrderId = await createPurchaseOrderDraft({
          token,
          deliveryAddressId: isValidObjectId ? selectedAddress : null,
        });
      } catch (error) {
        // Do not block save-order flow if PO generation fails.
      }

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
          coins: effectiveRedeemCoins,
        },
        paymentType: "prepaid",
        purchaseOrderId,
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
      <section className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="container mx-auto max-w-lg text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-6xl mb-4">🛒</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-3">
              Your cart is empty
            </h1>
            <p className="text-gray-600 mb-6 text-base">
              Add items to your cart to proceed with checkout
            </p>
            <Link href="/products">
              <Button
                sx={{
                  backgroundColor: "#059669",
                  color: "white",
                  padding: "14px 32px",
                  borderRadius: "12px",
                  fontWeight: 600,
                  fontSize: "16px",
                  textTransform: "none",
                  "&:hover": { backgroundColor: "#047857" },
                }}
              >
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="bg-gray-50 py-6 min-h-screen">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
            Checkout
          </h1>

          {/* High Traffic Notice - Only show when enabled by admin */}
          {highTrafficNotice?.enabled && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <MdInfo className="text-amber-600 text-xl shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm md:text-base">
                {highTrafficNotice.message || (
                  <>
                    <strong>High traffic</strong> — availability may vary. Your
                    order will be processed once confirmed.
                  </>
                )}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Address & Items */}
            <div className="lg:col-span-2 space-y-6">
              {/* Checkout Details */}
              <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg md:text-xl font-semibold text-gray-800">
                    {isGuestCheckout
                      ? "Guest Checkout Details"
                      : "Delivery Address"}
                  </h2>
                  {!isGuestCheckout && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleAddNewAddress}
                      sx={{
                        borderColor: "#059669",
                        color: "#059669",
                        textTransform: "none",
                        borderRadius: "8px",
                        "&:hover": {
                          borderColor: "#047857",
                          backgroundColor: "#ecfdf5",
                        },
                      }}
                    >
                      <FiPlus className="mr-1" /> Add Address
                    </Button>
                  )}
                </div>

                {isGuestCheckout && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextField
                      label="Full Name *"
                      name="fullName"
                      value={guestDetails.fullName}
                      onChange={handleGuestChange}
                      error={!!guestErrors.fullName}
                      helperText={guestErrors.fullName}
                      size="small"
                    />
                    <TextField
                      label="Phone *"
                      name="phone"
                      value={guestDetails.phone}
                      onChange={handleGuestChange}
                      error={!!guestErrors.phone}
                      helperText={guestErrors.phone}
                      size="small"
                    />
                    <TextField
                      label="Email *"
                      name="email"
                      value={guestDetails.email}
                      onChange={handleGuestChange}
                      error={!!guestErrors.email}
                      helperText={guestErrors.email}
                      size="small"
                    />

                    <div className="md:col-span-2 flex items-center gap-2 flex-wrap">
                      <UseCurrentLocationGoogleMaps
                        onResolved={(loc) => {
                          setGuestLocationPayload(loc);
                          setGuestDetails((prev) => ({
                            ...prev,
                            address:
                              loc.street || loc.formattedAddress || prev.address,
                            pincode: loc.pincode || prev.pincode,
                            state: normalizeStateValue(loc.state) || prev.state,
                          }));
                        }}
                        onError={(message) =>
                          setSnackbar({ open: true, message, severity: "error" })
                        }
                      />
                      {guestLocationPayload?.formattedAddress && (
                        <span className="text-xs text-gray-500">
                          Location selected
                        </span>
                      )}
                    </div>

                    <TextField
                      label="Address *"
                      name="address"
                      value={guestDetails.address}
                      onChange={handleGuestChange}
                      error={!!guestErrors.address}
                      helperText={guestErrors.address}
                      size="small"
                      multiline
                      rows={2}
                      className="md:col-span-2"
                    />
                    <TextField
                      label="Pincode *"
                      name="pincode"
                      value={guestDetails.pincode}
                      onChange={handleGuestChange}
                      error={!!guestErrors.pincode}
                      helperText={guestErrors.pincode}
                      size="small"
                    />
                    <FormControl size="small" error={!!guestErrors.state}>
                      <InputLabel>State *</InputLabel>
                      <Select
                        name="state"
                        value={guestDetails.state}
                        label="State *"
                        onChange={handleGuestChange}
                      >
                        {INDIAN_STATES.map((state) => (
                          <MenuItem key={state} value={state}>
                            {state}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </div>
                )}
                {!isGuestCheckout && (
                  <div className="mt-4">
                    {addressLoading ? (
                      <div className="flex justify-center py-8">
                        <CircularProgress size={32} sx={{ color: "#059669" }} />
                      </div>
                    ) : addresses.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                        <MdLocationOn
                          className="mx-auto text-gray-300 mb-2"
                          size={48}
                        />
                        <p className="text-gray-500 mb-3">
                          No delivery address found
                        </p>
                        <Button
                          onClick={handleAddNewAddress}
                          sx={{
                            backgroundColor: "#059669",
                            color: "white",
                            textTransform: "none",
                            borderRadius: "8px",
                            "&:hover": { backgroundColor: "#047857" },
                          }}
                        >
                          <FiPlus className="mr-1" /> Add Address
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {addresses.map((addr) => (
                          <label
                            key={addr._id}
                            className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all ${
                              selectedAddress === addr._id
                                ? "border-orange-500 bg-orange-50"
                                : "border-gray-200 hover:border-orange-300"
                            }`}
                          >
                            <Radio
                              checked={selectedAddress === addr._id}
                              onChange={() => setSelectedAddress(addr._id)}
                              sx={{
                                color: "#059669",
                                "&.Mui-checked": { color: "#059669" },
                              }}
                            />
                            <div className="ml-3 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                  {getAddressIcon(addr.addressType)}
                                  {addr.addressType || "Home"}
                                </span>
                                {addr.selected && (
                                  <span className="text-xs text-orange-600 font-medium">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="font-medium text-gray-800">
                                {addr.name}
                              </p>
                              <p className="text-gray-600 text-sm">
                                {addr.address_line1}
                                {addr.landmark && `, ${addr.landmark}`}
                              </p>
                              <p className="text-gray-600 text-sm">
                                {addr.city}, {addr.state} - {addr.pincode}
                              </p>
                              <p className="text-gray-600 text-sm">
                                +91 {addr.mobile}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleEditAddress(addr);
                              }}
                              className="text-orange-600 hover:text-orange-700 p-1"
                            >
                              <FiEdit2 size={16} />
                            </button>
                          </label>
                        ))}
                        <Link href="/address" className="block">
                          <p className="text-center text-sm text-orange-600 hover:underline mt-2">
                            Manage all addresses →
                          </p>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Order Items */}
              <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
                <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-4">
                  Order Items ({cartItems.length})
                </h2>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {cartItems.map((item, index) => {
                    const data = getItemData(item);
                    return (
                      <div
                        key={data.id || index}
                        className="pb-4 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={data.image}
                            alt={data.name}
                            className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-800 text-sm md:text-base truncate">
                              {data.name}
                            </h3>
                            {data.demandStatus === "HIGH" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 mt-1">
                                <HiOutlineFire className="w-3 h-3" />
                                High Demand
                              </span>
                            )}
                            <p className="text-gray-500 text-sm mt-1">
                              Qty: {data.quantity} × ₹{data.price}
                            </p>
                          </div>
                          <span className="font-semibold text-gray-800 text-sm md:text-base">
                            ₹{(data.price * data.quantity).toFixed(0)}
                          </span>
                        </div>
                        {data.demandStatus === "HIGH" && (
                          <div className="mt-2 ml-20 md:ml-24 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-700 flex items-center gap-1.5">
                              <HiOutlineFire className="w-3 h-3" />
                              High traffic — availability will be confirmed
                              after order processing.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Notes */}
              <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">
                  Order Notes{" "}
                  <span className="text-gray-400 font-normal">(Optional)</span>
                </h2>
                <textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Add special instructions for your order..."
                  className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none text-base"
                  rows="3"
                />
              </div>
            </div>

            {/* Right Column - Payment Summary */}
            <div className="space-y-6">
              {/* Coupon Section */}
              <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <FiTag className="text-orange-500" />
                  Apply Coupon
                </h3>

                {appliedCoupon ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-green-700 flex items-center gap-2">
                          <FiCheck /> {appliedCoupon.code}
                        </p>
                        <p className="text-green-600 text-sm">
                          You save ₹{appliedCoupon.discountAmount}
                        </p>
                      </div>
                      <button
                        onClick={handleRemoveCoupon}
                        className="text-red-500 hover:text-red-600 p-2"
                      >
                        <FiX size={20} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setCouponError("");
                        }}
                        placeholder="Enter code"
                        className="flex-1 p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-base uppercase"
                      />
                      <Button
                        onClick={handleApplyCoupon}
                        disabled={couponLoading}
                        sx={{
                          backgroundColor: "#059669",
                          color: "white",
                          padding: "12px 20px",
                          borderRadius: "12px",
                          fontWeight: 600,
                          textTransform: "none",
                          minWidth: "80px",
                          "&:hover": { backgroundColor: "#047857" },
                          "&:disabled": { backgroundColor: "#ccc" },
                        }}
                      >
                        {couponLoading ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : (
                          "Apply"
                        )}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="text-red-500 text-sm mt-2">{couponError}</p>
                    )}
                  </>
                )}
              </div>

              {/* GST Section */}
              <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
                <h3 className="font-semibold text-gray-800 mb-3">
                  GST (Optional)
                </h3>
                <TextField
                  label="GST Number"
                  value={gstNumber}
                  onChange={handleGstChange}
                  onBlur={handleGstBlur}
                  size="small"
                  fullWidth
                  placeholder="15-character GSTIN"
                  error={!!gstError}
                  helperText={
                    gstError ||
                    (authToken ? "Saved to your account for future orders" : "")
                  }
                />
                {gstSaving && (
                  <p className="text-xs text-gray-500 mt-2">
                    Saving GST number...
                  </p>
                )}
              </div>

              {/* Coins */}
              {!isGuestCheckout && (
                <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    Redeem Coins
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Balance: <strong>{coinBalance}</strong> coins
                  </p>
                  <div className="flex gap-2 items-center">
                    <TextField
                      label="Coins to redeem"
                      type="number"
                      size="small"
                      value={requestedCoins}
                      onChange={(e) =>
                        setRequestedCoins(
                          Math.max(0, Math.floor(Number(e.target.value || 0))),
                        )
                      }
                      inputProps={{ min: 0 }}
                      fullWidth
                    />
                    <Button
                      variant="outlined"
                      onClick={() =>
                        setRequestedCoins(
                          Math.min(
                            coinBalance,
                            Math.floor(
                              maxCoinRedeemValue /
                                Number(coinSettings.redeemRate || 1),
                            ),
                          ),
                        )
                      }
                    >
                      Max
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Max redeem value: ₹{maxCoinRedeemValue.toFixed(0)} (
                    {Number(coinSettings.maxRedeemPercentage || 0)}% cap)
                  </p>
                  {coinRedeemAmount > 0 && (
                    <p className="text-sm text-emerald-700 mt-1">
                      Applying {effectiveRedeemCoins} coins = ₹
                      {coinRedeemAmount.toFixed(0)}
                    </p>
                  )}
                </div>
              )}

              {/* Price Summary */}
              <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
                <h3 className="font-semibold text-gray-800 mb-4">
                  Order Summary
                </h3>
                <div className="space-y-3 text-base">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal (Excl. GST)</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  {membershipDiscount > 0 && (
                    <div className="flex justify-between text-green-700 font-medium">
                      <span>
                        Membership Discount ({membershipDiscountPercentage}%)
                      </span>
                      <span>-₹{membershipDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>
                      {checkoutStateForPreview.toLowerCase() === "rajasthan"
                        ? `GST (CGST ${round2(gstRatePercent / 2)}% + SGST ${round2(
                            gstRatePercent / 2,
                          )}%)`
                        : `GST (IGST ${round2(gstRatePercent)}%)`}
                    </span>
                    <span>₹{tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span className="flex items-center gap-2">
                      <MdLocalShipping />
                      Shipping
                      {shippingSettings?.freeShippingEnabled &&
                        subtotal < shippingSettings?.freeShippingThreshold && (
                          <span className="text-xs text-orange-500">
                            (Free over ₹
                            {shippingSettings?.freeShippingThreshold})
                          </span>
                        )}
                    </span>
                    <span
                      className={
                        shipping === 0 ? "text-green-600 font-medium" : ""
                      }
                    >
                      {shipping === 0
                        ? "FREE"
                        : `₹${Number(shipping || 0).toFixed(2)}`}
                    </span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span className="flex items-center gap-2">
                        <FiTag className="w-4 h-4" />
                        Coupon Discount ({appliedCoupon?.code})
                      </span>
                      <span>-₹{couponDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {/* Referral/Influencer Discount */}
                  {referralDiscount > 0 && (
                    <div className="flex justify-between text-purple-600 font-medium">
                      <span className="flex items-center gap-2">
                        <HiOutlineFire className="w-4 h-4" />
                        Referral Discount ({referralCode})
                      </span>
                      <span>-₹{referralDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {coinRedeemAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>
                        Coin Redemption ({effectiveRedeemCoins} coins)
                      </span>
                      <span>-₹{coinRedeemAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-3">
                    {/* Show original total crossed out when discount applied */}
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-gray-400 text-sm mb-1">
                        <span>Original Total (Incl. GST + Shipping)</span>
                        <span className="line-through">
                          ₹
                          {(subtotal + shipping + originalTaxEstimate).toFixed(
                            2,
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-800">
                      <span className="text-lg">
                        {totalDiscount > 0
                          ? "You Pay (Incl. GST + Shipping)"
                          : "Total (Incl. GST + Shipping)"}
                      </span>
                      <div className="text-right">
                        <span className="text-xl text-emerald-600">
                          ₹{total.toFixed(2)}
                        </span>
                        {totalDiscount > 0 && (
                          <p className="text-xs text-green-600 font-normal">
                            You save ₹{totalDiscount.toFixed(2)}!
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Referral Applied Badge */}
                {referralCode && (
                  <div className="mt-4 bg-purple-50 rounded-lg p-3 text-sm text-purple-700 flex items-center gap-2">
                    <HiOutlineFire className="w-4 h-4" />
                    <span>
                      Referral code <strong>{referralCode}</strong> applied!
                      {referralData?.discountType === "PERCENT"
                        ? ` (${referralData?.discountValue}% off)`
                        : ` (₹${referralData?.discountValue} off)`}
                    </span>
                  </div>
                )}

                {/* Legacy Affiliate Tracking Badge */}
                {affiliateData && !referralCode && (
                  <div className="mt-4 bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                    Referral: {affiliateData.code}
                  </div>
                )}
              </div>

              {/* Payment Button */}
              <Button
                onClick={handlePayNow}
                disabled={isPayButtonDisabled || cartItems.length === 0}
                fullWidth
                sx={{
                  backgroundColor: isPayButtonDisabled ? "#9ca3af" : "#059669",
                  color: "white",
                  padding: "16px 24px",
                  borderRadius: "12px",
                  fontWeight: 700,
                  fontSize: "18px",
                  textTransform: "none",
                  boxShadow: isPayButtonDisabled
                    ? "none"
                    : "0 4px 14px rgba(193, 89, 28, 0.4)",
                  "&:hover": {
                    backgroundColor: isPayButtonDisabled
                      ? "#9ca3af"
                      : "#047857",
                  },
                  "&:disabled": {
                    backgroundColor: "#9ca3af",
                    color: "#fff",
                  },
                }}
              >
                {isPayButtonDisabled
                  ? "Please Wait..."
                  : `Pay ₹${total.toFixed(0)}`}
              </Button>

              {/* Security Badge */}
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm text-gray-600 text-center">
                  🔒 Your payment information is secure and encrypted
                </p>
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

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%", borderRadius: "12px" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Add/Edit Address Dialog */}
      <Dialog
        open={isAddressDialogOpen}
        onClose={() => setIsAddressDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: "1px solid #e5e7eb" }}>
          {editingAddress ? "Edit Address" : "Add New Address"}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <div className="grid grid-cols-1 gap-4 mt-2">
            <TextField
              name="name"
              label="Full Name *"
              value={formData.name}
              onChange={handleFormChange}
              error={!!formErrors.name}
              helperText={formErrors.name}
              fullWidth
              size="small"
            />

            <TextField
              name="mobile"
              label="Mobile Number *"
              value={formData.mobile}
              onChange={handleFormChange}
              error={!!formErrors.mobile}
              helperText={formErrors.mobile}
              fullWidth
              size="small"
              placeholder="10-digit mobile number"
            />

            <div className="flex items-center gap-2 flex-wrap">
              <UseCurrentLocationGoogleMaps
                onResolved={(loc) => {
                  setLocationPayload(loc);
                  setFormData((prev) => ({
                    ...prev,
                    address_line1: loc.street || loc.formattedAddress || prev.address_line1,
                    city: loc.city || prev.city,
                    pincode: loc.pincode || prev.pincode,
                    state: normalizeStateValue(loc.state) || prev.state,
                  }));
                }}
                onError={(message) =>
                  setSnackbar({ open: true, message, severity: "error" })
                }
              />
              {locationPayload?.formattedAddress && (
                <span className="text-xs text-gray-500">
                  Location selected
                </span>
              )}
            </div>

            <TextField
              name="address_line1"
              label="Address (House No, Building, Street) *"
              value={formData.address_line1}
              onChange={handleFormChange}
              error={!!formErrors.address_line1}
              helperText={formErrors.address_line1}
              fullWidth
              size="small"
              multiline
              rows={2}
            />

            <TextField
              name="landmark"
              label="Landmark (Optional)"
              value={formData.landmark}
              onChange={handleFormChange}
              fullWidth
              size="small"
              placeholder="Near park, mall, etc."
            />

            <div className="grid grid-cols-2 gap-4">
              <TextField
                name="city"
                label="City *"
                value={formData.city}
                onChange={handleFormChange}
                error={!!formErrors.city}
                helperText={formErrors.city}
                fullWidth
                size="small"
              />

              <TextField
                name="pincode"
                label="Pincode *"
                value={formData.pincode}
                onChange={handleFormChange}
                error={!!formErrors.pincode}
                helperText={formErrors.pincode}
                fullWidth
                size="small"
                placeholder="6-digit pincode"
              />
            </div>

            <FormControl fullWidth size="small" error={!!formErrors.state}>
              <InputLabel>State *</InputLabel>
              <Select
                name="state"
                value={formData.state}
                onChange={handleFormChange}
                label="State *"
              >
                {INDIAN_STATES.map((state) => (
                  <MenuItem key={state} value={state}>
                    {state}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Address Type</InputLabel>
              <Select
                name="addressType"
                value={formData.addressType}
                onChange={handleFormChange}
                label="Address Type"
              >
                <MenuItem value="Home">
                  <span className="flex items-center gap-2">
                    <MdHome /> Home
                  </span>
                </MenuItem>
                <MenuItem value="Work">
                  <span className="flex items-center gap-2">
                    <MdWork /> Work
                  </span>
                </MenuItem>
                <MenuItem value="Other">
                  <span className="flex items-center gap-2">
                    <MdLocationOn /> Other
                  </span>
                </MenuItem>
              </Select>
            </FormControl>
          </div>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: "1px solid #e5e7eb" }}>
          <Button
            onClick={() => setIsAddressDialogOpen(false)}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveAddress}
            disabled={addressSaving}
            sx={{
              backgroundColor: "#059669",
              color: "white",
              textTransform: "none",
              "&:hover": { backgroundColor: "#047857" },
              "&:disabled": { backgroundColor: "#ccc" },
            }}
          >
            {addressSaving ? (
              <CircularProgress size={20} color="inherit" />
            ) : editingAddress ? (
              "Update"
            ) : (
              "Save"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Checkout;
