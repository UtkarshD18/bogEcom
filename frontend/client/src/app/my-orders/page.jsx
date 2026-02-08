"use client";
import { MyContext } from "@/context/ThemeProvider";
import { AlertCircle, ArrowLeft, Loader } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");
const API_URL = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL
  : `${API_BASE_URL}/api`;

const getCookieToken = () => {
  if (typeof document === "undefined") return null;
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("accessToken="))
    ?.split("=")[1];
};

const getAuthToken = () =>
  getCookieToken() ||
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken");

const Orders = () => {
  const router = useRouter();
  const context = useContext(MyContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if user is logged in
        let token = getAuthToken();

        if (!token) {
          setError("Please log in to view your orders");
          setTimeout(() => router.push("/login?redirect=/my-orders"), 2000);
          return;
        }

        // Fetch orders from API
        let response = await fetch(`${API_URL}/orders/user/my-orders`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });

        if (response.status === 401) {
          // Attempt refresh token flow (cookie-based) before failing
          try {
            const refresh = await fetch(`${API_URL}/user/refresh-token`, {
              method: "POST",
              credentials: "include",
            });
            if (refresh.ok) {
              const refreshData = await refresh.json();
              const newToken = refreshData?.data?.accessToken || null;
              if (newToken) {
                localStorage.setItem("accessToken", newToken);
                token = newToken;
                response = await fetch(`${API_URL}/orders/user/my-orders`, {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  credentials: "include",
                });
              }
            }
          } catch (refreshError) {
            console.error("Refresh token failed:", refreshError);
          }
        }

        if (!response.ok) {
          if (response.status === 401) {
            setError("Session expired. Please log in again.");
            setTimeout(() => router.push("/login?redirect=/my-orders"), 2000);
            return;
          }
          throw new Error(`Failed to fetch orders: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && Array.isArray(data.data)) {
          setOrders(data.data);
        } else {
          setOrders([]);
        }
      } catch (err) {
        console.error("Error fetching orders:", err);
        setError(err.message || "Failed to load orders. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [router]);

  // Helper function to get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-800";
      case "shipped":
        return "bg-blue-100 text-blue-800";
      case "confirmed":
        return "bg-yellow-100 text-yellow-800";
      case "pending":
        return "bg-gray-100 text-gray-800";
      case "pending_payment":
        return "bg-orange-100 text-orange-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "unavailable":
        return "bg-orange-100 text-orange-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Format status for display
  const formatStatus = (status) => {
    if (!status) return "Unknown";
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center text-orange-600 hover:text-orange-700 mb-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
                <p className="text-gray-600 mt-2">
                  Track and manage your purchases
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-3xl font-bold text-orange-600">
                  {orders.length}
                </p>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-12">
              <div className="flex justify-center mb-4">
                <Loader className="w-8 h-8 text-orange-600 animate-spin" />
              </div>
              <p className="text-gray-500">Loading your orders...</p>
            </div>
          ) : error && orders.length === 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <div className="flex justify-center mb-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
              <p className="text-red-800 font-medium mb-2">{error}</p>
              <p className="text-red-600 text-sm mb-4">
                {error.includes("Please log in") && "Redirecting to login..."}
              </p>
              <Link
                href="/login"
                className="inline-block bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
              >
                Login
              </Link>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500 mb-4">No orders found</p>
              <Link
                href="/products"
                className="inline-block bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700"
              >
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <div
                  key={order._id}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Order Header */}
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Order ID</p>
                        <p className="text-lg font-semibold text-gray-900">
                          #{order._id?.substring(0, 8) || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Date</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {new Date(order.createdAt).toLocaleDateString(
                            "en-IN",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Order Status</p>
                        <span
                          className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.order_status)}`}
                        >
                          {formatStatus(order.order_status) || "Pending"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Payment Status</p>
                        <span
                          className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${getPaymentStatusColor(order.payment_status)}`}
                        >
                          {formatStatus(order.payment_status) || "Pending"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total</p>
                        <p className="text-lg font-semibold text-orange-600">
                          ₹
                          {Number(order.totalAmt || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="px-6 py-4">
                    <p className="text-sm font-semibold text-gray-900 mb-3">
                      Items ({order.products?.length || 0})
                    </p>
                    <div className="space-y-2">
                      {order.products?.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-sm py-2 border-b border-gray-100 last:border-0"
                        >
                          <div>
                            <p className="text-gray-900 font-medium">
                              {item.productTitle || "Product"}
                            </p>
                            <p className="text-gray-600 text-xs">
                              Qty: {item.quantity} × ₹
                              {Number(item.price || 0).toLocaleString("en-IN")}
                            </p>
                          </div>
                          <p className="text-gray-900 font-medium">
                            ₹
                            {Number(
                              item.price * item.quantity || 0,
                            ).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delivery Address */}
                  {order.delivery_address && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                      <p className="text-sm font-semibold text-gray-900 mb-2">
                        Delivery Address
                      </p>
                      <div className="text-sm text-gray-700">
                        <p className="font-medium">
                          {order.delivery_address?.name || "N/A"}
                        </p>
                        <p>
                          {order.delivery_address?.address_line1 ||
                            order.delivery_address?.address_line ||
                            order.delivery_address?.address ||
                            ""}
                        </p>
                        <p>
                          {order.delivery_address?.city || ""},{" "}
                          {order.delivery_address?.state || ""} -{" "}
                          {order.delivery_address?.pincode || ""}
                        </p>
                        <p className="text-xs">
                          Phone:{" "}
                          {order.delivery_address?.mobile ||
                            order.delivery_address?.phone ||
                            "N/A"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Order Summary */}
                  <div className="px-6 py-4 bg-white border-t border-gray-200">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="text-gray-900">
                          ₹
                          {Number(order.totalAmt || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Discount:</span>
                        <span className="text-green-600">
                          -₹
                          {Number(order.discount || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax:</span>
                        <span className="text-gray-900">
                          ₹
                          {Number(order.tax || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipping:</span>
                        <span className="text-gray-900">
                          ₹
                          {Number(order.shipping || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
                        <span>Total:</span>
                        <span className="text-orange-600">
                          ₹
                          {Number(order.totalAmt || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Details */}
                  {(order.phonepeMerchantTransactionId ||
                    order.phonepeTransactionId ||
                    order.paymentId) && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                      <p className="text-sm font-semibold text-gray-900 mb-2">
                        Payment Details
                      </p>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>
                          PhonePe Transaction ID:{" "}
                          <span className="font-mono">
                            {order.phonepeTransactionId ||
                              order.paymentId ||
                              "N/A"}
                          </span>
                        </p>
                        <p>
                          PhonePe Merchant Txn ID:{" "}
                          <span className="font-mono">
                            {order.phonepeMerchantTransactionId || "N/A"}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* View Order Details Link */}
                  <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end">
                    <Link
                      href={`/orders/${order._id}`}
                      className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      View Order Details
                      <svg
                        className="ml-2 w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
export default Orders;
