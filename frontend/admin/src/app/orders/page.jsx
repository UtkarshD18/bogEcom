"use client";
import { useAdmin } from "@/context/AdminContext";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useLiveRefreshSetting } from "@/hooks/useLiveRefreshSetting";
import {
  API_BASE_URL,
  deleteData,
  getData,
  postData,
  putData,
} from "@/utils/api";
import { hasAdminPermission } from "@/utils/adminPermissions";
import { withAdminBasePath } from "@/utils/basePath";
import { Button } from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Select from "@mui/material/Select";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { FaAngleDown } from "react-icons/fa6";
import { FiSearch } from "react-icons/fi";
import { MdDateRange, MdLocalShipping } from "react-icons/md";

const API_URL = API_BASE_URL;
const ORDER_TABLE_COLUMNS = [
  "48px",
  "84px",
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

const PENDING_ORDER_STATUSES = new Set([
  "pending",
  "pending_payment",
  "in_warehouse",
]);

const PENDING_PAYMENT_STATUSES = new Set(["pending", "pending_payment"]);
const SETTLED_PAYMENT_STATUSES = new Set([
  "paid",
  "confirmed",
  "captured",
  "success",
  "successful",
]);

const normalizeOrderStatus = (status) => {
  if (!status) return "pending";
  const value = String(status).trim().toLowerCase().replace(/\s+/g, "_");
  return value === "confirmed" ? "accepted" : value;
};

const formatStatusLabel = (status, fallback = "Pending") => {
  const normalized = String(status || "").trim();
  if (!normalized) return fallback;
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const isGatewayMerchantReference = (value) =>
  /^BOG_/i.test(String(value || "").trim());

const getValueByPath = (source = {}, path = "") => {
  if (!source || typeof source !== "object" || !path) return null;
  return path
    .split(".")
    .reduce(
      (current, key) =>
        current && typeof current === "object" ? current[key] : undefined,
      source,
    );
};

const normalizePaymentFieldValue = (value) => String(value || "").trim();

const isNumericReference = (value) => /^\d+$/.test(String(value || ""));
const isLikelyUpiRrn = (value) => /^\d{12}$/.test(String(value || ""));

const resolveUpiRrn = (order = {}) => {
  const rrnCandidatePaths = [
    "rrn",
    "utr",
    "upi_ref",
    "bank_ref",
    "upiReferenceNo",
    "upiReferenceNumber",
    "bankReference",
    "bankReferenceNo",
    "payment.rrn",
    "payment.utr",
    "payment.upi_ref",
    "payment.bank_ref",
    "paymentDetails.rrn",
    "paymentDetails.utr",
    "gateway.rrn",
    "gateway.utr",
  ];

  let numericFallback = "";

  for (const path of rrnCandidatePaths) {
    const candidate = normalizePaymentFieldValue(getValueByPath(order, path));
    if (!candidate || !isNumericReference(candidate)) continue;
    if (isLikelyUpiRrn(candidate)) return candidate;
    if (!numericFallback) numericFallback = candidate;
  }

  return numericFallback;
};

const resolveTransactionId = (order = {}, rrnValue = "") => {
  const transactionCandidatePaths = [
    "transactionId",
    "txnId",
    "gatewayTxnId",
    "phonepeTransactionId",
    "paytmTransactionId",
    "providerReferenceId",
    "upiReferenceNumber",
    "payment.transactionId",
    "payment.txnId",
    "paymentDetails.transactionId",
    "paymentDetails.txnId",
    "gateway.transactionId",
    "gateway.txnId",
  ];

  for (const path of transactionCandidatePaths) {
    const candidate = normalizePaymentFieldValue(getValueByPath(order, path));
    if (!candidate) continue;
    if (rrnValue && candidate === rrnValue) continue;
    return candidate;
  }

  const directReference = [
    order?.transactionId,
    order?.txnId,
    order?.gatewayTxnId,
  ]
    .map((value) => normalizePaymentFieldValue(value))
    .find((value) => Boolean(value) && value !== rrnValue);

  if (directReference) {
    return directReference;
  }

  const fallbackPaymentId = normalizePaymentFieldValue(order?.paymentId);
  if (
    fallbackPaymentId &&
    !isGatewayMerchantReference(fallbackPaymentId) &&
    fallbackPaymentId !== rrnValue
  ) {
    return fallbackPaymentId;
  }

  return "";
};

const resolveGatewayTransactionReference = (order = {}) => {
  const rrnValue = resolveUpiRrn(order);
  return resolveTransactionId(order, rrnValue);
};

const resolveMerchantReference = (order = {}) => {
  const directReference = [order?.paytmOrderId, order?.phonepeMerchantOrderId]
    .map((value) => String(value || "").trim())
    .find(Boolean);

  if (directReference) return directReference;

  const fallbackPaymentId = String(order?.paymentId || "").trim();
  return isGatewayMerchantReference(fallbackPaymentId) ? fallbackPaymentId : "";
};

const resolvePaymentReference = (order = {}) => {
  return resolveGatewayTransactionReference(order);
};

const hasSettledPayment = (order = {}) => {
  const normalizedPaymentStatus = normalizeOrderStatus(
    order?.payment_status || order?.paymentStatus,
  );

  if (SETTLED_PAYMENT_STATUSES.has(normalizedPaymentStatus)) {
    return true;
  }

  return Boolean(
    order?.paymentCompletedAt || order?.confirmed_at || order?.confirmedAt,
  );
};

const resolvePaymentProviderLabel = (order = {}) => {
  const paymentMethod = String(
    order?.paymentMethod || order?.payment_method || "",
  )
    .trim()
    .toLowerCase();

  if (paymentMethod.includes("phonepe")) return "PhonePe";
  if (paymentMethod.includes("paytm")) return "Paytm";
  if (paymentMethod) return formatStatusLabel(paymentMethod, "Gateway");

  if (
    String(order?.phonepeMerchantOrderId || order?.phonepeOrderId || "").trim()
  ) {
    return "PhonePe";
  }
  if (String(order?.paytmOrderId || order?.paytmTransactionId || "").trim()) {
    return "Paytm";
  }
  return "Manual / Unknown";
};

const isPendingQueueOrder = (order = {}) => {
  const normalizedOrderStatus = normalizeOrderStatus(
    order?.order_status || order?.status,
  );
  const normalizedPaymentStatus = normalizeOrderStatus(order?.payment_status);

  return (
    PENDING_ORDER_STATUSES.has(normalizedOrderStatus) ||
    PENDING_PAYMENT_STATUSES.has(normalizedPaymentStatus)
  );
};

const isDemoOrTestOrder = (order = {}) => {
  const rawDemoFlag = order?.isDemoOrder;
  const normalizedDemoFlag =
    typeof rawDemoFlag === "string"
      ? rawDemoFlag.trim().toLowerCase()
      : rawDemoFlag;
  if (
    rawDemoFlag === true ||
    rawDemoFlag === 1 ||
    normalizedDemoFlag === "true" ||
    normalizedDemoFlag === "1"
  ) {
    return true;
  }

  const paymentMethod = String(
    order?.paymentMethod || order?.payment_method || "",
  )
    .trim()
    .toLowerCase();
  if (paymentMethod === "test") return true;

  const paymentId = String(order?.paymentId || "")
    .trim()
    .toUpperCase();
  if (paymentId.startsWith("TEST_")) return true;

  const notes = String(order?.notes || "")
    .trim()
    .toLowerCase();
  return notes.includes("demo test order");
};

const getPendingQueueReason = (order = {}) => {
  const normalizedOrderStatus = normalizeOrderStatus(
    order?.order_status || order?.status,
  );
  const normalizedPaymentStatus = normalizeOrderStatus(order?.payment_status);

  if (PENDING_ORDER_STATUSES.has(normalizedOrderStatus)) {
    return formatStatusLabel(normalizedOrderStatus);
  }
  if (PENDING_PAYMENT_STATUSES.has(normalizedPaymentStatus)) {
    return "Payment Pending";
  }
  return "Needs Review";
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : fallback;
};

const buildFallbackPagination = ({
  source = {},
  fallback = {},
  orderCount = 0,
} = {}) => {
  const page = toPositiveInt(
    source?.page ?? fallback?.page,
    toPositiveInt(fallback?.page, 1),
  );
  const limit = toPositiveInt(
    source?.limit ?? fallback?.limit,
    toPositiveInt(fallback?.limit, Math.max(orderCount, 1)),
  );
  const total = toPositiveInt(
    source?.total ?? source?.totalCount ?? source?.count ?? fallback?.total,
    Math.max(orderCount, 0),
  );
  const computedTotalPages = Math.max(
    1,
    Math.ceil(total / Math.max(limit, 1)) || 1,
  );
  const totalPages = toPositiveInt(
    source?.totalPages ?? source?.pages ?? fallback?.totalPages,
    computedTotalPages,
  );
  const hasNextPage =
    typeof source?.hasNextPage === "boolean"
      ? source.hasNextPage
      : page < totalPages;
  const hasPrevPage =
    typeof source?.hasPrevPage === "boolean" ? source.hasPrevPage : page > 1;

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };
};

const extractOrdersPayload = (input, options = {}) => {
  const fallbackPagination = options?.fallbackPagination || {};
  if (!input || typeof input !== "object") return null;

  const queue = [input];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current?.orders)) {
      const paginationSource =
        current?.pagination && typeof current.pagination === "object"
          ? {
              ...current,
              ...current.pagination,
            }
          : current;
      return {
        orders: current.orders,
        pagination: buildFallbackPagination({
          source: paginationSource,
          fallback: fallbackPagination,
          orderCount: current.orders.length,
        }),
      };
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return null;
};

