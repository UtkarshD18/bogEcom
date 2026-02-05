"use client";

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import cookies from "js-cookie";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

const API_URL = process.env.NEXT_PUBLIC_APP_API_URL || "http://localhost:8000";

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
        const response = await fetch(
          `${API_URL}/api/orders/user/order/${orderId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

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
      delivered: {
        color: "text-green-600",
        bg: "bg-green-50",
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
      statusMap[status] || {
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
        color: "text-green-600",
        bg: "bg-green-50",
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <CircularProgress sx={{ color: "#059669" }} />
          <p className="mt-4 text-gray-600">Loading order details...</p>
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
                  backgroundColor: "#059669",
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
            <p className="text-gray-600 mb-6">We couldn't find this order.</p>
            <Link href="/my-orders">
              <Button
                sx={{
                  backgroundColor: "#059669",
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
                      backgroundColor: "#059669",
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
                <span>
                  ₹
                  {(
                    order.totalAmt -
                    (order.tax || 0) -
                    (order.shipping || 0)
                  ).toFixed(2)}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>
                    Discount {order.couponCode && `(${order.couponCode})`}
                  </span>
                  <span>-₹{order.discount?.toFixed(2)}</span>
                </div>
              )}
              {order.discountAmount > 0 &&
                order.discountAmount !== order.discount && (
                  <div className="flex justify-between text-green-600">
                    <span>Coupon Discount</span>
                    <span>-₹{order.discountAmount?.toFixed(2)}</span>
                  </div>
                )}
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>₹{(order.tax || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span className="flex items-center gap-2">
                  <MdLocalShipping />
                  Shipping
                </span>
                <span
                  className={
                    order.shipping === 0 ? "text-green-600 font-medium" : ""
                  }
                >
                  {order.shipping === 0
                    ? "FREE"
                    : `₹${(order.shipping || 0).toFixed(2)}`}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-gray-800">
                <span className="text-lg">Total</span>
                <span className="text-xl text-orange-600">
                  ₹{(order.finalAmount || order.totalAmt || 0).toFixed(2)}
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
                  {order.delivery_address.name}
                </p>
                <p>{order.delivery_address.addressLine1}</p>
                {order.delivery_address.addressLine2 && (
                  <p>{order.delivery_address.addressLine2}</p>
                )}
                <p>
                  {order.delivery_address.city}, {order.delivery_address.state}{" "}
                  - {order.delivery_address.pinCode}
                </p>
                <p className="mt-2">Phone: {order.delivery_address.mobile}</p>
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
            <Link href="/my-orders">
              <Button
                variant="outlined"
                sx={{
                  borderColor: "#059669",
                  color: "#059669",
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
                  backgroundColor: "#059669",
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
              backgroundColor: "#059669",
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
    </>
  );
};

export default OrderDetailsPage;
