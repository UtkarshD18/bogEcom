"use client";

import { useShippingDisplayCharge } from "@/hooks/useShippingDisplayCharge";
import {
  buildSavedOrderCalculationInput,
  calculateOrderTotals,
} from "@/utils/calculateOrderTotals.mjs";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Rating,
  TextField,
} from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import cookies from "js-cookie";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { FiCreditCard, FiPackage } from "react-icons/fi";
import {
  MdAccessTime,
  MdArrowBack,
  MdCancel,
  MdCheckCircle,
  MdInfo,
  MdLocalShipping,
  MdPayment,
  MdReceipt,
  MdWarning,
} from "react-icons/md";
import { io } from "socket.io-client";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_APP_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");
const API_URL = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL
  : `${API_BASE_URL}/api`;

const STATUS_STEPS = [
  { key: "pending", label: "Pending", icon: MdAccessTime },
  { key: "pending_payment", label: "Payment Pending", icon: MdAccessTime },
  { key: "accepted", label: "Accepted", icon: MdCheckCircle },
  { key: "in_warehouse", label: "In Warehouse", icon: MdLocalShipping },
  { key: "shipped", label: "Shipped", icon: MdLocalShipping },
  { key: "out_for_delivery", label: "Out for Delivery", icon: MdLocalShipping },
  { key: "delivered", label: "Delivered", icon: MdCheckCircle },
];

const normalizeStatus = (status) => {
  if (!status) return "pending";
  const value = String(status).trim().toLowerCase().replace(/\s+/g, "_");
  if (value === "confirmed") return "accepted";
  return value;
};

const getStepIndex = (status) => {
  const normalized = normalizeStatus(status);
  const index = STATUS_STEPS.findIndex((step) => step.key === normalized);
  return index === -1 ? 0 : index;
};

/**
 * Order Details Page
 *
 * Route: /orders/:orderId
 * Access: Logged-in users only (users can only view their own orders)
 *
 * Displays:
 * - Order ID, date
 * - Items with quantity and price
 * - Subtotal, discount, tax, shipping, total
 * - Order status
 * - Payment status
 * - Pending payment messaging (if applicable)
 * - Retry payment button (stub - disabled until PhonePe)
 */