const resolveAlternateLocalhostBase = () => {
  try {
    const parsed = new URL(String(API_URL || ""));
    const host = parsed.hostname.toLowerCase();
    if (host !== "localhost" && host !== "127.0.0.1") return null;

    if (parsed.port === "8000") {
      parsed.port = "8001";
      return parsed.toString().replace(/\/+$/, "");
    }
    if (parsed.port === "8001") {
      parsed.port = "8000";
      return parsed.toString().replace(/\/+$/, "");
    }
    return null;
  } catch {
    return null;
  }
};

const fetchOrdersFromAltPort = async ({ url, token, fallbackPagination }) => {
  const altBase = resolveAlternateLocalhostBase();
  if (!altBase) return null;

  const resolvedToken =
    token ||
    (typeof window !== "undefined" ? localStorage.getItem("adminToken") : null);

  try {
    const response = await fetch(`${altBase}${url}`, {
      method: "GET",
      headers: {
        ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
      },
    });

    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return extractOrdersPayload(payload, { fallbackPagination });
  } catch {
    // Alternate port probing is best-effort only.
    return null;
  }
};

const buildXpressbeesTrackingUrl = (awb, candidateUrl = "") => {
  const normalizedAwb = String(awb || "").trim();
  if (!normalizedAwb) return "";

  const fallbackUrl = `https://www.xpressbees.com/shipment/tracking?awbNo=${encodeURIComponent(normalizedAwb)}`;
  const explicitUrl = String(candidateUrl || "").trim();
  if (!explicitUrl) return fallbackUrl;

  try {
    const parsed = new URL(explicitUrl);
    const host = String(parsed.hostname || "").toLowerCase();
    if (!host.includes("xpressbees.com")) return explicitUrl;

    parsed.pathname = "/shipment/tracking";
    parsed.search = "";
    parsed.searchParams.set("awbNo", normalizedAwb);
    return parsed.toString();
  } catch {
    return explicitUrl.toLowerCase().includes("xpressbees.com")
      ? fallbackUrl
      : explicitUrl;
  }
};

