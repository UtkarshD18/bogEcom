"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch orders from localStorage
    try {
      const savedOrders = JSON.parse(localStorage.getItem("orders") || "[]");
      setOrders(
        savedOrders.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        ),
      );
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  }, []);

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

          {/* Orders List */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500 mb-4">No orders found</p>
              <Link
                href="/"
                className="inline-block bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700"
              >
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden"
                >
                  {/* Order Header */}
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Order ID</p>
                        <p className="text-lg font-semibold text-gray-900">
                          #{order.id}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Date</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <span className="inline-block mt-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          {order.paymentStatus || "Completed"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total</p>
                        <p className="text-lg font-semibold text-orange-600">
                          ₹{order.total?.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="px-6 py-4">
                    <p className="text-sm font-semibold text-gray-900 mb-3">
                      Items
                    </p>
                    <div className="space-y-2">
                      {order.items?.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-sm py-2 border-b border-gray-100 last:border-0"
                        >
                          <div>
                            <p className="text-gray-900 font-medium">
                              {item.name}
                            </p>
                            <p className="text-gray-600">
                              Qty: {item.quantity}
                            </p>
                          </div>
                          <p className="text-gray-900 font-medium">
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-sm font-semibold text-gray-900 mb-2">
                      Delivery Address
                    </p>
                    <div className="text-sm text-gray-700">
                      <p className="font-medium">{order.address?.name}</p>
                      <p>{order.address?.address}</p>
                      <p>
                        {order.address?.city}, {order.address?.state} -{" "}
                        {order.address?.pincode}
                      </p>
                      <p>Phone: {order.address?.phone}</p>
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className="px-6 py-4 bg-white border-t border-gray-200">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="text-gray-900">
                          ₹{order.subtotal?.toFixed(2)}
                        </span>
                      </div>
                      {order.discount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Discount:</span>
                          <span className="text-green-600">
                            -₹{order.discount?.toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax:</span>
                        <span className="text-gray-900">
                          ₹{order.tax?.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipping:</span>
                        <span className="text-gray-900">
                          ₹{order.shipping?.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
                        <span>Total:</span>
                        <span className="text-orange-600">
                          ₹{order.total?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Details */}
                  {order.paymentId && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                      <p className="text-sm font-semibold text-gray-900 mb-2">
                        Payment Details
                      </p>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>Payment ID: {order.paymentId}</p>
                        <p>Order ID: {order.orderId}</p>
                      </div>
                    </div>
                  )}
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