const OrderDetailsPage = () => {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.orderId;

  // State
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [reviewDialog, setReviewDialog] = useState({
    open: false,
    productId: "",
    productTitle: "",
  });
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    comment: "",
  });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [orderReviews, setOrderReviews] = useState({});
  const [downloading, setDownloading] = useState({
    invoice: false,
  });
  const deliveryState =
    order?.delivery_address?.state ||
    order?.billingDetails?.state ||
    order?.guestDetails?.state ||
    "";
  const hasDeliveryState = Boolean(String(deliveryState).trim());
  const isRajasthanDelivery =
    String(deliveryState).trim().toLowerCase() === "rajasthan";
  const { displayShippingCharge } = useShippingDisplayCharge({
    isRajasthan: isRajasthanDelivery,
  });

  // Fetch order details
  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        setError("No order ID provided");
        setLoading(false);
        return;
      }

      const token = cookies.get("accessToken");
      if (!token) {
        router.push("/login?redirect=/orders/" + orderId);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });

        const data = await response.json();

        if (response.status === 401) {
          router.push("/login?redirect=/orders/" + orderId);
          return;
        }

        if (response.status === 403) {
          setError("You are not authorized to view this order");
          setLoading(false);
          return;
        }

        if (data.success) {
          setOrder(data.data);
        } else {
          setError(data.message || "Failed to fetch order");
        }
      } catch (err) {
        console.error("Error fetching order:", err);
        setError("Failed to load order details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, router]);

  useEffect(() => {
    if (!orderId) return;
    const token = cookies.get("accessToken");
    if (!token) return;

    const socket = io(API_URL, {
      withCredentials: true,
      transports: ["websocket"],
    });

    socket.on("order:update", (payload) => {
      if (!payload || payload.orderId !== orderId) return;
      setOrder((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          order_status: payload.status || prev.order_status,
          payment_status: payload.paymentStatus || prev.payment_status,
          statusTimeline: payload.statusTimeline || prev.statusTimeline,
          awb_number: payload.shipment?.awb || prev.awb_number,
          shipment_status: payload.shipment?.status || prev.shipment_status,
          shipping_provider:
            payload.shipment?.provider || prev.shipping_provider,
          shipping_label: payload.shipment?.label || prev.shipping_label,
          shipping_manifest:
            payload.shipment?.manifest || prev.shipping_manifest,
        };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [orderId]);

  useEffect(() => {
    const fetchMyOrderReviews = async () => {
      if (!orderId) return;
      const token = cookies.get("accessToken");
      if (!token) return;

      try {
        const response = await fetch(
          `${API_URL}/reviews/my?orderId=${orderId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            credentials: "include",
          },
        );

        const data = await response.json();
        if (!response.ok || !data?.success) {
          setOrderReviews({});
          return;
        }

        const reviewMap = {};
        (data?.data || []).forEach((review) => {
          if (review?.productId) {
            reviewMap[String(review.productId)] = review;
          }
        });
        setOrderReviews(reviewMap);
      } catch (reviewFetchError) {
        console.error("fetchMyOrderReviews error:", reviewFetchError);
        setOrderReviews({});
      }
    };

    fetchMyOrderReviews();
  }, [orderId]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status color and icon
  const getOrderStatusInfo = (status) => {
    const normalizedStatus = normalizeStatus(status);
    const statusMap = {
      pending_payment: {
        color: "text-amber-600",
        bg: "bg-amber-50",
        icon: MdAccessTime,
        label: "Pending Payment",
      },
      pending: {
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        icon: MdAccessTime,
        label: "Pending",
      },
      accepted: {
        color: "text-blue-600",
        bg: "bg-blue-50",
        icon: MdCheckCircle,
        label: "Accepted",
      },
      in_warehouse: {
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        icon: MdLocalShipping,
        label: "In Warehouse",
      },
      confirmed: {
        color: "text-blue-600",
        bg: "bg-blue-50",
        icon: MdCheckCircle,
        label: "Confirmed",
      },
      shipped: {
        color: "text-purple-600",
        bg: "bg-purple-50",
        icon: MdLocalShipping,
        label: "Shipped",
      },
      out_for_delivery: {
        color: "text-teal-600",
        bg: "bg-teal-50",
        icon: MdLocalShipping,
        label: "Out for Delivery",
      },
      delivered: {
        color: "text-primary",
        bg: "bg-[var(--flavor-glass)] text-primary",
        icon: MdCheckCircle,
        label: "Delivered",
      },
      cancelled: {
        color: "text-red-600",
        bg: "bg-red-50",
        icon: MdCancel,
        label: "Cancelled",
      },
    };
    return (
      statusMap[normalizedStatus] || {
        color: "text-gray-600",
        bg: "bg-gray-50",
        icon: MdInfo,
        label: status,
      }
    );
  };

  const getPaymentStatusInfo = (status) => {
    const statusMap = {
      unavailable: {
        color: "text-amber-600",
        bg: "bg-amber-50",
        icon: MdWarning,
        label: "Unavailable",
      },
      pending: {
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        icon: MdAccessTime,
        label: "Pending",
      },
      paid: {
        color: "text-primary",
        bg: "bg-[var(--flavor-glass)] text-primary",
        icon: MdCheckCircle,
        label: "Paid",
      },
      failed: {
        color: "text-red-600",
        bg: "bg-red-50",
        icon: MdCancel,
        label: "Failed",
      },
    };
    return (
      statusMap[status] || {
        color: "text-gray-600",
        bg: "bg-gray-50",
        icon: MdInfo,
        label: status,
      }
    );
  };

  // Check if order is in pending payment state
  const isPendingPayment =
    order?.order_status === "pending_payment" &&
    order?.payment_status === "unavailable";

  // Handle retry payment click (stub - shows modal only)
  const handleRetryPayment = () => {
    setShowPaymentModal(true);
  };

  const downloadFile = async (url, filename, key) => {
    try {
      setDownloading((prev) => ({ ...prev, [key]: true }));
      const token = cookies.get("accessToken");
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError.message || "Failed to download file");
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleDownloadInvoice = () => {
    downloadFile(
      `${API_URL}/orders/${order._id}/invoice`,
      `invoice-${order._id}.pdf`,
      "invoice",
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="container mx-auto max-w-4xl space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
            <div className="h-6 w-40 bg-gray-200 rounded mb-3"></div>
            <div className="h-4 w-64 bg-gray-100 rounded"></div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
            <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
            <div className="h-2 w-full bg-gray-100 rounded mb-6"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {Array.from({ length: 7 }).map((_, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gray-100"></div>
                  <div className="h-3 w-16 bg-gray-100 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <MdCancel className="text-6xl text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800 mb-3">
              {error.includes("authorized")
                ? "Access Denied"
                : "Error Loading Order"}
            </h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link href="/my-orders">
              <Button
                sx={{
                  backgroundColor: "var(--primary)",
                  color: "white",
                  padding: "12px 24px",
                  borderRadius: "12px",
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": { backgroundColor: "#a04a17" },
                }}
              >
                <MdArrowBack className="mr-2" />
                Back to My Orders
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // No order found
  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <FiPackage className="text-6xl text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800 mb-3">
              Order Not Found
            </h1>
            <p className="text-gray-600 mb-6">We could not find this order.</p>
            <Link href="/my-orders">
              <Button
                sx={{
                  backgroundColor: "var(--primary)",
                  color: "white",
                  padding: "12px 24px",
                  borderRadius: "12px",
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": { backgroundColor: "#a04a17" },
                }}
              >
                View All Orders
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const orderStatus = getOrderStatusInfo(order.order_status);
  const paymentStatus = getPaymentStatusInfo(order.payment_status);
  const OrderStatusIcon = orderStatus.icon;
  const PaymentStatusIcon = paymentStatus.icon;
  const currentStepIndex = getStepIndex(order.order_status);
  const progressPercent =
    STATUS_STEPS.length > 1
      ? Math.min(100, (currentStepIndex / (STATUS_STEPS.length - 1)) * 100)
      : 0;
  const timeline = Array.isArray(order?.statusTimeline)
    ? [...order.statusTimeline].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      )
    : [];
  const orderTotals = calculateOrderTotals(
    buildSavedOrderCalculationInput(order, { payableShipping: 0 }),
  );
  const canDownloadInvoice =
    order?.order_status !== "cancelled" &&
    (order?.payment_status === "paid" ||
      normalizeStatus(order?.order_status) === "accepted");
  const isReviewEligibleOrder = (() => {
    const normalizedOrderStatus = normalizeStatus(order?.order_status);
    if (
      normalizedOrderStatus === "delivered" ||
      normalizedOrderStatus === "completed"
    ) {
      return true;
    }

    return Array.isArray(order?.statusTimeline)
      ? order.statusTimeline.some((entry) => {
          const normalizedTimelineStatus = normalizeStatus(entry?.status);
          return (
            normalizedTimelineStatus === "delivered" ||
            normalizedTimelineStatus === "completed"
          );
        })
      : false;
  })();

  const getItemProductId = (item) => {
    const productId = item?.productId?._id || item?.productId;
    return productId ? String(productId) : "";
  };

  const getReviewByProductId = (productId) =>
    orderReviews[String(productId)] || null;

  const openReviewDialog = (product) => {
    const productId = getItemProductId(product);
    if (!productId || !isReviewEligibleOrder) return;

    if (getReviewByProductId(productId)) {
      toast.error("You already reviewed this product");
      return;
    }

    setReviewDialog({
      open: true,
      productId: String(productId),
      productTitle: product?.productTitle || "Product",
    });
    setReviewForm({ rating: 5, comment: "" });
  };

  const closeReviewDialog = (force = false) => {
    if (reviewSubmitting && !force) return;
    setReviewDialog({ open: false, productId: "", productTitle: "" });
  };

  const postReviewRequest = async (token, payload) => {
    const urls = Array.from(
      new Set([
        `${API_URL}/reviews`,
        `${API_BASE_URL}/api/reviews`,
        `${API_BASE_URL}/reviews`,
      ]),
    );

    let lastAttempt = {
      response: null,
      data: null,
    };

    for (const url of urls) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = { message: "Unexpected review API response" };
      }

      lastAttempt = { response, data };

      if (response.ok || response.status !== 404) {
        return lastAttempt;
      }
    }

    return lastAttempt;
  };

  const submitReview = async () => {
    const comment = reviewForm.comment.trim();
    if (!comment) {
      toast.error("Please enter review comment");
      return;
    }

    const rating = Number(reviewForm.rating);
    if (!rating || rating < 1 || rating > 5) {
      toast.error("Please choose rating between 1 and 5");
      return;
    }

    const token = cookies.get("accessToken");
    if (!token) {
      toast.error("Please login again");
      return;
    }

    setReviewSubmitting(true);
    try {
      const { response, data } = await postReviewRequest(token, {
        productId: reviewDialog.productId,
        orderId,
        rating,
        comment,
      });
      if (!response.ok || !data?.success) {
        if (
          response.status === 404 &&
          /reviews/i.test(String(data?.message || ""))
        ) {
          toast.error(
            "Reviews API not available. Please restart backend server.",
          );
          return;
        }
        toast.error(data?.message || "Failed to submit review");
        return;
      }

      const review = data?.data || null;
      if (review) {
        setOrderReviews((prev) => ({
          ...prev,
          [String(review.productId || reviewDialog.productId)]: review,
        }));
      }

      toast.success("Review submitted successfully");
      closeReviewDialog(true);
    } catch (reviewError) {
      console.error("submitReview error:", reviewError);
      toast.error("Failed to submit review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <>
      <section className="bg-gray-50 py-6 min-h-screen">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back Button */}
          <Link
            href="/my-orders"
            className="inline-flex items-center text-gray-600 hover:text-orange-600 mb-6 transition-colors"
          >
            <MdArrowBack className="mr-2" />
            Back to My Orders
          </Link>

          {/* Order Header */}
          <div className="bg-white rounded-xl shadow-sm p-5 md:p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <MdReceipt className="text-orange-500" />
                  Order Details
                </h1>
                <p className="text-gray-500 mt-1">
                  Order ID:{" "}
                  <span className="font-mono font-medium">
                    #{order._id?.slice(-8).toUpperCase()}
                  </span>
                </p>
                <p className="text-gray-500 text-sm">
                  Placed on {formatDate(order.createdAt)}
                </p>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-3">
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-full ${orderStatus.bg}`}
                >
                  <OrderStatusIcon className={`${orderStatus.color}`} />
                  <span
                    className={`font-semibold text-sm ${orderStatus.color}`}
                  >
                    {orderStatus.label}
                  </span>
                </div>
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-full ${paymentStatus.bg}`}
                >
                  <PaymentStatusIcon className={`${paymentStatus.color}`} />
                  <span
                    className={`font-semibold text-sm ${paymentStatus.color}`}
                  >
                    Payment: {paymentStatus.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Tracker */}
          <div className="bg-white rounded-xl shadow-sm p-5 md:p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800">
              Order Tracking
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Live updates appear automatically as your order moves.
            </p>

            <div className="relative mt-6">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-2 bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                />
              </div>
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {STATUS_STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const isComplete = index < currentStepIndex;
                  const isActive = index === currentStepIndex;
                  return (
                    <motion.div
                      key={step.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.03 }}
                      className="flex flex-col items-center text-center gap-2"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isActive
                            ? "bg-emerald-600 text-white"
                            : isComplete
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        <StepIcon />
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          isActive
                            ? "text-emerald-700"
                            : isComplete
                              ? "text-emerald-600"
                              : "text-gray-400"
                        }`}
                      >
                        {step.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              {timeline.length > 0 && (
                <div className="mt-6 border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Status Timeline
                  </h3>
                  <AnimatePresence>
                    {timeline.map((entry, idx) => (
                      <motion.div
                        key={`${entry.status}-${entry.timestamp}-${idx}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center justify-between text-sm text-gray-600 py-1"
                      >
                        <span className="font-medium text-gray-700">
                          {STATUS_STEPS.find(
                            (s) => s.key === normalizeStatus(entry.status),
                          )?.label || entry.status}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(entry.timestamp)}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Pending Payment Notice */}
          {isPendingPayment && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
              <div className="flex items-start gap-4">
                <div className="bg-amber-100 p-3 rounded-full">
                  <MdWarning className="text-amber-600 text-2xl" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-amber-800 text-lg mb-2">
                    Payment Pending
                  </h3>
                  <p className="text-amber-700 mb-4">
                    Payments are temporarily unavailable as we onboard{" "}
                    <strong>PhonePe</strong> as our payment partner. Your order
                    is saved and will be payable once payments go live.
                  </p>
                  <Button
                    onClick={handleRetryPayment}
                    variant="contained"
                    sx={{
                      backgroundColor: "var(--primary)",
                      color: "white",
                      padding: "10px 24px",
                      borderRadius: "10px",
                      fontWeight: 600,
                      textTransform: "none",
                      "&:hover": { backgroundColor: "#a04a17" },
                    }}
                  >
                    <FiCreditCard className="mr-2" />
                    Retry Payment
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="bg-white rounded-xl shadow-sm p-5 md:p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FiPackage className="text-orange-500" />
              Items ({order.products?.length || 0})
            </h2>
            <div className="space-y-4">
              {order.products?.map((item, index) => (
                <div
                  key={item.productId || index}
                  className="flex items-center gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
                >
                  <img
                    src={item.image || "/placeholder.png"}
                    alt={item.productTitle}
                    className="w-20 h-20 object-cover rounded-lg bg-gray-100"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 truncate">
                      {item.productTitle}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      Qty: {item.quantity} × ₹{item.price?.toFixed(2)}
                    </p>
                    {(() => {
                      const productId = getItemProductId(item);
                      const existingReview = productId
                        ? getReviewByProductId(productId)
                        : null;

                      if (existingReview) {
                        return (
                          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                            <p className="text-xs font-semibold text-emerald-700">
                              Your Review •{" "}
                              {Number(existingReview.rating || 0).toFixed(1)}★
                            </p>
                            <p className="text-xs text-emerald-800 mt-1 break-words">
                              {existingReview.comment}
                            </p>
                          </div>
                        );
                      }

                      if (!isReviewEligibleOrder || !productId) return null;

                      return (
                        <Button
                          onClick={() => openReviewDialog(item)}
                          size="small"
                          variant="outlined"
                          sx={{
                            mt: 1.5,
                            borderColor: "#ea580c",
                            color: "#ea580c",
                            textTransform: "none",
                            fontWeight: 600,
                            borderRadius: "999px",
                            "&:hover": {
                              borderColor: "#c2410c",
                              backgroundColor: "#fff7ed",
                            },
                          }}
                        >
                          Write Review
                        </Button>
                      );
                    })()}
                  </div>
                  <span className="font-semibold text-gray-800">
                    ₹
                    {item.subTotal?.toFixed(2) ||
                      (item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-xl shadow-sm p-5 md:p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <MdPayment className="text-orange-500" />
              Order Summary
            </h2>
            <div className="space-y-3 text-base">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>₹{orderTotals.subtotal.toFixed(2)}</span>
              </div>
              {orderTotals.totalDiscount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>
                    Discount {order.couponCode && `(${order.couponCode})`}
                  </span>
                  <span>-₹{orderTotals.totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {orderTotals.coinRedemptionAmount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>
                    Coin Redemption (
                    {Number(order?.coinRedemption?.coinsUsed || 0)} coins)
                  </span>
                  <span>-₹{orderTotals.coinRedemptionAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>₹{orderTotals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span className="flex items-center gap-2">
                  <MdLocalShipping />
                  Shipping
                </span>
                {hasDeliveryState ? (
                  <span className="text-primary font-medium flex items-center gap-2">
                    {displayShippingCharge > 0 && (
                      <span className="line-through text-gray-500 font-normal">
                        ₹{displayShippingCharge.toFixed(2)}
                      </span>
                    )}
                    <span>FREE</span>
                  </span>
                ) : (
                  <span className="text-gray-500">--</span>
                )}
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-gray-800">
                <span className="text-lg">Total</span>
                <span className="text-xl text-orange-600">
                  ₹{orderTotals.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          {order.delivery_address && (
            <div className="bg-white rounded-xl shadow-sm p-5 md:p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <MdLocalShipping className="text-orange-500" />
                Delivery Address
              </h2>
              <div className="text-gray-600">
                <p className="font-medium text-gray-800">
                  {order.delivery_address.name ||
                    order.billingDetails?.fullName}
                </p>
                <p>
                  {order.delivery_address.address_line1 ||
                    order.delivery_address.addressLine1 ||
                    order.billingDetails?.address}
                </p>
                {(order.delivery_address.address_line2 ||
                  order.delivery_address.addressLine2) && (
                  <p>
                    {order.delivery_address.address_line2 ||
                      order.delivery_address.addressLine2}
                  </p>
                )}
                <p>
                  {order.delivery_address.city
                    ? `${order.delivery_address.city}, `
                    : ""}
                  {order.delivery_address.state || order.billingDetails?.state}{" "}
                  -{" "}
                  {order.delivery_address.pincode ||
                    order.delivery_address.pinCode ||
                    order.billingDetails?.pincode}
                </p>
                <p className="mt-2">
                  Phone:{" "}
                  {order.delivery_address.mobile ||
                    order.delivery_address.phone ||
                    order.billingDetails?.phone}
                </p>
              </div>
            </div>
          )}
          {!order.delivery_address && order?.billingDetails && (
            <div className="bg-white rounded-xl shadow-sm p-5 md:p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <MdLocalShipping className="text-orange-500" />
                Billing / Guest Details
              </h2>
              <div className="text-gray-600">
                <p className="font-medium text-gray-800">
                  {order.billingDetails.fullName ||
                    order.guestDetails?.fullName ||
                    "Guest"}
                </p>
                <p>
                  {order.billingDetails.address ||
                    order.guestDetails?.address ||
                    "-"}
                </p>
                <p>
                  {order.billingDetails.state ||
                    order.guestDetails?.state ||
                    "-"}{" "}
                  -{" "}
                  {order.billingDetails.pincode ||
                    order.guestDetails?.pincode ||
                    "-"}
                </p>
                <p className="mt-2">
                  Phone:{" "}
                  {order.billingDetails.phone ||
                    order.guestDetails?.phone ||
                    "-"}
                </p>
                <p>
                  Email:{" "}
                  {order.billingDetails.email ||
                    order.guestDetails?.email ||
                    "-"}
                </p>
              </div>
            </div>
          )}

          {/* Order Notes */}
          {order.notes && (
            <div className="bg-white rounded-xl shadow-sm p-5 md:p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                Order Notes
              </h2>
              <p className="text-gray-600">{order.notes}</p>
            </div>
          )}

          {/* Affiliate Tracking (if present) */}
          {order.affiliateCode && (
            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <p className="text-blue-700 text-sm">
                Referral Code:{" "}
                <span className="font-medium">{order.affiliateCode}</span>
                {order.affiliateSource && ` (${order.affiliateSource})`}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-4 justify-center">
            {canDownloadInvoice && (
              <Button
                onClick={handleDownloadInvoice}
                disabled={downloading.invoice}
                variant="contained"
                sx={{
                  backgroundColor: "#0f766e",
                  color: "white",
                  padding: "12px 24px",
                  borderRadius: "12px",
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": { backgroundColor: "#115e59" },
                }}
              >
                {downloading.invoice ? "Downloading..." : "Download Invoice"}
              </Button>
            )}
            <Link href="/my-orders">
              <Button
                variant="outlined"
                sx={{
                  borderColor: "var(--primary)",
                  color: "var(--primary)",
                  padding: "12px 24px",
                  borderRadius: "12px",
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": {
                    borderColor: "#a04a17",
                    backgroundColor: "#ecfdf5",
                  },
                }}
              >
                <MdArrowBack className="mr-2" />
                All Orders
              </Button>
            </Link>
            <Link href="/products">
              <Button
                sx={{
                  backgroundColor: "var(--primary)",
                  color: "white",
                  padding: "12px 24px",
                  borderRadius: "12px",
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": { backgroundColor: "#a04a17" },
                }}
              >
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Payment Unavailable Modal */}
      <Dialog
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        PaperProps={{
          sx: {
            borderRadius: "16px",
            maxWidth: "400px",
            width: "100%",
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", pt: 3 }}>
          <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
            <MdWarning className="text-orange-500 text-3xl" />
          </div>
          <span className="font-bold text-gray-800">Payment Unavailable</span>
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center", px: 4 }}>
          <p className="text-gray-600 mb-2">
            Payments are temporarily unavailable.
          </p>
          <p className="text-gray-600">
            We are currently onboarding <strong>PhonePe</strong> as our payment
            partner. You will be notified once payments are enabled.
          </p>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 3, px: 3 }}>
          <Button
            onClick={() => setShowPaymentModal(false)}
            fullWidth
            sx={{
              backgroundColor: "var(--primary)",
              color: "white",
              padding: "12px",
              borderRadius: "10px",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": { backgroundColor: "#a04a17" },
            }}
          >
            Got It
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={reviewDialog.open}
        onClose={() => closeReviewDialog()}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Write Review</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2.5, pt: "6px !important" }}>
          <p className="text-sm text-gray-600">
            Product:{" "}
            <span className="font-semibold text-gray-900">
              {reviewDialog.productTitle}
            </span>
          </p>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Your Rating
            </p>
            <Rating
              value={reviewForm.rating}
              onChange={(_, value) =>
                setReviewForm((prev) => ({ ...prev, rating: value || 1 }))
              }
            />
          </div>

          <TextField
            label="Review Comment"
            multiline
            minRows={4}
            value={reviewForm.comment}
            onChange={(event) =>
              setReviewForm((prev) => ({
                ...prev,
                comment: event.target.value,
              }))
            }
            fullWidth
            required
            placeholder="Share your product experience"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => closeReviewDialog()}
            disabled={reviewSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={submitReview}
            variant="contained"
            disabled={reviewSubmitting}
            sx={{
              backgroundColor: "#ea580c",
              textTransform: "none",
              fontWeight: 600,
              "&:hover": { backgroundColor: "#c2410c" },
            }}
          >
            {reviewSubmitting ? "Submitting..." : "Submit Review"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default OrderDetailsPage;
