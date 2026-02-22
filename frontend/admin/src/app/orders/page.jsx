"use client";
import { useAdmin } from "@/context/AdminContext";
import { API_BASE_URL, deleteData, getData, putData } from "@/utils/api";
import { Button } from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Select from "@mui/material/Select";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { FaAngleDown } from "react-icons/fa6";
import { FiSearch } from "react-icons/fi";
import { MdDateRange, MdLocalShipping } from "react-icons/md";

const API_URL = API_BASE_URL;
const ORDER_TABLE_COLUMNS = [
  "48px",
  "84px",
  "76px",
  "172px",
  "76px",
  "96px",
  "192px",
  "72px",
  "96px",
  "84px",
  "168px",
  "96px",
];

const OrderRow = ({ order, index, token, onStatusUpdate }) => {
  const normalizeStatus = (status) => {
    if (!status) return "pending";
    const value = String(status).trim().toLowerCase().replace(/\s+/g, "_");
    return value === "confirmed" ? "accepted" : value;
  };
  const [expandIndex, setExpandIndex] = useState(false);
  const [orderStatus, setOrderStatus] = useState(
    normalizeStatus(order?.order_status) || "pending",
  );
  const [updating, setUpdating] = useState(false);
  const [downloadingPo, setDownloadingPo] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [orderReviews, setOrderReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const purchaseOrderId = (() => {
    const raw = order?.purchaseOrder;
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    if (typeof raw === "object" && raw?._id) return String(raw._id);
    if (typeof raw?.toString === "function") return String(raw.toString());
    return null;
  })();
  const canDownloadInvoice =
    ["delivered", "completed"].includes(normalizeStatus(order?.order_status)) &&
    Boolean(
      order?.isInvoiceGenerated ||
        order?.invoiceUrl ||
        order?.invoicePath ||
        order?.invoiceGeneratedAt,
    );
  const fallbackOrderId = String(order?._id || order?.id || "")
    .trim()
    .slice(-8)
    .toUpperCase();
  const orderDisplayId = String(
    order?.displayOrderId || (fallbackOrderId ? `BOG-${fallbackOrderId}` : "N/A"),
  )
    .trim()
    .toUpperCase();

  const handleDownloadPurchaseOrder = async () => {
    try {
      if (!purchaseOrderId) {
        toast.error("Purchase order not linked");
        return;
      }

      setDownloadingPo(true);
      const response = await fetch(
        `${API_URL}/api/purchase-orders/${purchaseOrderId}/pdf`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        let message = "Failed to download purchase order";
        try {
          const errorData = await response.json();
          message = errorData?.message || message;
        } catch {
          // Ignore non-JSON response parsing failures.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `purchase-order-${purchaseOrderId.slice(-8).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Purchase order downloaded");
    } catch (error) {
      toast.error(error.message || "Failed to download purchase order");
    } finally {
      setDownloadingPo(false);
    }
  };

  const handleDownloadInvoice = async () => {
    try {
      if (!canDownloadInvoice) {
        toast.error("Invoice not available yet");
        return;
      }

      setDownloadingInvoice(true);
      const response = await fetch(
        `${API_URL}/api/orders/${order._id}/invoice`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        let message = "Failed to download invoice";
        try {
          const errorData = await response.json();
          message = errorData?.message || message;
        } catch {
          // Ignore non-JSON response parsing failures.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `invoice-${orderDisplayId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Invoice downloaded");
    } catch (error) {
      toast.error(error.message || "Failed to download invoice");
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const handleChange = async (event) => {
    const newStatus = event.target.value;
    setUpdating(true);
    try {
      const response = await putData(
        `/api/orders/${order._id}/status`,
        { order_status: newStatus },
        token,
      );
      if (response.success) {
        setOrderStatus(newStatus);
        toast.success("Order status updated");
        if (onStatusUpdate) onStatusUpdate();
      } else {
        toast.error(response.message || "Failed to update status");
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
    setUpdating(false);
  };

  const fetchOrderReviews = async () => {
    if (!token || !order?._id) return;
    setReviewsLoading(true);
    try {
      const response = await getData(
        `/api/admin/reviews?orderId=${order._id}&limit=100`,
        token,
      );
      if (response?.success) {
        setOrderReviews(Array.isArray(response.data) ? response.data : []);
      } else {
        setOrderReviews([]);
      }
    } catch (error) {
      console.error("Failed to fetch order reviews:", error);
      setOrderReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!reviewId) return;
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm("Delete this customer review?");
    if (!confirmed) return;

    try {
      const response = await deleteData(`/api/admin/reviews/${reviewId}`, token);
      if (response?.success) {
        setOrderReviews((prev) => prev.filter((review) => review._id !== reviewId));
        toast.success("Review deleted");
      } else {
        toast.error(response?.message || "Failed to delete review");
      }
    } catch (error) {
      console.error("Failed to delete review:", error);
      toast.error("Failed to delete review");
    }
  };

  const getNormalizedId = (value) => {
    if (!value) return "";
    if (typeof value === "object") {
      return String(value?._id || value?.id || "");
    }
    return String(value);
  };

  const getReviewForProduct = (productId) => {
    const normalizedProductId = getNormalizedId(productId);
    if (!normalizedProductId) return null;

    return (
      orderReviews.find((review) => {
        const reviewProductId = getNormalizedId(
          review?.productId || review?.product?._id,
        );
        return reviewProductId === normalizedProductId;
      }) || null
    );
  };

  useEffect(() => {
    if (expandIndex) {
      fetchOrderReviews();
    } else {
      setOrderReviews([]);
    }
  }, [expandIndex, token, order?._id]);

  return (
    <>
      <tr className="border-b-[1px] border-[rgba(0,0,0,0.1)] hover:bg-gray-50">
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 font-bold">
          <Button
            className="!min-w-[40px] !h-[40px] !w-[40px] !rounded-full !text-gray-500 !bg-gray-100 hover:!bg-gray-200"
            onClick={() => setExpandIndex(!expandIndex)}
          >
            <FaAngleDown
              size={20}
              className={`transition-all ${expandIndex && "rotate-180"}`}
            />
          </Button>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 font-bold">
          {orderDisplayId}
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 break-words">
          {purchaseOrderId ? (
            <span className="text-[12px] font-[600] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
              PO #{String(purchaseOrderId).slice(-6).toUpperCase()}
            </span>
          ) : (
            <span className="text-gray-400">N/A</span>
          )}
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          <div className="flex items-center gap-3 max-w-[170px] min-w-0">
            <div className="rounded-full w-[50px] h-[50px] overflow-hidden bg-gray-200">
              <img
                src={order?.user?.avatar || "/Profile1.png"}
                alt="user"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="info flex flex-col gap-0 min-w-0">
              <span className="text-gray-800 text-[14px] truncate">
                {order?.user?.name || "Customer Name"}
              </span>
              <span className="text-gray-500 text-[13px] break-all leading-5">
                {order?.user?.email || "customer@email.com"}
              </span>
            </div>
          </div>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 break-all">
          {order?.paymentId || "N/A"}
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 break-all">
          {order?.user?.mobile || order?.delivery_address?.mobile || "N/A"}
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          <div className="max-w-[190px] py-2">
            <span className="bg-gray-100 rounded-md px-2 py-1 border border-[rgba(0,0,0,0.1)]">
              {order?.delivery_address?.addressType || "Home"}
            </span>
            <p className="pt-2 break-words leading-6">
              {order?.delivery_address
                ? `${order.delivery_address.address_line1 || order.delivery_address.address_line || ""}, ${order.delivery_address.city || ""}, ${order.delivery_address.state || ""}`
                : "No address"}
            </p>
          </div>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          {order?.delivery_address?.pincode || "N/A"}
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          ₹{order?.finalAmount || order?.totalAmt || "0"}
        </td>
        <td className="text-[14px] text-gray-600 px-4 py-2 text-primary font-bold break-all">
          {order?.user?._id?.slice(-6) || "------"}
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          <Select
            value={orderStatus}
            onChange={handleChange}
            displayEmpty
            inputProps={{ "aria-label": "Without label" }}
            size="small"
            disabled={updating}
            fullWidth
            sx={{
              "& .MuiSelect-select": {
                py: "9px",
                pr: "28px",
                fontSize: "14px",
                fontWeight: 500,
              },
              borderRadius: "10px",
              backgroundColor: "#ffffff",
              "& fieldset": {
                borderColor: "rgba(148, 163, 184, 0.6)",
              },
            }}
          >
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="pending_payment">Pending Payment</MenuItem>
            <MenuItem value="accepted">Accepted</MenuItem>
            <MenuItem value="in_warehouse">In Warehouse</MenuItem>
            <MenuItem value="shipped">Shipped</MenuItem>
            <MenuItem value="out_for_delivery">Out for Delivery</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
            <MenuItem value="confirmed">Confirmed (Legacy)</MenuItem>
          </Select>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          <div className="inline-flex items-center gap-1 text-[14px] whitespace-nowrap">
            <MdDateRange size={18} />
            {order?.createdAt
              ? new Date(order.createdAt).toLocaleDateString()
              : new Date().toLocaleDateString()}
          </div>
        </td>
      </tr>
      {expandIndex && (
        <tr className="bg-gray-100">
          <td colSpan={12} className="p-5">
            <div className="flex flex-wrap gap-4">
              {(order?.products || []).map((product, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 bg-white p-3 rounded-lg shadow-sm"
                >
                  <div className="img rounded-md overflow-hidden w-[80px] h-[80px] bg-gray-100">
                    <img
                      src={product?.image || "/placeholder.png"}
                      alt="product"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="info flex flex-col">
                    <h2 className="text-gray-900 text-[15px] font-[500]">
                      {product?.productTitle || "Product Name"}
                    </h2>
                    <span className="text-gray-600 text-[13px] font-[500]">
                      Qty: {product?.quantity || 1} × ₹{product?.price || 0}
                    </span>
                    <span className="text-green-600 text-[13px] font-[600]">
                      Subtotal: ₹
                      {product?.subTotal ||
                        product?.quantity * product?.price ||
                        0}
                    </span>
                    {(() => {
                      const review = getReviewForProduct(product?.productId);
                      if (!review) {
                        return (
                          <span className="text-gray-400 text-[12px] mt-1">
                            No customer review yet
                          </span>
                        );
                      }

                      return (
                        <div className="mt-2 p-2 rounded-md border border-gray-200 bg-gray-50 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] font-semibold text-gray-800">
                              {review.userName || "Customer"}{" "}
                              {review.city ? `• ${review.city}` : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteReview(review._id)}
                              className="text-[11px] font-semibold text-red-600 hover:text-red-700"
                            >
                              Delete Review
                            </button>
                          </div>
                          <div className="text-[12px] text-amber-600 font-semibold">
                            {"★".repeat(Math.max(1, Number(review.rating || 0)))}
                            <span className="text-gray-400 ml-1">
                              ({Number(review.rating || 0).toFixed(1)})
                            </span>
                          </div>
                          <p className="text-[12px] text-gray-700">
                            {review.comment}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {review.createdAt
                              ? new Date(review.createdAt).toLocaleDateString()
                              : ""}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
              {(!order?.products || order.products.length === 0) && (
                <p className="text-gray-500">No product details available</p>
              )}
            </div>
            {reviewsLoading && (
              <p className="text-sm text-gray-500 mt-3">
                Loading customer reviews...
              </p>
            )}

            {/* Invoice Section */}
            <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-gray-800 font-semibold">Invoice</div>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleDownloadInvoice}
                  disabled={!canDownloadInvoice || downloadingInvoice}
                >
                  {downloadingInvoice ? "Downloading..." : "Download Invoice"}
                </Button>
              </div>
              <div className="mt-2 text-sm text-gray-700">
                <span className="font-semibold">Status:</span>{" "}
                {canDownloadInvoice ? "Available" : "Pending"}
              </div>
            </div>

            {/* Purchase Order Section */}
            <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-gray-800 font-semibold">
                  Purchase Order
                </div>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleDownloadPurchaseOrder}
                  disabled={!purchaseOrderId || downloadingPo}
                >
                  {downloadingPo ? "Downloading..." : "Download PO PDF"}
                </Button>
              </div>
              <div className="mt-2 text-sm text-gray-700">
                <span className="font-semibold">PO ID:</span>{" "}
                {purchaseOrderId ? String(purchaseOrderId) : "Not linked"}
              </div>
            </div>

            {/* Shipping Section */}
            <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 text-gray-800 font-semibold">
                  <MdLocalShipping className="text-xl text-orange-500" />
                  Shipping
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1">
                  Automated
                </span>
              </div>
              <div className="mt-3 text-sm text-gray-700 space-y-1">
                <div>
                  <span className="font-semibold">AWB:</span>{" "}
                  {order?.awbNumber || order?.awb_number || "N/A"}
                </div>
                <div>
                  <span className="font-semibold">Courier:</span>{" "}
                  {order?.courierName || order?.shipping_provider || "Xpressbees"}
                </div>
                <div>
                  <span className="font-semibold">Tracking Status:</span>{" "}
                  {order?.shipmentStatus || order?.shipment_status || "pending"}
                </div>
                <div>
                  <span className="font-semibold">Tracking URL:</span>{" "}
                  {order?.trackingUrl ? (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      Open Tracking
                    </a>
                  ) : (
                    "N/A"
                  )}
                </div>
                <div>
                  <span className="font-semibold">Manifest:</span>{" "}
                  {order?.manifestId || order?.shipping_manifest ? "Generated" : "Pending"}
                </div>
                <div>
                  <span className="font-semibold">Delivery Status:</span>{" "}
                  {normalizeStatus(order?.order_status) === "completed"
                    ? "Completed"
                    : normalizeStatus(order?.order_status)}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}

    </>
  );
};

const Orders = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/orders/admin/all?page=${page}&limit=20`;
      if (search) url += `&search=${search}`;

      const response = await getData(url, token);
      if (response.success) {
        setOrders(response.data?.orders || []);
        setTotalPages(response.data?.pagination?.totalPages || 1);
      } else {
        setOrders([]);
        setTotalPages(1);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setOrders([]);
      setTotalPages(1);
    }
    setIsLoading(false);
  }, [page, search, token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated, page, fetchOrders]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="wrapper w-full p-4">
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl mb-5 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="info">
            <h1 className="text-[28px] leading-none font-[700] text-gray-800">
              Orders
            </h1>
            <p className="text-gray-500">
              There {orders.length === 1 ? "is" : "are"}{" "}
              <span className="text-primary font-bold">{orders.length}</span>{" "}
              {orders.length === 1 ? "order" : "orders"}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outlined"
              size="small"
              onClick={() => router.push("/purchase-orders")}
              sx={{
                textTransform: "none",
                borderRadius: "10px",
                px: 2,
                py: 0.8,
              }}
            >
              Purchase Orders
            </Button>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Order..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 bg-gray-50 rounded-lg w-[300px] outline-none focus:border-blue-500"
                />
              </div>
              <Button
                type="submit"
                variant="contained"
                sx={{
                  textTransform: "none",
                  borderRadius: "10px",
                  px: 2,
                  py: 0.8,
                }}
              >
                Search
              </Button>
            </form>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No orders found.</p>
          </div>
        ) : (
          <>
            <div className="w-full mt-5 border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full table-fixed">
                <colgroup>
                  {ORDER_TABLE_COLUMNS.map((width, idx) => (
                    <col key={idx} style={{ width }} />
                  ))}
                </colgroup>
                <thead className="bg-gray-200">
                  <tr>
                    <th className="text-[13px] text-gray-700 font-[700] px-4 py-3 text-left border-b-[1px] border-[rgba(0,0,0,0.1)] uppercase tracking-wide"></th>
                    <th className="text-[13px] text-gray-700 font-[700] px-4 py-3 text-left uppercase tracking-wide">
                      Order Id
                    </th>
                    <th className="text-[13px] text-gray-700 font-[700] px-4 py-3 text-left uppercase tracking-wide">
                      PO
                    </th>
                    <th className="text-[13px] text-gray-700 font-[700] px-4 py-3 text-left uppercase tracking-wide">
                      Customer
                    </th>
                    <th className="text-[13px] text-gray-700 font-[700] px-4 py-3 text-left uppercase tracking-wide">
                      Payment Id
                    </th>
                    <th className="text-[13px] text-gray-700 font-[700] px-4 py-3 text-left uppercase tracking-wide">
                      Phone Number
                    </th>
                    <th className="text-[13px] text-gray-700 font-[700] px-4 py-3 text-left uppercase tracking-wide">
                      Address
                    </th>
                    <th className="text-[13px] text-gray-700 font-[700] px-4 py-3 text-left uppercase tracking-wide">
                      Pincode
                    </th>
                    <th className="text-[13px] text-gray-700 font-[700] px-4 py-3 text-left uppercase tracking-wide">
                      Total Amount
                    </th>
                    <th className="text-[13px] text-gray-700 font-[700] px-4 py-3 text-left uppercase tracking-wide">
                      User Id
                    </th>
                    <th className="text-[13px] text-gray-700 font-[700] px-4 py-3 text-left uppercase tracking-wide">
                      Order Status
                    </th>
                    <th className="text-[13px] text-gray-700 font-[700] px-4 py-3 text-left uppercase tracking-wide">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => (
                    <OrderRow
                      key={order._id || index}
                      order={order}
                      index={index}
                      token={token}
                      onStatusUpdate={fetchOrders}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-center py-10">
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, value) => setPage(value)}
                showFirstButton
                showLastButton
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Orders;
