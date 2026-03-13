"use client";

import { useMemo } from "react";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatStatus = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "-";

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
};

const statusClasses = {
  Confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  RTO: "bg-orange-50 text-orange-700 border-orange-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
  Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

export default function OrdersTable({
  orders = [],
  page = 1,
  totalPages = 1,
  total = 0,
  onPageChange,
}) {
  const paginationText = useMemo(() => {
    if (!total) return "No orders found.";
    return `Showing page ${page} of ${totalPages} (${total} rows)`;
  }, [page, totalPages, total]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Order Report</h2>
        <p className="text-sm text-gray-500">{paginationText}</p>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Order ID</th>
              <th className="px-4 py-3 text-left font-semibold">Product ID</th>
              <th className="px-4 py-3 text-left font-semibold">Product Name</th>
              <th className="px-4 py-3 text-right font-semibold">Qty</th>
              <th className="px-4 py-3 text-right font-semibold">Price</th>
              <th className="px-4 py-3 text-left font-semibold">Order Status</th>
              <th className="px-4 py-3 text-left font-semibold">Customer</th>
              <th className="px-4 py-3 text-left font-semibold">Order Date</th>
              <th className="px-4 py-3 text-left font-semibold">Delivery Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  No orders match this range.
                </td>
              </tr>
            ) : (
              orders.map((order, index) => (
                <tr key={`${order.orderId}-${order.productId}-${index}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {order.orderDisplayId || order.orderId || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {order.productId || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {order.productName || "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {order.quantity ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(order.price)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${
                        statusClasses[order.orderStatus] ||
                        "bg-gray-50 text-gray-600 border-gray-200"
                      }`}
                    >
                      {order.orderStatus || "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {order.customerName || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {formatDate(order.orderDate)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {formatStatus(order.deliveryStatus)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onPageChange?.(Math.max(page - 1, 1))}
          disabled={page <= 1}
          className={`px-3 py-2 rounded-md border text-sm font-medium ${
            page <= 1
              ? "border-gray-200 text-gray-400"
              : "border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange?.(Math.min(page + 1, totalPages))}
          disabled={page >= totalPages}
          className={`px-3 py-2 rounded-md border text-sm font-medium ${
            page >= totalPages
              ? "border-gray-200 text-gray-400"
              : "border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