const resolveTrackingUrl = (order = {}) => {
  const explicitUrl = String(
    order?.trackingUrl ||
      order?.tracking_url ||
      order?.shipmentTrackingUrl ||
      "",
  ).trim();
  const awb = String(
    order?.awbNo ||
      order?.awb_no ||
      order?.awbNumber ||
      order?.awb_number ||
      order?.shipment?.awbNo ||
      order?.shipment?.awb_no ||
      order?.shipment?.awb_number ||
      order?.shipment?.awb ||
      order?.shipping?.awbNo ||
      order?.shipping?.awb_no ||
      order?.shipping?.awb_number ||
      order?.shipping?.awb ||
      "",
  ).trim();

  if (!explicitUrl) {
    return buildXpressbeesTrackingUrl(awb);
  }

  if (!awb) return explicitUrl;

  try {
    const parsed = new URL(explicitUrl);
    const host = String(parsed.hostname || "").toLowerCase();
    const isXpressbees = host.includes("xpressbees.com");
    if (!isXpressbees) return explicitUrl;
    return buildXpressbeesTrackingUrl(awb, explicitUrl);
  } catch {
    return explicitUrl.toLowerCase().includes("xpressbees.com")
      ? buildXpressbeesTrackingUrl(awb, explicitUrl)
      : explicitUrl;
  }
};

const OrderRow = ({ order, index, token, onStatusUpdate, canManageStatus }) => {
  const [expandIndex, setExpandIndex] = useState(false);
  const [orderStatus, setOrderStatus] = useState(
    normalizeOrderStatus(order?.order_status) || "pending",
  );
  const [updating, setUpdating] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [orderReviews, setOrderReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const trackingUrl = resolveTrackingUrl(order);
  const paymentSettled = hasSettledPayment(order);
  const upiRrn = paymentSettled ? resolveUpiRrn(order) : "";
  const transactionId = paymentSettled
    ? resolveTransactionId(order, upiRrn)
    : "";
  const paymentReference = paymentSettled
    ? resolvePaymentReference(order) ||
      upiRrn ||
      transactionId ||
      "Pending / Not issued yet"
    : "Pending / Not issued yet";
  const paymentProviderLabel = resolvePaymentProviderLabel(order);
  const merchantReference = resolveMerchantReference(order);
  const gatewayOrderReference = String(order?.phonepeOrderId || "").trim();
  const gatewayTransactionReference = paymentSettled
    ? resolveGatewayTransactionReference(order) || "Pending / Not issued yet"
    : "Pending / Not issued yet";

  const canDownloadInvoice =
    normalizeOrderStatus(order?.payment_status) === "paid" ||
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
    order?.displayOrderId ||
      (fallbackOrderId ? `BOG-${fallbackOrderId}` : "N/A"),
  )
    .trim()
    .toUpperCase();
  const internalOrderId = String(order?._id || order?.id || "").trim();
  const guestDetails = order?.guestDetails || {};
  const billingDetails = order?.billingDetails || {};
  const addressSnapshot = order?.deliveryAddressSnapshot || {};
  const deliveryAddress = order?.delivery_address || null;
  const snapshotAddressLine1 =
    addressSnapshot.address_line1 || addressSnapshot.full_address || "";
  const snapshotAddressCity = addressSnapshot.order_city || "";
  const snapshotAddressState = addressSnapshot.order_state || "";
  const snapshotAddressPincode = addressSnapshot.order_pincode || "";
  const snapshotSource = String(addressSnapshot.source || "")
    .trim()
    .toLowerCase();
  const customerName =
    guestDetails.fullName ||
    guestDetails.name ||
    billingDetails.fullName ||
    addressSnapshot.order_name ||
    order?.user?.name ||
    "Guest";
  const customerEmail =
    billingDetails.email ||
    guestDetails.email ||
    addressSnapshot.email ||
    order?.user?.email ||
    "N/A";
  const customerPhone =
    billingDetails.phone ||
    guestDetails.phone ||
    addressSnapshot.order_mobile ||
    deliveryAddress?.mobile ||
    deliveryAddress?.mobile_number ||
    order?.user?.mobile ||
    "N/A";
  const addressLine1 =
    snapshotAddressLine1 ||
    billingDetails.address ||
    guestDetails.address ||
    deliveryAddress?.address_line1 ||
    deliveryAddress?.address_line ||
    "";
  const addressCity =
    snapshotAddressCity ||
    billingDetails.city ||
    guestDetails.city ||
    deliveryAddress?.city ||
    "";
  const addressState =
    snapshotAddressState ||
    billingDetails.state ||
    guestDetails.state ||
    deliveryAddress?.state ||
    "";
  const addressDisplay = addressLine1
    ? `${addressLine1}${
        addressCity || addressState
          ? `, ${[addressCity, addressState].filter(Boolean).join(", ")}`
          : ""
      }`
    : "No address";
  const addressTypeLabel =
    snapshotSource === "saved_address"
      ? deliveryAddress?.addressType || "Saved"
      : snapshotSource === "guest_manual"
        ? "Guest"
        : snapshotSource === "registered_manual"
          ? "Manual"
          : deliveryAddress?.addressType || (addressLine1 ? "Guest" : "Home");
  const pincodeDisplay =
    snapshotAddressPincode ||
    billingDetails.pincode ||
    guestDetails.pincode ||
    deliveryAddress?.pincode ||
    "N/A";

  const copyToClipboard = async (value, label = "value") => {
    const safeValue = String(value || "").trim();
    if (!safeValue) {
      toast.error(`No ${label} available`);
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(safeValue);
      } else if (typeof document !== "undefined") {
        const textArea = document.createElement("textarea");
        textArea.value = safeValue;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      } else {
        throw new Error("Clipboard not available");
      }

      toast.success(`${label} copied`);
    } catch {
      toast.error(`Failed to copy ${label}`);
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
    if (!canManageStatus) {
      toast.error("You do not have permission to update order status.");
      return;
    }
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
      const response = await deleteData(
        `/api/admin/reviews/${reviewId}`,
        token,
      );
      if (response?.success) {
        setOrderReviews((prev) =>
          prev.filter((review) => review._id !== reviewId),
        );
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
                {customerName}
              </span>
              <span className="text-gray-500 text-[13px] break-all leading-5">
                {customerEmail}
              </span>
            </div>
          </div>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          <div className="min-w-0">
            <div className="break-all">{paymentReference}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">
              {paymentProviderLabel}
            </div>
          </div>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 break-all">
          {customerPhone}
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          <div className="max-w-[190px] py-2">
            <span className="bg-gray-100 rounded-md px-2 py-1 border border-[rgba(0,0,0,0.1)]">
              {addressTypeLabel}
            </span>
            <p className="pt-2 break-words leading-6">{addressDisplay}</p>
          </div>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          {pincodeDisplay}
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
            disabled={updating || !canManageStatus}
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
          <td colSpan={11} className="p-5">
            <div className="flex flex-wrap gap-4">
              {(order?.products || []).map((product, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 bg-white p-3 rounded-lg shadow-sm"
                >
                  <div className="img rounded-md overflow-hidden w-[80px] h-[80px] bg-gray-100">
                    <img
                      src={
                        product?.image || withAdminBasePath("/placeholder.png")
                      }
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
                            {"★".repeat(
                              Math.max(1, Number(review.rating || 0)),
                            )}
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

            <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
              <div className="text-gray-800 font-semibold">
                Order References
              </div>
              <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="font-semibold text-gray-700">Order No:</span>{" "}
                  <span className="text-gray-800">
                    {orderDisplayId || "N/A"}
                  </span>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="font-semibold text-gray-700">
                    Payment App Txn ID:
                  </span>{" "}
                  <span className="text-gray-800 break-all">
                    {paymentReference}
                  </span>
                </div>
                {upiRrn ? (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span
                        className="font-semibold text-gray-700"
                        title="RRN is a bank-level reference used for tracking UPI payments"
                      >
                        UPI RRN:
                      </span>{" "}
                      <span className="text-gray-800 break-all">{upiRrn}</span>
                    </div>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => copyToClipboard(upiRrn, "UPI RRN")}
                    >
                      Copy
                    </Button>
                  </div>
                ) : null}
                {transactionId ? (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-700">
                        Transaction ID:
                      </span>{" "}
                      <span className="text-gray-800 break-all">
                        {transactionId}
                      </span>
                    </div>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        copyToClipboard(transactionId, "Transaction ID")
                      }
                    >
                      Copy
                    </Button>
                  </div>
                ) : null}
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-gray-700">
                      Internal ID:
                    </span>{" "}
                    <span className="text-gray-800 break-all">
                      {internalOrderId || "N/A"}
                    </span>
                  </div>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!internalOrderId}
                    onClick={() =>
                      copyToClipboard(internalOrderId, "Internal ID")
                    }
                  >
                    Copy
                  </Button>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="font-semibold text-gray-700">
                    Payment Provider:
                  </span>{" "}
                  <span className="text-gray-800">{paymentProviderLabel}</span>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="font-semibold text-gray-700">
                    Merchant Ref:
                  </span>{" "}
                  <span className="text-gray-800 break-all">
                    {merchantReference || "N/A"}
                  </span>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="font-semibold text-gray-700">
                    Gateway Order Ref:
                  </span>{" "}
                  <span className="text-gray-800 break-all">
                    {gatewayOrderReference || "N/A"}
                  </span>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="font-semibold text-gray-700">
                    Gateway Txn Ref:
                  </span>{" "}
                  <span className="text-gray-800 break-all">
                    {gatewayTransactionReference || "Pending / Not issued yet"}
                  </span>
                </div>
              </div>
            </div>

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
                  {order?.courierName ||
                    order?.shipping_provider ||
                    "Xpressbees"}
                </div>
                <div>
                  <span className="font-semibold">Tracking Status:</span>{" "}
                  {order?.shipmentStatus || order?.shipment_status || "pending"}
                </div>
                <div>
                  <span className="font-semibold">Tracking URL:</span>{" "}
                  {trackingUrl ? (
                    <a
                      href={trackingUrl}
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
                  {order?.manifestId || order?.shipping_manifest
                    ? "Generated"
                    : "Pending"}
                </div>
                <div>
                  <span className="font-semibold">Delivery Status:</span>{" "}
                  {normalizeOrderStatus(order?.order_status) === "completed"
                    ? "Completed"
                    : normalizeOrderStatus(order?.order_status)}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const OrdersTable = ({ orders, token, onStatusUpdate, canManageStatus }) => (
  <div className="w-full mt-5 border border-gray-200 rounded-xl overflow-x-auto">
    <table className="min-w-[980px] w-full table-fixed">
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
            Customer
          </th>
          <th className="text-[13px] text-gray-700 font-[700] px-4 py-3 text-left uppercase tracking-wide">
            Payment App Txn ID
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
            onStatusUpdate={onStatusUpdate}
            canManageStatus={canManageStatus}
          />
        ))}
      </tbody>
    </table>
  </div>
);

const Orders = () => {
  const { token, isAuthenticated, loading, admin } = useAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backfillingPaymentIds, setBackfillingPaymentIds] = useState(false);
  const [repairingPaidOrders, setRepairingPaidOrders] = useState(false);
  const canManageStatus = hasAdminPermission(admin, "manage_orders");
  const canRunOrderMaintenanceActions = hasAdminPermission(admin, "manage_shipping");
  const { intervalMs } = useLiveRefreshSetting();
  const refreshConfig = useMemo(
    () => ({
      minIntervalMs: intervalMs,
      fallbackIntervalMs: Math.max(intervalMs * 30, 30000),
    }),
    [intervalMs],
  );

  const fetchOrders = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setIsLoading(true);
      } else {
        setRefreshing(true);
      }
      try {
        let url = `/api/orders/admin/all?page=${page}&limit=20`;
        if (search) url += `&search=${search}`;
        if (statusFilter && statusFilter !== "all") {
          url += `&status=${statusFilter}`;
        }

        const fallbackPagination = {
          page,
          limit: 20,
        };
        const response = await getData(url, token);
        let payload = extractOrdersPayload(response, { fallbackPagination });

        const shouldProbeAltPort =
          (!payload ||
            !Array.isArray(payload.orders) ||
            payload.orders.length === 0) &&
          page === 1 &&
          !search &&
          (!statusFilter || statusFilter === "all");

        if (shouldProbeAltPort) {
          const altPayload = await fetchOrdersFromAltPort({
            url,
            token,
            fallbackPagination,
          });
          if (
            altPayload &&
            Array.isArray(altPayload.orders) &&
            altPayload.orders.length > 0
          ) {
            payload = altPayload;
          }
        }

        if ((response?.success || payload) && payload) {
          const nextOrders = Array.isArray(payload?.orders)
            ? payload.orders
            : [];
          const visibleOrders = nextOrders.filter((order) => {
            if (isDemoOrTestOrder(order)) return false;
            if (statusFilter === "all" && isPendingQueueOrder(order)) return false;
            return true;
          });
          const nextTotalPages = Number(payload?.pagination?.totalPages || 1);
          setOrders(visibleOrders);
          setTotalPages(nextTotalPages > 0 ? nextTotalPages : 1);
        } else {
          // Keep existing rows if request failed; avoid false empty state flashes.
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              "Orders API returned an invalid payload shape; keeping current rows.",
              {
                message: response?.message || "Unknown response",
                response,
              },
            );
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Failed to fetch orders; keeping existing rows.", error);
        }
        // Preserve current data on transient failures.
      }
      setIsLoading(false);
      setRefreshing(false);
    },
    [page, search, statusFilter, token],
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated, page, statusFilter, fetchOrders]);

  useEffect(() => {
    const rawStatus = String(
      searchParams?.get("status") || "all",
    ).toLowerCase();
    const allowed = new Set(["all", "successful", "failed"]);
    const nextStatus = allowed.has(rawStatus) ? rawStatus : "all";
    setStatusFilter(nextStatus);
    setPage(1);
  }, [searchParams]);

  const { trigger: triggerOrdersRefresh } = useLiveRefresh(
    () => fetchOrders({ silent: true }),
    refreshConfig,
  );

  const primaryOrders = orders;

  const handleOrderUpdate = useCallback(() => {
    triggerOrdersRefresh();
  }, [triggerOrdersRefresh]);

  useAdminRealtime({ token, onOrderUpdate: handleOrderUpdate });

  const handleSearch = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleStatusChange = (event) => {
    const next = event.target.value;
    setStatusFilter(next);
    setPage(1);
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (next === "all") {
      params.delete("status");
    } else {
      params.set("status", next);
    }
    const query = params.toString();
    router.replace(query ? `/orders?${query}` : "/orders");
  };

  const handleRepairPaidOrders = async () => {
    if (!token) {
      toast.error("Admin session missing");
      return;
    }
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(
            "Repair paid orders missing shipment/invoice? This may take a minute.",
          );
    if (!confirmed) return;

    setRepairingPaidOrders(true);
    try {
      const response = await postData(
        "/api/orders/admin/repair-paid?limit=50",
        {},
        token,
      );
      if (response?.success) {
        const stats = response?.data || {};
        toast.success(
          `Repair completed: ${stats.repaired || 0} repaired, ${stats.skipped || 0} skipped.`,
        );
        fetchOrders();
      } else {
        toast.error(response?.message || "Repair failed");
      }
    } catch (error) {
      toast.error("Repair failed");
    } finally {
      setRepairingPaidOrders(false);
    }
  };

  const handleBackfillSuccessfulPaymentIds = async () => {
    if (!token) {
      toast.error("Admin session missing");
      return;
    }

    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(
            "Backfill Payment App Txn IDs for successful orders only? This updates payment ID only when provider transaction IDs already exist.",
          );
    if (!confirmed) return;

    setBackfillingPaymentIds(true);
    try {
      const response = await postData(
        "/api/orders/admin/backfill-payment-ids?limit=250",
        {},
        token,
      );

      if (response?.success) {
        const stats = response?.data || {};
        const updated = Number(stats?.updated || 0);
        const skipped = Number(stats?.skipped || 0);
        const remaining = Number(stats?.remaining || 0);

        toast.success(
          `Backfill completed: ${updated} updated, ${skipped} skipped, ${remaining} remaining.`,
        );
        fetchOrders();
      } else {
        toast.error(response?.message || "Backfill failed");
      }
    } catch {
      toast.error("Backfill failed");
    } finally {
      setBackfillingPaymentIds(false);
    }
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
            <p className="mt-1 text-xs text-gray-500">
              Pending and payment-hold orders are hidden from this view.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {canRunOrderMaintenanceActions ? (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleBackfillSuccessfulPaymentIds}
                  disabled={backfillingPaymentIds || repairingPaidOrders}
                  sx={{
                    textTransform: "none",
                    borderRadius: "10px",
                    px: 2,
                    py: 0.8,
                  }}
                >
                  {backfillingPaymentIds
                    ? "Backfilling Txn IDs..."
                    : "Backfill Successful Txn IDs"}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleRepairPaidOrders}
                  disabled={backfillingPaymentIds || repairingPaidOrders}
                  sx={{
                    textTransform: "none",
                    borderRadius: "10px",
                    px: 2,
                    py: 0.8,
                  }}
                >
                  {repairingPaidOrders
                    ? "Repairing Paid Orders..."
                    : "Repair Paid Orders"}
                </Button>
              </>
            ) : null}
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
            <Select
              size="small"
              value={statusFilter}
              onChange={handleStatusChange}
              displayEmpty
              sx={{
                minWidth: 180,
                borderRadius: "10px",
                backgroundColor: "#f9fafb",
              }}
            >
              <MenuItem value="all">All Orders</MenuItem>
              <MenuItem value="successful">Successful Orders</MenuItem>
              <MenuItem value="failed">Failed Orders</MenuItem>
            </Select>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Order..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 bg-gray-50 rounded-lg w-full sm:w-[300px] outline-none focus:border-blue-500"
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

        {refreshing ? (
          <div className="text-xs text-gray-500 mt-2">
            Refreshing live data...
          </div>
        ) : null}

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
            {primaryOrders.length > 0 ? (
              <OrdersTable
                orders={primaryOrders}
                token={token}
                onStatusUpdate={fetchOrders}
                canManageStatus={canManageStatus}
              />
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                No orders matched this view.
              </div>
            )}

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
