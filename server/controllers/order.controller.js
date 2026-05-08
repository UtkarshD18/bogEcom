/**
 * Production-Grade Order Controller
 * Complete API logic for order creation, payment, verification, and management
 * with comprehensive error handling and logging
 */

import crypto from "crypto";
import fsPromises from "fs/promises";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { getAccessTokenSecret } from "../config/authSecrets.js";
import { sendTemplatedEmail } from "../config/emailService.js";
import { checkExclusiveAccess } from "../middlewares/membershipGuard.js";
import AddressModel from "../models/address.model.js";
import CategoryModel from "../models/category.model.js";
import ComboModel from "../models/combo.model.js";
import ComboOrderModel from "../models/comboOrder.model.js";
import CouponModel from "../models/coupon.model.js";
import InvoiceModel from "../models/invoice.model.js";
import NewsletterModel from "../models/newsletter.model.js";
import OrderModel, {
  generateFinalOrderId,
  normalizeTempOrderId,
} from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import PurchaseOrderModel from "../models/purchaseOrder.model.js";
import SettingsModel from "../models/settings.model.js";
import UserModel from "../models/user.model.js";
import { emitOrderStatusUpdate } from "../realtime/orderEvents.js";
import { emitTrackingEvent } from "../services/analytics/trackingEmitter.service.js";
import { autoCreateShipmentForPaidOrder } from "../services/automatedShipping.service.js";
import {
  applyRedemptionToUser,
  awardCoinsToUser,
} from "../services/coin.service.js";
import {
  buildComboOrderSnapshot,
  computeComboAvailability,
  confirmComboStock,
  evaluateComboEligibility,
  expandComboToOrderProducts,
  isComboEligibleForSegment,
  releaseComboStock,
  reserveComboStock,
  resolveComboUnitOriginalTotal,
  resolveEffectiveComboUnitPrice,
  resolveUserSegment,
  restoreComboStock,
} from "../services/combos/combo.service.js";
import { syncOrderContactToCrmSafely } from "../services/crm/crmAutoSync.service.js";
import { captureCrmTouchpointSafely } from "../services/crm/crmTracking.service.js";
import { createEmailLog } from "../services/emailAutomation.service.js";
import {
  confirmInventory,
  getReservationExpiryDate,
  releaseInventory,
  reserveInventory,
  restoreInventory,
} from "../services/inventory.service.js";
import {
  expireOrderReservation,
  registerReservationExpiryListener,
  releaseExpiredReservations,
} from "../services/inventoryReservationExpiry.service.js";
import {
  createPaytmPayment,
  getPaytmStatus,
} from "../services/paytm.service.js";
import {
  createPhonePePayment,
  getPhonePeOrderStatus,
} from "../services/phonepe.service.js";
import { trackRestockConversionsForOrder } from "../services/productAvailabilityAnalytics.service.js";
import {
  getShippingQuote,
  validateIndianPincode,
} from "../services/shippingRate.service.js";
import { syncActiveStockReservations } from "../services/stockReservation.service.js";
import { splitGstInclusiveAmount } from "../services/tax.service.js";
import { createUserLocationLog } from "../services/userLocationLog.service.js";
import {
  buildLegacyGuestDetails,
  buildOrderAddressSnapshot,
  composeAddressLine1,
  INDIA_COUNTRY,
  normalizeStructuredAddress,
  serializeAddressDocument,
  validateStructuredAddress,
} from "../utils/addressUtils.js";
import {
  calculateOrderTotal,
  normalizeOrderForResponse,
} from "../utils/calculateOrderTotal.js";
import {
  AppError,
  asyncHandler,
  handleDatabaseError,
  logger,
  sendError,
  sendSuccess,
  validateMongoId,
  validateProductsArray,
} from "../utils/errorHandler.js";
import {
  generateInvoicePdf,
  getAbsolutePathFromStoredInvoicePath,
} from "../utils/generateInvoicePdf.js";
import isPrivilegedAdminRole from "../utils/isPrivilegedAdminRole.js";
import { syncOrderToFirestore } from "../utils/orderFirestoreSync.js";
import { saveDocumentWithTempIdRetry } from "../utils/orderPersistence.js";
import {
  applyOrderStatusTransition,
  normalizeOrderStatus,
  ORDER_STATUS,
} from "../utils/orderStatus.js";
import {
  resolveOrderAwb,
  resolveOrderTrackingUrl,
} from "../utils/orderTracking.js";
import { runWithBackgroundJobLease } from "../utils/backgroundJobLease.js";
import { formatDateTimeIST } from "../utils/pricingEngine.js";
import {
  calculateInfluencerCommission,
  calculateReferralDiscount,
  updateInfluencerStats,
} from "./influencer.controller.js";

// ==================== PAYMENT PROVIDER CONFIGURATION ====================

const PAYMENT_PROVIDERS = Object.freeze({
  PHONEPE: "PHONEPE",
  PAYTM: "PAYTM",
});
const DEFAULT_PAYMENT_PROVIDER = PAYMENT_PROVIDERS.PHONEPE;
const configuredPaymentProvider = String(
  process.env.PAYMENT_PROVIDER || DEFAULT_PAYMENT_PROVIDER,
)
  .trim()
  .toUpperCase();
const PAYTM_MERCHANT_ID = String(process.env.PAYTM_MERCHANT_ID || "").trim();
const PAYTM_MERCHANT_KEY = String(process.env.PAYTM_MERCHANT_KEY || "").trim();
const PHONEPE_CLIENT_ID = String(process.env.PHONEPE_CLIENT_ID || "").trim();
const PHONEPE_CLIENT_SECRET = String(
  process.env.PHONEPE_CLIENT_SECRET || "",
).trim();
const isValidPaytmMerchantKey = (value) =>
  [16, 24, 32].includes(String(value || "").trim().length);
const isTruthyEnv = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  );
};
const PAYMENT_PROVIDER_ENV_ENABLED = Object.freeze({
  PAYTM: Boolean(
    isTruthyEnv(process.env.PAYTM_ENABLED) &&
    PAYTM_MERCHANT_ID &&
    isValidPaytmMerchantKey(PAYTM_MERCHANT_KEY),
  ),
  PHONEPE: Boolean(
    isTruthyEnv(process.env.PHONEPE_ENABLED) &&
    PHONEPE_CLIENT_ID &&
    PHONEPE_CLIENT_SECRET,
  ),
});
const getEnabledPaymentProviders = () =>
  Object.entries(PAYMENT_PROVIDER_ENV_ENABLED)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([provider]) => provider);
const normalizeSupportedPaymentProvider = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  return Object.values(PAYMENT_PROVIDERS).includes(normalized)
    ? normalized
    : "";
};
const resolveDefaultPaymentProvider = () => {
  const requested = configuredPaymentProvider;
  const isSupported = Object.values(PAYMENT_PROVIDERS).includes(requested);
  if (isSupported && PAYMENT_PROVIDER_ENV_ENABLED[requested]) {
    return requested;
  }

  const orderedProviders =
    requested === PAYMENT_PROVIDERS.PHONEPE
      ? [PAYMENT_PROVIDERS.PHONEPE, PAYMENT_PROVIDERS.PAYTM]
      : [PAYMENT_PROVIDERS.PAYTM, PAYMENT_PROVIDERS.PHONEPE];
  return (
    orderedProviders.find(
      (provider) => PAYMENT_PROVIDER_ENV_ENABLED[provider],
    ) || null
  );
};
const PAYMENT_PROVIDER = resolveDefaultPaymentProvider();
const PAYMENT_ENV_ENABLED = Boolean(
  Object.values(PAYMENT_PROVIDER_ENV_ENABLED).some(Boolean),
);
const getRuntimeDefaultPaymentProvider = async () => {
  const paymentProviderSetting = await getCachedSetting(
    "defaultPaymentProvider",
  );
  const preferredProvider =
    normalizeSupportedPaymentProvider(paymentProviderSetting?.value) ||
    PAYMENT_PROVIDER ||
    DEFAULT_PAYMENT_PROVIDER;

  if (preferredProvider && PAYMENT_PROVIDER_ENV_ENABLED[preferredProvider]) {
    return preferredProvider;
  }

  const orderedProviders =
    preferredProvider === PAYMENT_PROVIDERS.PAYTM
      ? [PAYMENT_PROVIDERS.PAYTM, PAYMENT_PROVIDERS.PHONEPE]
      : [PAYMENT_PROVIDERS.PHONEPE, PAYMENT_PROVIDERS.PAYTM];

  return (
    orderedProviders.find(
      (provider) => PAYMENT_PROVIDER_ENV_ENABLED[provider],
    ) ||
    getEnabledPaymentProviders()[0] ||
    null
  );
};
const resolvePaymentProviderForRequest = async (requestedProvider) => {
  const normalized = String(requestedProvider || "")
    .trim()
    .toUpperCase();
  if (normalized) {
    if (!Object.values(PAYMENT_PROVIDERS).includes(normalized)) {
      throw new AppError("INVALID_PAYMENT_METHOD", {
        provider: normalized,
      });
    }
    if (!PAYMENT_PROVIDER_ENV_ENABLED[normalized]) {
      throw new AppError("PAYMENT_DISABLED", {
        provider: normalized,
        enabledProviders: getEnabledPaymentProviders(),
      });
    }
    return normalized;
  }

  const runtimeDefaultProvider = await getRuntimeDefaultPaymentProvider();
  if (runtimeDefaultProvider) return runtimeDefaultProvider;

  throw new AppError("PAYMENT_DISABLED", {
    enabledProviders: getEnabledPaymentProviders(),
  });
};

const SETTINGS_CACHE_TTL_MS = (() => {
  const configured = Number.parseInt(
    String(process.env.SETTINGS_CACHE_TTL_MS || "").trim(),
    10,
  );
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return 60 * 1000;
})();
const settingsCache = new Map();

const getCachedSetting = async (key) => {
  const cached = settingsCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < SETTINGS_CACHE_TTL_MS) {
    return cached;
  }

  const setting = await SettingsModel.findOne({ key })
    .select("value updatedBy")
    .lean();

  const record = {
    value: setting?.value,
    updatedBy: setting?.updatedBy || null,
    fetchedAt: Date.now(),
  };
  settingsCache.set(key, record);
  return record;
};

const isPaymentEnabled = async () => {
  const envEnabled = PAYMENT_ENV_ENABLED;

  if (!envEnabled) return false;

  const paymentSetting = await getCachedSetting("paymentGatewayEnabled");
  // Respect admin toggle (default ON if setting missing)
  if (paymentSetting?.value === undefined || paymentSetting?.value === null) {
    return true;
  }

  return Boolean(paymentSetting.value);
};

const isMaintenanceMode = async () => {
  const maintenanceSetting = await getCachedSetting("maintenanceMode");
  return Boolean(maintenanceSetting?.value);
};

const ORDER_SERIES_DEFAULTS = Object.freeze({
  prefix: "H1G",
  padding: 4,
});

const escapeRegExp = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveFinancialYearCode = (date = new Date()) => {
  const current = date instanceof Date ? date : new Date(date);
  const year = current.getFullYear();
  const month = current.getMonth();
  const fyStartYear = month >= 3 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  return `${String(fyStartYear).slice(-2)}${String(fyEndYear).slice(-2)}`;
};

const resolveOrderSeriesSettings = async () => {
  const orderSettings = await getCachedSetting("orderSettings");
  const rawPrefix = String(
    orderSettings?.value?.orderSeriesPrefix || ORDER_SERIES_DEFAULTS.prefix,
  )
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  const rawPadding = Number(orderSettings?.value?.orderSeriesPadding);

  return {
    prefix: rawPrefix || ORDER_SERIES_DEFAULTS.prefix,
    padding: Math.min(
      8,
      Math.max(
        3,
        Number.isFinite(rawPadding)
          ? rawPadding
          : ORDER_SERIES_DEFAULTS.padding,
      ),
    ),
  };
};

const parseOrderSequenceNumber = (value, scopePrefix) => {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return null;
  const normalizedScope = String(scopePrefix || "").toUpperCase();
  const legacyScope = normalizedScope.replace("-", "");

  let sequenceText = "";
  if (raw.startsWith(normalizedScope)) {
    sequenceText = raw.slice(normalizedScope.length);
  } else if (raw.startsWith(legacyScope)) {
    sequenceText = raw.slice(legacyScope.length);
  } else {
    return null;
  }
  const sequence = Number(sequenceText);
  return Number.isFinite(sequence) && sequence > 0 ? sequence : null;
};

const isValidNewsletterEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const captureOrderEmailInNewsletter = async ({
  req,
  email,
  userId,
  name,
  phone,
  orderId,
  orderAmount,
  sessionId,
  affiliateSource,
  influencerCode,
  isSavedOrder = false,
}) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  if (normalizedEmail && isValidNewsletterEmail(normalizedEmail)) {
    const source = userId ? "signin_order" : "guest_order";
    await NewsletterModel.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $setOnInsert: {
          email: normalizedEmail,
        },
        $set: {
          isActive: true,
          source,
        },
      },
      {
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  await syncOrderContactToCrmSafely({
    req,
    email: normalizedEmail,
    userId,
    name,
    phone,
    orderId,
    orderAmount,
    sessionId,
    affiliateSource,
    influencerCode,
    isSavedOrder,
  });
};

const generateOrderSeriesNumber = async (referenceDate = new Date()) => {
  const settings = await resolveOrderSeriesSettings();
  const fyCode = resolveFinancialYearCode(referenceDate);
  const scopePrefix = `${settings.prefix}-${fyCode}/`;
  const legacyScopePrefix = `${settings.prefix}${fyCode}/`;
  const regex = new RegExp(
    `^(?:${escapeRegExp(scopePrefix)}|${escapeRegExp(legacyScopePrefix)})\\d+$`,
    "i",
  );

  const latest = await OrderModel.findOne({ orderNumber: { $regex: regex } })
    .select("orderNumber")
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  let nextSequence =
    parseOrderSequenceNumber(latest?.orderNumber, scopePrefix) || 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    nextSequence += 1;
    const candidate = `${scopePrefix}${String(nextSequence).padStart(settings.padding, "0")}`;
    const exists = await OrderModel.exists({ orderNumber: candidate });
    if (!exists) return candidate;
  }

  const fallbackSequence = Date.now().toString().slice(-settings.padding);
  return `${scopePrefix}${fallbackSequence}`;
};

const isDateOnlyString = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeCouponDate = (value, boundary = "start") => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (isDateOnlyString(value)) {
    if (boundary === "end") {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
  }

  return date;
};

const resolveCouponEndDate = (endDate) => {
  if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
    return endDate;
  }

  const isMidnight =
    endDate.getHours() === 0 &&
    endDate.getMinutes() === 0 &&
    endDate.getSeconds() === 0 &&
    endDate.getMilliseconds() === 0;

  if (!isMidnight) return endDate;

  const adjusted = new Date(endDate);
  adjusted.setHours(23, 59, 59, 999);
  return adjusted;
};

const recordCouponUsage = async (order) => {
  if (!order?.couponCode) return null;

  const couponCode = String(order.couponCode).toUpperCase().trim();
  if (!couponCode) return null;

  return CouponModel.findOneAndUpdate(
    { code: couponCode, "usedBy.orderId": { $ne: order._id } },
    {
      $inc: { usageCount: 1 },
      $push: {
        usedBy: {
          user: order.user || null,
          orderId: order._id,
          usedAt: new Date(),
        },
      },
    },
    { new: true },
  );
};

const validateCouponForOrder = async ({
  code,
  orderAmount,
  userId,
  influencerCode,
}) => {
  const normalizedCode = code ? String(code).toUpperCase().trim() : null;
  if (!normalizedCode) {
    return { normalizedCode: null, discount: 0 };
  }

  const discountSettings =
    (await getCachedSetting("discountSettings"))?.value || {};

  // Admin-controlled rules
  const stackableCoupons = Boolean(discountSettings?.stackableCoupons);
  const hasInfluencerCode = Boolean(String(influencerCode || "").trim());
  if (!stackableCoupons && hasInfluencerCode) {
    return {
      errorMessage:
        "Coupons cannot be combined with referral/affiliate discounts",
    };
  }

  const safeOrderAmount = Math.max(round2(orderAmount), 0);
  const maxDiscountPercentage = Number(discountSettings?.maxDiscountPercentage);
  const maxDiscountByPercent =
    Number.isFinite(maxDiscountPercentage) && maxDiscountPercentage > 0
      ? (safeOrderAmount * maxDiscountPercentage) / 100
      : null;

  const applyGlobalDiscountCaps = (discount) => {
    let capped = Math.max(round2(discount), 0);
    if (maxDiscountByPercent !== null) {
      capped = Math.min(capped, maxDiscountByPercent);
    }
    return Math.min(capped, safeOrderAmount);
  };

  // First order discount (system-controlled) - tied to the offer popup coupon code
  const firstOrderConfig = discountSettings?.firstOrderDiscount || {};
  const firstOrderEnabled = Boolean(firstOrderConfig?.enabled);
  const offerCouponCode = String(
    (await getCachedSetting("offerCouponCode"))?.value || "",
  )
    .trim()
    .toUpperCase();

  if (
    firstOrderEnabled &&
    offerCouponCode &&
    normalizedCode === offerCouponCode
  ) {
    if (userId) {
      const hasPriorOrders = await OrderModel.exists({
        user: userId,
        $or: [
          { payment_status: "paid" },
          {
            order_status: {
              $in: [
                "accepted",
                "confirmed",
                "in_warehouse",
                "shipped",
                "out_for_delivery",
                "delivered",
                "rto",
                "rto_completed",
              ],
            },
          },
        ],
      });
      if (hasPriorOrders) {
        return {
          errorMessage: "This coupon is valid only on your first order",
        };
      }
    }

    // Use actual coupon document values if the coupon exists in the DB,
    // otherwise fall back to firstOrderDiscount settings
    const offerCoupon = await CouponModel.findOne({
      code: normalizedCode,
      isActive: true,
    });

    const percentage = offerCoupon
      ? Math.max(Number(offerCoupon.discountValue || 0), 0)
      : Math.max(Number(firstOrderConfig?.percentage || 0), 0);
    const maxDiscount = offerCoupon
      ? Math.max(Number(offerCoupon.maxDiscountAmount || 0), 0)
      : Math.max(Number(firstOrderConfig?.maxDiscount || 0), 0);

    const computed =
      safeOrderAmount > 0 ? (safeOrderAmount * percentage) / 100 : 0;
    const discountAmount = applyGlobalDiscountCaps(
      maxDiscount > 0 ? Math.min(computed, maxDiscount) : computed,
    );

    return { normalizedCode, discount: discountAmount };
  }

  const coupon = await CouponModel.findOne({
    code: normalizedCode,
    isActive: true,
  });

  if (!coupon) {
    return { errorMessage: "Invalid coupon code" };
  }

  const now = new Date();
  const startDate = normalizeCouponDate(coupon.startDate, "start");
  const endDate = resolveCouponEndDate(coupon.endDate);

  if (startDate && now < startDate) {
    return { errorMessage: "This coupon is not yet active" };
  }

  if (endDate && now > endDate) {
    return { errorMessage: "This coupon has expired" };
  }

  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    return { errorMessage: "This coupon has reached its usage limit" };
  }

  if (orderAmount < coupon.minOrderAmount) {
    return {
      errorMessage: `Minimum order of ₹${coupon.minOrderAmount} required for this coupon`,
    };
  }

  if (userId && coupon.perUserLimit > 0) {
    const userUsage = coupon.usedBy.filter(
      (u) => u.user && u.user.toString() === userId.toString(),
    ).length;
    if (userUsage >= coupon.perUserLimit) {
      return {
        errorMessage:
          "You have already used this coupon the maximum number of times",
      };
    }
  }

  const discount = applyGlobalDiscountCaps(
    coupon.calculateDiscount(safeOrderAmount),
  );
  return { normalizedCode, discount };
};

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const roundToNearestRupee = (value) => Math.round(Number(value || 0));

const resolveGatewayPayableAmount = (value) =>
  Math.max(roundToNearestRupee(value), 1);

const buildRoundedPricing = (value) => {
  const finalAmount = Math.max(round2(Number(value || 0)), 0);
  const roundedAmount = resolveGatewayPayableAmount(finalAmount);
  return {
    finalAmount,
    roundedAmount,
    roundOff: round2(roundedAmount - finalAmount),
  };
};

const resolveInfluencerCommissionBase = (order = {}) => {
  const taxableSubtotal = Number(
    order?.subtotal ?? order?.gst?.taxableAmount ?? 0,
  );
  if (Number.isFinite(taxableSubtotal) && taxableSubtotal > 0) {
    return round2(taxableSubtotal);
  }

  const finalAmount = Number(order?.finalAmount ?? 0);
  if (Number.isFinite(finalAmount) && finalAmount > 0) {
    return round2(finalAmount);
  }

  const totalAmount = Number(order?.totalAmt ?? 0);
  if (Number.isFinite(totalAmount) && totalAmount > 0) {
    return round2(totalAmount);
  }

  return 0;
};

const getPrimaryStoreUrl = () =>
  String(
    process.env.CLIENT_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://healthyonegram.com",
  )
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");

const getSupportContactEmail = () =>
  String(
    process.env.SUPPORT_ADMIN_EMAIL ||
      process.env.SUPPORT_EMAIL ||
      process.env.EMAIL_FROM_ADDRESS ||
      process.env.SMTP_USER ||
      "support@healthyonegram.com",
  )
    .trim()
    .toLowerCase();

const getSupportContactUrl = () => `${getPrimaryStoreUrl()}/contact`;

const CONTROLLER_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEST_INVOICE_EXPORT_DIR = path.resolve(
  CONTROLLER_DIR,
  "../invoices/local-test-invoices",
);

const sanitizeFileComponent = (value, fallback = "test_invoice") => {
  const normalized = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
};

const normalizePathForResponse = (absolutePath) => {
  if (!absolutePath) return "";
  const relative = path.relative(process.cwd(), absolutePath);
  if (!relative || relative.startsWith("..")) {
    return absolutePath.replace(/\\/g, "/");
  }
  return relative.replace(/\\/g, "/");
};

const persistInvoiceSnapshotToDisk = async ({
  filenameSeed,
  payload,
  invoicePath = "",
  context = "persistInvoiceSnapshotToDisk",
}) => {
  const safeName = sanitizeFileComponent(
    filenameSeed,
    `test_invoice_${Date.now()}`,
  );
  const jsonAbsolutePath = path.join(
    TEST_INVOICE_EXPORT_DIR,
    `${safeName}.json`,
  );

  try {
    await fsPromises.mkdir(TEST_INVOICE_EXPORT_DIR, { recursive: true });
    await fsPromises.writeFile(
      jsonAbsolutePath,
      JSON.stringify(payload, null, 2),
      "utf8",
    );

    let pdfAbsolutePath = "";
    const sourcePdfPath = invoicePath
      ? getAbsolutePathFromStoredInvoicePath(invoicePath)
      : null;
    if (sourcePdfPath) {
      const pdfExt = path.extname(sourcePdfPath) || ".pdf";
      pdfAbsolutePath = path.join(
        TEST_INVOICE_EXPORT_DIR,
        `${safeName}${pdfExt}`,
      );
      const sourceResolved = path.resolve(sourcePdfPath);
      const destinationResolved = path.resolve(pdfAbsolutePath);
      if (sourceResolved !== destinationResolved) {
        await fsPromises.copyFile(sourceResolved, destinationResolved);
      }
    }

    return {
      ok: true,
      folder: normalizePathForResponse(TEST_INVOICE_EXPORT_DIR),
      jsonPath: normalizePathForResponse(jsonAbsolutePath),
      pdfPath: normalizePathForResponse(pdfAbsolutePath),
    };
  } catch (error) {
    logger.error(context, "Failed to persist invoice snapshot on disk", {
      error: error?.message || String(error),
      folder: TEST_INVOICE_EXPORT_DIR,
      invoicePath,
    });
    return {
      ok: false,
      folder: normalizePathForResponse(TEST_INVOICE_EXPORT_DIR),
      jsonPath: normalizePathForResponse(jsonAbsolutePath),
      pdfPath: "",
      error: error?.message || "Failed to persist invoice snapshot",
    };
  }
};

const formatInr = (value) => `Rs. ${round2(value).toFixed(2)}`;

const FINAL_ORDER_ID_PATTERN = /^[A-Z0-9]+-\d{4}\/\d{4}$/;

const resolveOrderPublicIdentifier = (order = {}) => {
  const tempId = normalizeTempOrderId(order?.temp_id);
  if (tempId) return tempId;

  const rawOrderId = String(order?._id || "").trim();
  return rawOrderId || "";
};

const resolveOrderLookupFilter = (identifier) => {
  const rawIdentifier = String(identifier || "").trim();
  if (!rawIdentifier) return null;

  const tempId = normalizeTempOrderId(rawIdentifier);
  if (tempId) {
    return { temp_id: tempId };
  }

  if (mongoose.Types.ObjectId.isValid(rawIdentifier)) {
    return { _id: rawIdentifier };
  }

  return null;
};

const findOrderByIdentifier = async (identifier, { lean = false } = {}) => {
  const filter = resolveOrderLookupFilter(identifier);
  if (!filter) return null;

  const query = OrderModel.findOne(filter);
  return lean ? query.lean() : query;
};

const buildGatewayMerchantTransactionId = (
  order,
  { includeRetrySuffix = false } = {},
) => {
  const baseReference =
    normalizeTempOrderId(order?.temp_id) || String(order?._id || "").trim();
  if (!baseReference) return "";

  if (!includeRetrySuffix) {
    return `BOG_${baseReference}`;
  }

  return `BOG_${baseReference}_${Date.now().toString(36).toUpperCase()}`;
};

const isDuplicateKeyError = (error) => Number(error?.code || 0) === 11000;

const assignFinalOrderIdAfterPaymentSuccess = async ({
  order,
  confirmedAt = new Date(),
}) => {
  if (!order?._id) {
    return { order, assigned: false, finalId: null };
  }

  const existingFinal = String(order.final_id || "")
    .trim()
    .toUpperCase();
  if (existingFinal && FINAL_ORDER_ID_PATTERN.test(existingFinal)) {
    order.final_id = existingFinal;
    order.orderNumber = existingFinal;
    order.displayOrderId = existingFinal;
    order.confirmed_at = order.confirmed_at || confirmedAt;
    order.confirmedAt = order.confirmedAt || order.confirmed_at;
    order.status = "confirmed";
    return { order, assigned: false, finalId: existingFinal };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const generatedFinalId = await generateFinalOrderId(
      order.createdAt || confirmedAt,
    );

    try {
      const updated = await OrderModel.findOneAndUpdate(
        {
          _id: order._id,
          $or: [{ final_id: null }, { final_id: "" }],
        },
        {
          $set: {
            final_id: generatedFinalId,
            orderNumber: generatedFinalId,
            displayOrderId: generatedFinalId,
            confirmed_at: confirmedAt,
            confirmedAt: confirmedAt,
            status: "confirmed",
          },
        },
        { new: true },
      );

      if (updated) {
        return { order: updated, assigned: true, finalId: generatedFinalId };
      }

      const latest = await OrderModel.findById(order._id);
      if (latest) {
        return {
          order: latest,
          assigned: false,
          finalId: String(latest.final_id || "")
            .trim()
            .toUpperCase(),
        };
      }

      return { order, assigned: false, finalId: null };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new AppError("CONFLICT", {
    field: "final_id",
    message: "Failed to allocate a unique final order ID",
  });
};

const resolveDisplayOrderNumber = (order = {}) => {
  const explicitDisplayId =
    order?.final_id ||
    order?.temp_id ||
    order?.displayOrderId ||
    order?.orderNumber ||
    order?.order_id ||
    order?.orderId ||
    "";
  if (String(explicitDisplayId || "").trim()) {
    return String(explicitDisplayId).trim().toUpperCase();
  }

  const rawOrderId = String(order?._id || "").trim();
  if (!rawOrderId) return "N/A";
  return `BOG-${rawOrderId.slice(-8).toUpperCase()}`;
};

const resolveOrderContactIdentity = (order = {}) => {
  const billing = order?.billingDetails || {};
  const guest = order?.guestDetails || {};
  const delivery = order?.deliveryAddressSnapshot || {};

  return {
    email: billing?.email || guest?.email || delivery?.email || "",
    phone:
      billing?.phone ||
      billing?.mobile ||
      guest?.phone ||
      guest?.mobile ||
      guest?.mobile_number ||
      delivery?.order_mobile ||
      "",
    name:
      billing?.fullName ||
      guest?.name ||
      guest?.full_name ||
      delivery?.order_name ||
      "",
  };
};

const emitPurchaseCompletedTrackingEvent = ({
  req,
  order,
  source = "unknown",
}) => {
  if (!req || !order) return;

  const orderId = String(order?._id || "").trim();
  if (!orderId) return;
  if (!order?.isDemoOrder) {
    const contactIdentity = resolveOrderContactIdentity(order);

    void captureCrmTouchpointSafely({
      channel: "website",
      eventType: "order_paid",
      userId: order?.user ? String(order.user) : null,
      email: contactIdentity.email,
      phone: contactIdentity.phone,
      name: contactIdentity.name,
      orderId,
      orderAmount: order?.finalAmount || order?.totalAmt || 0,
      sessionId: String(
        order?.trackingSessionId || req.analyticsSessionId || "",
      ),
      pageUrl: "/checkout",
      referrer: req?.headers?.referer || "",
      happenedAt: order?.confirmedAt || order?.confirmed_at || new Date(),
      idempotencyKey: `crm:order:${orderId}:paid`,
      metadata: {
        source,
        paymentMethod: String(order?.paymentMethod || "").trim() || "unknown",
        paymentStatus: String(order?.payment_status || "").trim() || "unknown",
        orderStatus: String(order?.order_status || "").trim() || "unknown",
        influencerCode: String(order?.influencerCode || "").trim() || null,
        couponCode: String(order?.couponCode || "").trim() || null,
        affiliateSource: order?.affiliateSource || null,
      },
    });
  }

  if (String(order?.analyticsConsent || "").toLowerCase() === "denied") return;

  const lineItems = Array.isArray(order?.products)
    ? order.products.slice(0, 100).map((item) => ({
        productId: String(item?.productId || "").trim(),
        productTitle: String(item?.productTitle || "").trim(),
        quantity: Number(item?.quantity || 0),
        price: Number(item?.price || 0),
        subTotal: Number(item?.subTotal || 0),
      }))
    : [];

  emitTrackingEvent({
    req,
    eventType: "purchase_completed",
    userId: order?.user ? String(order.user) : null,
    sessionId: String(order?.trackingSessionId || req.analyticsSessionId || ""),
    metadata: {
      source,
      orderId,
      orderNumber:
        String(order?.orderNumber || order?.displayOrderId || "").trim() ||
        null,
      paymentMethod: String(order?.paymentMethod || "").trim() || "unknown",
      paymentStatus: String(order?.payment_status || "").trim() || "unknown",
      orderStatus: String(order?.order_status || "").trim() || "unknown",
      revenue: Number(order?.finalAmount || order?.totalAmt || 0),
      subtotal: Number(order?.subtotal || 0),
      tax: Number(order?.tax || 0),
      shipping: Number(order?.shipping || 0),
      discount: Number(order?.discount || order?.discountAmount || 0),
      influencerCode: String(order?.influencerCode || "").trim() || null,
      couponCode: String(order?.couponCode || "").trim() || null,
      items: lineItems,
    },
    pageUrl: "/checkout",
    referrer: "",
    async: true,
  });

  const combos = Array.isArray(order?.combos) ? order.combos : [];
  combos.forEach((combo) => {
    if (!combo?.comboId) return;
    const quantity = Number(combo?.quantity || 1);
    const comboRevenue = Number(combo?.comboPrice || 0) * quantity;
    emitTrackingEvent({
      req,
      eventType: "combo_purchase",
      userId: order?.user ? String(order.user) : null,
      sessionId: String(
        order?.trackingSessionId || req.analyticsSessionId || "",
      ),
      metadata: {
        source,
        comboId: String(combo.comboId || ""),
        comboName: String(combo.comboName || ""),
        comboSlug: String(combo.comboSlug || ""),
        comboType: String(combo.comboType || ""),
        quantity,
        revenue: round2(comboRevenue),
        orderId,
      },
      pageUrl: "/checkout",
      referrer: "",
      async: true,
    });
  });
};

const resolveAnalyticsConsentFromRequest = (req) => {
  const normalized = String(
    req?.headers?.["x-analytics-consent"] ||
      req?.cookies?.analytics_consent ||
      req?.body?.consent ||
      "",
  )
    .trim()
    .toLowerCase();

  if (["granted", "allow", "opt_in", "yes", "true"].includes(normalized)) {
    return "granted";
  }
  if (["denied", "disallow", "opt_out", "no", "false"].includes(normalized)) {
    return "denied";
  }
  return "unknown";
};

const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildEmailMatchRegex = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return new RegExp(`^${escapeRegex(normalized)}$`, "i");
};

const getPayOrderTokenSecret = () => {
  const secret =
    process.env.PAY_ORDER_TOKEN_SECRET ||
    getAccessTokenSecret() ||
    process.env.ACCESS_TOKEN_SECRET ||
    process.env.SECRET_KEY_ACCESS_TOKEN ||
    process.env.JSON_WEB_TOKEN_SECRET_KEY ||
    "";
  return String(secret || "").trim();
};

const getPayOrderTokenTtlMs = () => {
  const raw = Number(process.env.PAY_ORDER_TOKEN_TTL_DAYS || 7);
  const days = Number.isFinite(raw) ? Math.max(raw, 1) : 7;
  return days * 24 * 60 * 60 * 1000;
};

const signPayOrderToken = ({ orderId, email, timestamp, secret }) =>
  crypto
    .createHmac("sha256", secret)
    .update(`${orderId}.${email}.${timestamp}`)
    .digest("hex");

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const formatOrderDateForEmail = (value) => {
  return formatDateTimeIST(value);
};

const stringifyOrderItemsForEmail = (order) => {
  const items = Array.isArray(order?.products) ? order.products : [];
  if (items.length === 0) return "No items found for this order.";

  return items
    .map((item, index) => {
      const name = String(item?.productTitle || item?.name || "Item").trim();
      const variantName = String(
        item?.variantName || item?.variantTitle || "",
      ).trim();
      const displayName =
        variantName && !name.toLowerCase().includes(variantName.toLowerCase())
          ? `${name} (${variantName})`
          : name;
      const quantity = Math.max(Number(item?.quantity || 0), 0);
      const unitPrice = round2(Number(item?.price || 0));
      const lineTotal = round2(
        Number(
          item?.subTotal || item?.subTotalAmt || item?.price * quantity || 0,
        ),
      );
      const unitLabel = unitPrice > 0 ? ` @ ${formatInr(unitPrice)}` : "";
      return `${index + 1}. ${displayName} x ${quantity}${unitLabel} = ${formatInr(lineTotal)}`;
    })
    .join("\n");
};

const resolveOrderRecipient = async (order) => {
  const contactIdentity = resolveOrderContactIdentity(order);
  const preferredName = String(contactIdentity?.name || "").trim();
  const fallbackName =
    preferredName || String(order?.user?.name || "").trim() || "Customer";
  const directEmail = String(contactIdentity?.email || order?.user?.email || "")
    .trim()
    .toLowerCase();

  if (directEmail) {
    return { email: directEmail, name: fallbackName };
  }

  const userId = order?.user?._id || order?.user || null;
  if (!userId) {
    return { email: "", name: fallbackName };
  }

  try {
    const user = await UserModel.findById(userId).select("email name").lean();
    const resolvedEmail = String(user?.email || "")
      .trim()
      .toLowerCase();
    const resolvedName =
      preferredName || String(user?.name || "").trim() || "Customer";
    return { email: resolvedEmail, name: resolvedName };
  } catch {
    return { email: "", name: fallbackName };
  }
};

const resolveOrderEmailForToken = async (order) => {
  const { email } = await resolveOrderRecipient(order);
  return normalizeEmail(email || "");
};

const generatePayOrderToken = async (order) => {
  const secret = getPayOrderTokenSecret();
  if (!secret) return "";
  const email = await resolveOrderEmailForToken(order);
  if (!email) return "";
  const issuedAt = Date.now();
  const orderReferenceId =
    resolveOrderPublicIdentifier(order) || String(order?._id || "").trim();
  const signature = signPayOrderToken({
    orderId: orderReferenceId,
    email,
    timestamp: issuedAt,
    secret,
  });
  return `${issuedAt.toString(36)}.${signature}`;
};

const verifyPayOrderToken = async (order, token) => {
  const secret = getPayOrderTokenSecret();
  if (!secret) {
    return { ok: false, reason: "missing_secret" };
  }

  const rawToken = String(token || "").trim();
  const [tsPart, signature] = rawToken.split(".");
  if (!tsPart || !signature) {
    return { ok: false, reason: "malformed_token" };
  }

  const issuedAt = Number.parseInt(tsPart, 36);
  if (!Number.isFinite(issuedAt)) {
    return { ok: false, reason: "invalid_timestamp" };
  }

  const ttlMs = getPayOrderTokenTtlMs();
  if (Date.now() - issuedAt > ttlMs) {
    return { ok: false, reason: "expired" };
  }

  const email = await resolveOrderEmailForToken(order);
  if (!email) {
    return { ok: false, reason: "missing_email" };
  }

  const orderReferenceId =
    resolveOrderPublicIdentifier(order) || String(order?._id || "").trim();

  const expected = signPayOrderToken({
    orderId: orderReferenceId,
    email,
    timestamp: issuedAt,
    secret,
  });

  if (!safeEqual(expected, signature)) {
    return { ok: false, reason: "invalid_signature" };
  }

  return { ok: true };
};

const buildPayOrderUrl = async (order) => {
  const token = await generatePayOrderToken(order);
  if (!token) return "";
  const siteUrl = getPrimaryStoreUrl();
  const orderReferenceId =
    resolveOrderPublicIdentifier(order) || String(order?._id || "").trim();
  return `${siteUrl}/pay-order/${encodeURIComponent(
    orderReferenceId,
  )}?key=${encodeURIComponent(token)}`;
};

const linkOrderToUserByEmail = async (order) => {
  if (!order || order.user) return false;
  const email = normalizeEmail(
    order?.billingDetails?.email || order?.guestDetails?.email || "",
  );
  const emailMatch = buildEmailMatchRegex(email);
  if (!emailMatch) return false;
  const user = await UserModel.findOne({ email: emailMatch })
    .select("_id")
    .lean();
  if (!user?._id) return false;
  order.user = user._id;
  return true;
};

const sendOrderConfirmationEmail = async (order) => {
  try {
    const { email: recipientEmail, name: customerName } =
      await resolveOrderRecipient(order);

    if (!recipientEmail) {
      logger.warn("sendOrderConfirmationEmail", "Recipient email missing", {
        orderId: order?._id,
      });
      return false;
    }

    const rawOrderId = String(order?._id || "").trim();
    const displayOrderNumber = resolveDisplayOrderNumber(order);
    const supportContact = getSupportContactEmail();
    const supportUrl = getSupportContactUrl();
    const siteUrl = getPrimaryStoreUrl();
    const normalizedPaymentStatus = String(order?.payment_status || "")
      .trim()
      .toLowerCase();
    const normalizedOrderStatus = normalizeOrderStatus(order?.order_status);
    const pendingStatuses = new Set([
      ORDER_STATUS.PENDING,
      ORDER_STATUS.PAYMENT_PENDING,
    ]);
    const canPayNow =
      normalizedPaymentStatus !== "paid" &&
      pendingStatuses.has(normalizedOrderStatus);
    const paymentUrl = canPayNow ? await buildPayOrderUrl(order) : "";
    const hasPaymentLink = Boolean(paymentUrl);
    const paymentCtaLabel = hasPaymentLink ? "Pay Now" : "View Store";
    const safePaymentUrl = paymentUrl || siteUrl;
    const pricingSnapshot = order?.pricing || {};

    const originalSubtotal = round2(
      Number(
        pricingSnapshot.originalPrice ||
          order?.originalPrice ||
          Number(order?.subtotal || 0) + Number(order?.discount || 0) ||
          0,
      ),
    );
    const discount = round2(
      Number(
        pricingSnapshot.discount ||
          order?.discount ||
          order?.discountAmount ||
          0,
      ) + Number(order?.coinRedemption?.amount || 0),
    );
    const taxableAmount = round2(
      Number(pricingSnapshot.discountedPrice || order?.subtotal || 0),
    );
    const taxAmount = round2(Number(pricingSnapshot.gst || order?.tax || 0));
    const shippingAmount = round2(Number(order?.shipping || 0));
    const finalAmount = round2(
      Number(
        pricingSnapshot.roundedTotal ||
          order?.roundedAmount ||
          order?.finalAmount ||
          order?.totalAmt ||
          0,
      ),
    );
    const roundOff = round2(
      Number(pricingSnapshot.roundOff || order?.roundOff || 0),
    );

    const awbNumber = resolveOrderAwb(order);
    const trackingUrl = resolveOrderTrackingUrl(order);

    const estimatedDeliveryDate =
      order?.deliveryDate || order?.delivery_date
        ? new Date(order?.deliveryDate || order?.delivery_date)
        : new Date(
            new Date(order?.createdAt || Date.now()).getTime() +
              7 * 24 * 60 * 60 * 1000,
          );

    const attachments = [];
    try {
      const [sellerDetails, productMetaById] = await Promise.all([
        getInvoiceSellerDetails(),
        getOrderProductMetadata(order),
      ]);

      const invoiceResult = await generateInvoicePdf({
        order,
        sellerDetails,
        productMetaById,
      });

      const absolutePath =
        invoiceResult?.absolutePath ||
        getAbsolutePathFromStoredInvoicePath(invoiceResult?.invoicePath || "");
      if (absolutePath) {
        const invoiceBuffer = await fsPromises.readFile(absolutePath);
        const invoiceFileName = `invoice-${displayOrderNumber.replace(/[^a-zA-Z0-9-_]/g, "") || rawOrderId}.pdf`;
        attachments.push({
          filename: invoiceFileName,
          content: invoiceBuffer,
          contentType: "application/pdf",
        });
      }
    } catch (invoiceError) {
      logger.warn("sendOrderConfirmationEmail", "Invoice attachment skipped", {
        orderId: order?._id,
        error: invoiceError?.message || String(invoiceError),
      });
    }

    const text = [
      `Order No: ${displayOrderNumber}`,
      `Order ID: ${rawOrderId || "N/A"}`,
      `Order created successfully.`,
      `Status: ${order?.order_status || "pending"}`,
      `Payment: ${order?.payment_status || "pending"}`,
      `Final Amount: ${formatInr(finalAmount)}`,
      `Round Off: ${formatInr(roundOff)}`,
      `Estimated Delivery: ${estimatedDeliveryDate.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
      })} IST`,
      awbNumber ? `AWB: ${awbNumber}` : "",
      trackingUrl ? `Track Shipment: ${trackingUrl}` : "",
      hasPaymentLink ? `Pay now: ${paymentUrl}` : "",
      `Support: ${supportContact}`,
    ].join("\n");

    const result = await sendTemplatedEmail({
      to: recipientEmail,
      subject: `Order Confirmation - ${displayOrderNumber}`,
      templateFile: "orderConfirmation.html",
      templateData: {
        customer_name: customerName,
        order_number: displayOrderNumber,
        order_id: rawOrderId || "N/A",
        order_date: formatOrderDateForEmail(order?.createdAt),
        order_status: String(order?.order_status || "pending"),
        payment_status: String(order?.payment_status || "pending"),
        items_text: stringifyOrderItemsForEmail(order),
        subtotal: formatInr(originalSubtotal),
        discount: formatInr(discount),
        taxable_amount: formatInr(taxableAmount),
        tax_amount: formatInr(taxAmount),
        shipping_amount: formatInr(shippingAmount),
        round_off: formatInr(roundOff),
        final_amount: formatInr(finalAmount),
        estimated_delivery_date: `${estimatedDeliveryDate.toLocaleDateString(
          "en-IN",
          {
            timeZone: "Asia/Kolkata",
          },
        )} IST`,
        awb_number: awbNumber,
        tracking_url: trackingUrl,
        site_url: siteUrl,
        payment_url: safePaymentUrl,
        payment_cta_label: paymentCtaLabel,
        support_contact: supportContact,
        support_url: supportUrl,
        year: String(new Date().getFullYear()),
      },
      text,
      context: "order.confirmation",
      attachments,
    });

    if (!result?.success) {
      logger.warn("sendOrderConfirmationEmail", "Email send failed", {
        orderId: order?._id,
        recipientEmail,
        error: result?.error || "Unknown error",
      });
      return false;
    }

    if (
      order?.confirmationEmailSentAt == null &&
      typeof order?.save === "function"
    ) {
      try {
        order.confirmationEmailSentAt = new Date();
        await order.save();
      } catch (persistError) {
        logger.warn(
          "sendOrderConfirmationEmail",
          "Failed to persist sent flag",
          {
            orderId: order?._id,
            error: persistError?.message || String(persistError),
          },
        );
      }
    }

    return true;
  } catch (error) {
    logger.error("sendOrderConfirmationEmail", "Unexpected email error", {
      orderId: order?._id,
      error: error?.message || String(error),
    });
    return false;
  }
};

const sendOrderPaymentSuccessEmail = async (
  order,
  { paymentProvider = null } = {},
) => {
  try {
    const { email: recipientEmail, name: customerName } =
      await resolveOrderRecipient(order);

    if (!recipientEmail) {
      logger.warn("sendOrderPaymentSuccessEmail", "Recipient email missing", {
        orderId: order?._id,
      });
      return false;
    }

    const rawOrderId = String(order?._id || "").trim();
    const displayOrderNumber = resolveDisplayOrderNumber(order);
    const supportContact = getSupportContactEmail();
    const supportUrl = getSupportContactUrl();
    const siteUrl = getPrimaryStoreUrl();
    const actionUrl =
      order?.user && rawOrderId
        ? `${siteUrl}/orders/${encodeURIComponent(rawOrderId)}`
        : siteUrl;
    const providerLabel = resolvePaymentProviderLabel(
      paymentProvider || order?.paymentMethod,
    );
    const pricingSnapshot = order?.pricing || {};
    const finalAmount = round2(
      Number(
        pricingSnapshot.roundedTotal ||
          order?.roundedAmount ||
          order?.finalAmount ||
          order?.totalAmt ||
          0,
      ),
    );
    const roundOff = round2(
      Number(pricingSnapshot.roundOff || order?.roundOff || 0),
    );

    const text = [
      `Order No: ${displayOrderNumber}`,
      `Order ID: ${rawOrderId || "N/A"}`,
      `Payment provider: ${providerLabel}`,
      `Payment status: paid`,
      `Final Amount: ${formatInr(finalAmount)}`,
      `Round Off: ${formatInr(roundOff)}`,
      `Open: ${actionUrl}`,
      `Support: ${supportContact}`,
    ].join("\n");

    const result = await sendTemplatedEmail({
      to: recipientEmail,
      subject: `Payment Received - ${displayOrderNumber}`,
      templateFile: "orderPaymentSuccess.html",
      templateData: {
        customer_name: customerName,
        order_number: displayOrderNumber,
        order_id: rawOrderId || "N/A",
        order_date: formatOrderDateForEmail(order?.createdAt),
        order_status: String(order?.order_status || "accepted"),
        payment_provider: providerLabel,
        items_text: stringifyOrderItemsForEmail(order),
        round_off: formatInr(roundOff),
        final_amount: formatInr(finalAmount),
        action_url: actionUrl,
        site_url: siteUrl,
        support_contact: supportContact,
        support_url: supportUrl,
        year: String(new Date().getFullYear()),
      },
      text,
      context: "order.payment_success",
    });

    if (!result?.success) {
      logger.warn("sendOrderPaymentSuccessEmail", "Email send failed", {
        orderId: order?._id,
        recipientEmail,
        error: result?.error || "Unknown error",
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("sendOrderPaymentSuccessEmail", "Unexpected email error", {
      orderId: order?._id,
      error: error?.message || String(error),
    });
    return false;
  }
};

const sendOrderCancelledEmail = async (order) => {
  try {
    const { email: recipientEmail, name: customerName } =
      await resolveOrderRecipient(order);

    if (!recipientEmail) {
      logger.warn("sendOrderCancelledEmail", "Recipient email missing", {
        orderId: order?._id,
      });
      return false;
    }

    const rawOrderId = String(order?._id || "").trim();
    const displayOrderNumber = resolveDisplayOrderNumber(order);
    const supportContact = getSupportContactEmail();
    const supportUrl = getSupportContactUrl();
    const siteUrl = getPrimaryStoreUrl();
    const pricingSnapshot = order?.pricing || {};

    const text = [
      `Order No: ${displayOrderNumber}`,
      `Order ID: ${rawOrderId || "N/A"}`,
      `Status: cancelled`,
      `Support: ${supportContact}`,
    ].join("\n");

    const result = await sendTemplatedEmail({
      to: recipientEmail,
      subject: `Order Cancelled - ${displayOrderNumber}`,
      templateFile: "orderCancelled.html",
      templateData: {
        customer_name: customerName,
        order_number: displayOrderNumber,
        order_id: rawOrderId || "N/A",
        order_date: formatOrderDateForEmail(order?.createdAt),
        order_status: "cancelled",
        items_text: stringifyOrderItemsForEmail(order),
        site_url: siteUrl,
        support_contact: supportContact,
        support_url: supportUrl,
        year: String(new Date().getFullYear()),
      },
      text,
      context: "order.cancelled",
    });

    if (!result?.success) {
      logger.warn("sendOrderCancelledEmail", "Email send failed", {
        orderId: order?._id,
        recipientEmail,
        error: result?.error || "Unknown error",
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("sendOrderCancelledEmail", "Unexpected email error", {
      orderId: order?._id,
      error: error?.message || String(error),
    });
    return false;
  }
};

const clearOrderPaymentReminderState = (order) => {
  if (!order) return;
  order.paymentReminderEmailSentAt = null;
  order.paymentReminderEmailFailureKind = "";
  order.paymentReminderEmailProvider = "";
};

const PAYMENT_PENDING_ORDER_STATUSES = new Set([
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PAYMENT_PENDING,
]);

const resolveReservationSecondsRemaining = (
  reservationExpiresAt,
  now = new Date(),
) => {
  if (!reservationExpiresAt) return 0;
  const expiry = new Date(reservationExpiresAt);
  if (Number.isNaN(expiry.getTime())) return 0;

  const remainingMs = expiry.getTime() - now.getTime();
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
};

const flushExpiredReservationsSafely = async (
  context = "reservationCleanup",
) => {
  try {
    await releaseExpiredReservations();
  } catch (error) {
    logger.warn(context, "Failed to flush expired reservations", {
      error: error?.message || String(error),
    });
  }
};

const ensureOrderHasActiveReservationForPayment = async (
  order,
  {
    source = "PAYMENT_PAGE",
    refreshExpiry = true,
    throwOnUnavailable = true,
  } = {},
) => {
  if (!order) {
    throw new AppError("ORDER_NOT_FOUND");
  }

  const now = new Date();
  const normalizedPaymentStatus = String(order.payment_status || "")
    .trim()
    .toLowerCase();

  if (normalizedPaymentStatus === "paid") {
    return {
      status: "paid",
      expiresAt: null,
      secondsRemaining: 0,
    };
  }

  const normalizedOrderStatus = normalizeOrderStatus(order.order_status);
  if (!PAYMENT_PENDING_ORDER_STATUSES.has(normalizedOrderStatus)) {
    return {
      status: "noop",
      reason: "invalid_order_status",
      expiresAt: order.reservationExpiresAt || null,
      secondsRemaining: resolveReservationSecondsRemaining(
        order.reservationExpiresAt,
        now,
      ),
    };
  }

  const inventoryStatus = String(order.inventoryStatus || "")
    .trim()
    .toLowerCase();
  if (inventoryStatus === "reserved") {
    const expiryResult = await expireOrderReservation(order, {
      now,
      source: `${source}_EXPIRED`,
    });

    if (expiryResult.status === "released") {
      logger.info(
        "orderReservation",
        "Expired reservation released before payment action",
        {
          orderId: order._id,
          source,
        },
      );
    }
  }

  let reservationStatus = String(order.inventoryStatus || "")
    .trim()
    .toLowerCase();

  if (reservationStatus !== "reserved") {
    await reserveComboStock(order, `${source}_RESERVE`);
    try {
      await reserveInventory(order, `${source}_RESERVE`);
      reservationStatus = String(order.inventoryStatus || "")
        .trim()
        .toLowerCase();
    } catch (reservationError) {
      try {
        await releaseComboStock(order, `${source}_RESERVE_FAIL`);
      } catch (rollbackError) {
        logger.error(
          "orderReservation",
          "Failed to rollback combo reservation",
          {
            orderId: order?._id,
            source,
            error: rollbackError?.message || String(rollbackError),
          },
        );
      }

      if (
        !throwOnUnavailable &&
        reservationError instanceof AppError &&
        reservationError.code === "INSUFFICIENT_STOCK"
      ) {
        return {
          status: "unavailable",
          reason: "insufficient_stock",
          expiresAt: null,
          secondsRemaining: 0,
        };
      }

      throw reservationError;
    }
  }

  if (reservationStatus !== "reserved") {
    if (throwOnUnavailable) {
      throw new AppError("CONFLICT", {
        field: "inventoryStatus",
        message: "Unable to reserve inventory for payment",
      });
    }

    return {
      status: "unavailable",
      reason: "reservation_unavailable",
      expiresAt: null,
      secondsRemaining: 0,
    };
  }

  if (refreshExpiry || !order.reservationExpiresAt) {
    order.reservationExpiresAt = getReservationExpiryDate(now);
  }

  order.updatedAt = new Date();
  await syncActiveStockReservations(order, { source });
  await order.save();

  return {
    status: "reserved",
    expiresAt: order.reservationExpiresAt || null,
    secondsRemaining: resolveReservationSecondsRemaining(
      order.reservationExpiresAt,
      now,
    ),
  };
};

const resolvePaymentProviderLabel = (provider) =>
  String(provider || "")
    .trim()
    .toUpperCase() === PAYMENT_PROVIDERS.PAYTM
    ? "Paytm"
    : "PhonePe";

const inferPaymentFailureKind = ({
  hint = "",
  state = "",
  raw = null,
} = {}) => {
  const fragments = [
    hint,
    state,
    raw?.code,
    raw?.message,
    raw?.error,
    raw?.status,
    raw?.state,
    raw?.responseCode,
    raw?.resultCode,
    raw?.resultStatus,
    raw?.resultMsg,
    raw?.resultInfo?.resultCode,
    raw?.resultInfo?.resultStatus,
    raw?.resultInfo?.resultMsg,
    ...(Array.isArray(raw?.paymentDetails)
      ? raw.paymentDetails.flatMap((entry) => [
          entry?.state,
          entry?.status,
          entry?.message,
          entry?.detailedErrorCode,
          entry?.paymentMode,
        ])
      : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    fragments.includes("cancel") ||
    fragments.includes("abort") ||
    fragments.includes("dropped") ||
    fragments.includes("closed by user")
  ) {
    return "cancelled";
  }

  return "failed";
};

const buildPaymentFailureReason = ({ provider, failureKind }) => {
  const providerLabel = resolvePaymentProviderLabel(provider);
  if (failureKind === "expired") {
    return "Reserved inventory window expired before payment was completed";
  }
  return failureKind === "cancelled"
    ? `${providerLabel} payment cancelled by customer`
    : `${providerLabel} payment failed`;
};

const sendOrderPaymentReminderEmail = async (
  order,
  { failureKind = "failed", paymentProvider = PAYMENT_PROVIDERS.PHONEPE } = {},
) => {
  try {
    const { email: recipientEmail, name: customerName } =
      await resolveOrderRecipient(order);
    const displayOrderNumber = resolveDisplayOrderNumber(order);
    const providerLabel = resolvePaymentProviderLabel(paymentProvider);
    const normalizedFailureKind =
      failureKind === "cancelled"
        ? "cancelled"
        : failureKind === "expired"
          ? "expired"
          : "failed";
    const subject =
      normalizedFailureKind === "cancelled"
        ? `Payment Cancelled - ${displayOrderNumber}`
        : normalizedFailureKind === "expired"
          ? "Complete Your Payment Before Items Sell Out"
          : `Payment Reminder - ${displayOrderNumber}`;
    const emailLog = await createEmailLog({
      user_id: order?.user || null,
      order_id: order?._id || null,
      to_email: recipientEmail || "unknown@unknown.invalid",
      email_type: "order_payment_reminder",
      template_type: "orderPaymentReminder.html",
      subject,
      status: "queued",
      metadata: {
        provider: providerLabel,
        failureKind: normalizedFailureKind,
      },
    });

    if (!recipientEmail) {
      logger.warn("sendOrderPaymentReminderEmail", "Recipient email missing", {
        orderId: order?._id,
      });
      if (emailLog?._id) {
        await mongoose.model("EmailLog").updateOne(
          { _id: emailLog._id },
          {
            $set: {
              status: "skipped",
              error_message: "Missing recipient email",
            },
          },
        );
      }
      return false;
    }

    const rawOrderId = String(order?._id || "").trim();
    const supportContact = getSupportContactEmail();
    const supportUrl = getSupportContactUrl();
    const siteUrl = getPrimaryStoreUrl();
    const paymentUrl = await buildPayOrderUrl(order);
    const actionUrl =
      paymentUrl ||
      (order?.user && rawOrderId
        ? `${siteUrl}/orders/${encodeURIComponent(rawOrderId)}`
        : siteUrl);
    const actionLabel = paymentUrl
      ? normalizedFailureKind === "expired"
        ? "Complete Payment"
        : "Pay Now"
      : order?.user
        ? "View your order"
        : "Visit the store";
    const pricingSnapshot = order?.pricing || {};
    const finalAmount = round2(
      Number(
        pricingSnapshot.roundedTotal ||
          order?.finalAmount ||
          order?.totalAmt ||
          0,
      ),
    );
    const failureMessage =
      normalizedFailureKind === "cancelled"
        ? "Your payment was cancelled before completion. You can return and place the order again when ready."
        : normalizedFailureKind === "expired"
          ? "Your 3 minute 30 second reservation window ended before payment completed. Use the link below to retry payment before these items sell out."
          : "Your payment did not complete successfully. You can retry from your order page or place the order again.";

    const text = [
      `Order No: ${displayOrderNumber}`,
      `Order ID: ${rawOrderId || "N/A"}`,
      `Payment provider: ${providerLabel}`,
      `Payment status: ${normalizedFailureKind}`,
      failureMessage,
      `Order Total: ${formatInr(finalAmount)}`,
      `Open: ${actionUrl}`,
      `Support: ${supportContact}`,
    ].join("\n");

    const result = await sendTemplatedEmail({
      to: recipientEmail,
      subject,
      templateFile: "orderPaymentReminder.html",
      templateData: {
        customer_name: customerName,
        order_number: displayOrderNumber,
        order_id: rawOrderId || "N/A",
        order_date: formatOrderDateForEmail(order?.createdAt),
        payment_provider: providerLabel,
        failure_kind:
          normalizedFailureKind === "cancelled"
            ? "Cancelled"
            : normalizedFailureKind === "expired"
              ? "Reservation Expired"
              : "Failed",
        failure_message: failureMessage,
        items_text: stringifyOrderItemsForEmail(order),
        final_amount: formatInr(finalAmount),
        action_label: actionLabel,
        action_url: actionUrl,
        site_url: siteUrl,
        support_contact: supportContact,
        support_url: supportUrl,
        year: String(new Date().getFullYear()),
      },
      text,
      context: "order.payment_reminder",
    });

    if (!result?.success) {
      logger.warn("sendOrderPaymentReminderEmail", "Email send failed", {
        orderId: order?._id,
        recipientEmail,
        error: result?.error || "Unknown error",
      });
      if (emailLog?._id) {
        await mongoose.model("EmailLog").updateOne(
          { _id: emailLog._id },
          {
            $set: {
              status: "failed",
              error_message: result?.error || "send_failed",
            },
          },
        );
      }
      return false;
    }

    if (emailLog?._id) {
      await mongoose.model("EmailLog").updateOne(
        { _id: emailLog._id },
        {
          $set: {
            status: "sent",
          },
        },
      );
    }

    return true;
  } catch (error) {
    logger.error("sendOrderPaymentReminderEmail", "Unexpected email error", {
      orderId: order?._id,
      error: error?.message || String(error),
    });
    return false;
  }
};

const maybeSendOrderPaymentReminderEmail = async ({
  order,
  failureKind = "failed",
  paymentProvider = PAYMENT_PROVIDERS.PHONEPE,
  logContext = "paymentWebhook",
}) => {
  if (!order) return false;
  if (order.paymentReminderEmailSentAt) {
    return false;
  }

  const sent = await sendOrderPaymentReminderEmail(order, {
    failureKind,
    paymentProvider,
  });
  if (!sent) {
    return false;
  }

  order.paymentReminderEmailSentAt = new Date();
  order.paymentReminderEmailFailureKind =
    failureKind === "cancelled"
      ? "cancelled"
      : failureKind === "expired"
        ? "expired"
        : "failed";
  order.paymentReminderEmailProvider = String(paymentProvider || "")
    .trim()
    .toUpperCase();

  try {
    await order.save();
    return true;
  } catch (error) {
    logger.warn(logContext, "Failed to persist payment reminder metadata", {
      orderId: order?._id,
      error: error?.message || String(error),
    });
    return false;
  }
};

registerReservationExpiryListener(async (order) => {
  if (!order) return;

  const normalizedPaymentStatus = String(order.payment_status || "")
    .trim()
    .toLowerCase();
  if (normalizedPaymentStatus === "paid") {
    return;
  }

  const normalizedOrderStatus = normalizeOrderStatus(order.order_status);
  if (!PAYMENT_PENDING_ORDER_STATUSES.has(normalizedOrderStatus)) {
    return;
  }

  const paymentProvider =
    normalizeSupportedPaymentProvider(order?.paymentMethod) ||
    PAYMENT_PROVIDERS.PHONEPE;

  await maybeSendOrderPaymentReminderEmail({
    order,
    failureKind: "expired",
    paymentProvider,
    logContext: "reservationExpiry",
  });
});

const PAYMENT_EMAIL_DELAY_MS = Math.max(
  Number(process.env.ORDER_PAYMENT_EMAIL_DELAY_MS || 60_000),
  0,
);
const PAYMENT_REMINDER_POLL_INTERVAL_MS = Math.max(
  Number(
    process.env.ORDER_PAYMENT_REMINDER_POLL_INTERVAL_MS ||
      PAYMENT_EMAIL_DELAY_MS ||
      60_000,
  ),
  15_000,
);
const PAYMENT_REMINDER_LOOKBACK_HOURS = Math.max(
  Number(process.env.ORDER_PAYMENT_REMINDER_LOOKBACK_HOURS || 24),
  1,
);
const scheduledOrderEmailTasks = new Map();
let orderPaymentReminderJob = null;

const scheduleOrderEmailTask = ({
  orderId,
  taskType,
  delayMs = PAYMENT_EMAIL_DELAY_MS,
  logContext = "orderEmailScheduler",
  task,
}) => {
  const normalizedOrderId = String(orderId || "").trim();
  const normalizedTaskType = String(taskType || "")
    .trim()
    .toLowerCase();
  if (!normalizedOrderId || !normalizedTaskType || typeof task !== "function") {
    return false;
  }

  const key = `${normalizedTaskType}:${normalizedOrderId}`;
  if (scheduledOrderEmailTasks.has(key)) {
    return false;
  }

  const timer = setTimeout(
    async () => {
      scheduledOrderEmailTasks.delete(key);
      try {
        await task();
      } catch (error) {
        logger.error(logContext, "Scheduled order email task failed", {
          orderId: normalizedOrderId,
          taskType: normalizedTaskType,
          error: error?.message || String(error),
        });
      }
    },
    Math.max(Number(delayMs || 0), 0),
  );

  if (typeof timer?.unref === "function") {
    timer.unref();
  }

  scheduledOrderEmailTasks.set(key, timer);
  return true;
};

const scheduleOrderPaymentSuccessEmails = ({
  order,
  paymentProvider,
  logContext = "paymentWebhook",
}) => {
  const orderId = String(order?._id || "").trim();
  if (!orderId) return false;

  return scheduleOrderEmailTask({
    orderId,
    taskType: "payment_success",
    logContext,
    task: async () => {
      const freshOrder = await OrderModel.findById(orderId);
      if (!freshOrder) return;

      const paymentStatus = String(freshOrder.payment_status || "")
        .trim()
        .toLowerCase();
      if (paymentStatus !== "paid") {
        return;
      }

      await sendOrderPaymentSuccessEmail(freshOrder, {
        paymentProvider,
      });

      if (!freshOrder.confirmationEmailSentAt) {
        await sendOrderConfirmationEmail(freshOrder);
      }
    },
  });
};

const scheduleOrderPaymentReminderEmail = ({
  order,
  failureKind = "failed",
  paymentProvider = PAYMENT_PROVIDERS.PHONEPE,
  logContext = "paymentWebhook",
}) => {
  const orderId = String(order?._id || "").trim();
  if (!orderId) return false;

  return scheduleOrderEmailTask({
    orderId,
    taskType: "payment_reminder",
    logContext,
    task: async () => {
      const freshOrder = await OrderModel.findById(orderId);
      if (!freshOrder) return;

      const paymentStatus = String(freshOrder.payment_status || "")
        .trim()
        .toLowerCase();
      if (paymentStatus === "paid") {
        return;
      }

      await maybeSendOrderPaymentReminderEmail({
        order: freshOrder,
        failureKind,
        paymentProvider,
        logContext,
      });
    },
  });
};

const inferStoredPaymentFailureKind = (order) => {
  const storedKind = String(order?.paymentReminderEmailFailureKind || "")
    .trim()
    .toLowerCase();
  if (storedKind === "cancelled") return "cancelled";
  if (storedKind === "expired") return "expired";
  if (storedKind === "failed") return "failed";

  const reason = String(order?.failureReason || "")
    .trim()
    .toLowerCase();
  if (
    reason.includes("cancel") ||
    reason.includes("abort") ||
    reason.includes("dropped") ||
    reason.includes("closed by user")
  ) {
    return "cancelled";
  }

  return "failed";
};

const processDueOrderPaymentReminderEmails = async ({
  logContext = "orderPaymentReminderJob",
} = {}) => {
  const now = Date.now();
  const dueBefore = new Date(now - PAYMENT_EMAIL_DELAY_MS);
  const lookbackAfter = new Date(
    now - PAYMENT_REMINDER_LOOKBACK_HOURS * 60 * 60 * 1000,
  );

  const dueOrders = await OrderModel.find({
    paymentReminderEmailSentAt: null,
    paymentMethod: { $in: Object.values(PAYMENT_PROVIDERS) },
    updatedAt: { $gte: lookbackAfter },
    $or: [
      {
        payment_status: "failed",
        paymentId: { $exists: true, $nin: [null, ""] },
        updatedAt: { $lte: dueBefore, $gte: lookbackAfter },
      },
      {
        payment_status: "pending",
        inventoryStatus: "released",
        order_status: {
          $in: [ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_PENDING],
        },
      },
    ],
  })
    .sort({ updatedAt: 1, createdAt: 1 })
    .limit(25);

  for (const order of dueOrders) {
    await maybeSendOrderPaymentReminderEmail({
      order,
      failureKind:
        String(order?.payment_status || "")
          .trim()
          .toLowerCase() === "pending" &&
        String(order?.inventoryStatus || "")
          .trim()
          .toLowerCase() === "released"
          ? "expired"
          : inferStoredPaymentFailureKind(order),
      paymentProvider:
        normalizeSupportedPaymentProvider(order?.paymentMethod) ||
        PAYMENT_PROVIDERS.PHONEPE,
      logContext,
    });
  }
};

export const startOrderPaymentReminderJob = () => {
  if (orderPaymentReminderJob) return;

  const run = () =>
    runWithBackgroundJobLease({
      jobKey: "order-payment-reminder",
      intervalMs: PAYMENT_REMINDER_POLL_INTERVAL_MS,
      task: processDueOrderPaymentReminderEmails,
    }).catch((error) => {
      logger.error(
        "orderPaymentReminderJob",
        "Reminder queue execution failed",
        {
          error: error?.message || String(error),
        },
      );
    });

  void run();
  orderPaymentReminderJob = setInterval(run, PAYMENT_REMINDER_POLL_INTERVAL_MS);

  if (typeof orderPaymentReminderJob?.unref === "function") {
    orderPaymentReminderJob.unref();
  }

  logger.info("orderPaymentReminderJob", "Payment reminder scheduler started", {
    delayMs: PAYMENT_EMAIL_DELAY_MS,
    pollIntervalMs: PAYMENT_REMINDER_POLL_INTERVAL_MS,
    lookbackHours: PAYMENT_REMINDER_LOOKBACK_HOURS,
  });
};

const CHECKOUT_GST_RATE = 5;
const DEFAULT_PRODUCT_WEIGHT_GRAMS = 500;

const toObjectIdOrNull = (value) => {
  if (!value) return null;
  const candidate =
    value && typeof value === "object" && value._id ? value._id : value;
  const asString = String(candidate || "").trim();
  return mongoose.Types.ObjectId.isValid(asString) ? candidate : null;
};

const normalizeMongoIdString = (value) => {
  const normalized = String(value || "").trim();
  return mongoose.Types.ObjectId.isValid(normalized) ? normalized : null;
};

const decodePaytmWebhookEnvelope = (body = {}) => {
  if (!body) return {};

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  if (body.BODY && typeof body.BODY === "string") {
    try {
      const parsed = JSON.parse(body.BODY);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // fallback to raw payload
    }
  }

  if (body.body && typeof body.body === "string") {
    try {
      const parsed = JSON.parse(body.body);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // fallback to raw payload
    }
  }

  if (body.body && typeof body.body === "object") {
    return body.body;
  }

  return body;
};

const parsePaytmRawBody = (rawBody) => {
  const trimmed = String(rawBody || "").trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  const params = new URLSearchParams(trimmed);
  const parsed = {};
  for (const [key, value] of params.entries()) {
    parsed[key] = value;
  }
  return parsed;
};

const extractPaytmWebhookFields = (payload = {}) => {
  const resultInfo =
    payload?.resultInfo && typeof payload.resultInfo === "object"
      ? payload.resultInfo
      : payload?.RESULTINFO && typeof payload.RESULTINFO === "object"
        ? payload.RESULTINFO
        : {};

  const merchantTransactionId =
    payload?.merchantTransactionId ||
    payload?.merchant_order_id ||
    payload?.ORDERID ||
    payload?.orderId ||
    payload?.orderid ||
    payload?.order_id ||
    null;

  const transactionId =
    payload?.transactionId ||
    payload?.TXNID ||
    payload?.txnId ||
    payload?.txn_id ||
    payload?.providerReferenceId ||
    payload?.BANKTXNID ||
    null;

  const utrNumber = extractUtrNumber({
    utr: payload?.utr,
    UTR: payload?.UTR,
    rrn: payload?.rrn,
    RRN: payload?.RRN,
    bankTransactionId: payload?.BANKTXNID,
    providerReferenceId: payload?.providerReferenceId,
    txnId: transactionId,
  });

  const state =
    payload?.txnStatus ||
    payload?.TXNSTATUS ||
    payload?.transactionStatus ||
    payload?.transaction_status ||
    payload?.STATUS ||
    payload?.status ||
    payload?.state ||
    payload?.resultStatus ||
    resultInfo?.resultStatus ||
    null;

  return { merchantTransactionId, transactionId, state, utrNumber };
};

const normalizePaytmState = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "";
  if (normalized === "s") return "success";
  if (normalized === "f") return "fail";
  if (normalized === "p") return "pending";
  if (normalized === "u") return "pending";
  if (normalized.includes("success")) return "success";
  if (normalized.includes("fail")) return "fail";
  if (normalized.includes("pending")) return "pending";
  if (normalized.includes("cancel")) return "fail";
  return "";
};

const resolvePaytmState = (...candidates) => {
  for (const candidate of candidates) {
    const normalized = normalizePaytmState(candidate);
    if (normalized) return normalized;
  }
  return "";
};

const extractOrderIdFromMerchantTransactionId = (merchantTransactionId) => {
  const normalized = String(merchantTransactionId || "").trim();
  if (!normalized || !normalized.startsWith("BOG_")) return null;

  const payload = normalized.replace(/^BOG_/, "");

  const directTempId = normalizeTempOrderId(payload);
  if (directTempId) {
    return directTempId;
  }

  if (mongoose.Types.ObjectId.isValid(payload)) {
    return payload;
  }

  const tempWithSuffixMatch = payload.match(/^(TMP-[A-Z0-9]{6})(?:[_-].+)?$/i);
  if (tempWithSuffixMatch?.[1]) {
    return tempWithSuffixMatch[1].toUpperCase();
  }

  const objectIdWithSuffixMatch = payload.match(
    /^([a-fA-F0-9]{24})(?:[_-].+)?$/,
  );
  if (!objectIdWithSuffixMatch?.[1]) return null;

  return objectIdWithSuffixMatch[1];
};

const verifyPaytmWebhookState = async (merchantTransactionId) => {
  try {
    const statusResponse = await getPaytmStatus({
      orderId: merchantTransactionId,
    });
    console.log(
      "PAYMENT RAW RESPONSE:",
      JSON.stringify(statusResponse || {}, null, 2),
    );
    const payload =
      statusResponse && typeof statusResponse === "object"
        ? statusResponse
        : {};
    return {
      ...extractPaytmWebhookFields(payload),
      raw: payload,
    };
  } catch (error) {
    logger.warn("handlePaytmWebhook", "Paytm status verification failed", {
      merchantTransactionId,
      error: error?.message || String(error),
    });
    return null;
  }
};

const getClientBaseUrl = () => {
  const configured = String(process.env.CLIENT_URL || "")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");

  if (/^https?:\/\//i.test(configured)) {
    return configured;
  }

  return "https://healthyonegram.com";
};

const normalizeHttpOrigin = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (!/^https?:$/i.test(parsed.protocol)) return "";
    return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
  } catch {
    return "";
  }
};

const resolveClientOriginFromRequest = (req) => {
  const explicitQueryOrigin = normalizeHttpOrigin(
    req?.query?.clientOrigin || req?.body?.clientOrigin,
  );
  if (explicitQueryOrigin) return explicitQueryOrigin;

  const headerOrigin = normalizeHttpOrigin(req?.headers?.origin);
  if (headerOrigin) return headerOrigin;

  const refererRaw = String(req?.headers?.referer || "").trim();
  if (refererRaw) {
    try {
      const refererOrigin = normalizeHttpOrigin(new URL(refererRaw).origin);
      if (refererOrigin) return refererOrigin;
    } catch {
      // ignore invalid referer
    }
  }

  return "";
};

const resolveClientBaseUrl = (req) => {
  const requestOrigin = resolveClientOriginFromRequest(req);
  if (requestOrigin && isLocalHostName(resolveHostname(requestOrigin))) {
    return requestOrigin;
  }

  return getClientBaseUrl();
};

const getBackendBaseUrl = (req) => {
  const configured = String(
    process.env.BACKEND_URL ||
      process.env.API_BASE_URL ||
      (process.env.GAE_DEFAULT_HOSTNAME
        ? `https://${process.env.GAE_DEFAULT_HOSTNAME}`
        : ""),
  )
    .trim()
    .replace(/\/+$/, "");

  if (/^https?:\/\//i.test(configured)) {
    return configured;
  }

  const host = String(req?.headers?.host || "").trim();
  if (!host) return "";
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "")
    .trim()
    .toLowerCase();
  const protocol =
    forwardedProto === "https" || forwardedProto === "http"
      ? forwardedProto
      : String(req?.protocol || "https").trim() || "https";
  return `${protocol}://${host}`;
};

const resolveHostname = (value) => {
  const input = String(value || "").trim();
  if (!input) return "";
  try {
    const parsed = new URL(input.includes("://") ? input : `https://${input}`);
    return String(parsed.hostname || "")
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
};

const isLocalHostName = (hostname) => {
  const normalized = String(hostname || "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".local")
  );
};

const isPhonePeProdEnvironment = () =>
  String(process.env.PHONEPE_ENV || "PROD")
    .trim()
    .toUpperCase() === "PROD";

const isRuntimeProduction = () =>
  String(process.env.NODE_ENV || "")
    .trim()
    .toLowerCase() === "production";

const isLocalhostPaymentSource = (req) => {
  const originHost = resolveHostname(req?.headers?.origin);
  const refererHost = resolveHostname(req?.headers?.referer);
  const hostHeader = String(req?.headers?.host || "")
    .trim()
    .toLowerCase();
  const forwardedHost = String(req?.headers?.["x-forwarded-host"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  const candidates = [
    originHost,
    refererHost,
    resolveHostname(hostHeader),
    resolveHostname(forwardedHost),
  ].filter(Boolean);

  return candidates.some((host) => isLocalHostName(host));
};

const buildPhonePeLocalhostProdError = () => ({
  error: true,
  success: false,
  code: "PHONEPE_LOCALHOST_NOT_SUPPORTED",
  message:
    "PhonePe QR in PROD mode cannot be initiated from localhost/non-whitelisted origins. Open checkout from your registered domain (for example https://healthyonegram.com) or use UAT credentials for local testing.",
});

const shouldBlockPhonePeForLocalhost = (req) =>
  isRuntimeProduction() &&
  isPhonePeProdEnvironment() &&
  isLocalhostPaymentSource(req);

const buildPhonePeOrderCallbackUrl = ({
  configuredCallbackUrl,
  backendUrl,
  merchantTransactionId,
}) => {
  const resolvedBackendBase = String(backendUrl || getClientBaseUrl())
    .trim()
    .replace(/\/+$/, "");
  const fallbackBase = `${resolvedBackendBase}/api/orders/webhook/phonepe`;
  const fallback = `${fallbackBase}?merchantOrderId=${encodeURIComponent(
    String(merchantTransactionId || ""),
  )}`;
  const configured = String(configuredCallbackUrl || "").trim();
  if (!configured) return fallback;

  try {
    const callbackUrl = new URL(
      configured.startsWith("http")
        ? configured
        : `${resolvedBackendBase}${configured.startsWith("/") ? "" : "/"}${configured}`,
    );
    callbackUrl.searchParams.set(
      "merchantOrderId",
      String(merchantTransactionId || ""),
    );
    return callbackUrl.toString();
  } catch {
    return fallback;
  }
};

const buildPaytmOrderCallbackUrl = ({
  configuredCallbackUrl,
  backendUrl,
  req,
}) => {
  const resolvedBackendBase = String(
    backendUrl || getBackendBaseUrl(req) || resolveClientBaseUrl(req),
  )
    .trim()
    .replace(/\/+$/, "");

  const fallback = `${resolvedBackendBase}/api/orders/webhook/paytm`;
  const configured = String(configuredCallbackUrl || "").trim();
  const input = configured
    ? configured.startsWith("http")
      ? configured
      : `${resolvedBackendBase}${configured.startsWith("/") ? "" : "/"}${configured}`
    : fallback;

  try {
    const callbackUrl = new URL(input);
    const clientOrigin =
      resolveClientOriginFromRequest(req) || resolveClientBaseUrl(req);
    if (clientOrigin) {
      callbackUrl.searchParams.set("clientOrigin", clientOrigin);
    }
    return callbackUrl.toString();
  } catch {
    return input;
  }
};

const buildPhonePeOrderRedirectUrl = ({
  configuredRedirectUrl,
  primaryOrigin,
  merchantTransactionId,
  orderId,
  returnPath = "/my-orders",
}) => {
  const resolvedOrigin = String(primaryOrigin || getClientBaseUrl())
    .trim()
    .replace(/\/+$/, "");
  const fallback = `${resolvedOrigin}/payment/phonepe?merchantOrderId=${encodeURIComponent(
    String(merchantTransactionId || ""),
  )}&orderId=${encodeURIComponent(String(orderId || ""))}&paymentProvider=${encodeURIComponent(
    PAYMENT_PROVIDERS.PHONEPE,
  )}&flow=order&returnPath=${encodeURIComponent(String(returnPath || "/my-orders"))}`;
  const configured = String(configuredRedirectUrl || "").trim();
  if (!configured) return fallback;

  try {
    const redirectUrl = new URL(
      configured.startsWith("http")
        ? configured
        : `${resolvedOrigin}${configured.startsWith("/") ? "" : "/"}${configured}`,
    );
    redirectUrl.searchParams.set(
      "merchantOrderId",
      String(merchantTransactionId || ""),
    );
    redirectUrl.searchParams.set("orderId", String(orderId || ""));
    redirectUrl.searchParams.set("paymentProvider", PAYMENT_PROVIDERS.PHONEPE);
    redirectUrl.searchParams.set("flow", "order");
    redirectUrl.searchParams.set(
      "returnPath",
      String(returnPath || "/my-orders"),
    );
    return redirectUrl.toString();
  } catch {
    return fallback;
  }
};

const isBrowserNavigationRequest = (req) => {
  const method = String(req?.method || "")
    .trim()
    .toUpperCase();
  const requestedWith = String(req?.headers?.["x-requested-with"] || "")
    .trim()
    .toLowerCase();
  const accept = String(req?.headers?.accept || "").toLowerCase();
  const contentType = String(
    req?.headers?.["content-type"] || "",
  ).toLowerCase();
  const origin = String(req?.headers?.origin || "").toLowerCase();
  const referer = String(req?.headers?.referer || "").toLowerCase();
  const secFetchDest = String(
    req?.headers?.["sec-fetch-dest"] || "",
  ).toLowerCase();
  const secFetchMode = String(
    req?.headers?.["sec-fetch-mode"] || "",
  ).toLowerCase();
  const secFetchUser = String(
    req?.headers?.["sec-fetch-user"] || "",
  ).toLowerCase();
  const userAgent = String(req?.headers?.["user-agent"] || "").toLowerCase();

  if (method === "GET") return true;
  if (
    requestedWith === "xmlhttprequest" ||
    requestedWith === "fetch" ||
    requestedWith === "api"
  ) {
    return false;
  }

  const hasNavigationHints =
    secFetchDest === "document" ||
    secFetchMode === "navigate" ||
    secFetchUser === "?1";
  const browserUserAgent =
    userAgent.includes("mozilla") ||
    userAgent.includes("chrome") ||
    userAgent.includes("safari") ||
    userAgent.includes("firefox") ||
    userAgent.includes("edg") ||
    userAgent.includes("opera");
  const isFormPost =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");
  const hasOriginHint = Boolean(origin || referer);

  return (
    accept.includes("text/html") ||
    hasNavigationHints ||
    browserUserAgent ||
    (isFormPost && hasOriginHint)
  );
};

const PAYTM_BROWSER_FIELD_KEYS = new Set([
  "checksumhash",
  "mid",
  "orderid",
  "order_id",
  "merchanttransactionid",
  "merchant_order_id",
  "merchantorderid",
  "txnid",
  "txn_id",
  "txnstatus",
  "respcode",
  "respmsg",
  "status",
  "resultstatus",
  "resultcode",
  "resultmsg",
]);

const hasPaytmFieldKeys = (payload) => {
  if (!payload || typeof payload !== "object") return false;
  return Object.keys(payload).some((key) =>
    PAYTM_BROWSER_FIELD_KEYS.has(String(key || "").toLowerCase()),
  );
};

const resolvePaytmCandidatePayload = (payload) => {
  if (!payload || typeof payload !== "object") return payload;
  if (payload.BODY || payload.body) {
    return decodePaytmWebhookEnvelope(payload);
  }
  return payload;
};

const isPaytmBrowserCallback = (req) => {
  if (!req) return false;
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const resolvedBody = resolvePaytmCandidatePayload(body);
  const query = req.query && typeof req.query === "object" ? req.query : {};
  return (
    hasPaytmFieldKeys(body) ||
    hasPaytmFieldKeys(resolvedBody) ||
    hasPaytmFieldKeys(query)
  );
};

const shouldRedirectPaytm = (req) => {
  if (!req) return false;
  if (isBrowserNavigationRequest(req) || isPaytmBrowserCallback(req)) {
    return true;
  }
  const referer = String(req.headers?.referer || "").toLowerCase();
  const origin = String(req.headers?.origin || "").toLowerCase();
  if (
    referer.includes("paytm") ||
    referer.includes("paytmpayments") ||
    origin.includes("paytm") ||
    origin.includes("paytmpayments")
  ) {
    return true;
  }
  if (req.rawBody) {
    const rawPayload = parsePaytmRawBody(req.rawBody);
    const resolvedRawPayload = resolvePaytmCandidatePayload(rawPayload);
    if (
      hasPaytmFieldKeys(rawPayload) ||
      hasPaytmFieldKeys(resolvedRawPayload)
    ) {
      return true;
    }
  }
  const method = String(req.method || "").toUpperCase();
  if (method === "GET") return true;
  const accept = String(req.headers?.accept || "").toLowerCase();
  const userAgent = String(req.headers?.["user-agent"] || "").toLowerCase();
  const isBrowser =
    userAgent.includes("mozilla") ||
    userAgent.includes("chrome") ||
    userAgent.includes("safari") ||
    userAgent.includes("firefox") ||
    userAgent.includes("edg") ||
    userAgent.includes("opera");
  return isBrowser && !accept.includes("application/json");
};

const redirectPaytmWebhookToClient = (req, res, { orderId, paymentState }) => {
  const path = orderId
    ? `/orders/${encodeURIComponent(String(orderId))}`
    : "/my-orders";

  const preferredClientBase =
    resolveClientOriginFromRequest(req) || resolveClientBaseUrl(req);

  try {
    const target = new URL(path, `${preferredClientBase}/`);
    target.searchParams.set("paymentProvider", "PAYTM");
    if (paymentState) {
      target.searchParams.set(
        "paymentState",
        String(paymentState).toLowerCase(),
      );
    }
    return res.redirect(303, target.toString());
  } catch {
    const fallback = new URL(
      "/my-orders",
      `${resolveClientBaseUrl(req) || "https://healthyonegram.com"}/`,
    );
    fallback.searchParams.set("paymentProvider", "PAYTM");
    if (paymentState) {
      fallback.searchParams.set(
        "paymentState",
        String(paymentState).toLowerCase(),
      );
    }
    return res.redirect(303, fallback.toString());
  }
};

const decodeMaybeJson = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const decodeMaybeBase64Json = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  try {
    const decoded = Buffer.from(normalized, "base64").toString("utf-8");
    return decodeMaybeJson(decoded);
  } catch {
    return null;
  }
};

const extractPhonePeWebhookMerchantOrderId = (req, payload = {}) => {
  const payloadObj = payload && typeof payload === "object" ? payload : {};
  const nestedPayload =
    decodeMaybeJson(payloadObj.payload) ||
    decodeMaybeBase64Json(payloadObj.payload) ||
    null;
  const nestedResponse =
    decodeMaybeJson(payloadObj.response) ||
    decodeMaybeBase64Json(payloadObj.response) ||
    null;

  return (
    payloadObj.merchantOrderId ||
    payloadObj.merchant_order_id ||
    payloadObj.orderId ||
    payloadObj.order_id ||
    payloadObj.transactionId ||
    nestedPayload?.merchantOrderId ||
    nestedPayload?.merchant_order_id ||
    nestedPayload?.data?.merchantOrderId ||
    nestedResponse?.merchantOrderId ||
    nestedResponse?.data?.merchantOrderId ||
    req?.query?.merchantOrderId ||
    req?.body?.merchantOrderId ||
    null
  );
};

const normalizePhonePeState = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const UPI_REFERENCE_REGEX = /^\d{12,16}$/;
const UTR_REGEX = /^\d{12,16}$/;
const extractNumericUpiReference = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (UPI_REFERENCE_REGEX.test(normalized)) return normalized;
  const embedded = normalized.match(/(?:^|[^\d])(\d{12,16})(?:[^\d]|$)/);
  return embedded?.[1] || "";
};

const extractUtrNumber = (...args) => {
  const candidateFields =
    args.length === 1 &&
    args[0] &&
    typeof args[0] === "object" &&
    !Array.isArray(args[0])
      ? [
          args[0]?.utr,
          args[0]?.UTR,
          args[0]?.rrn,
          args[0]?.RRN,
          args[0]?.bankTransactionId,
          args[0]?.providerReferenceId,
          args[0]?.txnId,
        ]
      : args;

  for (const value of candidateFields) {
    const normalized = String(value || "").trim();
    if (!normalized) continue;
    const numeric = normalized.replace(/\D/g, "");
    if (numeric.length >= 12 && numeric.length <= 16) {
      return numeric;
    }
  }

  return "";
};

const verifyPhonePeWebhookState = async (merchantOrderId) => {
  try {
    const statusResponse = await getPhonePeOrderStatus({ merchantOrderId });
    console.log(
      "PAYMENT RAW RESPONSE:",
      JSON.stringify(statusResponse || {}, null, 2),
    );
    const state = normalizePhonePeState(statusResponse?.state);
    const paymentDetails = Array.isArray(statusResponse?.paymentDetails)
      ? statusResponse.paymentDetails
      : [];
    const firstPayment = paymentDetails[0] || {};
    const upiReferenceCandidate =
      firstPayment?.providerReferenceId ||
      firstPayment?.utr ||
      firstPayment?.rrn ||
      firstPayment?.bankTransactionId ||
      statusResponse?.providerReferenceId ||
      statusResponse?.utr ||
      statusResponse?.rrn ||
      statusResponse?.bankTransactionId ||
      "";
    const upiReference = extractNumericUpiReference(upiReferenceCandidate);
    const utrNumber = extractUtrNumber({
      utr: firstPayment?.utr || statusResponse?.utr,
      rrn: firstPayment?.rrn || statusResponse?.rrn,
      bankTransactionId:
        firstPayment?.bankTransactionId || statusResponse?.bankTransactionId,
      providerReferenceId:
        firstPayment?.providerReferenceId ||
        statusResponse?.providerReferenceId,
      txnId: firstPayment?.transactionId,
    });

    return {
      state,
      merchantOrderId: String(merchantOrderId || "").trim(),
      phonepeOrderId: String(statusResponse?.orderId || "").trim() || null,
      transactionId:
        firstPayment?.transactionId ||
        firstPayment?.providerReferenceId ||
        firstPayment?.utr ||
        null,
      upiReference: upiReference || null,
      utrNumber: utrNumber || null,
      raw: statusResponse,
    };
  } catch (error) {
    logger.warn("handlePhonePeWebhook", "PhonePe status verification failed", {
      merchantOrderId,
      error: error?.message || String(error),
    });
    return null;
  }
};

const normalizeGuestDetails = (guestDetails = {}) =>
  buildLegacyGuestDetails(guestDetails, {
    email: guestDetails.email,
    gst: guestDetails.gst,
  });

const validateGuestDetails = (details) => {
  const validation = validateStructuredAddress(
    {
      full_name: details.fullName,
      mobile_number: details.phone,
      pincode: details.pincode,
      flat_house: details.flat_house || details.address,
      area_street_sector: details.area_street_sector || details.address,
      landmark: details.landmark,
      city: details.city || details.state,
      state: details.state,
      email: details.email,
    },
    { requireEmail: true },
  );

  if (!validation.isValid) {
    const [field, message] = Object.entries(validation.errors)[0] || [];
    throw new AppError("INVALID_FORMAT", {
      field: field || "guestDetails",
      message: message || "Guest details are invalid",
    });
  }
};

const resolveCheckoutContact = async ({
  userId,
  deliveryAddressId,
  guestDetails,
  strictGuestValidation = true,
}) => {
  const normalizedGuest = normalizeGuestDetails(guestDetails);
  let userGstNumber = "";
  let userEmail = "";
  if (userId && !normalizedGuest.gst) {
    const userRecord = await UserModel.findById(userId)
      .select("gstNumber email")
      .lean();
    userGstNumber = userRecord?.gstNumber || "";
    userEmail = String(userRecord?.email || "")
      .trim()
      .toLowerCase();
  } else if (userId) {
    const userRecord = await UserModel.findById(userId).select("email").lean();
    userEmail = String(userRecord?.email || "")
      .trim()
      .toLowerCase();
  }

  if (deliveryAddressId) {
    const address = await AddressModel.findById(deliveryAddressId).lean();
    if (!address) {
      throw new AppError("ADDRESS_NOT_FOUND");
    }

    const serializedAddress = serializeAddressDocument(address);
    const derived = {
      ...buildLegacyGuestDetails(serializedAddress, {
        email: normalizedGuest.email,
        gst: normalizedGuest.gst || userGstNumber,
      }),
      fullName: String(
        serializedAddress.full_name || normalizedGuest.fullName || "",
      ).trim(),
      phone: String(
        serializedAddress.mobile_number || normalizedGuest.phone || "",
      ).trim(),
      address: String(
        serializedAddress.address_line1 || normalizedGuest.address || "",
      ).trim(),
      pincode: String(
        serializedAddress.pincode || normalizedGuest.pincode || "",
      ).trim(),
      state: String(
        serializedAddress.state || normalizedGuest.state || "",
      ).trim(),
      email: String(normalizedGuest.email || userEmail || "")
        .trim()
        .toLowerCase(),
      city: String(serializedAddress.city || normalizedGuest.city || "").trim(),
      gst: normalizedGuest.gst || userGstNumber,
    };

    if (!userId && strictGuestValidation) {
      validateGuestDetails(derived);
    }

    const structuredAddress = normalizeStructuredAddress({
      ...serializedAddress,
      email: derived.email,
    });
    const addressSnapshot = buildOrderAddressSnapshot(structuredAddress, {
      email: derived.email,
      source: "saved_address",
      addressId: address._id,
    });

    return {
      contact: derived,
      addressId: address._id,
      state: derived.state,
      pincode: derived.pincode,
      structuredAddress,
      addressSnapshot,
    };
  }

  if (!userId && strictGuestValidation) {
    validateGuestDetails(normalizedGuest);
  }

  const structuredAddress = normalizeStructuredAddress({
    full_name: normalizedGuest.fullName,
    mobile_number: normalizedGuest.phone,
    pincode: normalizedGuest.pincode,
    flat_house: normalizedGuest.flat_house || normalizedGuest.address,
    area_street_sector:
      normalizedGuest.area_street_sector || normalizedGuest.address,
    landmark: normalizedGuest.landmark,
    city: normalizedGuest.city,
    state: normalizedGuest.state,
    district: normalizedGuest.district,
    email: normalizedGuest.email || userEmail,
  });

  const resolvedContactEmail = String(normalizedGuest.email || userEmail || "")
    .trim()
    .toLowerCase();

  return {
    contact: {
      ...normalizedGuest,
      email: resolvedContactEmail,
      gst: normalizedGuest.gst || userGstNumber,
    },
    addressId: null,
    state: normalizedGuest.state,
    pincode: normalizedGuest.pincode,
    structuredAddress,
    addressSnapshot: buildOrderAddressSnapshot(structuredAddress, {
      email: resolvedContactEmail,
      source: userId ? "registered_manual" : "guest_manual",
      addressId: null,
    }),
  };
};

const buildBillingDetailsFromCheckoutContact = (checkoutContact = {}) => {
  const snapshot = checkoutContact.addressSnapshot || {};
  const structured = checkoutContact.structuredAddress || {};
  const contact = checkoutContact.contact || {};

  return {
    fullName: contact.fullName || snapshot.order_name || "",
    email: contact.email || snapshot.email || "",
    phone: contact.phone || snapshot.order_mobile || "",
    address:
      contact.address ||
      snapshot.address_line1 ||
      composeAddressLine1(structured) ||
      "Address not available",
    pincode: contact.pincode || snapshot.order_pincode || "",
    state: contact.state || snapshot.order_state || "",
    city: structured.city || snapshot.order_city || "",
    flat_house: structured.flat_house || snapshot.order_flat_house || "",
    area_street_sector:
      structured.area_street_sector || snapshot.order_area || "",
    landmark: structured.landmark || snapshot.order_landmark || "",
    country: INDIA_COUNTRY,
  };
};

const buildGuestOrderDetails = (
  checkoutContact = {},
  { include = false } = {},
) => {
  if (!include) return {};

  const contact = checkoutContact.contact || {};
  const structured = checkoutContact.structuredAddress || {};

  return {
    ...contact,
    city: structured.city || contact.city || "",
    flat_house: structured.flat_house || contact.flat_house || "",
    area_street_sector:
      structured.area_street_sector || contact.area_street_sector || "",
    landmark: structured.landmark || contact.landmark || "",
    district: structured.district || contact.district || "",
    country: INDIA_COUNTRY,
  };
};

const normalizeOrderProducts = ({ products, dbProductMap }) => {
  return products.map((item) => {
    const productId = String(item.productId || "");
    const dbProduct = dbProductMap.get(productId);
    if (!dbProduct) {
      throw new AppError("PRODUCT_NOT_FOUND", { productId });
    }

    const quantity = Math.max(Number(item.quantity || 1), 1);

    const rawVariantId = item.variantId ?? item.variant ?? null;
    const rawVariantName = item.variantName ?? item.variantTitle ?? "";
    const normalizedVariantId = (() => {
      if (rawVariantId === undefined || rawVariantId === null) return null;
      const normalized = String(rawVariantId).trim();
      if (!normalized || normalized === "undefined" || normalized === "null") {
        return null;
      }
      return normalized;
    })();
    const normalizedVariantName = String(rawVariantName || "").trim();

    const variants = Array.isArray(dbProduct?.variants)
      ? dbProduct.variants
      : [];
    const normalizedRequestedPrice = round2(Number(item?.price || 0));

    const variantById = normalizedVariantId
      ? variants.find(
          (variant) =>
            String(variant?._id || "") === String(normalizedVariantId),
        )
      : null;
    const variantByName = normalizedVariantName
      ? variants.find(
          (variant) =>
            String(variant?.name || "")
              .trim()
              .toLowerCase() === normalizedVariantName.toLowerCase(),
        )
      : null;
    const variantsMatchingPrice =
      normalizedRequestedPrice > 0
        ? variants.filter(
            (variant) =>
              round2(Number(variant?.price || 0)) === normalizedRequestedPrice,
          )
        : [];
    const variantByPrice =
      variantsMatchingPrice.length === 1 ? variantsMatchingPrice[0] : null;

    let selectedVariant =
      variantById || variantByName || variantByPrice || null;

    if (
      !selectedVariant &&
      (normalizedVariantId || normalizedVariantName) &&
      variants.length > 0
    ) {
      throw new AppError("INVALID_INPUT", {
        field: normalizedVariantId ? "variantId" : "variantName",
        value: normalizedVariantId || normalizedVariantName,
        productId,
      });
    }

    if (!selectedVariant && variants.length > 0) {
      selectedVariant =
        variants.find((variant) => variant?.isDefault) || variants[0] || null;
    }

    const resolvedVariantId = selectedVariant?._id
      ? String(selectedVariant._id)
      : normalizedVariantId
        ? String(normalizedVariantId)
        : null;
    const resolvedVariantName = String(
      selectedVariant?.name || normalizedVariantName || "",
    ).trim();

    const resolvedPrice = (() => {
      const candidate = selectedVariant?.price;
      if (candidate !== undefined && candidate !== null && candidate !== "") {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed)) {
          return round2(parsed);
        }
      }
      return round2(Number(dbProduct.price ?? item.price ?? 0));
    })();

    const resolvedImage =
      item.image ||
      selectedVariant?.image ||
      (Array.isArray(selectedVariant?.images)
        ? selectedVariant.images[0]
        : "") ||
      dbProduct.images?.[0] ||
      dbProduct.thumbnail ||
      "";
    const subTotal = round2(resolvedPrice * quantity);

    const resolvedSku = String(
      selectedVariant?.sku || dbProduct?.sku || item?.sku || "",
    )
      .trim()
      .toUpperCase();
    const resolvedHsn = String(
      selectedVariant?.hsnCode || dbProduct?.hsnCode || item?.hsnCode || "",
    ).trim();

    return {
      productId,
      productTitle: item.productTitle || dbProduct.name || "Product",
      variantId: resolvedVariantId,
      variantName: resolvedVariantName,
      sku: resolvedSku,
      hsnCode: resolvedHsn,
      quantity,
      price: resolvedPrice,
      image: resolvedImage,
      subTotal,
    };
  });
};

const authorizePurchaseOrderForCheckout = async ({
  purchaseOrderId,
  userId,
  checkoutContact,
}) => {
  if (!purchaseOrderId) return null;

  const purchaseOrder =
    await PurchaseOrderModel.findById(purchaseOrderId).lean();
  if (!purchaseOrder) {
    throw new AppError("NOT_FOUND", {
      field: "purchaseOrderId",
      message: "Purchase order not found",
    });
  }

  if (purchaseOrder.userId) {
    if (!userId || String(purchaseOrder.userId) !== String(userId)) {
      throw new AppError("FORBIDDEN");
    }
  } else {
    const checkoutEmail = String(checkoutContact?.contact?.email || "")
      .trim()
      .toLowerCase();
    const poEmail = String(purchaseOrder?.guestDetails?.email || "")
      .trim()
      .toLowerCase();

    if (!checkoutEmail || !poEmail || checkoutEmail !== poEmail) {
      throw new AppError("FORBIDDEN");
    }
  }

  return purchaseOrder;
};

logger.info(
  "Payment System",
  `DefaultProvider: ${PAYMENT_PROVIDER || "NONE"}, EnvEnabled: ${PAYMENT_ENV_ENABLED}`,
  {
    configuredProvider: configuredPaymentProvider,
    providerReadiness: PAYMENT_PROVIDER_ENV_ENABLED,
  },
);

const isInvoiceEligible = (order) => {
  if (!order) return false;

  const hasExistingInvoice = Boolean(
    order.invoicePath ||
    order.invoiceNumber ||
    order.invoiceGeneratedAt ||
    order.isInvoiceGenerated ||
    order.invoiceUrl,
  );
  if (hasExistingInvoice) {
    return true;
  }
  const normalizedStatus = normalizeOrderStatus(order.order_status);
  if (normalizedStatus === ORDER_STATUS.CANCELLED) {
    return false;
  }

  if (
    String(order.payment_status || "")
      .trim()
      .toLowerCase() === "paid"
  ) {
    return true;
  }

  if (
    [ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED].includes(normalizedStatus)
  ) {
    return true;
  }

  if (Array.isArray(order.statusTimeline)) {
    return order.statusTimeline.some((entry) => {
      const timelineStatus = normalizeOrderStatus(entry?.status);
      return (
        timelineStatus === ORDER_STATUS.DELIVERED ||
        timelineStatus === ORDER_STATUS.COMPLETED
      );
    });
  }

  return false;
};

const getInvoiceEligibilityMessage = (order) => {
  if (!order) return "Order not found";
  if (normalizeOrderStatus(order.order_status) === ORDER_STATUS.CANCELLED) {
    return "Invoice is not available for cancelled orders.";
  }
  if (!isInvoiceEligible(order)) {
    return "Invoice will be available after payment is confirmed.";
  }
  return null;
};

const extractHsnFromSpecifications = (specifications) => {
  if (!specifications) return null;

  if (specifications instanceof Map) {
    return (
      specifications.get("HSN") ||
      specifications.get("hsn") ||
      specifications.get("Hsn") ||
      null
    );
  }

  if (typeof specifications === "object") {
    return (
      specifications.HSN || specifications.hsn || specifications.Hsn || null
    );
  }

  return null;
};

const getOrderProductMetadata = async (order) => {
  const productIds = Array.from(
    new Set(
      (order?.products || [])
        .map((item) => String(item?.productId || ""))
        .filter((id) => mongoose.Types.ObjectId.isValid(id)),
    ),
  );

  if (productIds.length === 0) return {};

  const products = await ProductModel.find({ _id: { $in: productIds } })
    .select("_id specifications hsnCode unit weight")
    .lean();

  const metadata = {};
  products.forEach((product) => {
    const hsn =
      String(product?.hsnCode || "").trim() ||
      extractHsnFromSpecifications(product?.specifications);
    metadata[String(product._id)] = {
      hsn: hsn ? String(hsn) : process.env.INVOICE_DEFAULT_HSN || "2106",
      unit: product?.unit || "",
      weight: Number(product?.weight || 0),
    };
  });

  return metadata;
};

const getInvoiceSellerDetails = async () => {
  const storeInfo = (await getCachedSetting("storeInfo"))?.value || {};

  return {
    name: "BUY ONE GRAM PRIVATE LIMITED",
    gstin: "08AAJCB3889Q1ZO",
    address: "G-225, RIICO INDUSTRIAL AREA SITAPURA, TONK ROAD, JAIPUR-302022",
    state: "Rajasthan",
    placeOfSupplyStateCode: "08",
    cin: "U51909RJ2020PTC071817",
    msme: "UDYAM-RJ-17-0154669",
    fssai: "12224027000921",
    phone: process.env.INVOICE_SELLER_PHONE || storeInfo.phone || "",
    email: process.env.INVOICE_SELLER_EMAIL || storeInfo.email || "",
    currencySymbol: storeInfo.currencySymbol || "Rs. ",
    logoPath: process.env.INVOICE_LOGO_PATH || "",
    bankName: process.env.INVOICE_BANK_NAME || "ICICI BANK LIMITED",
    bankAccount: process.env.INVOICE_BANK_ACCOUNT || "731405000083",
    bankBranch: process.env.INVOICE_BANK_BRANCH || "SITAPURA",
    bankIfsc: process.env.INVOICE_BANK_IFSC || "ICIC0006748",
  };
};

const fetchAndNormalizeOrderProducts = async (
  products = [],
  logContext = "order",
) => {
  const normalizedProductIds = products.map((product, index) => {
    const productId = normalizeMongoIdString(product?.productId);
    if (!productId) {
      throw new AppError("INVALID_INPUT", {
        field: `products[${index}].productId`,
        value: product?.productId ?? null,
      });
    }
    return productId;
  });
  const dbProducts = await ProductModel.find({
    _id: { $in: normalizedProductIds },
  })
    .select("_id name price images thumbnail isExclusive sku hsnCode variants")
    .lean();
  const dbProductMap = new Map(dbProducts.map((p) => [String(p._id), p]));
  const missingIds = normalizedProductIds.filter(
    (id) => !dbProductMap.has(String(id)),
  );
  if (missingIds.length > 0) {
    logger.warn(logContext, "Some products not found", { missingIds });
    throw new AppError("PRODUCT_NOT_FOUND", { missingIds });
  }

  const normalizedProducts = normalizeOrderProducts({
    products: products.map((product, index) => ({
      ...product,
      productId: normalizedProductIds[index],
      variantId: normalizeMongoIdString(product?.variantId),
    })),
    dbProductMap,
  });

  return { normalizedProducts, dbProducts };
};

const aggregateComboQuantities = (combos = []) => {
  const map = new Map();
  combos.forEach((combo) => {
    const comboId = String(combo?.comboId || combo?.id || "").trim();
    if (!comboId) return;
    const quantity = Math.max(Number(combo?.quantity || 1), 1);
    const existing = map.get(comboId) || { comboId, quantity: 0 };
    existing.quantity += quantity;
    map.set(comboId, existing);
  });
  return Array.from(map.values());
};

const fetchAndNormalizeOrderCombos = async ({
  combos = [],
  userId = null,
  logContext = "order",
}) => {
  const aggregated = aggregateComboQuantities(combos);
  if (aggregated.length === 0) {
    return {
      normalizedCombos: [],
      expandedProducts: [],
      comboDiscount: 0,
      comboOriginalAmount: 0,
      comboPriceAmount: 0,
    };
  }

  const comboIds = aggregated.map((combo, index) => {
    const comboId = normalizeMongoIdString(combo?.comboId);
    if (!comboId) {
      throw new AppError("INVALID_INPUT", {
        field: `combos[${index}].comboId`,
        value: combo?.comboId ?? null,
      });
    }
    return comboId;
  });
  const dbCombos = await ComboModel.find({ _id: { $in: comboIds } }).lean();
  const comboMap = new Map(dbCombos.map((combo) => [String(combo._id), combo]));

  const missing = comboIds.filter((id) => !comboMap.has(String(id)));
  if (missing.length > 0) {
    logger.warn(logContext, "Some combos not found", { missing });
    throw new AppError("NOT_FOUND", { field: "comboId", missing });
  }

  const segmentInfo = await resolveUserSegment({ userId });
  const allItems = dbCombos.flatMap((combo) => combo.items || []);
  const productIds = allItems
    .map((item) => String(item.productId || ""))
    .filter(Boolean);
  const products = productIds.length
    ? await ProductModel.find({ _id: { $in: productIds } })
        .select(
          "_id stock stock_quantity reserved_quantity track_inventory trackInventory hasVariants variants",
        )
        .lean()
    : [];
  const productMap = new Map(
    products.map((product) => [String(product._id), product]),
  );

  const normalizedCombos = [];
  const expandedProducts = [];
  let comboOriginalAmount = 0;
  let comboPriceAmount = 0;

  for (const comboInput of aggregated) {
    const combo = comboMap.get(String(comboInput.comboId));
    if (!combo) continue;

    const eligibility = evaluateComboEligibility(combo);
    if (!eligibility.eligible) {
      throw new AppError("FORBIDDEN", {
        field: "combo",
        reason: eligibility.reason,
      });
    }

    const categoryIds = (combo.items || [])
      .map((item) => item.categoryId)
      .filter(Boolean);
    if (!isComboEligibleForSegment(combo, segmentInfo, categoryIds)) {
      throw new AppError("FORBIDDEN", {
        field: "combo",
        reason: "segment_not_allowed",
      });
    }

    const comboQuantity = Math.max(Number(comboInput.quantity || 1), 1);
    if (combo.maxPerOrder && comboQuantity > combo.maxPerOrder) {
      throw new AppError("INVALID_QUANTITY", {
        field: "combo.quantity",
        comboId: combo._id,
        maxPerOrder: combo.maxPerOrder,
      });
    }

    const availability = await computeComboAvailability(combo, productMap);
    if (availability.available < comboQuantity) {
      throw new AppError("INSUFFICIENT_STOCK", {
        comboId: combo._id,
        requested: comboQuantity,
        available: availability.available,
      });
    }

    const expanded = expandComboToOrderProducts(combo, comboQuantity);
    const comboUnitBaseline = resolveComboUnitOriginalTotal(combo);
    const comboOriginalBaselineFromExpanded = round2(
      expanded.reduce((sum, item) => sum + Number(item?.subTotal || 0), 0),
    );
    const comboOriginalBaseline =
      comboUnitBaseline > 0
        ? round2(comboUnitBaseline * comboQuantity)
        : comboOriginalBaselineFromExpanded > 0
          ? comboOriginalBaselineFromExpanded
          : round2(
              Number(combo.originalPrice ?? combo.originalTotal ?? 0) *
                comboQuantity,
            );
    const comboUnitPrice = resolveEffectiveComboUnitPrice(combo);
    const comboListPrice = round2(comboUnitPrice * comboQuantity);

    const snapshot = buildComboOrderSnapshot(combo, comboQuantity);
    if (snapshot) {
      snapshot.comboPrice = comboUnitPrice;
      snapshot.savings = round2(
        Math.max(comboOriginalBaseline - comboListPrice, 0),
      );
      normalizedCombos.push(snapshot);
    }

    comboOriginalAmount += comboOriginalBaseline;
    comboPriceAmount += comboListPrice;

    expandedProducts.push(...expanded);
  }

  comboOriginalAmount = round2(comboOriginalAmount);
  comboPriceAmount = round2(comboPriceAmount);
  const comboDiscount = round2(
    Math.max(comboOriginalAmount - comboPriceAmount, 0),
  );

  return {
    normalizedCombos,
    expandedProducts,
    comboDiscount,
    comboOriginalAmount,
    comboPriceAmount,
  };
};

const calculateCheckoutPricing = async ({
  normalizedProducts,
  comboDiscount = 0,
  comboOriginalAmount = 0,
  userId,
  couponCode,
  influencerCode,
  checkoutContact,
  coinRedeem,
  paymentType = "prepaid",
  logContext = "checkoutPricing",
}) => {
  const comboExpandedAmount = round2(
    normalizedProducts
      .filter((item) => Boolean(item?.comboId))
      .reduce((sum, item) => sum + Number(item?.subTotal || 0), 0),
  );
  const standaloneAmount = round2(
    normalizedProducts
      .filter((item) => !item?.comboId)
      .reduce((sum, item) => sum + Number(item?.subTotal || 0), 0),
  );
  const normalizedComboOriginalAmount = round2(
    Math.max(Number(comboOriginalAmount || 0), 0),
  );
  const effectiveComboOriginalAmount =
    normalizedComboOriginalAmount > 0
      ? normalizedComboOriginalAmount
      : comboExpandedAmount;
  const originalAmount = round2(
    standaloneAmount + effectiveComboOriginalAmount,
  );

  const comboDiscountInclusive = Math.min(
    Math.max(round2(Number(comboDiscount || 0)), 0),
    originalAmount,
  );
  const discountedOriginalAmount = round2(
    Math.max(originalAmount - comboDiscountInclusive, 0),
  );

  const originalBaseSplit = splitGstInclusiveAmount(
    originalAmount,
    CHECKOUT_GST_RATE,
    checkoutContact?.state,
  );
  const originalBaseSubtotal = round2(originalBaseSplit.taxableAmount || 0);
  const discountedBaseSplit = splitGstInclusiveAmount(
    discountedOriginalAmount,
    CHECKOUT_GST_RATE,
    checkoutContact?.state,
  );
  const baseSubtotal = round2(discountedBaseSplit.taxableAmount || 0);
  const comboDiscountBase = round2(
    Math.max(originalBaseSubtotal - baseSubtotal, 0),
  );

  const membershipDiscount = 0;

  let workingTaxableAmount = baseSubtotal;

  let influencerDiscount = 0;
  let influencerData = null;
  if (influencerCode) {
    const referralResult = await calculateReferralDiscount(
      influencerCode,
      workingTaxableAmount,
    );
    if (referralResult?.influencer) {
      influencerDiscount = round2(referralResult.discount || 0);
      influencerData = referralResult.influencer;
      workingTaxableAmount = Math.max(
        round2(workingTaxableAmount - influencerDiscount),
        0,
      );
    }
  }

  const couponResult = await validateCouponForOrder({
    code: couponCode,
    orderAmount: workingTaxableAmount,
    userId,
    influencerCode: influencerDiscount > 0 ? influencerCode : null,
  });

  if (couponResult.errorMessage) {
    return {
      errorMessage: couponResult.errorMessage,
    };
  }

  const normalizedCouponCode = couponResult.normalizedCode;
  const couponDiscount = Math.min(
    round2(couponResult.discount || 0),
    workingTaxableAmount,
  );

  const totalDiscount = round2(
    membershipDiscount +
      influencerDiscount +
      couponDiscount +
      comboDiscountBase,
  );

  const taxableAmount = round2(
    Math.max(workingTaxableAmount - couponDiscount, 0),
  );
  const gstAmount = round2((taxableAmount * CHECKOUT_GST_RATE) / 100);
  const taxData = {
    rate: CHECKOUT_GST_RATE,
    state: checkoutContact?.state || "",
    taxableAmount,
    tax: gstAmount,
    totalTax: gstAmount,
    cgst: 0,
    sgst: 0,
    igst: gstAmount,
  };

  const requestedCoins = Number(coinRedeem?.coins || coinRedeem || 0);
  if (requestedCoins > 0) {
    return {
      errorMessage:
        "Coin redemption is only available for membership subscriptions.",
    };
  }

  const redemption = { coinsUsed: 0, redeemAmount: 0 };
  const postDiscountInclusive = Math.max(
    round2(taxableAmount + gstAmount - Number(redemption.redeemAmount || 0)),
    0,
  );

  const totalWeight = normalizedProducts.reduce(
    (sum, item) =>
      sum +
      Math.max(Number(item.quantity || 0), 0) * DEFAULT_PRODUCT_WEIGHT_GRAMS,
    0,
  );

  let shippingCharge = 0;
  try {
    if (validateIndianPincode(checkoutContact?.pincode || "")) {
      const shippingQuote = await getShippingQuote({
        destinationPincode: checkoutContact.pincode,
        subtotal: postDiscountInclusive,
        totalWeightGrams: totalWeight,
        paymentType: paymentType || "prepaid",
      });
      shippingCharge = Number(shippingQuote?.charge || 0);
    }
  } catch (shippingErr) {
    logger.warn(logContext, "Shipping quote failed, defaulting to 0", {
      error: shippingErr?.message || String(shippingErr),
    });
    shippingCharge = 0;
  }
  shippingCharge = Math.max(round2(shippingCharge), 0);

  const pricingTotals = buildRoundedPricing(
    postDiscountInclusive + shippingCharge,
  );
  const finalAmount = pricingTotals.finalAmount;

  let influencerCommission = 0;
  if (influencerData?._id) {
    influencerCommission = await calculateInfluencerCommission(
      influencerData._id,
      taxableAmount,
    );
  }

  return {
    originalAmount,
    subtotal: baseSubtotal,
    taxableAmount,
    gstAmount,
    shippingCharge,
    finalAmount,
    roundedAmount: pricingTotals.roundedAmount,
    roundOff: pricingTotals.roundOff,
    totalDiscount,
    membershipDiscount,
    couponDiscount,
    influencerDiscount,
    normalizedCouponCode,
    influencerData,
    influencerCode:
      influencerData?.code || (influencerDiscount > 0 ? influencerCode : null),
    influencerCommission,
    membershipPlan: null,
    taxData: {
      ...taxData,
      taxableAmount,
      tax: gstAmount,
    },
    redemption,
    comboDiscount: comboDiscountBase,
    comboDiscountInclusive: comboDiscountInclusive,
    basePrice: round2(originalBaseSubtotal),
    discountedPrice: taxableAmount,
    roundedTotal: pricingTotals.roundedAmount,
  };
};

export const ensureOrderInvoice = async (orderDoc, options = {}) => {
  try {
    const forceRegenerate = Boolean(options?.forceRegenerate);

    if (!orderDoc?._id) {
      return { ok: false, reason: "Order not found" };
    }

    const eligibilityMessage = getInvoiceEligibilityMessage(orderDoc);
    if (eligibilityMessage) {
      return { ok: false, reason: eligibilityMessage };
    }

    const existingAbsolutePath = getAbsolutePathFromStoredInvoicePath(
      orderDoc.invoicePath,
    );

    const populatedOrder =
      orderDoc?.user?.name && orderDoc?.delivery_address?.address_line1
        ? orderDoc
        : await OrderModel.findById(orderDoc._id)
            .populate("user", "name email")
            .populate("delivery_address");

    if (!populatedOrder) {
      return { ok: false, reason: "Order not found" };
    }

    const [sellerDetails, productMetaById] = await Promise.all([
      getInvoiceSellerDetails(),
      getOrderProductMetadata(populatedOrder),
    ]);

    let generated = null;
    let absolutePath = existingAbsolutePath;
    let generatedNewFile = false;

    if (forceRegenerate) {
      generated = await generateInvoicePdf({
        order: populatedOrder,
        sellerDetails,
        productMetaById,
        forceRegenerate: true,
      });
      generatedNewFile = true;
      absolutePath = generated.absolutePath;
    } else if (orderDoc.invoicePath && existingAbsolutePath) {
      try {
        await fsPromises.access(existingAbsolutePath);
      } catch {
        generated = await generateInvoicePdf({
          order: populatedOrder,
          sellerDetails,
          productMetaById,
          forceRegenerate: false,
        });
        generatedNewFile = true;
        absolutePath = generated.absolutePath;
      }
    } else {
      generated = await generateInvoicePdf({
        order: populatedOrder,
        sellerDetails,
        productMetaById,
        forceRegenerate: false,
      });
      generatedNewFile = true;
      absolutePath = generated.absolutePath;
    }

    if (generated) {
      orderDoc.invoiceNumber = generated.invoiceNumber;
      orderDoc.invoicePath = generated.invoicePath;
      orderDoc.invoiceGeneratedAt = generated.invoiceGeneratedAt;
    }

    if (!absolutePath) {
      return { ok: false, reason: "Invoice file path could not be resolved" };
    }

    const pricing = calculateOrderTotal(populatedOrder);
    const pricingSnapshot = populatedOrder.pricing || {};
    const addressSnapshot =
      populatedOrder.deliveryAddressSnapshot ||
      buildOrderAddressSnapshot(
        populatedOrder.delivery_address || populatedOrder.guestDetails || {},
        {
          email:
            populatedOrder.billingDetails?.email ||
            populatedOrder.guestDetails?.email ||
            populatedOrder.user?.email ||
            "",
          source: populatedOrder.delivery_address ? "saved_address" : "manual",
          addressId: populatedOrder.delivery_address?._id || null,
        },
      );
    const state =
      addressSnapshot?.order_state ||
      populatedOrder.billingDetails?.state ||
      populatedOrder.guestDetails?.state ||
      populatedOrder.delivery_address?.state ||
      "";
    const gst = populatedOrder.gst || {};
    const taxBreakdown = {
      rate: Number(gst.rate ?? pricingSnapshot.gstRate ?? CHECKOUT_GST_RATE),
      state: gst.state || pricingSnapshot.state || state || "",
      taxableAmount: Number(
        gst.taxableAmount ??
          pricingSnapshot.discountedPrice ??
          pricing.subtotal,
      ),
      cgst: Number(gst.cgst || 0),
      sgst: Number(gst.sgst || 0),
      igst: Number(gst.igst || 0),
      totalTax: round2(
        Number(gst.totalTax ?? pricingSnapshot.gst ?? pricing.tax),
      ),
    };

    const billingDetails = {
      fullName:
        addressSnapshot?.order_name ||
        populatedOrder.billingDetails?.fullName ||
        populatedOrder.guestDetails?.fullName ||
        populatedOrder.delivery_address?.name ||
        populatedOrder.user?.name ||
        "Customer",
      email:
        addressSnapshot?.email ||
        populatedOrder.billingDetails?.email ||
        populatedOrder.guestDetails?.email ||
        populatedOrder.user?.email ||
        "",
      phone:
        addressSnapshot?.order_mobile ||
        populatedOrder.billingDetails?.phone ||
        populatedOrder.guestDetails?.phone ||
        String(populatedOrder.delivery_address?.mobile || ""),
      address:
        addressSnapshot?.address_line1 ||
        populatedOrder.billingDetails?.address ||
        populatedOrder.guestDetails?.address ||
        populatedOrder.delivery_address?.address_line1 ||
        "Address not available",
      pincode:
        addressSnapshot?.order_pincode ||
        populatedOrder.billingDetails?.pincode ||
        populatedOrder.guestDetails?.pincode ||
        populatedOrder.delivery_address?.pincode ||
        "",
      state,
      city:
        addressSnapshot?.order_city ||
        populatedOrder.billingDetails?.city ||
        populatedOrder.guestDetails?.city ||
        populatedOrder.delivery_address?.city ||
        "",
      flat_house:
        addressSnapshot?.order_flat_house ||
        populatedOrder.billingDetails?.flat_house ||
        populatedOrder.guestDetails?.flat_house ||
        "",
      area_street_sector:
        addressSnapshot?.order_area ||
        populatedOrder.billingDetails?.area_street_sector ||
        populatedOrder.guestDetails?.area_street_sector ||
        "",
      landmark:
        addressSnapshot?.order_landmark ||
        populatedOrder.billingDetails?.landmark ||
        populatedOrder.guestDetails?.landmark ||
        populatedOrder.delivery_address?.landmark ||
        "",
      country: INDIA_COUNTRY,
    };

    const invoiceNumber =
      orderDoc.invoiceNumber ||
      generated?.invoiceNumber ||
      orderDoc._id.toString();
    const invoicePath = orderDoc.invoicePath || generated?.invoicePath || "";

    orderDoc.invoiceNumber = invoiceNumber;
    orderDoc.invoicePath = invoicePath;
    orderDoc.invoiceGeneratedAt =
      orderDoc.invoiceGeneratedAt ||
      generated?.invoiceGeneratedAt ||
      new Date();
    orderDoc.isInvoiceGenerated = Boolean(invoicePath);
    orderDoc.invoiceUrl = invoicePath || null;

    const normalizedStatus = normalizeOrderStatus(orderDoc.order_status);
    if (normalizedStatus === ORDER_STATUS.DELIVERED) {
      orderDoc.deliveryDate = orderDoc.deliveryDate || new Date();
    }
    if (
      orderDoc.isInvoiceGenerated &&
      normalizedStatus === ORDER_STATUS.DELIVERED
    ) {
      applyOrderStatusTransition(orderDoc, ORDER_STATUS.COMPLETED, {
        source: "INVOICE_AUTOGENERATION",
      });
    }

    const createdBy = toObjectIdOrNull(
      orderDoc.user ||
        orderDoc.user?._id ||
        populatedOrder.user ||
        populatedOrder.user?._id,
    );

    const orderSetPayload = {
      invoiceNumber: orderDoc.invoiceNumber,
      invoicePath: orderDoc.invoicePath,
      invoiceGeneratedAt: orderDoc.invoiceGeneratedAt,
      isInvoiceGenerated: orderDoc.isInvoiceGenerated,
      invoiceUrl: orderDoc.invoiceUrl,
      deliveryDate: orderDoc.deliveryDate || null,
    };
    if (orderDoc.order_status) {
      orderSetPayload.order_status = orderDoc.order_status;
    }
    if (Array.isArray(orderDoc.statusTimeline)) {
      orderSetPayload.statusTimeline = orderDoc.statusTimeline;
    }

    // Avoid validating legacy fields while persisting generated invoice refs.
    try {
      await OrderModel.updateOne(
        { _id: orderDoc._id },
        {
          $set: orderSetPayload,
        },
      );
    } catch (persistError) {
      logger.warn(
        "ensureOrderInvoice",
        "Failed to persist order invoice metadata; continuing with generated PDF",
        {
          orderId: orderDoc._id,
          invoiceNumber: orderDoc.invoiceNumber,
          invoicePath: orderDoc.invoicePath,
          error: persistError?.message || String(persistError),
        },
      );
    }

    try {
      const invoiceTotalExcludingShipping = round2(
        Math.max(Number(pricing.total || 0) - Number(pricing.shipping || 0), 0),
      );
      await InvoiceModel.findOneAndUpdate(
        { orderId: orderDoc._id },
        {
          orderId: orderDoc._id,
          invoiceNumber,
          subtotal: pricing.subtotal,
          taxBreakdown,
          shipping: 0,
          total: invoiceTotalExcludingShipping,
          gstNumber:
            populatedOrder.gstNumber ||
            populatedOrder.guestDetails?.gst ||
            sellerDetails.gstin ||
            "",
          billingDetails,
          deliveryAddress: addressSnapshot,
          invoicePath,
          createdBy,
        },
        { upsert: true, new: true, runValidators: true },
      );
    } catch (invoicePersistError) {
      logger.warn(
        "ensureOrderInvoice",
        "Failed to upsert invoice metadata; continuing with generated PDF",
        {
          orderId: orderDoc._id,
          invoiceNumber,
          invoicePath,
          error: invoicePersistError?.message || String(invoicePersistError),
        },
      );
    }

    return {
      ok: true,
      generated: generatedNewFile,
      order: orderDoc,
      absolutePath,
    };
  } catch (error) {
    logger.error("ensureOrderInvoice", "Invoice pipeline failed", {
      orderId: orderDoc?._id,
      paymentStatus: orderDoc?.payment_status,
      orderStatus: orderDoc?.order_status,
      error: error?.message || String(error),
    });
    return {
      ok: false,
      reason: "Failed to generate invoice",
      error,
    };
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all orders (Admin)
 * @route GET /api/orders/admin/all
 * @access Admin or Order Owner
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 20)
 * @param {string} search - Search by payment ID or user email
 * @param {string} status - Filter by order status
 */
export const getAllOrders = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.pagination;

    const skip = (page - 1) * limit;
    const filter = {
      // Keep purchase orders out of the regular orders listing.
      purchaseOrder: null,
      // Hide test/demo orders from the production admin orders screen.
      isDemoOrder: { $ne: true },
      status: { $ne: ORDER_STATUS.PENDING },
    };
    const andFilters = [];
    const normalizedStatus = String(status || "all")
      .trim()
      .toLowerCase();
    const successStatuses = [
      ORDER_STATUS.ACCEPTED,
      ORDER_STATUS.CONFIRMED_LEGACY,
      ORDER_STATUS.SHIPPED,
      ORDER_STATUS.OUT_FOR_DELIVERY,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.COMPLETED,
    ];
    const failedStatuses = [
      ORDER_STATUS.CANCELLED,
      ORDER_STATUS.RTO,
      ORDER_STATUS.RTO_COMPLETED,
    ];
    const dispatchedStatuses = [
      ORDER_STATUS.SHIPPED,
      ORDER_STATUS.OUT_FOR_DELIVERY,
    ];
    const paidLikeStatuses = [
      "paid",
      "confirmed",
      "captured",
      "success",
      "successful",
      "PAID",
      "CONFIRMED",
    ];
    const failedPaymentStatuses = ["failed", "FAILED"];

    // Filter by status
    if (normalizedStatus && normalizedStatus !== "all") {
      if (normalizedStatus === "successful") {
        andFilters.push({
          $or: [
            { status: { $in: successStatuses } },
            { payment_status: { $in: paidLikeStatuses } },
          ],
        });
      } else if (normalizedStatus === "failed") {
        andFilters.push({
          $or: [
            { status: { $in: failedStatuses } },
            { payment_status: { $in: failedPaymentStatuses } },
          ],
        });
      } else if (normalizedStatus === "pending") {
        filter.status = ORDER_STATUS.PENDING;
      } else if (normalizedStatus === "dispatched") {
        filter.status = { $in: dispatchedStatuses };
      } else {
        const normalizedOrderStatus = normalizeOrderStatus(normalizedStatus);
        if (normalizedOrderStatus === ORDER_STATUS.ACCEPTED) {
          filter.status = { $in: [ORDER_STATUS.ACCEPTED, "confirmed"] };
        } else if (normalizedOrderStatus === "confirmed") {
          filter.status = { $in: [ORDER_STATUS.ACCEPTED, "confirmed"] };
        } else {
          filter.status = normalizedOrderStatus;
        }
      }
    }

    // Search by payment identifiers or user email
    if (search) {
      const normalizedSearch = String(search || "").trim();
      const searchFilters = [
        { paymentId: { $regex: normalizedSearch, $options: "i" } },
        { paytmTransactionId: { $regex: normalizedSearch, $options: "i" } },
        { paytmOrderId: { $regex: normalizedSearch, $options: "i" } },
        { phonepeTransactionId: { $regex: normalizedSearch, $options: "i" } },
        {
          phonepeMerchantOrderId: {
            $regex: normalizedSearch,
            $options: "i",
          },
        },
        { phonepeOrderId: { $regex: normalizedSearch, $options: "i" } },
        { orderNumber: { $regex: normalizedSearch, $options: "i" } },
        { displayOrderId: { $regex: normalizedSearch, $options: "i" } },
        { "billingDetails.email": { $regex: normalizedSearch, $options: "i" } },
        { "guestDetails.email": { $regex: normalizedSearch, $options: "i" } },
        { "user.email": { $regex: normalizedSearch, $options: "i" } },
      ];

      if (mongoose.Types.ObjectId.isValid(normalizedSearch)) {
        searchFilters.push({
          _id: new mongoose.Types.ObjectId(normalizedSearch),
        });
      }

      andFilters.push({ $or: searchFilters });
    }

    if (andFilters.length > 0) {
      filter.$and = andFilters;
    }

    logger.debug("getAllOrders", "Fetching orders", {
      page,
      limit,
      status,
      search,
    });

    const [orders, total] = await Promise.all([
      OrderModel.find(filter)
        .populate("user", "name email avatar mobile")
        .populate("delivery_address")
        .populate("influencerId", "code name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      OrderModel.countDocuments(filter),
    ]);

    await reconcileOrdersForListing({
      orders,
      req,
      limit: 3,
      logContext: "getAllOrders",
      successSource: "PAYMENT_STATUS_RECONCILE_ADMIN_LIST",
      shipmentSource: "PAYMENT_STATUS_RECONCILE_ADMIN_LIST_AUTO_SHIPMENT",
    });

    const normalizedOrders = orders.map((order) =>
      normalizeOrderForResponse(order),
    );

    logger.info("getAllOrders", `Retrieved ${orders.length} orders`, {
      total,
      page,
      limit,
    });

    return sendSuccess(
      res,
      {
        orders: normalizedOrders,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
      "Orders retrieved successfully",
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "getAllOrders");
    return sendError(res, dbError);
  }
});

/**
 * Remove all pending orders (Admin)
 * @route DELETE /api/orders/admin/pending
 * @access Admin
 */
export const removeAllPendingOrders = asyncHandler(async (req, res) => {
  try {
    const requesterRole = String(req?.user?.role || "").trim();
    const normalizedRequesterRole = requesterRole.toLowerCase();
    if (
      !isPrivilegedAdminRole(requesterRole) ||
      normalizedRequesterRole !== "admin"
    ) {
      throw new AppError("FORBIDDEN", {
        message: "Only admin can remove pending orders",
      });
    }

    const pendingStatuses = [
      ORDER_STATUS.PENDING,
      ORDER_STATUS.PAYMENT_PENDING,
      ORDER_STATUS.IN_WAREHOUSE,
    ];
    const pendingPaymentStatuses = ["pending", "pending_payment", "PENDING"];

    const filter = {
      purchaseOrder: null,
      $or: [
        { order_status: { $in: pendingStatuses } },
        { payment_status: { $in: pendingPaymentStatuses } },
      ],
    };

    const pendingOrders = await OrderModel.find(filter)
      .select("_id order_status payment_status inventoryStatus products combos")
      .lean();

    if (pendingOrders.length === 0) {
      return sendSuccess(
        res,
        {
          totalMatched: 0,
          deletedCount: 0,
          skippedCount: 0,
        },
        "No pending orders found",
      );
    }

    let deletedCount = 0;
    let skippedCount = 0;
    let releasedInventoryCount = 0;
    let releasedComboCount = 0;
    const skippedOrderIds = [];

    for (const order of pendingOrders) {
      try {
        if (String(order?.inventoryStatus || "").toLowerCase() === "reserved") {
          const inventoryRelease = await releaseInventory(
            order,
            "ADMIN_PENDING_PURGE",
          );
          if (inventoryRelease?.status === "released") {
            releasedInventoryCount += 1;
          }

          const comboRelease = await releaseComboStock(
            order,
            "ADMIN_PENDING_PURGE",
          );
          if (comboRelease?.status === "released") {
            releasedComboCount += 1;
          }
        }

        const deleteResult = await OrderModel.deleteOne({ _id: order._id });
        if (Number(deleteResult?.deletedCount || 0) === 1) {
          deletedCount += 1;
        } else {
          skippedCount += 1;
          skippedOrderIds.push(String(order._id));
        }
      } catch (cleanupError) {
        skippedCount += 1;
        skippedOrderIds.push(String(order._id));
        logger.error(
          "removeAllPendingOrders",
          "Failed to remove pending order",
          {
            orderId: order?._id,
            error: cleanupError?.message || String(cleanupError),
          },
        );
      }
    }

    logger.info("removeAllPendingOrders", "Pending order cleanup finished", {
      totalMatched: pendingOrders.length,
      deletedCount,
      skippedCount,
      releasedInventoryCount,
      releasedComboCount,
    });

    return sendSuccess(
      res,
      {
        totalMatched: pendingOrders.length,
        deletedCount,
        skippedCount,
        releasedInventoryCount,
        releasedComboCount,
        skippedOrderIds,
      },
      deletedCount > 0
        ? `Removed ${deletedCount} pending orders`
        : "No pending orders were removed",
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "removeAllPendingOrders");
    return sendError(res, dbError);
  }
});

/**
 * Remove all demo orders (Admin)
 * @route DELETE /api/orders/admin/demo-orders
 * @access Admin
 */
export const removeAllDemoOrders = asyncHandler(async (req, res) => {
  try {
    const demoOrders = await OrderModel.find({ isDemoOrder: true })
      .select("_id inventoryStatus products combos")
      .lean();

    if (demoOrders.length === 0) {
      return sendSuccess(
        res,
        {
          totalMatched: 0,
          deletedCount: 0,
          skippedCount: 0,
          releasedInventoryCount: 0,
          releasedComboCount: 0,
          restoredInventoryCount: 0,
          restoredComboCount: 0,
          deletedComboOrdersCount: 0,
          deletedInvoicesCount: 0,
        },
        "No demo orders found",
      );
    }

    let deletedCount = 0;
    let skippedCount = 0;
    let releasedInventoryCount = 0;
    let releasedComboCount = 0;
    let restoredInventoryCount = 0;
    let restoredComboCount = 0;
    let deletedComboOrdersCount = 0;
    let deletedInvoicesCount = 0;
    const skippedOrderIds = [];

    for (const order of demoOrders) {
      try {
        const inventoryStatus = String(order?.inventoryStatus || "")
          .trim()
          .toLowerCase();

        if (inventoryStatus === "reserved") {
          const inventoryRelease = await releaseInventory(
            order,
            "ADMIN_DEMO_PURGE",
          );
          if (inventoryRelease?.status === "released") {
            releasedInventoryCount += 1;
          }

          const comboRelease = await releaseComboStock(
            order,
            "ADMIN_DEMO_PURGE",
          );
          if (comboRelease?.status === "released") {
            releasedComboCount += 1;
          }
        } else if (inventoryStatus === "deducted") {
          const inventoryRestore = await restoreInventory(
            order,
            "ADMIN_DEMO_PURGE",
          );
          if (inventoryRestore?.status === "restored") {
            restoredInventoryCount += 1;
          }

          const comboRestore = await restoreComboStock(
            order,
            "ADMIN_DEMO_PURGE",
          );
          if (comboRestore?.status === "restored") {
            restoredComboCount += 1;
          }
        }

        const [comboDeleteResult, invoiceDeleteResult] = await Promise.all([
          ComboOrderModel.deleteMany({ orderId: order._id }),
          InvoiceModel.deleteMany({ orderId: order._id }),
        ]);

        deletedComboOrdersCount += Number(comboDeleteResult?.deletedCount || 0);
        deletedInvoicesCount += Number(invoiceDeleteResult?.deletedCount || 0);

        const deleteResult = await OrderModel.deleteOne({ _id: order._id });
        if (Number(deleteResult?.deletedCount || 0) === 1) {
          deletedCount += 1;
        } else {
          skippedCount += 1;
          skippedOrderIds.push(String(order._id));
        }
      } catch (cleanupError) {
        skippedCount += 1;
        skippedOrderIds.push(String(order._id));
        logger.error("removeAllDemoOrders", "Failed to remove demo order", {
          orderId: order?._id,
          error: cleanupError?.message || String(cleanupError),
        });
      }
    }

    logger.info("removeAllDemoOrders", "Demo order cleanup finished", {
      totalMatched: demoOrders.length,
      deletedCount,
      skippedCount,
      releasedInventoryCount,
      releasedComboCount,
      restoredInventoryCount,
      restoredComboCount,
      deletedComboOrdersCount,
      deletedInvoicesCount,
    });

    return sendSuccess(
      res,
      {
        totalMatched: demoOrders.length,
        deletedCount,
        skippedCount,
        releasedInventoryCount,
        releasedComboCount,
        restoredInventoryCount,
        restoredComboCount,
        deletedComboOrdersCount,
        deletedInvoicesCount,
        skippedOrderIds,
      },
      deletedCount > 0
        ? `Removed ${deletedCount} demo orders`
        : "No demo orders were removed",
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "removeAllDemoOrders");
    return sendError(res, dbError);
  }
});

/**
 * Get order statistics (Admin)
 * @route GET /api/orders/admin/stats
 * @access Admin or Order Owner
 */
export const getOrderStats = asyncHandler(async (req, res) => {
  try {
    logger.debug("getOrderStats", "Calculating order statistics");

    const stats = await Promise.all([
      OrderModel.countDocuments(),
      OrderModel.countDocuments({ order_status: "pending" }),
      OrderModel.countDocuments({ order_status: "pending_payment" }),
      OrderModel.countDocuments({
        order_status: { $in: ["accepted", "confirmed"] },
      }),
      OrderModel.countDocuments({ order_status: "in_warehouse" }),
      OrderModel.countDocuments({ order_status: "shipped" }),
      OrderModel.countDocuments({ order_status: "out_for_delivery" }),
      OrderModel.countDocuments({
        order_status: { $in: ["delivered", "completed"] },
      }),
      OrderModel.countDocuments({ order_status: "cancelled" }),
      OrderModel.countDocuments({ payment_status: "paid" }),
      OrderModel.countDocuments({ payment_status: "failed" }),
      OrderModel.countDocuments({ payment_status: "pending" }),
      OrderModel.aggregate([
        { $match: { payment_status: "paid" } },
        {
          $addFields: {
            effectiveAmount: {
              $cond: [
                { $gt: ["$finalAmount", 0] },
                "$finalAmount",
                "$totalAmt",
              ],
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$effectiveAmount" } } },
      ]),
      OrderModel.aggregate([
        { $match: { payment_status: "failed" } },
        {
          $addFields: {
            effectiveAmount: {
              $cond: [
                { $gt: ["$finalAmount", 0] },
                "$finalAmount",
                "$totalAmt",
              ],
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$effectiveAmount" } } },
      ]),
    ]);

    logger.info("getOrderStats", "Statistics calculated");

    return sendSuccess(
      res,
      {
        orders: {
          total: stats[0],
          byStatus: {
            pending: stats[1],
            pending_payment: stats[2],
            accepted: stats[3],
            in_warehouse: stats[4],
            shipped: stats[5],
            out_for_delivery: stats[6],
            delivered: stats[7],
            completed: stats[7],
            cancelled: stats[8],
            confirmed: stats[3],
          },
        },
        payments: {
          paid: stats[9],
          failed: stats[10],
          pending: stats[11],
        },
        revenue: {
          paid: stats[12][0]?.total || 0,
          failed: stats[13][0]?.total || 0,
        },
      },
      "Statistics retrieved successfully",
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "getOrderStats");
    return sendError(res, dbError);
  }
});

/**
 * Get dashboard statistics (Admin)
 * @route GET /api/orders/admin/dashboard-stats
 * @access Admin
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    logger.debug("getDashboardStats", "Calculating dashboard statistics");

    const [
      totalOrders,
      totalProducts,
      totalCategories,
      totalUsers,
      totalRevenue,
      recentOrders,
      pendingOrders,
      pendingPayments,
    ] = await Promise.all([
      OrderModel.countDocuments(),
      ProductModel.countDocuments(),
      CategoryModel.countDocuments(),
      UserModel.countDocuments(),
      OrderModel.aggregate([
        { $match: { order_status: { $ne: "cancelled" } } },
        {
          $addFields: {
            effectiveAmount: {
              $cond: [
                { $gt: ["$finalAmount", 0] },
                "$finalAmount",
                "$totalAmt",
              ],
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$effectiveAmount" } } },
      ]),
      OrderModel.find()
        .populate("user", "name email avatar")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      OrderModel.countDocuments({ status: ORDER_STATUS.PENDING }),
      OrderModel.countDocuments({ payment_status: "pending" }),
    ]);

    logger.info("getDashboardStats", "Dashboard statistics calculated");

    return sendSuccess(
      res,
      {
        totals: {
          orders: totalOrders,
          products: totalProducts,
          categories: totalCategories,
          users: totalUsers,
          revenue: totalRevenue[0]?.total || 0,
        },
        alerts: {
          pendingOrders,
          pendingPayments,
        },
        recentOrders,
      },
      "Dashboard data retrieved successfully",
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "getDashboardStats");
    return sendError(res, dbError);
  }
});

/**
 * Get single order by ID
 * @route GET /api/orders/:id
 * @access Admin
 */
export const getOrderById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.validatedData || req.params || {};

    validateMongoId(id, "orderId");

    const requesterId = req.userId || req.user?._id || req.user;
    if (!requesterId) {
      throw new AppError("UNAUTHORIZED");
    }

    logger.debug("getOrderById", "Fetching order", { id });

    const order = await OrderModel.findById(id)
      .populate("user", "name email avatar mobile")
      .populate("delivery_address")
      .populate("influencerId", "code name");

    if (!order) {
      logger.warn("getOrderById", "Order not found", { id });
      throw new AppError("ORDER_NOT_FOUND");
    }

    let isAdmin = false;
    if (req.user?.role) {
      isAdmin = isPrivilegedAdminRole(req.user.role);
    } else {
      const viewer =
        await UserModel.findById(requesterId).select("role status");
      if (!viewer) {
        throw new AppError("UNAUTHORIZED");
      }
      isAdmin = isPrivilegedAdminRole(viewer.role);
    }

    if (!isAdmin) {
      const orderUserId = order.user?._id?.toString() || order.user?.toString();
      if (orderUserId !== requesterId?.toString()) {
        logger.warn("getOrderById", "Access denied for order", {
          requesterId,
          orderId: id,
          orderUserId,
        });
        throw new AppError("FORBIDDEN");
      }
    }

    await reconcileOrderPaymentStatus({
      order,
      req,
      force: true,
      logContext: "getOrderById",
      successSource: "PAYMENT_STATUS_RECONCILE_SINGLE",
      shipmentSource: "PAYMENT_STATUS_RECONCILE_SINGLE_AUTO_SHIPMENT",
    });

    logger.info("getOrderById", "Order retrieved", { id });

    return sendSuccess(
      res,
      normalizeOrderForResponse(order),
      "Order retrieved successfully",
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "getOrderById");
    return sendError(res, dbError);
  }
});

/**
 * Update order status (Admin)
 * @route PUT /api/orders/:id/status
 * @access Admin
 * @param {string} order_status - New order status
 * @param {string} notes - Optional update notes
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  try {
    const requesterRole = String(req?.user?.role || "").trim();
    const normalizedRequesterRole = requesterRole.toLowerCase();
    if (
      !isPrivilegedAdminRole(requesterRole) ||
      normalizedRequesterRole !== "admin"
    ) {
      throw new AppError("FORBIDDEN", {
        message: "Manual order status changes are disabled",
      });
    }

    throw new AppError("FORBIDDEN", {
      message:
        "Manual order status changes are disabled. Order status is updated automatically from payment and shipping events.",
    });
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "updateOrderStatus");
    return sendError(res, dbError);
  }
});

/**
 * Retry automatic shipment creation for a paid order
 * Used when the original auto-shipment failed (e.g. missing pickup config)
 * @route POST /api/admin/orders/:id/retry-shipment
 * @access Admin
 */
export const retryOrderShipment = asyncHandler(async (req, res) => {
  try {
    const orderId = req.params.id || req.validatedData?.id;
    if (!orderId) {
      throw new AppError("MISSING_FIELD", { field: "id" });
    }

    const order = await OrderModel.findById(orderId);
    if (!order) {
      throw new AppError("NOT_FOUND", { entity: "Order", id: orderId });
    }

    if (
      String(order.payment_status || "")
        .trim()
        .toLowerCase() !== "paid"
    ) {
      return sendError(
        res,
        new AppError("VALIDATION_ERROR", {
          message: `Order payment_status is "${order.payment_status}", not "paid". Cannot create shipment.`,
        }),
      );
    }

    if (hasBookedShipment(order)) {
      return sendSuccess(
        res,
        {
          alreadyBooked: true,
          awb_number: order.awb_number || order.awbNumber,
          shipping_provider: order.shipping_provider || order.courierName,
        },
        "Shipment already booked for this order",
      );
    }

    const result = await repairPaidOrderArtifacts({
      order,
      syncContext: "retryOrderShipment",
      shipmentSource: "ADMIN_RETRY_SHIPMENT",
    });

    if (!result.ok || !result.repaired) {
      logger.error("retryOrderShipment", "Shipment retry failed", {
        orderId,
        reason: result.shipmentResult?.reason || "UNKNOWN",
        error: result.shipmentResult?.error?.message || null,
      });
      return sendError(
        res,
        new AppError("INTERNAL_ERROR", {
          message: `Shipment creation failed: ${result.shipmentResult?.reason || "UNKNOWN"}`,
        }),
      );
    }

    return sendSuccess(
      res,
      {
        repaired: true,
        awb_number: result.order?.awb_number || result.order?.awbNumber || null,
        shipping_provider:
          result.order?.shipping_provider || result.order?.courierName || null,
        shipmentResult: result.shipmentResult,
        invoiceResult: result.invoiceResult,
      },
      "Shipment created successfully for order",
    );
  } catch (error) {
    logger.error("retryOrderShipment", "Unhandled error", {
      orderId: req.params.id,
      error: error.message,
    });
    if (error instanceof AppError) {
      return sendError(res, error);
    }
    const dbError = handleDatabaseError(error, "retryOrderShipment");
    return sendError(res, dbError);
  }
});

// ==================== USER ENDPOINTS ====================

/**
 * Get user's orders
 * @route GET /api/orders/user/my-orders
 * @access User (authenticated) / Guest
 */
export const getUserOrders = asyncHandler(async (req, res) => {
  try {
    const userId = req.user;

    if (!userId) {
      logger.warn("getUserOrders", "User ID not found in request");
      throw new AppError("UNAUTHORIZED");
    }

    const userRecord = await UserModel.findById(userId).select("email").lean();
    const userEmail = normalizeEmail(userRecord?.email || "");
    const emailMatch = buildEmailMatchRegex(userEmail);
    const orderQuery = emailMatch
      ? {
          $or: [
            { user: userId },
            { "billingDetails.email": emailMatch },
            { "guestDetails.email": emailMatch },
          ],
        }
      : { user: userId };

    logger.debug("getUserOrders", "Fetching user orders", {
      userId,
      userEmail,
    });

    const orders = await OrderModel.find(orderQuery)
      .populate("user", "name email avatar")
      .populate("delivery_address")
      .populate("influencerId", "code name")
      .sort({ createdAt: -1 })
      .exec();

    await reconcileOrdersForListing({
      orders,
      req,
      limit: 2,
      logContext: "getUserOrders",
      successSource: "PAYMENT_STATUS_RECONCILE_USER_LIST",
      shipmentSource: "PAYMENT_STATUS_RECONCILE_USER_LIST_AUTO_SHIPMENT",
    });

    const normalizedOrders = orders.map((order) =>
      normalizeOrderForResponse(order),
    );

    logger.info("getUserOrders", `Retrieved ${orders.length} orders for user`, {
      userId,
    });

    return sendSuccess(res, normalizedOrders, "Orders retrieved successfully");
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "getUserOrders");
    return sendError(res, dbError);
  }
});

/**
 * Get user's single order (with ownership check)
 * @route GET /api/orders/user/order/:orderId
 * @access User (authenticated only)
 */
export const getUserOrderById = asyncHandler(async (req, res) => {
  try {
    const userId = req.user;
    const id = req.params.orderId || req.params.id;

    if (!userId) {
      throw new AppError("UNAUTHORIZED");
    }

    validateMongoId(id, "orderId");

    logger.debug("getUserOrderById", "Fetching user order", {
      userId,
      orderId: id,
    });

    const order = await OrderModel.findById(id)
      .populate("user", "name email avatar mobile")
      .populate("delivery_address");

    if (!order) {
      logger.warn("getUserOrderById", "Order not found", { orderId: id });
      throw new AppError("ORDER_NOT_FOUND");
    }

    // Check ownership
    const orderUserId = order.user?._id?.toString() || order.user?.toString();
    const requester = await UserModel.findById(userId).select("email").lean();
    const requesterEmail = normalizeEmail(requester?.email || "");
    const orderEmail = normalizeEmail(
      order?.billingDetails?.email || order?.guestDetails?.email || "",
    );
    const isEmailOwner =
      Boolean(requesterEmail) &&
      Boolean(orderEmail) &&
      requesterEmail === orderEmail;

    if (orderUserId !== userId?.toString() && !isEmailOwner) {
      logger.warn(
        "getUserOrderById",
        "User trying to access order they don't own",
        {
          userId,
          orderId: id,
          orderUserId,
          requesterEmail,
          orderEmail,
        },
      );
      throw new AppError("FORBIDDEN");
    }

    await reconcileOrderPaymentStatus({
      order,
      req,
      force: true,
      logContext: "getUserOrderById",
      successSource: "PAYMENT_STATUS_RECONCILE_USER_SINGLE",
      shipmentSource: "PAYMENT_STATUS_RECONCILE_USER_SINGLE_AUTO_SHIPMENT",
    });

    logger.info("getUserOrderById", "Order retrieved", { userId, orderId: id });

    return sendSuccess(
      res,
      normalizeOrderForResponse(order),
      "Order retrieved successfully",
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "getUserOrderById");
    return sendError(res, dbError);
  }
});

/**
 * Download order invoice (Admin or order owner)
 * @route GET /api/orders/:orderId/invoice
 * @access User/Admin
 */
export const downloadOrderInvoice = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;
    const requesterId = req.user;

    validateMongoId(orderId, "orderId");

    if (!requesterId) {
      throw new AppError("UNAUTHORIZED");
    }

    const requester = await UserModel.findById(requesterId).select("_id role");
    if (!requester) {
      throw new AppError("UNAUTHORIZED");
    }

    const order = await OrderModel.findById(orderId)
      .populate("user", "_id name email")
      .populate("delivery_address");

    if (!order) {
      throw new AppError("ORDER_NOT_FOUND");
    }

    const isAdmin = isPrivilegedAdminRole(requester.role);
    const orderUserId =
      order.user?._id?.toString?.() || order.user?.toString?.();
    const requesterEmail = normalizeEmail(requester?.email || "");
    const orderEmail = normalizeEmail(
      order?.billingDetails?.email || order?.guestDetails?.email || "",
    );
    const isEmailOwner =
      Boolean(requesterEmail) &&
      Boolean(orderEmail) &&
      requesterEmail === orderEmail;

    if (
      !isAdmin &&
      (!orderUserId || orderUserId !== requester._id.toString()) &&
      !isEmailOwner
    ) {
      throw new AppError("FORBIDDEN");
    }

    const fallbackInvoiceAbsolutePath = getAbsolutePathFromStoredInvoicePath(
      order.invoicePath || order.invoiceUrl,
    );
    const invoiceDebugContext = {
      orderId,
      requesterId: requester?._id?.toString?.() || String(requesterId || ""),
      requesterRole: requester?.role || null,
      orderStatus: order?.order_status || null,
      paymentStatus: order?.payment_status || null,
      isInvoiceGenerated: Boolean(order?.isInvoiceGenerated),
      invoiceNumber: order?.invoiceNumber || null,
      invoicePath: order?.invoicePath || null,
      invoiceUrl: order?.invoiceUrl || null,
      resolvedFallbackPath: fallbackInvoiceAbsolutePath || null,
      timelineTail: Array.isArray(order?.statusTimeline)
        ? order.statusTimeline.slice(-3).map((entry) => ({
            status: entry?.status || null,
            source: entry?.source || null,
            timestamp: entry?.timestamp || null,
          }))
        : [],
    };

    const invoiceResult = await ensureOrderInvoice(order, {
      forceRegenerate: true,
    });
    if (!invoiceResult.ok) {
      logger.error("downloadOrderInvoice", "Invoice generation failed", {
        ...invoiceDebugContext,
        reason: invoiceResult.reason,
        error: invoiceResult.error?.message || null,
        stack: invoiceResult.error?.stack || null,
      });

      if (fallbackInvoiceAbsolutePath) {
        try {
          await fsPromises.access(fallbackInvoiceAbsolutePath);
          const fallbackFilename = `${sanitizeFileComponent(
            order.invoiceNumber || `invoice_${orderId}`,
            `invoice_${orderId}`,
          )}.pdf`;
          logger.warn(
            "downloadOrderInvoice",
            "Serving fallback invoice file after generation failure",
            {
              ...invoiceDebugContext,
              servedFrom: fallbackInvoiceAbsolutePath,
            },
          );
          return res.download(fallbackInvoiceAbsolutePath, fallbackFilename);
        } catch (fallbackError) {
          logger.warn(
            "downloadOrderInvoice",
            "Fallback invoice file unavailable after generation failure",
            {
              ...invoiceDebugContext,
              fallbackError: fallbackError?.message || String(fallbackError),
            },
          );
        }
      }

      return res.status(400).json({
        error: true,
        success: false,
        message: invoiceResult.reason,
      });
    }

    await fsPromises.access(invoiceResult.absolutePath);

    const filename = `${sanitizeFileComponent(
      invoiceResult.order.invoiceNumber || `invoice_${orderId}`,
      `invoice_${orderId}`,
    )}.pdf`;

    return res.download(invoiceResult.absolutePath, filename, (error) => {
      if (error) {
        logger.error("downloadOrderInvoice", "Failed to send invoice file", {
          orderId,
          error: error.message,
        });

        if (!res.headersSent) {
          return sendError(res, error);
        }
      }
      return undefined;
    });
  } catch (error) {
    if (error instanceof AppError) {
      logger.warn("downloadOrderInvoice", "AppError in downloadOrderInvoice", {
        orderId: req?.params?.orderId || null,
        requesterId: req?.user || null,
        errorCode: error?.code || null,
        errorMessage: error?.message || null,
      });
      return sendError(res, error);
    }

    logger.error(
      "downloadOrderInvoice",
      "Unexpected error in downloadOrderInvoice",
      {
        orderId: req?.params?.orderId || null,
        requesterId: req?.user || null,
        error: error?.message || String(error),
        stack: error?.stack || null,
      },
    );
    const dbError = handleDatabaseError(error, "downloadOrderInvoice");
    return sendError(res, dbError);
  }
});

// ==================== ORDER CREATION & PAYMENT ENDPOINTS ====================

/**
 * Create order (Checkout) - Paytm / PhonePe integration
 * @route POST /api/orders
 * @access User (authenticated) / Guest
 * @param {Array} products - Product array with details
 * @param {number} totalAmt - Total order amount
 * @param {string} delivery_address - Delivery address ID
 */
export const createOrder = asyncHandler(async (req, res) => {
  try {
    const maintenanceMode = await isMaintenanceMode();
    if (maintenanceMode) {
      logger.warn(
        "createOrder",
        "Maintenance mode enabled - blocking checkout",
      );
      return res.status(503).json({
        error: true,
        success: false,
        message:
          "Checkout is temporarily unavailable due to maintenance. Please try again later.",
      });
    }

    if (!(await isPaymentEnabled())) {
      logger.warn("createOrder", "Payment gateway not enabled");
      throw new AppError("PAYMENT_DISABLED");
    }

    const {
      products,
      combos,
      delivery_address,
      couponCode,
      influencerCode,
      notes,
      affiliateCode,
      affiliateSource,
      guestDetails,
      coinRedeem,
      purchaseOrderId,
      paymentType,
      paymentProvider: requestedPaymentProvider,
    } = req.validatedData;
    const userId = req.user || null;
    const selectedPaymentProvider = await resolvePaymentProviderForRequest(
      requestedPaymentProvider,
    );

    logger.debug("createOrder", "Creating order", {
      userId,
      productCount: Array.isArray(products) ? products.length : 0,
      comboCount: Array.isArray(combos) ? combos.length : 0,
    });

    const { normalizedProducts, dbProducts } =
      await fetchAndNormalizeOrderProducts(products || [], "createOrder");
    const comboPayload = await fetchAndNormalizeOrderCombos({
      combos: combos || [],
      userId,
      logContext: "createOrder",
    });
    const mergedProducts = [
      ...normalizedProducts,
      ...comboPayload.expandedProducts,
    ];

    const exclusiveProductIds = dbProducts
      .filter((product) => product.isExclusive === true)
      .map((product) => String(product._id));

    if (comboPayload.expandedProducts.length > 0) {
      const comboProductIds = comboPayload.expandedProducts.map((item) =>
        String(item.productId || ""),
      );
      const comboExclusive = await ProductModel.find({
        _id: { $in: comboProductIds },
        isExclusive: true,
      })
        .select("_id")
        .lean();
      comboExclusive.forEach((product) => {
        exclusiveProductIds.push(String(product._id));
      });
    }

    if (exclusiveProductIds.length > 0) {
      if (!userId) {
        return res.status(403).json({
          error: true,
          success: false,
          message:
            "Login with an active membership to purchase exclusive products.",
        });
      }

      const hasExclusiveAccess = await checkExclusiveAccess(userId);
      if (!hasExclusiveAccess) {
        return res.status(403).json({
          error: true,
          success: false,
          message: "Active membership required for exclusive products.",
        });
      }
    }

    const checkoutContact = await resolveCheckoutContact({
      userId,
      deliveryAddressId: delivery_address || null,
      guestDetails:
        guestDetails || req.body?.guestDetails || req.body?.shippingAddress,
    });
    const pricing = await calculateCheckoutPricing({
      normalizedProducts: mergedProducts,
      comboDiscount: comboPayload.comboDiscount,
      comboOriginalAmount: comboPayload.comboOriginalAmount,
      userId,
      couponCode,
      influencerCode,
      checkoutContact,
      coinRedeem,
      paymentType,
      logContext: "createOrder",
    });

    if (pricing.errorMessage) {
      return res.status(400).json({
        error: true,
        success: false,
        message: pricing.errorMessage,
      });
    }

    const normalizedCouponCode = pricing.normalizedCouponCode;
    const couponDiscount = pricing.couponDiscount;
    const membershipDiscount = pricing.membershipDiscount;
    const influencerDiscount = pricing.influencerDiscount;
    const influencerData = pricing.influencerData;
    const influencerCommission = pricing.influencerCommission;
    const redemption = pricing.redemption;
    const taxData = pricing.taxData;
    const shippingCharge = pricing.shippingCharge;
    const computedFinalAmount = pricing.finalAmount;
    const roundedAmount = pricing.roundedAmount;
    const roundOff = pricing.roundOff;
    const totalDiscount = pricing.totalDiscount;
    const comboDiscount = round2(
      Number(pricing.comboDiscountInclusive ?? pricing.comboDiscount ?? 0),
    );
    const payableAmount = roundedAmount;

    const checkoutPurchaseOrder = await authorizePurchaseOrderForCheckout({
      purchaseOrderId,
      userId,
      checkoutContact,
    });
    const billingDetails =
      buildBillingDetailsFromCheckoutContact(checkoutContact);
    const guestOrderDetails = buildGuestOrderDetails(checkoutContact, {
      include: !userId,
    });

    // Create order in database
    const order = new OrderModel({
      user: userId,
      products: mergedProducts,
      combos: comboPayload.normalizedCombos,
      basePrice: round2(Number(pricing.basePrice || 0)),
      subtotal: taxData.taxableAmount,
      discountedPrice: round2(Number(pricing.taxableAmount || 0)),
      total: round2(Number(pricing.total ?? (computedFinalAmount || 0))),
      totalAmt: computedFinalAmount,
      delivery_address: checkoutContact.addressId || null,
      payment_status: "pending",
      order_status: "pending",
      status: "pending",
      statusTimeline: [
        {
          status: ORDER_STATUS.PENDING,
          source: "ORDER_CREATE",
          timestamp: new Date(),
        },
      ],
      paymentMethod: selectedPaymentProvider,
      originalPrice: pricing.originalAmount,
      comboDiscount,
      discount: totalDiscount,
      finalAmount: computedFinalAmount,
      roundedAmount,
      roundedTotal: roundedAmount,
      roundOff,
      couponCode: normalizedCouponCode,
      discountAmount: couponDiscount,
      membershipDiscount,
      membershipPlan: pricing.membershipPlan?.planId || null,
      tax: taxData.tax,
      shipping: shippingCharge,
      gst: {
        rate: taxData.rate,
        state: taxData.state,
        taxableAmount: taxData.taxableAmount,
        cgst: taxData.cgst,
        sgst: taxData.sgst,
        igst: taxData.igst,
        totalTax: taxData.totalTax || taxData.tax,
      },
      pricing: {
        originalPrice: round2(Number(pricing.originalAmount || 0)),
        basePrice: round2(Number(pricing.basePrice || 0)),
        discount: round2(Number(totalDiscount || 0)),
        discountedPrice: round2(Number(pricing.taxableAmount || 0)),
        gst: round2(Number(pricing.gstAmount || 0)),
        total: round2(Number(pricing.finalAmount || computedFinalAmount || 0)),
        roundedTotal: round2(Number(roundedAmount || 0)),
        roundOff: round2(Number(roundOff || 0)),
        shipping: round2(Number(shippingCharge || 0)),
        state: checkoutContact?.state || "",
        gstRate: CHECKOUT_GST_RATE,
      },
      gstNumber: checkoutContact.contact.gst || "",
      billingDetails,
      deliveryAddressSnapshot: checkoutContact.addressSnapshot,
      guestDetails: guestOrderDetails,
      trackingSessionId:
        String(req.analyticsSessionId || req.cookies?.hog_sid || "").trim() ||
        null,
      analyticsConsent: resolveAnalyticsConsentFromRequest(req),
      coinRedemption: {
        coinsUsed: Number(redemption.coinsUsed || 0),
        amount: Number(redemption.redeemAmount || 0),
      },
      notes: notes || "",
      influencerId: influencerData?._id || null,
      influencerCode: pricing.influencerCode || null,
      influencerDiscount,
      influencerCommission,
      affiliateCode: affiliateCode || pricing.influencerCode || null,
      affiliateSource: affiliateSource || (influencerData ? "referral" : null),
      purchaseOrder: checkoutPurchaseOrder?._id || null,
    });

    await flushExpiredReservationsSafely("createOrder");

    try {
      await reserveComboStock(order, "ORDER_CREATE");
      await reserveInventory(order, "ORDER_CREATE");
      await saveDocumentWithTempIdRetry(order, {
        onDuplicateKey: ({
          attempt,
          maxAttempts,
          document,
          duplicateFields,
        }) => {
          logger.warn(
            "createOrder",
            "Retrying order save after identity key conflict",
            {
              attempt,
              maxAttempts,
              duplicateFields,
              tempOrderId: document?.temp_id || null,
            },
          );
        },
      });
      await syncActiveStockReservations(order, { source: "ORDER_CREATE" });

      void captureOrderEmailInNewsletter({
        req,
        email:
          checkoutContact?.contact?.email ||
          billingDetails?.email ||
          guestOrderDetails?.email ||
          "",
        userId,
        name:
          checkoutContact?.contact?.name ||
          billingDetails?.fullName ||
          guestOrderDetails?.name ||
          "",
        phone:
          billingDetails?.phone ||
          billingDetails?.mobile ||
          guestOrderDetails?.phone ||
          guestOrderDetails?.mobile ||
          "",
        orderId: order?._id || null,
        orderAmount: order?.finalAmount || order?.totalAmt || 0,
        sessionId: order?.trackingSessionId || "",
        affiliateSource: order?.affiliateSource || null,
        influencerCode: order?.influencerCode || null,
        isSavedOrder: Boolean(order?.isSavedOrder),
      }).catch((captureError) => {
        logger.warn("createOrder", "Failed to capture newsletter email", {
          orderId: order?._id,
          userId,
          error: captureError?.message || String(captureError),
        });
      });
    } catch (inventoryError) {
      try {
        await releaseComboStock(order, "ORDER_CREATE_FAIL");
      } catch (releaseError) {
        logger.error("createOrder", "Failed to rollback combo reservation", {
          orderId: order._id,
          error: releaseError.message,
        });
      }
      if (order.inventoryStatus === "reserved") {
        try {
          await releaseInventory(order, "ORDER_CREATE_FAIL");
        } catch (releaseError) {
          logger.error(
            "createOrder",
            "Failed to rollback inventory reservation",
            {
              orderId: order._id,
              error: releaseError.message,
            },
          );
        }
      }
      throw inventoryError;
    }

    // Location capture (90-day retention). Best-effort and non-blocking.
    try {
      let locationForLog = req.validatedData?.location || null;
      let addressFieldsForLog = {
        street:
          checkoutContact?.addressSnapshot?.address_line1 ||
          checkoutContact?.contact?.address ||
          "",
        city:
          checkoutContact?.addressSnapshot?.order_city ||
          checkoutContact?.structuredAddress?.city ||
          "",
        state: checkoutContact?.contact?.state || "",
        pincode: checkoutContact?.contact?.pincode || "",
        country: INDIA_COUNTRY,
      };

      if (checkoutContact?.addressId) {
        const addressDoc = await AddressModel.findById(
          checkoutContact.addressId,
        )
          .select(
            [
              "address_line1",
              "city",
              "state",
              "pincode",
              "country",
              "+location.latitude",
              "+location.longitude",
              "+location.formattedAddress",
              "+location.source",
            ].join(" "),
          )
          .lean();

        if (addressDoc) {
          addressFieldsForLog = {
            street: String(
              addressDoc.address_line1 || addressFieldsForLog.street || "",
            ).trim(),
            city: String(addressDoc.city || "").trim(),
            state: String(
              addressDoc.state || addressFieldsForLog.state || "",
            ).trim(),
            pincode: String(
              addressDoc.pincode || addressFieldsForLog.pincode || "",
            ).trim(),
            country:
              String(
                addressDoc.country || addressFieldsForLog.country || "India",
              ).trim() || "India",
          };

          const addrLoc = addressDoc.location || null;
          if (
            Number.isFinite(Number(addrLoc?.latitude)) &&
            Number.isFinite(Number(addrLoc?.longitude))
          ) {
            locationForLog = {
              source: addrLoc?.source || "google_maps",
              latitude: addrLoc.latitude,
              longitude: addrLoc.longitude,
              formattedAddress: String(addrLoc.formattedAddress || "").trim(),
            };
          }
        }
      }

      const log = await createUserLocationLog({
        userId: userId || null,
        orderId: order._id,
        location: locationForLog,
        addressFields: addressFieldsForLog,
      });

      order.locationLog = log?._id || null;
      await order.save();
    } catch (logErr) {
      logger.warn("createOrder", "Location log creation failed", {
        orderId: order?._id,
        error: logErr?.message || String(logErr),
      });
    }

    if (checkoutPurchaseOrder?._id) {
      await PurchaseOrderModel.findByIdAndUpdate(checkoutPurchaseOrder._id, {
        $set: { status: "approved" },
      });
    }

    if (comboPayload.normalizedCombos.length > 0) {
      const comboOrders = comboPayload.normalizedCombos.map(
        (comboSnapshot) => ({
          comboId: comboSnapshot.comboId,
          orderId: order._id,
          userId,
          quantity: comboSnapshot.quantity,
          comboPrice: round2(comboSnapshot.comboPrice * comboSnapshot.quantity),
          originalPrice: round2(
            comboSnapshot.originalPrice * comboSnapshot.quantity,
          ),
          savings: round2(comboSnapshot.savings * comboSnapshot.quantity),
          orderTotal: round2(Number(order.finalAmount || order.totalAmt || 0)),
          items: comboSnapshot.items,
        }),
      );
      await ComboOrderModel.insertMany(comboOrders);
    }

    logger.info("createOrder", "Order created in database", {
      orderId: order._id,
      userId,
    });

    emitOrderStatusUpdate(order, "ORDER_CREATE");

    const primaryOrigin = resolveClientBaseUrl(req);
    const backendUrl = getBackendBaseUrl(req);
    const merchantTransactionId = buildGatewayMerchantTransactionId(order);

    if (!merchantTransactionId) {
      throw new AppError("INTERNAL_ERROR", {
        message: "Unable to create payment reference for order",
      });
    }

    if (selectedPaymentProvider === PAYMENT_PROVIDERS.PAYTM) {
      const callbackUrl = buildPaytmOrderCallbackUrl({
        configuredCallbackUrl:
          process.env.PAYTM_ORDER_CALLBACK_URL ||
          process.env.PAYTM_CALLBACK_URL,
        backendUrl,
        req,
      });

      const paytmResponse = await createPaytmPayment({
        amount: payableAmount,
        orderId: merchantTransactionId,
        callbackUrl,
        customerId: userId ? String(userId) : "guest",
        mobileNumber:
          checkoutContact.contact.phone ||
          req.body?.shippingAddress?.mobile ||
          null,
        email:
          checkoutContact.contact.email ||
          req.body?.billingDetails?.email ||
          req.body?.guestDetails?.email ||
          null,
      });
      const gatewayBase = (() => {
        try {
          return new URL(String(paytmResponse.gatewayUrl || "")).origin;
        } catch {
          return "";
        }
      })();

      const paymentUrl = `${primaryOrigin}/payment/paytm?mid=${encodeURIComponent(
        paytmResponse.mid,
      )}&orderId=${encodeURIComponent(
        paytmResponse.orderId,
      )}&txnToken=${encodeURIComponent(
        paytmResponse.txnToken,
      )}&amount=${encodeURIComponent(String(payableAmount))}`;
      const paymentUrlWithGateway = gatewayBase
        ? `${paymentUrl}&gatewayBase=${encodeURIComponent(gatewayBase)}`
        : paymentUrl;

      order.paymentId = merchantTransactionId;
      order.paytmOrderId = merchantTransactionId;
      await order.save();

      return sendSuccess(
        res,
        {
          orderId: order._id,
          tempOrderId: order.temp_id || null,
          finalOrderId: order.final_id || null,
          paymentProvider: PAYMENT_PROVIDERS.PAYTM,
          gatewayPayableAmount: payableAmount,
          totals: {
            subtotal: round2(Number(taxData.taxableAmount || 0)),
            tax: round2(Number(taxData.tax || 0)),
            shipping: round2(Number(shippingCharge || 0)),
            finalAmount: round2(Number(computedFinalAmount || 0)),
            roundedAmount,
            roundOff,
          },
          paymentUrl: paymentUrlWithGateway,
          merchantTransactionId,
          txnToken: paytmResponse.txnToken,
          paytmGatewayUrl: paytmResponse.gatewayUrl,
        },
        "Order created successfully",
        201,
      );
    }

    if (selectedPaymentProvider === PAYMENT_PROVIDERS.PHONEPE) {
      if (shouldBlockPhonePeForLocalhost(req)) {
        return res.status(400).json(buildPhonePeLocalhostProdError());
      }

      const callbackUrl = buildPhonePeOrderCallbackUrl({
        configuredCallbackUrl: process.env.PHONEPE_ORDER_CALLBACK_URL,
        backendUrl,
        merchantTransactionId,
      });
      const redirectUrl = buildPhonePeOrderRedirectUrl({
        configuredRedirectUrl: process.env.PHONEPE_REDIRECT_URL,
        primaryOrigin,
        merchantTransactionId,
        orderId: order._id,
        returnPath: "/my-orders",
      });

      const phonepeResponse = await createPhonePePayment({
        amount: payableAmount,
        merchantOrderId: merchantTransactionId,
        redirectUrl,
        callbackUrl,
        customerId: userId ? String(userId) : "guest",
      });

      order.paymentId = merchantTransactionId;
      order.phonepeMerchantOrderId = merchantTransactionId;
      order.phonepeOrderId = phonepeResponse.phonepeOrderId || null;
      await order.save();

      return sendSuccess(
        res,
        {
          orderId: order._id,
          tempOrderId: order.temp_id || null,
          finalOrderId: order.final_id || null,
          paymentProvider: PAYMENT_PROVIDERS.PHONEPE,
          gatewayPayableAmount: payableAmount,
          totals: {
            subtotal: round2(Number(taxData.taxableAmount || 0)),
            tax: round2(Number(taxData.tax || 0)),
            shipping: round2(Number(shippingCharge || 0)),
            finalAmount: round2(Number(computedFinalAmount || 0)),
            roundedAmount,
            roundOff,
          },
          paymentUrl: phonepeResponse.redirectUrl,
          merchantTransactionId,
          phonepeOrderId: phonepeResponse.phonepeOrderId,
          state: phonepeResponse.state,
          expiresAt: phonepeResponse.expireAt,
        },
        "Order created successfully",
        201,
      );
    }

    throw new AppError("INVALID_PAYMENT_METHOD", {
      provider: selectedPaymentProvider,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "createOrder");
    return sendError(res, dbError);
  }
});

/**
 * Preview checkout pricing (server source of truth)
 * @route POST /api/orders/preview
 * @access User (authenticated) / Guest
 */
export const previewOrderPricing = asyncHandler(async (req, res) => {
  try {
    const {
      products,
      combos,
      delivery_address,
      couponCode,
      influencerCode,
      guestDetails,
      coinRedeem,
      paymentType,
    } = req.body || {};

    const hasProducts = Array.isArray(products) && products.length > 0;
    const hasCombos = Array.isArray(combos) && combos.length > 0;
    if (!hasProducts && !hasCombos) {
      throw new AppError("EMPTY_PRODUCTS", {
        fieldName: "products",
        value: products,
      });
    }

    if (hasProducts) {
      validateProductsArray(products, "products");
    }

    if (delivery_address) {
      validateMongoId(delivery_address, "delivery_address");
    }

    const normalizedPaymentType = String(paymentType || "prepaid")
      .trim()
      .toLowerCase();
    const allowedPaymentTypes = new Set(["prepaid", "cod", "reverse"]);
    if (!allowedPaymentTypes.has(normalizedPaymentType)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid paymentType",
      });
    }

    const userId = req.user?._id || req.user?.id || req.user || null;

    const { normalizedProducts, dbProducts } =
      await fetchAndNormalizeOrderProducts(
        products || [],
        "previewOrderPricing",
      );
    const comboPayload = await fetchAndNormalizeOrderCombos({
      combos: combos || [],
      userId,
      logContext: "previewOrderPricing",
    });
    const mergedProducts = [
      ...normalizedProducts,
      ...comboPayload.expandedProducts,
    ];

    const exclusiveProductIds = dbProducts
      .filter((product) => product.isExclusive === true)
      .map((product) => String(product._id));
    if (comboPayload.expandedProducts.length > 0) {
      const comboProductIds = comboPayload.expandedProducts.map((item) =>
        String(item.productId || ""),
      );
      const comboExclusive = await ProductModel.find({
        _id: { $in: comboProductIds },
        isExclusive: true,
      })
        .select("_id")
        .lean();
      comboExclusive.forEach((product) => {
        exclusiveProductIds.push(String(product._id));
      });
    }
    if (exclusiveProductIds.length > 0) {
      if (!userId) {
        return res.status(403).json({
          error: true,
          success: false,
          message:
            "Login with an active membership to purchase exclusive products.",
        });
      }
      const hasExclusiveAccess = await checkExclusiveAccess(userId);
      if (!hasExclusiveAccess) {
        return res.status(403).json({
          error: true,
          success: false,
          message: "Active membership required for exclusive products.",
        });
      }
    }

    const checkoutContact = await resolveCheckoutContact({
      userId,
      deliveryAddressId: delivery_address || null,
      guestDetails: guestDetails || {},
      strictGuestValidation: false,
    });

    const pricing = await calculateCheckoutPricing({
      normalizedProducts: mergedProducts,
      comboDiscount: comboPayload.comboDiscount,
      comboOriginalAmount: comboPayload.comboOriginalAmount,
      userId,
      couponCode,
      influencerCode,
      checkoutContact,
      coinRedeem,
      paymentType: normalizedPaymentType,
      logContext: "previewOrderPricing",
    });

    if (pricing.errorMessage) {
      return res.status(400).json({
        error: true,
        success: false,
        message: pricing.errorMessage,
      });
    }

    return sendSuccess(
      res,
      {
        subtotal: pricing.subtotal,
        discount: pricing.totalDiscount,
        taxableAmount: pricing.taxableAmount,
        gstAmount: pricing.gstAmount,
        shipping: pricing.shippingCharge,
        finalAmount: pricing.finalAmount,
        roundedAmount: pricing.roundedAmount,
        roundOff: pricing.roundOff,
        gatewayPayableAmount: pricing.roundedAmount,
        originalAmount: pricing.originalAmount,
        discountBreakdown: {
          combo: round2(
            Number(
              pricing.comboDiscountInclusive ?? pricing.comboDiscount ?? 0,
            ),
          ),
          membership: pricing.membershipDiscount,
          influencer: pricing.influencerDiscount,
          coupon: pricing.couponDiscount,
          total: pricing.totalDiscount,
        },
        codes: {
          couponCode: pricing.normalizedCouponCode || null,
          influencerCode: pricing.influencerCode || null,
        },
        gst: {
          rate: pricing.taxData?.rate ?? CHECKOUT_GST_RATE,
          state: pricing.taxData?.state || checkoutContact?.state || "",
          taxableAmount: pricing.taxableAmount,
          cgst: pricing.taxData?.cgst ?? 0,
          sgst: pricing.taxData?.sgst ?? 0,
          igst: pricing.taxData?.igst ?? pricing.gstAmount,
          totalTax: pricing.gstAmount,
        },
      },
      "Checkout preview generated successfully",
      200,
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "previewOrderPricing");
    return sendError(res, dbError);
  }
});

/**
 * Save order for later (When payments unavailable)
 * @route POST /api/orders/save-for-later
 * @access User (authenticated) / Guest
 */
export const saveOrderForLater = asyncHandler(async (req, res) => {
  try {
    const {
      products,
      combos,
      delivery_address,
      couponCode,
      influencerCode,
      affiliateCode,
      affiliateSource,
      notes,
      guestDetails,
      coinRedeem,
      purchaseOrderId,
      paymentType,
    } = req.validatedData;

    const userId = req.user?._id || req.user?.id || req.user || null;

    logger.debug("saveOrderForLater", "Saving order for later", {
      userId,
      productCount: Array.isArray(products) ? products.length : 0,
      comboCount: Array.isArray(combos) ? combos.length : 0,
    });

    const { normalizedProducts, dbProducts } =
      await fetchAndNormalizeOrderProducts(products || [], "saveOrderForLater");
    const comboPayload = await fetchAndNormalizeOrderCombos({
      combos: combos || [],
      userId,
      logContext: "saveOrderForLater",
    });
    const mergedProducts = [
      ...normalizedProducts,
      ...comboPayload.expandedProducts,
    ];

    const exclusiveProductIds = dbProducts
      .filter((product) => product.isExclusive === true)
      .map((product) => String(product._id));
    if (comboPayload.expandedProducts.length > 0) {
      const comboProductIds = comboPayload.expandedProducts.map((item) =>
        String(item.productId || ""),
      );
      const comboExclusive = await ProductModel.find({
        _id: { $in: comboProductIds },
        isExclusive: true,
      })
        .select("_id")
        .lean();
      comboExclusive.forEach((product) => {
        exclusiveProductIds.push(String(product._id));
      });
    }

    if (exclusiveProductIds.length > 0) {
      if (!userId) {
        return res.status(403).json({
          error: true,
          success: false,
          message:
            "Login with an active membership to purchase exclusive products.",
        });
      }

      const hasExclusiveAccess = await checkExclusiveAccess(userId);
      if (!hasExclusiveAccess) {
        return res.status(403).json({
          error: true,
          success: false,
          message: "Active membership required for exclusive products.",
        });
      }
    }

    const checkoutContact = await resolveCheckoutContact({
      userId,
      deliveryAddressId: delivery_address || null,
      guestDetails:
        guestDetails || req.body?.guestDetails || req.body?.shippingAddress,
    });
    const pricing = await calculateCheckoutPricing({
      normalizedProducts: mergedProducts,
      comboDiscount: comboPayload.comboDiscount,
      comboOriginalAmount: comboPayload.comboOriginalAmount,
      userId,
      couponCode,
      influencerCode,
      checkoutContact,
      coinRedeem,
      paymentType,
      logContext: "saveOrderForLater",
    });

    if (pricing.errorMessage) {
      return res.status(400).json({
        error: true,
        success: false,
        message: pricing.errorMessage,
      });
    }

    const originalPrice = pricing.originalAmount;
    const normalizedCouponCode = pricing.normalizedCouponCode;
    const couponDiscount = pricing.couponDiscount;
    const membershipDiscount = pricing.membershipDiscount;
    const influencerDiscount = pricing.influencerDiscount;
    const influencerData = pricing.influencerData;
    const influencerCommission = pricing.influencerCommission;
    const redemption = pricing.redemption;
    const taxData = pricing.taxData;
    const shippingCharge = pricing.shippingCharge;
    const finalOrderAmount = pricing.finalAmount;
    const roundedAmount = pricing.roundedAmount;
    const roundOff = pricing.roundOff;
    const totalDiscount = pricing.totalDiscount;
    const comboDiscount = round2(
      Number(pricing.comboDiscountInclusive ?? pricing.comboDiscount ?? 0),
    );

    const checkoutPurchaseOrder = await authorizePurchaseOrderForCheckout({
      purchaseOrderId,
      userId,
      checkoutContact,
    });
    const billingDetails =
      buildBillingDetailsFromCheckoutContact(checkoutContact);
    const guestOrderDetails = buildGuestOrderDetails(checkoutContact, {
      include: !userId,
    });

    // Create saved order
    const savedOrder = new OrderModel({
      user: userId,
      products: mergedProducts,
      combos: comboPayload.normalizedCombos,
      subtotal: taxData.taxableAmount,
      totalAmt: finalOrderAmount,
      delivery_address: checkoutContact.addressId || null,
      order_status: "pending_payment",
      status: "pending",
      payment_status: "unavailable",
      statusTimeline: [
        {
          status: ORDER_STATUS.PAYMENT_PENDING,
          source: "ORDER_SAVE",
          timestamp: new Date(),
        },
      ],
      paymentMethod: "PENDING",
      couponCode: normalizedCouponCode || null,
      discountAmount: couponDiscount,
      discount: totalDiscount,
      membershipDiscount,
      membershipPlan: pricing.membershipPlan?.planId || null,
      comboDiscount,
      finalAmount: finalOrderAmount,
      roundedAmount,
      roundOff,
      influencerId: influencerData?._id || null,
      influencerCode: pricing.influencerCode || null,
      influencerDiscount,
      influencerCommission,
      commissionPaid: false,
      originalPrice,
      tax: taxData.tax,
      shipping: shippingCharge,
      gst: {
        rate: taxData.rate,
        state: taxData.state,
        taxableAmount: taxData.taxableAmount,
        cgst: taxData.cgst,
        sgst: taxData.sgst,
        igst: taxData.igst,
      },
      gstNumber: checkoutContact.contact.gst || "",
      billingDetails,
      deliveryAddressSnapshot: checkoutContact.addressSnapshot,
      guestDetails: guestOrderDetails,
      trackingSessionId:
        String(req.analyticsSessionId || req.cookies?.hog_sid || "").trim() ||
        null,
      analyticsConsent: resolveAnalyticsConsentFromRequest(req),
      coinRedemption: {
        coinsUsed: Number(redemption.coinsUsed || 0),
        amount: Number(redemption.redeemAmount || 0),
      },
      affiliateCode: affiliateCode || pricing.influencerCode || null,
      affiliateSource:
        affiliateSource || (pricing.influencerCode ? "referral" : null),
      purchaseOrder: checkoutPurchaseOrder?._id || null,
      isSavedOrder: true,
      notes: notes || "Order saved - awaiting payment gateway activation",
    });

    await flushExpiredReservationsSafely("saveOrderForLater");

    try {
      await reserveComboStock(savedOrder, "ORDER_SAVE");
      await reserveInventory(savedOrder, "ORDER_SAVE");
      await saveDocumentWithTempIdRetry(savedOrder, {
        onDuplicateKey: ({
          attempt,
          maxAttempts,
          document,
          duplicateFields,
        }) => {
          logger.warn(
            "saveOrderForLater",
            "Retrying saved-order persistence after identity key conflict",
            {
              attempt,
              maxAttempts,
              duplicateFields,
              tempOrderId: document?.temp_id || null,
            },
          );
        },
      });
      await syncActiveStockReservations(savedOrder, { source: "ORDER_SAVE" });

      void captureOrderEmailInNewsletter({
        req,
        email:
          checkoutContact?.contact?.email ||
          billingDetails?.email ||
          guestOrderDetails?.email ||
          "",
        userId,
        name:
          checkoutContact?.contact?.name ||
          billingDetails?.fullName ||
          guestOrderDetails?.name ||
          "",
        phone:
          billingDetails?.phone ||
          billingDetails?.mobile ||
          guestOrderDetails?.phone ||
          guestOrderDetails?.mobile ||
          "",
        orderId: savedOrder?._id || null,
        orderAmount: savedOrder?.finalAmount || savedOrder?.totalAmt || 0,
        sessionId: savedOrder?.trackingSessionId || "",
        affiliateSource: savedOrder?.affiliateSource || null,
        influencerCode: savedOrder?.influencerCode || null,
        isSavedOrder: Boolean(savedOrder?.isSavedOrder),
      }).catch((captureError) => {
        logger.warn("saveOrderForLater", "Failed to capture newsletter email", {
          orderId: savedOrder?._id,
          userId,
          error: captureError?.message || String(captureError),
        });
      });
    } catch (inventoryError) {
      try {
        await releaseComboStock(savedOrder, "ORDER_SAVE_FAIL");
      } catch (releaseError) {
        logger.error(
          "saveOrderForLater",
          "Failed to rollback combo reservation",
          {
            orderId: savedOrder._id,
            error: releaseError.message,
          },
        );
      }
      if (savedOrder.inventoryStatus === "reserved") {
        try {
          await releaseInventory(savedOrder, "ORDER_SAVE_FAIL");
        } catch (releaseError) {
          logger.error(
            "saveOrderForLater",
            "Failed to rollback inventory reservation",
            {
              orderId: savedOrder._id,
              error: releaseError.message,
            },
          );
        }
      }
      throw inventoryError;
    }

    // Location capture (90-day retention). Best-effort and non-blocking.
    try {
      let locationForLog = req.validatedData?.location || null;
      let addressFieldsForLog = {
        street:
          checkoutContact?.addressSnapshot?.address_line1 ||
          checkoutContact?.contact?.address ||
          "",
        city:
          checkoutContact?.addressSnapshot?.order_city ||
          checkoutContact?.structuredAddress?.city ||
          "",
        state: checkoutContact?.contact?.state || "",
        pincode: checkoutContact?.contact?.pincode || "",
        country: INDIA_COUNTRY,
      };

      if (checkoutContact?.addressId) {
        const addressDoc = await AddressModel.findById(
          checkoutContact.addressId,
        )
          .select(
            [
              "address_line1",
              "city",
              "state",
              "pincode",
              "country",
              "+location.latitude",
              "+location.longitude",
              "+location.formattedAddress",
              "+location.source",
            ].join(" "),
          )
          .lean();

        if (addressDoc) {
          addressFieldsForLog = {
            street: String(
              addressDoc.address_line1 || addressFieldsForLog.street || "",
            ).trim(),
            city: String(addressDoc.city || "").trim(),
            state: String(
              addressDoc.state || addressFieldsForLog.state || "",
            ).trim(),
            pincode: String(
              addressDoc.pincode || addressFieldsForLog.pincode || "",
            ).trim(),
            country:
              String(
                addressDoc.country || addressFieldsForLog.country || "India",
              ).trim() || "India",
          };

          const addrLoc = addressDoc.location || null;
          if (
            Number.isFinite(Number(addrLoc?.latitude)) &&
            Number.isFinite(Number(addrLoc?.longitude))
          ) {
            locationForLog = {
              source: addrLoc?.source || "google_maps",
              latitude: addrLoc.latitude,
              longitude: addrLoc.longitude,
              formattedAddress: String(addrLoc.formattedAddress || "").trim(),
            };
          }
        }
      }

      const log = await createUserLocationLog({
        userId: userId || null,
        orderId: savedOrder._id,
        location: locationForLog,
        addressFields: addressFieldsForLog,
      });

      savedOrder.locationLog = log?._id || null;
      await savedOrder.save();
    } catch (logErr) {
      logger.warn("saveOrderForLater", "Location log creation failed", {
        orderId: savedOrder?._id,
        error: logErr?.message || String(logErr),
      });
    }

    if (checkoutPurchaseOrder?._id) {
      await PurchaseOrderModel.findByIdAndUpdate(checkoutPurchaseOrder._id, {
        $set: { status: "approved" },
      });
    }

    if (comboPayload.normalizedCombos.length > 0) {
      const comboOrders = comboPayload.normalizedCombos.map(
        (comboSnapshot) => ({
          comboId: comboSnapshot.comboId,
          orderId: savedOrder._id,
          userId,
          quantity: comboSnapshot.quantity,
          comboPrice: round2(comboSnapshot.comboPrice * comboSnapshot.quantity),
          originalPrice: round2(
            comboSnapshot.originalPrice * comboSnapshot.quantity,
          ),
          savings: round2(comboSnapshot.savings * comboSnapshot.quantity),
          orderTotal: round2(
            Number(savedOrder.finalAmount || savedOrder.totalAmt || 0),
          ),
          items: comboSnapshot.items,
        }),
      );
      await ComboOrderModel.insertMany(comboOrders);
    }

    logger.info("saveOrderForLater", "Order saved for later", {
      orderId: savedOrder._id,
    });

    // Update influencer stats only once per order.
    if (influencerData && !savedOrder.influencerStatsSynced) {
      const influencerStatsSynced = await updateInfluencerStats(
        influencerData._id,
        finalOrderAmount,
        influencerCommission,
      );
      if (influencerStatsSynced) {
        savedOrder.influencerStatsSynced = true;
        await savedOrder.save();
      }
    }

    // Sync to Firestore
    syncOrderToFirestore(savedOrder, "create").catch((err) =>
      logger.error("saveOrderForLater", "Failed to sync to Firestore", {
        orderId: savedOrder._id,
        error: err.message,
      }),
    );

    return sendSuccess(
      res,
      {
        orderId: savedOrder._id,
        orderStatus: savedOrder.order_status,
        paymentStatus: savedOrder.payment_status,
        gatewayPayableAmount: roundedAmount,
        pricing: {
          originalAmount: originalPrice,
          membershipDiscount,
          influencerDiscount,
          couponDiscount,
          coinRedeemAmount: Number(redemption.redeemAmount || 0),
          tax: taxData.tax,
          shipping: shippingCharge,
          totalDiscount,
          finalAmount: finalOrderAmount,
          roundedAmount,
          roundOff,
        },
        discountsApplied: {
          influencer: Boolean(influencerData?.code),
          coupon: !!normalizedCouponCode,
          affiliate: !!savedOrder.affiliateCode,
        },
      },
      "Order saved successfully",
      201,
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "saveOrderForLater");
    return sendError(res, dbError);
  }
});

/**
 * Check payment gateway status
 * @route GET /api/orders/payment-status
 * @access Public
 */
export const getPaymentGatewayStatus = asyncHandler(async (req, res) => {
  try {
    const paymentEnabled = await isPaymentEnabled();
    const enabledProviders = getEnabledPaymentProviders();
    const defaultProvider = await getRuntimeDefaultPaymentProvider();
    const providerStatus = Object.fromEntries(
      Object.entries(PAYMENT_PROVIDER_ENV_ENABLED).map(
        ([provider, enabled]) => [provider, Boolean(enabled)],
      ),
    );

    logger.info("getPaymentGatewayStatus", "Status check", {
      provider: defaultProvider,
      enabled: paymentEnabled,
      enabledProviders,
    });

    return sendSuccess(res, {
      paymentEnabled,
      provider: defaultProvider,
      defaultProvider,
      enabledProviders,
      providers: providerStatus,
      message: paymentEnabled
        ? `${defaultProvider || "Payment gateway"} is active`
        : "Payment gateways are currently unavailable. You can still save orders for later.",
      canSaveOrder: true,
      configurationStatus: paymentEnabled ? "configured" : "not_configured",
    });
  } catch (error) {
    logger.error("getPaymentGatewayStatus", "Error checking payment status", {
      error: error.message,
    });
    return sendError(res, error);
  }
});

/**
 * Get pay-order details (Public with token)
 * @route GET /api/orders/pay-order/:orderId?key=token
 */
export const getPayOrderDetails = asyncHandler(async (req, res) => {
  try {
    const orderIdentifier = req.params.orderId || req.params.id;
    const token = String(req.query?.key || req.body?.key || "").trim();

    const order = await findOrderByIdentifier(orderIdentifier);
    if (!order) {
      throw new AppError("ORDER_NOT_FOUND");
    }

    const tokenCheck = await verifyPayOrderToken(order, token);
    if (!tokenCheck.ok) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Invalid or expired payment link",
        reason: tokenCheck.reason || "invalid_token",
      });
    }

    const normalizedPaymentStatus = String(order.payment_status || "")
      .trim()
      .toLowerCase();
    const normalizedOrderStatus = normalizeOrderStatus(order.order_status);
    const pendingStatuses = new Set([
      ORDER_STATUS.PENDING,
      ORDER_STATUS.PAYMENT_PENDING,
    ]);
    let reservationState = null;
    if (
      normalizedPaymentStatus !== "paid" &&
      pendingStatuses.has(normalizedOrderStatus)
    ) {
      await flushExpiredReservationsSafely("getPayOrderDetails");
      reservationState = await ensureOrderHasActiveReservationForPayment(
        order,
        {
          source: "PAY_ORDER_DETAILS",
          refreshExpiry: true,
          throwOnUnavailable: false,
        },
      );
    }

    const isPayable =
      normalizedPaymentStatus !== "paid" &&
      pendingStatuses.has(normalizedOrderStatus) &&
      reservationState?.status !== "unavailable";
    const reservationExpiresAt =
      reservationState?.expiresAt || order.reservationExpiresAt || null;
    const reservationSecondsRemaining =
      resolveReservationSecondsRemaining(reservationExpiresAt);

    const displayOrderId = resolveDisplayOrderNumber(order);
    const items = Array.isArray(order.products)
      ? order.products.map((item) => ({
          name: String(item?.productTitle || item?.name || "Item").trim(),
          quantity: Math.max(Number(item?.quantity || 0), 0),
          price: round2(Number(item?.price || 0)),
          total: round2(Number(item?.subTotal || 0)),
          image: String(item?.image || ""),
        }))
      : [];

    return sendSuccess(res, {
      orderId: order._id,
      tempOrderId: order.temp_id || null,
      finalOrderId: order.final_id || null,
      displayOrderId,
      paymentStatus: normalizedPaymentStatus || "pending",
      orderStatus: normalizedOrderStatus || "pending",
      payable: isPayable,
      reservationStatus: reservationState?.status || null,
      reservationExpiresAt,
      reservationSecondsRemaining,
      reservationUnavailableReason:
        reservationState?.status === "unavailable"
          ? reservationState.reason || "insufficient_stock"
          : null,
      couponCode: String(order.couponCode || "").trim(),
      couponDiscount: round2(Number(order.discountAmount || 0)),
      totals: {
        subtotal: round2(Number(order.subtotal || 0)),
        discount: round2(Number(order.discount || 0)),
        couponDiscount: round2(Number(order.discountAmount || 0)),
        tax: round2(Number(order.tax || 0)),
        shipping: round2(Number(order.shipping || 0)),
        finalAmount: round2(Number(order.finalAmount || order.totalAmt || 0)),
      },
      items,
      createdAt: order.createdAt || null,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }
    const dbError = handleDatabaseError(error, "getPayOrderDetails");
    return sendError(res, dbError);
  }
});

/**
 * Initiate payment for a pending order (Public with token)
 * @route POST /api/orders/pay-order/:orderId/initiate?key=token
 */
export const initiatePayOrderPayment = asyncHandler(async (req, res) => {
  try {
    const orderIdentifier = req.params.orderId || req.params.id;
    const token = String(req.query?.key || req.body?.key || "").trim();

    const maintenanceMode = await isMaintenanceMode();
    if (maintenanceMode) {
      return res.status(503).json({
        error: true,
        success: false,
        message:
          "Checkout is temporarily unavailable due to maintenance. Please try again later.",
      });
    }

    if (!(await isPaymentEnabled())) {
      throw new AppError("PAYMENT_DISABLED");
    }

    const order = await findOrderByIdentifier(orderIdentifier);
    if (!order) {
      throw new AppError("ORDER_NOT_FOUND");
    }

    const tokenCheck = await verifyPayOrderToken(order, token);
    if (!tokenCheck.ok) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Invalid or expired payment link",
        reason: tokenCheck.reason || "invalid_token",
      });
    }

    const normalizedPaymentStatus = String(order.payment_status || "")
      .trim()
      .toLowerCase();
    if (normalizedPaymentStatus === "paid") {
      throw new AppError("CONFLICT", {
        field: "payment_status",
        message: "Order is already paid",
      });
    }

    const normalizedOrderStatus = normalizeOrderStatus(order.order_status);
    const pendingStatuses = new Set([
      ORDER_STATUS.PENDING,
      ORDER_STATUS.PAYMENT_PENDING,
    ]);
    if (!pendingStatuses.has(normalizedOrderStatus)) {
      throw new AppError("INVALID_STATUS", {
        field: "order_status",
        status: normalizedOrderStatus,
        message: "Order is not eligible for payment",
      });
    }

    await flushExpiredReservationsSafely("initiatePayOrderPayment");
    await ensureOrderHasActiveReservationForPayment(order, {
      source: "PAY_ORDER_INITIATE",
      refreshExpiry: true,
      throwOnUnavailable: true,
    });

    const requestedPaymentProvider = String(
      req.body?.paymentProvider || order.paymentMethod || "",
    )
      .trim()
      .toUpperCase();
    const selectedPaymentProvider = await resolvePaymentProviderForRequest(
      requestedPaymentProvider,
    );

    const payableAmount = Math.max(
      Number(order.roundedAmount || 0) > 0
        ? roundToNearestRupee(order.roundedAmount)
        : resolveGatewayPayableAmount(
            Number(order.finalAmount || order.totalAmt || 0),
          ),
      1,
    );

    const primaryOrigin = resolveClientBaseUrl(req);
    const backendUrl = getBackendBaseUrl(req);
    const returnPath = `/pay-order/${encodeURIComponent(resolveOrderPublicIdentifier(order) || String(order._id))}?key=${encodeURIComponent(
      token,
    )}`;

    const contact = order.billingDetails || order.guestDetails || {};

    let mutated = false;

    if (selectedPaymentProvider === PAYMENT_PROVIDERS.PAYTM) {
      const merchantTransactionId =
        String(order.paytmOrderId || order.paymentId || "").trim() ||
        buildGatewayMerchantTransactionId(order);
      const callbackUrl = buildPaytmOrderCallbackUrl({
        configuredCallbackUrl:
          process.env.PAYTM_ORDER_CALLBACK_URL ||
          process.env.PAYTM_CALLBACK_URL,
        backendUrl,
        req,
      });

      const paytmResponse = await createPaytmPayment({
        amount: payableAmount,
        orderId: merchantTransactionId,
        callbackUrl,
        customerId: order.user ? String(order.user) : "guest",
        mobileNumber: contact.phone || null,
        email: contact.email || null,
      });

      const gatewayBase = (() => {
        try {
          return new URL(String(paytmResponse.gatewayUrl || "")).origin;
        } catch {
          return "";
        }
      })();

      const paymentUrl = `${primaryOrigin}/payment/paytm?mid=${encodeURIComponent(
        paytmResponse.mid,
      )}&orderId=${encodeURIComponent(
        paytmResponse.orderId,
      )}&txnToken=${encodeURIComponent(
        paytmResponse.txnToken,
      )}&amount=${encodeURIComponent(String(payableAmount))}&returnPath=${encodeURIComponent(returnPath)}`;
      const paymentUrlWithGateway = gatewayBase
        ? `${paymentUrl}&gatewayBase=${encodeURIComponent(gatewayBase)}`
        : paymentUrl;

      order.paymentMethod = PAYMENT_PROVIDERS.PAYTM;
      order.payment_status = "pending";
      order.paymentId = merchantTransactionId;
      order.paytmOrderId = merchantTransactionId;
      order.failureReason = "";
      clearOrderPaymentReminderState(order);
      order.updatedAt = new Date();
      await order.save();
      mutated = true;

      syncOrderToFirestore(order, "update").catch((err) =>
        logger.error("initiatePayOrderPayment", "Failed to sync order", {
          orderId: order._id,
          error: err.message,
        }),
      );

      return sendSuccess(res, {
        orderId: order._id,
        tempOrderId: order.temp_id || null,
        finalOrderId: order.final_id || null,
        paymentProvider: PAYMENT_PROVIDERS.PAYTM,
        gatewayPayableAmount: payableAmount,
        totals: {
          subtotal: round2(Number(order.subtotal || 0)),
          tax: round2(Number(order.tax || 0)),
          shipping: round2(Number(order.shipping || 0)),
          finalAmount: round2(Number(order.finalAmount || order.totalAmt || 0)),
          roundedAmount: roundToNearestRupee(
            order.roundedAmount || payableAmount,
          ),
          roundOff: round2(Number(order.roundOff || 0)),
        },
        paymentUrl: paymentUrlWithGateway,
        merchantTransactionId,
        txnToken: paytmResponse.txnToken,
        paytmGatewayUrl: paytmResponse.gatewayUrl,
      });
    }

    if (selectedPaymentProvider === PAYMENT_PROVIDERS.PHONEPE) {
      if (shouldBlockPhonePeForLocalhost(req)) {
        return res.status(400).json(buildPhonePeLocalhostProdError());
      }

      const merchantTransactionId = buildGatewayMerchantTransactionId(order, {
        includeRetrySuffix: true,
      });
      const callbackUrl = buildPhonePeOrderCallbackUrl({
        configuredCallbackUrl: process.env.PHONEPE_ORDER_CALLBACK_URL,
        backendUrl,
        merchantTransactionId,
      });
      const redirectUrl = buildPhonePeOrderRedirectUrl({
        configuredRedirectUrl: process.env.PHONEPE_REDIRECT_URL,
        primaryOrigin,
        merchantTransactionId,
        orderId: order._id,
        returnPath,
      });

      const phonepeResponse = await createPhonePePayment({
        amount: payableAmount,
        merchantOrderId: merchantTransactionId,
        redirectUrl,
        callbackUrl,
        customerId: order.user ? String(order.user) : "guest",
      });

      order.paymentMethod = PAYMENT_PROVIDERS.PHONEPE;
      order.payment_status = "pending";
      order.paymentId = merchantTransactionId;
      order.phonepeMerchantOrderId = merchantTransactionId;
      order.phonepeOrderId = phonepeResponse.phonepeOrderId || null;
      order.failureReason = "";
      clearOrderPaymentReminderState(order);
      order.updatedAt = new Date();
      await order.save();
      mutated = true;

      syncOrderToFirestore(order, "update").catch((err) =>
        logger.error("initiatePayOrderPayment", "Failed to sync order", {
          orderId: order._id,
          error: err.message,
        }),
      );

      return sendSuccess(res, {
        orderId: order._id,
        tempOrderId: order.temp_id || null,
        finalOrderId: order.final_id || null,
        paymentProvider: PAYMENT_PROVIDERS.PHONEPE,
        gatewayPayableAmount: payableAmount,
        totals: {
          subtotal: round2(Number(order.subtotal || 0)),
          tax: round2(Number(order.tax || 0)),
          shipping: round2(Number(order.shipping || 0)),
          finalAmount: round2(Number(order.finalAmount || order.totalAmt || 0)),
          roundedAmount: roundToNearestRupee(
            order.roundedAmount || payableAmount,
          ),
          roundOff: round2(Number(order.roundOff || 0)),
        },
        paymentUrl: phonepeResponse.redirectUrl,
        merchantTransactionId,
        phonepeOrderId: phonepeResponse.phonepeOrderId,
        state: phonepeResponse.state,
        expiresAt: phonepeResponse.expireAt,
      });
    }

    if (mutated) {
      await order.save();
    }

    throw new AppError("INVALID_PAYMENT_METHOD", {
      provider: selectedPaymentProvider,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "initiatePayOrderPayment");
    return sendError(res, dbError);
  }
});

/**
 * Retry payment for an existing unpaid order
 * @route POST /api/orders/:orderId/retry-payment
 * @access User (authenticated + owner)
 */
export const retryOrderPayment = asyncHandler(async (req, res) => {
  try {
    const userId = req.user;
    const orderIdentifier = req.params.orderId || req.params.id;

    if (!userId) {
      throw new AppError("UNAUTHORIZED");
    }

    const maintenanceMode = await isMaintenanceMode();
    if (maintenanceMode) {
      return res.status(503).json({
        error: true,
        success: false,
        message:
          "Checkout is temporarily unavailable due to maintenance. Please try again later.",
      });
    }

    if (!(await isPaymentEnabled())) {
      throw new AppError("PAYMENT_DISABLED");
    }

    const order = await findOrderByIdentifier(orderIdentifier);
    if (!order) {
      throw new AppError("ORDER_NOT_FOUND");
    }

    const orderUserId = order.user?._id?.toString() || order.user?.toString();
    if (orderUserId !== userId?.toString()) {
      throw new AppError("FORBIDDEN");
    }

    const normalizedPaymentStatus = String(order.payment_status || "")
      .trim()
      .toLowerCase();
    if (normalizedPaymentStatus === "paid") {
      throw new AppError("CONFLICT", {
        field: "payment_status",
        message: "Order is already paid",
      });
    }

    const normalizedOrderStatus = normalizeOrderStatus(order.order_status);
    const terminalStatuses = new Set([
      ORDER_STATUS.CANCELLED,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.COMPLETED,
      ORDER_STATUS.RTO,
      ORDER_STATUS.RTO_COMPLETED,
    ]);
    if (terminalStatuses.has(normalizedOrderStatus)) {
      throw new AppError("INVALID_STATUS", {
        field: "order_status",
        status: normalizedOrderStatus,
        message: "Order is not eligible for payment retry",
      });
    }

    if (!PAYMENT_PENDING_ORDER_STATUSES.has(normalizedOrderStatus)) {
      throw new AppError("INVALID_STATUS", {
        field: "order_status",
        status: normalizedOrderStatus,
        message: "Order is not eligible for payment retry",
      });
    }

    await flushExpiredReservationsSafely("retryOrderPayment");
    await ensureOrderHasActiveReservationForPayment(order, {
      source: "RETRY_PAYMENT",
      refreshExpiry: true,
      throwOnUnavailable: true,
    });

    const requestedPaymentProvider = String(
      req.body?.paymentProvider || order.paymentMethod || "",
    )
      .trim()
      .toUpperCase();
    const selectedPaymentProvider = await resolvePaymentProviderForRequest(
      requestedPaymentProvider,
    );

    const payableAmount = Math.max(
      Number(order.roundedAmount || 0) > 0
        ? roundToNearestRupee(order.roundedAmount)
        : resolveGatewayPayableAmount(
            Number(order.finalAmount || order.totalAmt || 0),
          ),
      1,
    );

    const primaryOrigin = resolveClientBaseUrl(req);
    const backendUrl = getBackendBaseUrl(req);

    const contact = order.billingDetails || order.guestDetails || {};

    if (selectedPaymentProvider === PAYMENT_PROVIDERS.PAYTM) {
      const merchantTransactionId =
        String(order.paytmOrderId || order.paymentId || "").trim() ||
        buildGatewayMerchantTransactionId(order);
      const callbackUrl = buildPaytmOrderCallbackUrl({
        configuredCallbackUrl:
          process.env.PAYTM_ORDER_CALLBACK_URL ||
          process.env.PAYTM_CALLBACK_URL,
        backendUrl,
        req,
      });

      const paytmResponse = await createPaytmPayment({
        amount: payableAmount,
        orderId: merchantTransactionId,
        callbackUrl,
        customerId: userId ? String(userId) : "guest",
        mobileNumber: contact.phone || null,
        email: contact.email || null,
      });

      const gatewayBase = (() => {
        try {
          return new URL(String(paytmResponse.gatewayUrl || "")).origin;
        } catch {
          return "";
        }
      })();

      const paymentUrl = `${primaryOrigin}/payment/paytm?mid=${encodeURIComponent(
        paytmResponse.mid,
      )}&orderId=${encodeURIComponent(
        paytmResponse.orderId,
      )}&txnToken=${encodeURIComponent(
        paytmResponse.txnToken,
      )}&amount=${encodeURIComponent(String(payableAmount))}`;
      const paymentUrlWithGateway = gatewayBase
        ? `${paymentUrl}&gatewayBase=${encodeURIComponent(gatewayBase)}`
        : paymentUrl;

      order.paymentMethod = PAYMENT_PROVIDERS.PAYTM;
      order.payment_status = "pending";
      order.paymentId = merchantTransactionId;
      order.paytmOrderId = merchantTransactionId;
      order.failureReason = "";
      clearOrderPaymentReminderState(order);
      order.updatedAt = new Date();
      await order.save();

      syncOrderToFirestore(order, "update").catch((err) =>
        logger.error("retryOrderPayment", "Failed to sync order to Firestore", {
          orderId: order._id,
          error: err.message,
        }),
      );

      return sendSuccess(res, {
        orderId: order._id,
        tempOrderId: order.temp_id || null,
        finalOrderId: order.final_id || null,
        paymentProvider: PAYMENT_PROVIDERS.PAYTM,
        gatewayPayableAmount: payableAmount,
        totals: {
          subtotal: round2(Number(order.subtotal || 0)),
          tax: round2(Number(order.tax || 0)),
          shipping: round2(Number(order.shipping || 0)),
          finalAmount: round2(Number(order.finalAmount || order.totalAmt || 0)),
          roundedAmount: roundToNearestRupee(
            order.roundedAmount || payableAmount,
          ),
          roundOff: round2(Number(order.roundOff || 0)),
        },
        paymentUrl: paymentUrlWithGateway,
        merchantTransactionId,
        txnToken: paytmResponse.txnToken,
        paytmGatewayUrl: paytmResponse.gatewayUrl,
      });
    }

    if (selectedPaymentProvider === PAYMENT_PROVIDERS.PHONEPE) {
      if (shouldBlockPhonePeForLocalhost(req)) {
        return res.status(400).json(buildPhonePeLocalhostProdError());
      }

      const merchantTransactionId = buildGatewayMerchantTransactionId(order, {
        includeRetrySuffix: true,
      });
      const callbackUrl = buildPhonePeOrderCallbackUrl({
        configuredCallbackUrl: process.env.PHONEPE_ORDER_CALLBACK_URL,
        backendUrl,
        merchantTransactionId,
      });
      const redirectUrl = buildPhonePeOrderRedirectUrl({
        configuredRedirectUrl: process.env.PHONEPE_REDIRECT_URL,
        primaryOrigin,
        merchantTransactionId,
        orderId: order._id,
        returnPath: "/my-orders",
      });

      const phonepeResponse = await createPhonePePayment({
        amount: payableAmount,
        merchantOrderId: merchantTransactionId,
        redirectUrl,
        callbackUrl,
        customerId: userId ? String(userId) : "guest",
      });

      order.paymentMethod = PAYMENT_PROVIDERS.PHONEPE;
      order.payment_status = "pending";
      order.paymentId = merchantTransactionId;
      order.phonepeMerchantOrderId = merchantTransactionId;
      order.phonepeOrderId = phonepeResponse.phonepeOrderId || null;
      order.failureReason = "";
      clearOrderPaymentReminderState(order);
      order.updatedAt = new Date();
      await order.save();

      syncOrderToFirestore(order, "update").catch((err) =>
        logger.error("retryOrderPayment", "Failed to sync order to Firestore", {
          orderId: order._id,
          error: err.message,
        }),
      );

      return sendSuccess(res, {
        orderId: order._id,
        tempOrderId: order.temp_id || null,
        finalOrderId: order.final_id || null,
        paymentProvider: PAYMENT_PROVIDERS.PHONEPE,
        gatewayPayableAmount: payableAmount,
        totals: {
          subtotal: round2(Number(order.subtotal || 0)),
          tax: round2(Number(order.tax || 0)),
          shipping: round2(Number(order.shipping || 0)),
          finalAmount: round2(Number(order.finalAmount || order.totalAmt || 0)),
          roundedAmount: roundToNearestRupee(
            order.roundedAmount || payableAmount,
          ),
          roundOff: round2(Number(order.roundOff || 0)),
        },
        paymentUrl: phonepeResponse.redirectUrl,
        merchantTransactionId,
        phonepeOrderId: phonepeResponse.phonepeOrderId,
        state: phonepeResponse.state,
        expiresAt: phonepeResponse.expireAt,
      });
    }

    throw new AppError("INVALID_PAYMENT_METHOD", {
      provider: selectedPaymentProvider,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "retryOrderPayment");
    return sendError(res, dbError);
  }
});

const runPostPaymentSuccessTasks = async ({
  order,
  webhookContext = "paymentWebhook",
  shipmentSource = "PAYMENT_WEBHOOK_AUTO_SHIPMENT",
}) => {
  if (!order) return;

  if (order.user && Number(order.coinRedemption?.coinsUsed || 0) > 0) {
    try {
      await applyRedemptionToUser({
        userId: order.user,
        coinsUsed: Number(order.coinRedemption.coinsUsed || 0),
        source: "order",
        referenceId: String(order._id),
        meta: {
          orderId: String(order._id),
          paymentId: order.paymentId || null,
        },
      });
    } catch (coinError) {
      logger.error(webhookContext, "Failed to deduct redeemed coins", {
        orderId: order._id,
        error: coinError.message,
      });
    }
  }

  if (order.couponCode) {
    recordCouponUsage(order).catch((err) =>
      logger.error(webhookContext, "Failed to record coupon usage", {
        orderId: order._id,
        error: err.message,
      }),
    );
  }

  if (order.influencerId && !order.influencerStatsSynced) {
    const effectiveAmount =
      order.finalAmount > 0 ? order.finalAmount : order.totalAmt;
    const commissionBaseAmount = resolveInfluencerCommissionBase(order);
    let commission = order.influencerCommission || 0;
    if (!commission && order.influencerId) {
      commission = await calculateInfluencerCommission(
        order.influencerId,
        commissionBaseAmount,
      );
      order.influencerCommission = commission;
    }

    try {
      const influencerStatsSynced = await updateInfluencerStats(
        order.influencerId,
        effectiveAmount,
        commission,
      );
      if (influencerStatsSynced) {
        order.influencerStatsSynced = true;
        await order.save();
      }
    } catch (err) {
      logger.error(webhookContext, "Failed to update influencer stats", {
        orderId: order._id,
        error: err.message,
      });
    }
  }

  if (order.user) {
    try {
      const effectiveAmount = Math.max(
        Number(order.subtotal || 0) - Number(order.discount || 0),
        0,
      );
      const awardResult = await awardCoinsToUser({
        userId: order.user,
        orderAmount: effectiveAmount,
        source: "order",
        referenceId: String(order._id),
      });
      if (awardResult.coinsAwarded > 0) {
        order.coinsAwarded = awardResult.coinsAwarded;
        await order.save();
      }
    } catch (coinError) {
      logger.error(webhookContext, "Failed to award coins", {
        orderId: order._id,
        error: coinError.message,
      });
    }
  }

  const autoShipmentResult = await autoCreateShipmentForPaidOrder({
    orderId: order._id,
    source: shipmentSource,
  });
  if (!autoShipmentResult.ok) {
    const logLevel = autoShipmentResult.skipped ? "warn" : "error";
    logger[logLevel](webhookContext, "Automatic shipment booking failed", {
      orderId: order._id,
      reason: autoShipmentResult.reason || "SHIPMENT_CREATION_FAILED",
      skipped: Boolean(autoShipmentResult.skipped),
      error: autoShipmentResult.error?.message || null,
    });
  }

  if (autoShipmentResult?.order) {
    order.awb_number = autoShipmentResult.order.awb_number;
    order.awbNumber = autoShipmentResult.order.awbNumber;
    order.shipment_status = autoShipmentResult.order.shipment_status;
    order.shipmentStatus = autoShipmentResult.order.shipmentStatus;
    order.shipping_provider = autoShipmentResult.order.shipping_provider;
    order.courierName = autoShipmentResult.order.courierName;
    order.trackingUrl = autoShipmentResult.order.trackingUrl;
    order.shipmentId = autoShipmentResult.order.shipmentId;
    order.manifestId = autoShipmentResult.order.manifestId;
  }
};

const hasInvoiceArtifacts = (order) =>
  Boolean(
    order?.invoicePath ||
    order?.invoiceNumber ||
    order?.invoiceGeneratedAt ||
    order?.isInvoiceGenerated ||
    order?.invoiceUrl,
  );

const hasBookedShipment = (order) =>
  Boolean(
    String(
      order?.awbNumber || order?.awb_number || order?.shipmentId || "",
    ).trim(),
  );

const mergeShipmentFieldsFromOrder = (targetOrder, sourceOrder) => {
  if (!targetOrder || !sourceOrder) return;
  targetOrder.awb_number = sourceOrder.awb_number;
  targetOrder.awbNumber = sourceOrder.awbNumber;
  targetOrder.shipment_status = sourceOrder.shipment_status;
  targetOrder.shipmentStatus = sourceOrder.shipmentStatus;
  targetOrder.shipping_provider = sourceOrder.shipping_provider;
  targetOrder.courierName = sourceOrder.courierName;
  targetOrder.trackingUrl = sourceOrder.trackingUrl;
  targetOrder.shipmentId = sourceOrder.shipmentId;
  targetOrder.manifestId = sourceOrder.manifestId;
  targetOrder.shipping_label = sourceOrder.shipping_label;
  targetOrder.shipping_manifest = sourceOrder.shipping_manifest;
  targetOrder.shipping_label_local_path = sourceOrder.shipping_label_local_path;
  targetOrder.shipmentFailureCount = sourceOrder.shipmentFailureCount;
  targetOrder.shipmentLastError = sourceOrder.shipmentLastError;
};

const repairPaidOrderArtifacts = async ({
  order,
  syncContext = "repairPaidOrderArtifacts",
  shipmentSource = "PAYMENT_REPAIR_AUTO_SHIPMENT",
}) => {
  if (!order) {
    return { ok: false, repaired: false, reason: "ORDER_NOT_FOUND" };
  }

  if (
    String(order.payment_status || "")
      .trim()
      .toLowerCase() !== "paid"
  ) {
    return { ok: true, repaired: false, reason: "PAYMENT_NOT_PAID", order };
  }

  let repaired = false;
  let invoiceResult = null;
  let shipmentResult = null;

  if (!hasInvoiceArtifacts(order)) {
    invoiceResult = await ensureOrderInvoice(order);
    if (!invoiceResult.ok) {
      logger.warn(syncContext, "Invoice repair skipped", {
        orderId: order._id,
        reason: invoiceResult.reason,
      });
    } else {
      repaired = true;
    }
  }

  if (!hasBookedShipment(order)) {
    shipmentResult = await autoCreateShipmentForPaidOrder({
      orderId: order._id,
      source: shipmentSource,
    });
    if (shipmentResult?.order) {
      mergeShipmentFieldsFromOrder(order, shipmentResult.order);
    }
    if (shipmentResult?.ok) {
      repaired = true;
    }
  }

  if (repaired) {
    syncOrderToFirestore(order, "update").catch((err) =>
      logger.error(syncContext, "Failed to sync repaired order", {
        orderId: order._id,
        error: err.message,
      }),
    );
    emitOrderStatusUpdate(order, syncContext);
  }

  return {
    ok: true,
    repaired,
    order,
    invoiceResult,
    shipmentResult,
  };
};

const resolvePaymentProviderFromOrder = (order = {}) => {
  const method = String(order?.paymentMethod || "")
    .trim()
    .toUpperCase();

  if (
    method === PAYMENT_PROVIDERS.PAYTM ||
    String(order?.paytmOrderId || "").trim()
  ) {
    return PAYMENT_PROVIDERS.PAYTM;
  }

  if (
    method === PAYMENT_PROVIDERS.PHONEPE ||
    String(order?.phonepeMerchantOrderId || "").trim() ||
    String(order?.phonepeOrderId || "").trim()
  ) {
    return PAYMENT_PROVIDERS.PHONEPE;
  }

  return null;
};

const SUCCESSFUL_BACKFILL_ORDER_STATUSES = new Set([
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.CONFIRMED_LEGACY,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.COMPLETED,
]);

const SUCCESSFUL_BACKFILL_PAYMENT_STATUSES = new Set([
  "paid",
  "confirmed",
  "captured",
  "success",
  "successful",
]);

const isGatewayMerchantReference = (value) =>
  /^BOG_/i.test(String(value || "").trim());

const resolveProviderTransactionIdForBackfill = (order = {}) => {
  return [order?.paytmTransactionId, order?.phonepeTransactionId]
    .map((value) => String(value || "").trim())
    .find(Boolean);
};

const isSuccessfulOrderCandidateForBackfill = (order = {}) => {
  const paymentStatus = String(order?.payment_status || "")
    .trim()
    .toLowerCase();
  const orderStatus = normalizeOrderStatus(order?.order_status);

  return (
    SUCCESSFUL_BACKFILL_PAYMENT_STATUSES.has(paymentStatus) ||
    SUCCESSFUL_BACKFILL_ORDER_STATUSES.has(orderStatus)
  );
};

const shouldAttemptPaymentReconciliation = (order, { force = false } = {}) => {
  if (!order?._id) return false;

  const paymentStatus = String(order.payment_status || "")
    .trim()
    .toLowerCase();
  if (paymentStatus === "paid" || paymentStatus === "failed") {
    return false;
  }

  if (normalizeOrderStatus(order.order_status) === ORDER_STATUS.CANCELLED) {
    return false;
  }

  const provider = resolvePaymentProviderFromOrder(order);
  if (!provider) return false;

  if (!force) {
    const createdAt = order.createdAt ? new Date(order.createdAt) : null;
    const maxAgeMs = 1000 * 60 * 60 * 48;
    if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
    if (Date.now() - createdAt.getTime() > maxAgeMs) return false;
  }

  if (provider === PAYMENT_PROVIDERS.PAYTM) {
    return (
      PAYMENT_PROVIDER_ENV_ENABLED.PAYTM &&
      Boolean(
        String(order.paytmOrderId || "").trim() ||
        (resolvePaymentProviderFromOrder(order) === PAYMENT_PROVIDERS.PAYTM &&
          String(order.paymentId || "")
            .trim()
            .startsWith("BOG_")),
      )
    );
  }

  if (provider === PAYMENT_PROVIDERS.PHONEPE) {
    return (
      PAYMENT_PROVIDER_ENV_ENABLED.PHONEPE &&
      Boolean(String(order.phonepeMerchantOrderId || "").trim())
    );
  }

  return false;
};

const applyResolvedPaymentStatus = async ({
  order,
  normalizedState,
  paymentProvider,
  merchantTransactionId = null,
  transactionId = null,
  providerOrderIdField = null,
  providerTransactionIdField = null,
  extraUpdates = {},
  successSource = "PAYMENT_RESOLVED",
  shipmentSource = "PAYMENT_RESOLVED_AUTO_SHIPMENT",
  failureReason = "Payment failed",
  req = null,
  logContext = "applyResolvedPaymentStatus",
  trackingSource = "payment_resolution",
}) => {
  if (!order) {
    return { ok: false, skipped: true, reason: "ORDER_NOT_FOUND" };
  }

  const wasPaid =
    String(order.payment_status || "")
      .trim()
      .toLowerCase() === "paid";
  let orderMutated = false;
  const hasPaymentReminder =
    Boolean(order.paymentReminderEmailSentAt) ||
    Boolean(order.paymentReminderEmailFailureKind) ||
    Boolean(order.paymentReminderEmailProvider);

  if (
    merchantTransactionId &&
    providerOrderIdField &&
    String(order[providerOrderIdField] || "") !== String(merchantTransactionId)
  ) {
    order[providerOrderIdField] = merchantTransactionId;
    orderMutated = true;
  }

  if (
    transactionId &&
    providerTransactionIdField &&
    String(order[providerTransactionIdField] || "") !== String(transactionId)
  ) {
    order[providerTransactionIdField] = transactionId;
    order.paymentId = transactionId;
    order.paymentAppTxnId = transactionId;
    orderMutated = true;
  }

  if (
    transactionId &&
    String(order.paymentAppTxnId || "") !== String(transactionId)
  ) {
    order.paymentAppTxnId = transactionId;
    orderMutated = true;
  }

  if (
    paymentProvider &&
    String(order.paymentProvider || "") !== String(paymentProvider)
  ) {
    order.paymentProvider = paymentProvider;
    orderMutated = true;
  }

  Object.entries(extraUpdates || {}).forEach(([key, value]) => {
    if (value === undefined) return;
    if (String(order[key] ?? "") !== String(value ?? "")) {
      order[key] = value;
      orderMutated = true;
    }
  });

  if (normalizedState === "success") {
    if (!wasPaid) {
      order.payment_status = "paid";
      order.paymentCompletedAt = new Date();
      if (paymentProvider) {
        order.paymentMethod = paymentProvider;
      }
      order.status = "confirmed";
      order.failureReason = "";
      applyOrderStatusTransition(order, ORDER_STATUS.ACCEPTED, {
        source: successSource,
      });
      await confirmComboStock(order, successSource);
      await confirmInventory(order, successSource);
      await trackRestockConversionsForOrder(order, {
        source: successSource,
      });
      orderMutated = true;
    }
    if (hasPaymentReminder) {
      clearOrderPaymentReminderState(order);
      orderMutated = true;
    }
  } else if (normalizedState === "fail") {
    if (!wasPaid) {
      order.payment_status = "failed";
      order.status = "pending";
      order.failureReason = failureReason;
      await releaseComboStock(order, successSource);
      await releaseInventory(order, successSource);
      orderMutated = true;
    }
  } else if (normalizedState === "pending") {
    if (
      !wasPaid &&
      String(order.payment_status || "")
        .trim()
        .toLowerCase() !== "pending"
    ) {
      order.payment_status = "pending";
      order.status = "pending";
      orderMutated = true;
    }
    if (hasPaymentReminder) {
      clearOrderPaymentReminderState(order);
      orderMutated = true;
    }
  } else {
    return { ok: false, skipped: true, reason: "UNKNOWN_PAYMENT_STATE", order };
  }

  if (orderMutated) {
    order.updatedAt = new Date();
    await order.save();
  }

  if (
    !wasPaid &&
    String(order.payment_status || "")
      .trim()
      .toLowerCase() === "paid"
  ) {
    const finalIdAssignment = await assignFinalOrderIdAfterPaymentSuccess({
      order,
      confirmedAt: order.paymentCompletedAt || new Date(),
    });
    if (finalIdAssignment?.order) {
      order = finalIdAssignment.order;
    }
    if (finalIdAssignment?.assigned) {
      orderMutated = true;
    }
  }

  let invoiceResult = null;
  if (
    String(order.payment_status || "")
      .trim()
      .toLowerCase() === "paid"
  ) {
    invoiceResult = await ensureOrderInvoice(order);
    if (!invoiceResult.ok) {
      logger.warn(
        logContext,
        "Invoice generation failed after payment confirmation",
        {
          orderId: order._id,
          provider: paymentProvider,
          reason: invoiceResult.reason,
        },
      );
    }
  }

  if (
    !wasPaid &&
    String(order.payment_status || "")
      .trim()
      .toLowerCase() === "paid"
  ) {
    try {
      if (await linkOrderToUserByEmail(order)) {
        orderMutated = true;
        await order.save();
      }
    } catch (linkError) {
      logger.warn(logContext, "Failed to link order to user by email", {
        orderId: order?._id,
        error: linkError?.message || String(linkError),
      });
    }

    if (req) {
      emitPurchaseCompletedTrackingEvent({
        req,
        order,
        source: trackingSource,
      });
    }

    await runPostPaymentSuccessTasks({
      order,
      webhookContext: logContext,
      shipmentSource,
    });

    scheduleOrderPaymentSuccessEmails({
      order,
      paymentProvider,
      logContext,
    });
  }

  if (orderMutated || invoiceResult?.ok) {
    syncOrderToFirestore(order, "update").catch((err) =>
      logger.error(
        logContext,
        "Failed to sync order after payment resolution",
        {
          orderId: order._id,
          error: err.message,
        },
      ),
    );
    emitOrderStatusUpdate(order, successSource);
  }

  return {
    ok: true,
    skipped: !orderMutated && !invoiceResult?.ok,
    order,
    wasPaid,
    invoiceResult,
  };
};

const reconcileOrderPaymentStatus = async ({
  order,
  req = null,
  force = false,
  logContext = "reconcileOrderPaymentStatus",
  successSource = "PAYMENT_STATUS_RECONCILE",
  shipmentSource = "PAYMENT_STATUS_RECONCILE_AUTO_SHIPMENT",
}) => {
  if (!order) {
    return { ok: false, skipped: true, reason: "ORDER_NOT_FOUND" };
  }

  const paymentStatus = String(order.payment_status || "")
    .trim()
    .toLowerCase();
  if (paymentStatus === "paid") {
    return repairPaidOrderArtifacts({
      order,
      syncContext: logContext,
      shipmentSource,
    });
  }

  if (!shouldAttemptPaymentReconciliation(order, { force })) {
    return { ok: true, skipped: true, reason: "RECONCILE_SKIPPED", order };
  }

  const provider = resolvePaymentProviderFromOrder(order);
  if (provider === PAYMENT_PROVIDERS.PAYTM) {
    const merchantTransactionId =
      String(order.paytmOrderId || "").trim() ||
      (String(order.paymentId || "")
        .trim()
        .startsWith("BOG_")
        ? String(order.paymentId || "").trim()
        : "");
    if (!merchantTransactionId) {
      return {
        ok: true,
        skipped: true,
        reason: "MISSING_PAYTM_ORDER_ID",
        order,
      };
    }

    const verifiedStatus = await verifyPaytmWebhookState(merchantTransactionId);
    const normalizedState = resolvePaytmState(verifiedStatus?.state);
    if (!normalizedState) {
      return {
        ok: true,
        skipped: true,
        reason: "PAYTM_STATE_UNCHANGED",
        order,
      };
    }

    return applyResolvedPaymentStatus({
      order,
      normalizedState,
      paymentProvider: provider,
      merchantTransactionId,
      transactionId: verifiedStatus?.transactionId || null,
      providerOrderIdField: "paytmOrderId",
      providerTransactionIdField: "paytmTransactionId",
      successSource,
      shipmentSource,
      failureReason: "Paytm payment failed",
      req,
      logContext,
    });
  }

  if (provider === PAYMENT_PROVIDERS.PHONEPE) {
    const merchantOrderId = String(order.phonepeMerchantOrderId || "").trim();
    if (!merchantOrderId) {
      return {
        ok: true,
        skipped: true,
        reason: "MISSING_PHONEPE_ORDER_ID",
        order,
      };
    }

    const verifiedStatus = await verifyPhonePeWebhookState(merchantOrderId);
    const normalizedState = normalizePhonePeState(verifiedStatus?.state);
    if (!normalizedState) {
      return {
        ok: true,
        skipped: true,
        reason: "PHONEPE_STATE_UNCHANGED",
        order,
      };
    }

    const resolvedState =
      normalizedState.includes("COMPLETED") ||
      normalizedState.includes("SUCCESS")
        ? "success"
        : normalizedState.includes("FAIL") ||
            normalizedState.includes("DECLINED")
          ? "fail"
          : normalizedState.includes("PENDING") ||
              normalizedState.includes("CREATED")
            ? "pending"
            : "";

    if (!resolvedState) {
      return {
        ok: true,
        skipped: true,
        reason: "PHONEPE_STATE_UNKNOWN",
        order,
      };
    }

    return applyResolvedPaymentStatus({
      order,
      normalizedState: resolvedState,
      paymentProvider: provider,
      merchantTransactionId: merchantOrderId,
      transactionId: verifiedStatus?.transactionId || null,
      providerOrderIdField: "phonepeMerchantOrderId",
      providerTransactionIdField: "phonepeTransactionId",
      extraUpdates: {
        phonepeOrderId:
          verifiedStatus?.phonepeOrderId || order.phonepeOrderId || null,
        upiRef: verifiedStatus?.upiReference || order.upiRef || null,
        upiReferenceNumber:
          verifiedStatus?.upiReference || order.upiReferenceNumber || null,
        upiReferenceNo:
          verifiedStatus?.upiReference || order.upiReferenceNo || null,
        rrn: verifiedStatus?.upiReference || order.rrn || null,
        utr: verifiedStatus?.upiReference || order.utr || null,
        utrNumber:
          verifiedStatus?.utrNumber ||
          extractUtrNumber({
            providerReferenceId: verifiedStatus?.upiReference,
            txnId: verifiedStatus?.transactionId,
          }) ||
          order.utrNumber ||
          null,
        upiRefId:
          verifiedStatus?.upiReference ||
          verifiedStatus?.transactionId ||
          order.upiRefId ||
          null,
      },
      successSource,
      shipmentSource,
      failureReason: "PhonePe payment failed",
      req,
      logContext,
    });
  }

  return { ok: true, skipped: true, reason: "UNSUPPORTED_PROVIDER", order };
};

const reconcileOrdersForListing = async ({
  orders,
  req = null,
  limit = 3,
  logContext = "reconcileOrdersForListing",
  successSource = "PAYMENT_STATUS_RECONCILE_LIST",
  shipmentSource = "PAYMENT_STATUS_RECONCILE_LIST_AUTO_SHIPMENT",
}) => {
  const maxCandidates = Math.max(Number(limit || 0), 0);
  if (!maxCandidates) return;

  const list = Array.isArray(orders) ? orders : [];
  const candidateQueue = [];
  const seen = new Set();

  const markCandidate = (order, type) => {
    if (!order?._id) return;
    const id = String(order._id);
    if (seen.has(id)) return;
    seen.add(id);
    candidateQueue.push({ order, type });
  };

  const needsPaidRepair = (order) =>
    String(order?.payment_status || "")
      .trim()
      .toLowerCase() === "paid" &&
    (!hasInvoiceArtifacts(order) || !hasBookedShipment(order));

  list.forEach((order) => {
    if (shouldAttemptPaymentReconciliation(order, { force: false })) {
      markCandidate(order, "reconcile");
    }
  });

  list.forEach((order) => {
    if (needsPaidRepair(order)) {
      markCandidate(order, "repair");
    }
  });

  const candidates = candidateQueue.slice(0, maxCandidates);

  if (candidates.length === 0) return;

  await Promise.allSettled(
    candidates.map(({ order, type }) =>
      type === "repair"
        ? repairPaidOrderArtifacts({
            order,
            syncContext: logContext,
            shipmentSource,
          })
        : reconcileOrderPaymentStatus({
            order,
            req,
            force: false,
            logContext,
            successSource,
            shipmentSource,
          }),
    ),
  );
};

// ==================== WEBHOOK HANDLERS ====================

/**
 * Paytm Webhook Handler
 * @route POST /api/orders/webhook/paytm
 * @access Public (payment state verified via Paytm status API)
 */
export const handlePaytmWebhook = asyncHandler(async (req, res) => {
  try {
    logger.debug("handlePaytmWebhook", "Webhook received");
    const wantsBrowserRedirect = shouldRedirectPaytm(req);
    const bodyHasPayload =
      req.body &&
      typeof req.body === "object" &&
      Object.keys(req.body).length > 0;
    const rawBodyPayload =
      !bodyHasPayload && req.rawBody ? parsePaytmRawBody(req.rawBody) : null;
    const queryPayload =
      req.query && typeof req.query === "object" ? req.query : null;
    const hasQueryPayload =
      queryPayload && Object.keys(queryPayload).length > 0;
    if (
      wantsBrowserRedirect &&
      String(req?.method || "").toUpperCase() === "GET" &&
      !bodyHasPayload &&
      !rawBodyPayload &&
      !hasQueryPayload
    ) {
      return redirectPaytmWebhookToClient(req, res, {
        paymentState: "pending",
      });
    }
    const incomingPayload = bodyHasPayload
      ? req.body
      : rawBodyPayload || queryPayload || {};

    if (!PAYMENT_PROVIDER_ENV_ENABLED.PAYTM) {
      logger.warn("handlePaytmWebhook", "Paytm environment not enabled");
      return wantsBrowserRedirect
        ? redirectPaytmWebhookToClient(req, res, {
            paymentState: "unavailable",
          })
        : sendSuccess(res, {}, "Webhook received");
    }

    const payload = decodePaytmWebhookEnvelope(incomingPayload);
    const webhookData = extractPaytmWebhookFields(payload);
    const merchantTransactionId = webhookData.merchantTransactionId;

    if (!merchantTransactionId) {
      logger.warn("handlePaytmWebhook", "Missing merchantTransactionId");
      return wantsBrowserRedirect
        ? redirectPaytmWebhookToClient(req, res, { paymentState: "pending" })
        : sendSuccess(res, {}, "Webhook received");
    }

    if (!String(merchantTransactionId).startsWith("BOG_")) {
      logger.warn("handlePaytmWebhook", "Ignoring non-order transaction", {
        merchantTransactionId,
      });
      return wantsBrowserRedirect
        ? redirectPaytmWebhookToClient(req, res, { paymentState: "pending" })
        : sendSuccess(res, {}, "Webhook received");
    }

    const orderIdentifier = extractOrderIdFromMerchantTransactionId(
      merchantTransactionId,
    );
    if (!orderIdentifier) {
      logger.warn("handlePaytmWebhook", "Invalid orderId in transaction", {
        merchantTransactionId,
        orderIdentifier,
      });
      return wantsBrowserRedirect
        ? redirectPaytmWebhookToClient(req, res, { paymentState: "pending" })
        : sendSuccess(res, {}, "Webhook received");
    }

    const order = await findOrderByIdentifier(orderIdentifier);

    if (!order) {
      logger.warn("handlePaytmWebhook", "Order not found", {
        merchantTransactionId,
      });
      return wantsBrowserRedirect
        ? redirectPaytmWebhookToClient(req, res, {
            paymentState: "pending",
          })
        : sendSuccess(res, {}, "Webhook received");
    }

    if (
      order.paytmOrderId &&
      String(order.paytmOrderId) !== String(merchantTransactionId)
    ) {
      logger.warn("handlePaytmWebhook", "Transaction/order mismatch", {
        orderId: order._id,
        merchantTransactionId,
        expected: order.paytmOrderId,
      });
      return wantsBrowserRedirect
        ? redirectPaytmWebhookToClient(req, res, {
            orderId: order._id,
            paymentState: String(
              order.payment_status || "pending",
            ).toLowerCase(),
          })
        : sendSuccess(res, {}, "Webhook received");
    }

    const verifiedStatus = await verifyPaytmWebhookState(merchantTransactionId);
    if (!verifiedStatus) {
      return wantsBrowserRedirect
        ? redirectPaytmWebhookToClient(req, res, {
            orderId: order._id,
            paymentState: String(
              order.payment_status || "pending",
            ).toLowerCase(),
          })
        : sendSuccess(res, {}, "Webhook acknowledged");
    }

    const transactionId =
      verifiedStatus.transactionId || webhookData.transactionId || null;
    const normalizedState = resolvePaytmState(
      verifiedStatus.state,
      webhookData.state,
    );
    if (!normalizedState) {
      logger.warn("handlePaytmWebhook", "Unknown payment state", {
        merchantTransactionId,
        state: verifiedStatus.state || webhookData.state || null,
      });
      return wantsBrowserRedirect
        ? redirectPaytmWebhookToClient(req, res, {
            orderId: order._id,
            paymentState: String(
              order.payment_status || "pending",
            ).toLowerCase(),
          })
        : sendSuccess(res, {}, "Webhook received");
    }

    const paymentStateHint = String(
      incomingPayload?.paymentState ||
        incomingPayload?.payment_status ||
        incomingPayload?.status ||
        "",
    )
      .toLowerCase()
      .trim();
    const failureKind =
      normalizedState === "fail"
        ? inferPaymentFailureKind({
            hint: paymentStateHint,
            state: String(verifiedStatus.state || webhookData.state || ""),
            raw: verifiedStatus.raw || payload,
          })
        : "";
    const failureReason =
      normalizedState === "fail"
        ? buildPaymentFailureReason({
            provider: PAYMENT_PROVIDERS.PAYTM,
            failureKind,
          })
        : "Paytm payment failed";
    const resolvedPaytmUtrNumber =
      verifiedStatus?.utrNumber ||
      extractUtrNumber({ txnId: transactionId }) ||
      null;
    if (!resolvedPaytmUtrNumber) {
      console.warn("UTR NOT FOUND IN PAYMENT RESPONSE");
    }

    const resolution = await applyResolvedPaymentStatus({
      order,
      normalizedState,
      paymentProvider: PAYMENT_PROVIDERS.PAYTM,
      merchantTransactionId,
      transactionId,
      providerOrderIdField: "paytmOrderId",
      providerTransactionIdField: "paytmTransactionId",
      extraUpdates: {
        paymentAppTxnId: transactionId || order.paymentAppTxnId || null,
        utrNumber: resolvedPaytmUtrNumber,
        upiRefId:
          verifiedStatus?.utrNumber || transactionId || order.upiRefId || null,
      },
      successSource: "PAYMENT_WEBHOOK",
      shipmentSource: "PAYMENT_WEBHOOK_AUTO_SHIPMENT",
      failureReason,
      req,
      logContext: "handlePaytmWebhook",
      trackingSource: "paytm_webhook",
    });

    if (
      normalizedState === "fail" &&
      String(order.payment_status || "").toLowerCase() === "failed"
    ) {
      scheduleOrderPaymentReminderEmail({
        order,
        failureKind,
        paymentProvider: PAYMENT_PROVIDERS.PAYTM,
        logContext: "handlePaytmWebhook",
      });
    } else if (
      normalizedState === "pending" &&
      String(order.payment_status || "").toLowerCase() === "pending"
    ) {
      scheduleOrderPaymentReminderEmail({
        order,
        paymentProvider: PAYMENT_PROVIDERS.PAYTM,
        logContext: "handlePaytmWebhook",
      });
    }

    let clientPaymentState = String(order.payment_status || "pending")
      .toLowerCase()
      .trim();
    if (clientPaymentState === "failed" && failureKind === "cancelled") {
      clientPaymentState = "cancelled";
    }

    if (resolution.skipped) {
      return wantsBrowserRedirect
        ? redirectPaytmWebhookToClient(req, res, {
            orderId: order._id,
            paymentState: clientPaymentState,
          })
        : sendSuccess(
            res,
            {
              orderId: String(order?._id || ""),
              paymentState: clientPaymentState,
            },
            "Webhook already processed",
          );
    }
    return wantsBrowserRedirect
      ? redirectPaytmWebhookToClient(req, res, {
          orderId: order._id,
          paymentState: clientPaymentState,
        })
      : sendSuccess(
          res,
          {
            orderId: String(order?._id || ""),
            paymentState: clientPaymentState,
          },
          "Webhook processed",
        );
  } catch (error) {
    logger.error("handlePaytmWebhook", "Webhook processing error", {
      error: error.message,
    });
    if (shouldRedirectPaytm(req)) {
      const orderIdCandidate =
        req?.body?.ORDERID ||
        req?.body?.orderId ||
        req?.body?.merchantTransactionId ||
        req?.query?.ORDERID ||
        req?.query?.orderId ||
        req?.query?.merchantTransactionId ||
        "";
      const resolvedOrderIdentifier = extractOrderIdFromMerchantTransactionId(
        String(orderIdCandidate || "").trim(),
      );
      const resolvedOrder = resolvedOrderIdentifier
        ? await findOrderByIdentifier(resolvedOrderIdentifier, { lean: true })
        : null;
      const resolvedOrderId = resolvedOrder?._id
        ? String(resolvedOrder._id)
        : undefined;
      return redirectPaytmWebhookToClient(req, res, {
        orderId: resolvedOrderId,
        paymentState: "failed",
      });
    }
    return sendError(res, error);
  }
});

/**
 * Repair paid orders missing shipment or invoice artifacts (Admin)
 * @route POST /api/orders/admin/repair-paid
 * @access Admin
 */
export const repairPaidOrders = asyncHandler(async (req, res) => {
  try {
    const requesterRole = String(req?.user?.role || "").trim();
    const normalizedRequesterRole = requesterRole.toLowerCase();
    if (
      !isPrivilegedAdminRole(requesterRole) ||
      normalizedRequesterRole !== "admin"
    ) {
      throw new AppError("FORBIDDEN", {
        message: "Only admin can repair paid orders",
      });
    }

    const limitRaw = req.body?.limit ?? req.query?.limit ?? 10;
    const limit = Math.min(Math.max(Number(limitRaw) || 10, 1), 50);

    const filter = {
      payment_status: "paid",
      purchaseOrder: null,
      isDemoOrder: { $ne: true },
      $or: [
        { awbNumber: { $in: [null, ""] } },
        { awb_number: { $in: [null, ""] } },
        { shipmentId: { $in: [null, ""] } },
        { invoicePath: { $in: [null, ""] } },
        { invoiceNumber: { $in: [null, ""] } },
        { isInvoiceGenerated: { $ne: true } },
      ],
    };

    const orders = await OrderModel.find(filter)
      .sort({ updatedAt: 1 })
      .limit(limit)
      .exec();

    if (!orders.length) {
      return sendSuccess(
        res,
        { total: 0, repaired: 0, skipped: 0 },
        "No paid orders pending repair",
      );
    }

    const results = await Promise.allSettled(
      orders.map((order) =>
        repairPaidOrderArtifacts({
          order,
          syncContext: "admin_repair_paid_orders",
          shipmentSource: "ADMIN_REPAIR_AUTO_SHIPMENT",
        }),
      ),
    );

    let repaired = 0;
    let skipped = 0;
    results.forEach((result) => {
      if (result.status !== "fulfilled") {
        skipped += 1;
        return;
      }
      const value = result.value;
      if (value?.repaired) {
        repaired += 1;
      } else {
        skipped += 1;
      }
    });

    return sendSuccess(
      res,
      {
        total: orders.length,
        repaired,
        skipped,
      },
      "Paid order repair completed",
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }
    const dbError = handleDatabaseError(error, "repairPaidOrders");
    return sendError(res, dbError);
  }
});

/**
 * Backfill paymentId with provider transaction ID for successful orders (Admin)
 * @route POST /api/orders/admin/backfill-payment-ids
 * @access Admin
 */
export const backfillSuccessfulOrderPaymentIds = asyncHandler(
  async (req, res) => {
    try {
      const requesterRole = String(req?.user?.role || "").trim();
      const normalizedRequesterRole = requesterRole.toLowerCase();
      if (
        !isPrivilegedAdminRole(requesterRole) ||
        normalizedRequesterRole !== "admin"
      ) {
        throw new AppError("FORBIDDEN", {
          message: "Only admin can backfill successful payment IDs",
        });
      }

      const limitRaw = req.body?.limit ?? req.query?.limit ?? 250;
      const limit = Math.min(Math.max(Number(limitRaw) || 250, 1), 1000);

      const candidateFilter = {
        purchaseOrder: null,
        isDemoOrder: { $ne: true },
        $and: [
          {
            $or: [
              {
                payment_status: {
                  $in: Array.from(SUCCESSFUL_BACKFILL_PAYMENT_STATUSES),
                },
              },
              {
                order_status: {
                  $in: Array.from(SUCCESSFUL_BACKFILL_ORDER_STATUSES),
                },
              },
            ],
          },
          {
            $or: [
              { paymentId: { $in: [null, ""] } },
              { paymentId: { $regex: "^BOG_", $options: "i" } },
            ],
          },
          {
            $or: [
              { paytmTransactionId: { $exists: true, $nin: [null, ""] } },
              { phonepeTransactionId: { $exists: true, $nin: [null, ""] } },
            ],
          },
        ],
      };

      const orders = await OrderModel.find(candidateFilter)
        .sort({ updatedAt: 1 })
        .limit(limit)
        .exec();

      if (!orders.length) {
        return sendSuccess(
          res,
          { scanned: 0, updated: 0, skipped: 0, remaining: 0 },
          "No successful orders need payment ID backfill",
        );
      }

      let updated = 0;
      let skipped = 0;
      const updatedOrderIds = [];

      for (const order of orders) {
        if (!isSuccessfulOrderCandidateForBackfill(order)) {
          skipped += 1;
          continue;
        }

        const transactionId = resolveProviderTransactionIdForBackfill(order);
        if (!transactionId) {
          skipped += 1;
          continue;
        }

        const currentPaymentId = String(order?.paymentId || "").trim();
        const currentPaymentAppTxnId = String(
          order?.paymentAppTxnId || "",
        ).trim();
        if (
          currentPaymentId &&
          !currentPaymentAppTxnId &&
          !isGatewayMerchantReference(currentPaymentId)
        ) {
          skipped += 1;
          continue;
        }

        if (
          currentPaymentId === transactionId &&
          currentPaymentAppTxnId === transactionId
        ) {
          skipped += 1;
          continue;
        }

        order.paymentId = transactionId;
        order.paymentAppTxnId = transactionId;
        order.paymentProvider =
          order.paymentProvider || resolvePaymentProviderFromOrder(order) || "";
        order.updatedAt = new Date();
        await order.save();
        updated += 1;
        updatedOrderIds.push(String(order._id));

        syncOrderToFirestore(order, "update").catch((error) => {
          logger.error(
            "backfillSuccessfulOrderPaymentIds",
            "Failed to sync order after payment ID backfill",
            {
              orderId: order._id,
              error: error?.message || String(error),
            },
          );
        });
      }

      const remaining = await OrderModel.countDocuments(candidateFilter);

      return sendSuccess(
        res,
        {
          scanned: orders.length,
          updated,
          skipped,
          remaining,
          updatedOrderIds,
        },
        "Successful-order payment ID backfill completed",
      );
    } catch (error) {
      if (error instanceof AppError) {
        return sendError(res, error);
      }
      const dbError = handleDatabaseError(
        error,
        "backfillSuccessfulOrderPaymentIds",
      );
      return sendError(res, dbError);
    }
  },
);

/**
 * PhonePe Webhook Handler
 * @route POST /api/orders/webhook/phonepe
 * @access Public (payment state verified via PhonePe status API)
 */
export const handlePhonePeWebhook = asyncHandler(async (req, res) => {
  try {
    logger.debug("handlePhonePeWebhook", "Webhook received");

    if (!PAYMENT_PROVIDER_ENV_ENABLED.PHONEPE) {
      logger.warn("handlePhonePeWebhook", "PhonePe environment not enabled");
      return sendSuccess(res, {}, "Webhook received");
    }

    const merchantTransactionId = String(
      extractPhonePeWebhookMerchantOrderId(req, req.body || {}) || "",
    ).trim();

    if (!merchantTransactionId) {
      logger.warn("handlePhonePeWebhook", "Missing merchantOrderId");
      return sendSuccess(res, {}, "Webhook received");
    }

    if (!merchantTransactionId.startsWith("BOG_")) {
      logger.warn("handlePhonePeWebhook", "Ignoring non-order transaction", {
        merchantTransactionId,
      });
      return sendSuccess(res, {}, "Webhook received");
    }

    const orderIdentifier = extractOrderIdFromMerchantTransactionId(
      merchantTransactionId,
    );
    if (!orderIdentifier) {
      logger.warn("handlePhonePeWebhook", "Invalid orderId in transaction", {
        merchantTransactionId,
        orderIdentifier,
      });
      return sendSuccess(res, {}, "Webhook received");
    }

    const order = await findOrderByIdentifier(orderIdentifier);
    if (!order) {
      logger.warn("handlePhonePeWebhook", "Order not found", {
        merchantTransactionId,
      });
      return sendSuccess(res, {}, "Webhook received");
    }

    if (
      order.phonepeMerchantOrderId &&
      String(order.phonepeMerchantOrderId) !== String(merchantTransactionId)
    ) {
      logger.info(
        "handlePhonePeWebhook",
        "Processing alternate retry transaction id",
        {
          orderId: order._id,
          merchantTransactionId,
          previous: order.phonepeMerchantOrderId,
        },
      );
    }

    const verifiedStatus = await verifyPhonePeWebhookState(
      merchantTransactionId,
    );
    if (!verifiedStatus) {
      return sendSuccess(res, {}, "Webhook acknowledged");
    }

    const normalizedState = normalizePhonePeState(verifiedStatus.state);
    const paymentStateHint = String(
      req.body?.paymentState ||
        req.query?.paymentState ||
        req.body?.payment_status ||
        req.query?.payment_status ||
        "",
    )
      .toLowerCase()
      .trim();
    const transactionId = verifiedStatus.transactionId || null;
    const resolvedState =
      normalizedState.includes("COMPLETED") ||
      normalizedState.includes("SUCCESS")
        ? "success"
        : normalizedState.includes("FAIL") ||
            normalizedState.includes("DECLINED")
          ? "fail"
          : normalizedState.includes("PENDING") ||
              normalizedState.includes("CREATED")
            ? "pending"
            : "";

    if (!resolvedState) {
      logger.warn("handlePhonePeWebhook", "Unknown payment state", {
        merchantTransactionId,
        state: normalizedState || null,
      });
      return sendSuccess(res, {}, "Webhook received");
    }

    const failureKind =
      resolvedState === "fail"
        ? inferPaymentFailureKind({
            hint: paymentStateHint,
            state: normalizedState,
            raw: verifiedStatus.raw,
          })
        : "";
    const failureReason =
      resolvedState === "fail"
        ? buildPaymentFailureReason({
            provider: PAYMENT_PROVIDERS.PHONEPE,
            failureKind,
          })
        : "PhonePe payment failed";
    const resolvedPhonePeUtrNumber =
      verifiedStatus?.utrNumber ||
      extractUtrNumber({
        providerReferenceId: verifiedStatus?.upiReference,
        txnId: transactionId,
      }) ||
      order.utrNumber ||
      null;
    if (!resolvedPhonePeUtrNumber) {
      console.warn("UTR NOT FOUND IN PAYMENT RESPONSE");
    }

    const resolution = await applyResolvedPaymentStatus({
      order,
      normalizedState: resolvedState,
      paymentProvider: PAYMENT_PROVIDERS.PHONEPE,
      merchantTransactionId,
      transactionId,
      providerOrderIdField: "phonepeMerchantOrderId",
      providerTransactionIdField: "phonepeTransactionId",
      extraUpdates: {
        paymentAppTxnId: transactionId || order.paymentAppTxnId || null,
        phonepeOrderId:
          verifiedStatus.phonepeOrderId || order.phonepeOrderId || null,
        upiRef: verifiedStatus?.upiReference || order.upiRef || null,
        upiReferenceNumber:
          verifiedStatus?.upiReference || order.upiReferenceNumber || null,
        upiReferenceNo:
          verifiedStatus?.upiReference || order.upiReferenceNo || null,
        rrn: verifiedStatus?.upiReference || order.rrn || null,
        utr: verifiedStatus?.upiReference || order.utr || null,
        utrNumber: resolvedPhonePeUtrNumber,
        upiRefId:
          verifiedStatus?.upiReference ||
          transactionId ||
          order.upiRefId ||
          null,
      },
      successSource: "PHONEPE_WEBHOOK",
      shipmentSource: "PHONEPE_WEBHOOK_AUTO_SHIPMENT",
      failureReason,
      req,
      logContext: "handlePhonePeWebhook",
      trackingSource: "phonepe_webhook",
    });

    if (
      resolvedState === "fail" &&
      String(order.payment_status || "").toLowerCase() === "failed"
    ) {
      scheduleOrderPaymentReminderEmail({
        order,
        failureKind,
        paymentProvider: PAYMENT_PROVIDERS.PHONEPE,
        logContext: "handlePhonePeWebhook",
      });
    } else if (
      resolvedState === "pending" &&
      String(order.payment_status || "").toLowerCase() === "pending"
    ) {
      scheduleOrderPaymentReminderEmail({
        order,
        paymentProvider: PAYMENT_PROVIDERS.PHONEPE,
        logContext: "handlePhonePeWebhook",
      });
    }

    let clientPaymentState = String(order.payment_status || "pending")
      .toLowerCase()
      .trim();
    if (clientPaymentState === "failed" && failureKind === "cancelled") {
      clientPaymentState = "cancelled";
    }

    if (resolution.skipped) {
      return sendSuccess(
        res,
        {
          orderId: String(order?._id || ""),
          paymentState: clientPaymentState,
        },
        "Webhook already processed",
      );
    }

    return sendSuccess(
      res,
      {
        orderId: String(order?._id || ""),
        paymentState: clientPaymentState,
      },
      "Webhook processed",
    );
  } catch (error) {
    logger.error("handlePhonePeWebhook", "Webhook processing error", {
      error: error.message,
    });
    return sendError(res, error);
  }
});

const createPhonePePassiveWebhookHandler = (context) =>
  asyncHandler(async (req, res) => {
    logger.info(context, "Webhook received", {
      bodyKeys: Object.keys(req.body || {}),
    });
    return sendSuccess(res, {}, "Webhook received");
  });

export const handlePhonePeRefundSuccessWebhook =
  createPhonePePassiveWebhookHandler("handlePhonePeRefundSuccessWebhook");
export const handlePhonePeRefundAcceptWebhook =
  createPhonePePassiveWebhookHandler("handlePhonePeRefundAcceptWebhook");
export const handlePhonePeChargebackWebhook =
  createPhonePePassiveWebhookHandler("handlePhonePeChargebackWebhook");
export const handlePhonePeSubscriptionPreWebhook =
  createPhonePePassiveWebhookHandler("handlePhonePeSubscriptionPreWebhook");

// ==================== TEST ENDPOINTS (Development Only) ====================

/**
 * Create test order for development
 * @route POST /api/orders/test/create
 * @access Development only
 */
export const createTestOrder = asyncHandler(async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      logger.warn("createTestOrder", "Test endpoint called in production");
      throw new AppError("FORBIDDEN");
    }

    const body = req.body || {};
    const effectiveUserId = String(body.userId || req.user || "").trim();
    const influencerCode = String(body.influencerCode || "")
      .trim()
      .toUpperCase();
    const couponCode = String(body.couponCode || "")
      .trim()
      .toUpperCase();
    const recipientEmailOverride = String(body.recipientEmail || "")
      .trim()
      .toLowerCase();
    const shouldSendConfirmationEmail = Boolean(
      body.sendConfirmationEmail || recipientEmailOverride,
    );
    const shippingSuppressed = true;

    if (!effectiveUserId) {
      throw new AppError("MISSING_FIELD", { field: "userId" });
    }

    validateMongoId(effectiveUserId, "userId");

    logger.debug("createTestOrder", "Creating test order", {
      userId: effectiveUserId,
      couponCode: couponCode || null,
      influencerCode: influencerCode || null,
      recipientEmailOverride: recipientEmailOverride || null,
      shippingSuppressed,
    });

    // Verify user exists
    const user = await UserModel.findById(effectiveUserId).select(
      "_id name email mobile",
    );
    if (!user) {
      logger.warn("createTestOrder", "User not found", {
        userId: effectiveUserId,
      });
      throw new AppError("USER_NOT_FOUND");
    }

    let normalizedProducts = [];
    const requestedProducts = Array.isArray(body.products) ? body.products : [];
    const requestedCombos = Array.isArray(body.combos) ? body.combos : [];

    if (requestedProducts.length > 0) {
      validateProductsArray(requestedProducts, "products");
      const normalizedResult = await fetchAndNormalizeOrderProducts(
        requestedProducts,
        "createTestOrder",
      );
      normalizedProducts = normalizedResult.normalizedProducts;
    }

    const comboPayload = await fetchAndNormalizeOrderCombos({
      combos: requestedCombos,
      userId: effectiveUserId,
      logContext: "createTestOrder",
    });

    if (requestedProducts.length === 0 && requestedCombos.length === 0) {
      const products = await ProductModel.find().limit(3);
      if (products.length === 0) {
        logger.warn("createTestOrder", "No products found in database");
        throw new AppError("PRODUCT_NOT_FOUND", {
          message: "No products available",
        });
      }
      normalizedProducts = products.map((product) => {
        const quantity = Math.floor(Math.random() * 2) + 1;
        const price = round2(Number(product.price || 0));
        return {
          productId: String(product._id),
          productTitle: product.name,
          variantId: null,
          variantName: "",
          sku: String(product.sku || "")
            .trim()
            .toUpperCase(),
          hsnCode: String(product.hsnCode || "").trim(),
          quantity,
          price,
          image: product.images?.[0] || product.thumbnail || "",
          subTotal: round2(price * quantity),
        };
      });
    }

    const mergedProducts = [
      ...normalizedProducts,
      ...comboPayload.expandedProducts,
    ];

    if (!mergedProducts.length) {
      throw new AppError("MISSING_FIELD", {
        field: "products|combos",
        message: "At least one product or combo is required",
      });
    }

    const selectedAddress = String(body.address || "").trim();
    const selectedPincode = shippingSuppressed
      ? ""
      : String(body.pincode || "").trim();
    const selectedState = String(body.state || "").trim();
    const checkoutContact = {
      addressId: null,
      pincode: selectedPincode,
      state: selectedState,
      contact: {
        fullName: String(user.name || "Demo User"),
        email: String(recipientEmailOverride || user.email || "")
          .trim()
          .toLowerCase(),
        phone: String(user.mobile || body.phone || "").trim(),
        address: selectedAddress || "Demo test order (shipping suppressed)",
        pincode: selectedPincode,
        state: selectedState,
        gst: String(body.gstNumber || "")
          .trim()
          .toUpperCase(),
      },
    };

    const pricing = await calculateCheckoutPricing({
      normalizedProducts: mergedProducts,
      comboDiscount: comboPayload.comboDiscount,
      comboOriginalAmount: comboPayload.comboOriginalAmount,
      userId: effectiveUserId,
      couponCode: couponCode || null,
      influencerCode: influencerCode || null,
      checkoutContact,
      coinRedeem: { coins: 0 },
      paymentType: "prepaid",
      logContext: "createTestOrder",
    });

    if (pricing.errorMessage) {
      return res.status(400).json({
        error: true,
        success: false,
        message: pricing.errorMessage,
      });
    }

    const shippingCharge = shippingSuppressed
      ? 0
      : round2(Number(pricing.shippingCharge || 0));
    const taxableAmount = round2(Number(pricing.taxableAmount || 0));
    const gstAmount = round2(Number(pricing.gstAmount || 0));
    const pricingTotals = buildRoundedPricing(
      taxableAmount + gstAmount + shippingCharge,
    );
    const finalAmount = pricingTotals.finalAmount;
    const generatedFinalOrderId = await generateFinalOrderId();
    const billingDetails =
      buildBillingDetailsFromCheckoutContact(checkoutContact);

    // Create test order (paid + accepted), but shipping-suppressed.
    const generatedTestPaymentId = `TEST_${Date.now()}`;
    const testOrder = new OrderModel({
      user: effectiveUserId,
      products: mergedProducts,
      combos: comboPayload.normalizedCombos,
      basePrice: round2(Number(pricing.basePrice || 0)),
      total: round2(Number(pricing.total || finalAmount || 0)),
      totalAmt: finalAmount,
      subtotal: taxableAmount,
      discountedPrice: taxableAmount,
      tax: gstAmount,
      shipping: shippingCharge,
      finalAmount,
      roundedAmount: pricingTotals.roundedAmount,
      roundedTotal: pricingTotals.roundedAmount,
      roundOff: pricingTotals.roundOff,
      paymentMethod: "TEST",
      payment_status: "paid",
      order_status: ORDER_STATUS.ACCEPTED,
      status: "confirmed",
      shippingStatus: "manual",
      shipmentStatus: "pending",
      shipment_status: "pending",
      statusTimeline: [
        {
          status: ORDER_STATUS.PENDING,
          source: "TEST_CREATE",
          timestamp: new Date(),
        },
        {
          status: ORDER_STATUS.ACCEPTED,
          source: "TEST_CREATE",
          timestamp: new Date(),
        },
      ],
      paymentId: generatedTestPaymentId,
      paymentAppTxnId: generatedTestPaymentId,
      originalPrice: round2(Number(pricing.originalAmount || finalAmount)),
      comboDiscount: round2(
        Number(pricing.comboDiscountInclusive ?? pricing.comboDiscount ?? 0),
      ),
      discount: round2(Number(pricing.totalDiscount || 0)),
      couponCode: pricing.normalizedCouponCode || null,
      discountAmount: round2(Number(pricing.couponDiscount || 0)),
      membershipDiscount: round2(Number(pricing.membershipDiscount || 0)),
      influencerId: pricing.influencerData?._id || null,
      influencerCode: pricing.influencerCode || null,
      influencerDiscount: round2(Number(pricing.influencerDiscount || 0)),
      influencerCommission: round2(Number(pricing.influencerCommission || 0)),
      commissionPaid: false,
      influencerStatsSynced: false,
      affiliateCode: pricing.influencerCode || null,
      affiliateSource: pricing.influencerCode ? "referral" : "organic",
      gst: {
        rate: Number(pricing.taxData?.rate ?? CHECKOUT_GST_RATE),
        state: pricing.taxData?.state || selectedState || "",
        taxableAmount,
        cgst: Number(pricing.taxData?.cgst || 0),
        sgst: Number(pricing.taxData?.sgst || 0),
        igst: Number(pricing.taxData?.igst || 0),
        totalTax: Number(pricing.taxData?.totalTax || gstAmount || 0),
      },
      pricing: {
        originalPrice: round2(Number(pricing.originalAmount || 0)),
        basePrice: round2(Number(pricing.basePrice || 0)),
        discount: round2(Number(pricing.totalDiscount || 0)),
        discountedPrice: round2(Number(taxableAmount || 0)),
        gst: round2(Number(gstAmount || 0)),
        total: round2(Number(pricing.finalAmount || finalAmount || 0)),
        roundedTotal: round2(Number(pricingTotals.roundedAmount || 0)),
        roundOff: round2(Number(pricingTotals.roundOff || 0)),
        shipping: round2(Number(shippingCharge || 0)),
        state: pricing.taxData?.state || selectedState || "",
        gstRate: CHECKOUT_GST_RATE,
      },
      gstNumber: checkoutContact.contact.gst || "",
      billingDetails,
      deliveryAddressSnapshot: checkoutContact.addressSnapshot,
      guestDetails: {},
      trackingSessionId:
        String(req.analyticsSessionId || req.cookies?.hog_sid || "").trim() ||
        null,
      final_id: generatedFinalOrderId,
      orderNumber: generatedFinalOrderId,
      displayOrderId: generatedFinalOrderId,
      confirmed_at: new Date(),
      confirmedAt: new Date(),
      analyticsConsent: resolveAnalyticsConsentFromRequest(req),
      isSavedOrder: true,
      isDemoOrder: true,
      notes:
        String(body.notes || "").trim() ||
        "Demo test order (shipping suppressed, shippingStatus=manual)",
    });

    await testOrder.save();

    emitPurchaseCompletedTrackingEvent({
      req,
      order: testOrder,
      source: "test_order",
    });

    let influencerStatsSynced = false;
    if (testOrder.influencerId && !testOrder.influencerStatsSynced) {
      const effectiveAmount =
        testOrder.finalAmount > 0 ? testOrder.finalAmount : testOrder.totalAmt;
      const commissionBaseAmount = resolveInfluencerCommissionBase(testOrder);
      let commission = testOrder.influencerCommission || 0;
      if (!commission) {
        commission = await calculateInfluencerCommission(
          testOrder.influencerId,
          commissionBaseAmount,
        );
        testOrder.influencerCommission = commission;
      }

      influencerStatsSynced = await updateInfluencerStats(
        testOrder.influencerId,
        effectiveAmount,
        commission,
      );

      if (influencerStatsSynced) {
        testOrder.influencerStatsSynced = true;
        await testOrder.save();
      }
    }

    let invoiceSummary = {
      generated: false,
      invoiceNumber: null,
      invoicePath: "",
      reason: null,
    };
    if (!isInvoiceEligible(testOrder)) {
      applyOrderStatusTransition(testOrder, ORDER_STATUS.DELIVERED, {
        source: "TEST_CREATE",
      });
      testOrder.deliveryDate = testOrder.deliveryDate || new Date();
      await testOrder.save();
    }

    const invoiceResult = await ensureOrderInvoice(testOrder);
    if (!invoiceResult.ok) {
      logger.error("createTestOrder", "Failed to generate invoice", {
        orderId: testOrder._id,
        reason: invoiceResult.reason,
        error: invoiceResult.error?.message || null,
      });
      return res.status(500).json({
        error: true,
        success: false,
        message: invoiceResult.reason || "Failed to generate test invoice",
      });
    }
    invoiceSummary = {
      generated: Boolean(invoiceResult.generated),
      invoiceNumber: testOrder.invoiceNumber || null,
      invoicePath: testOrder.invoicePath || "",
      reason: null,
    };

    const clientInvoice = {
      invoiceNumber: testOrder.invoiceNumber || null,
      invoicePath: testOrder.invoicePath || "",
      totals: {
        originalSubtotal: round2(Number(pricing.subtotal || 0)),
        subtotal: taxableAmount,
        comboDiscount: round2(
          Number(pricing.comboDiscountInclusive ?? pricing.comboDiscount ?? 0),
        ),
        influencerDiscount: round2(Number(pricing.influencerDiscount || 0)),
        couponDiscount: round2(Number(pricing.couponDiscount || 0)),
        gst: gstAmount,
        shipping: shippingCharge,
        total: finalAmount,
        roundedAmount: pricingTotals.roundedAmount,
        roundOff: pricingTotals.roundOff,
      },
      items: mergedProducts.map((item) => ({
        productId: item.productId || null,
        name: item.productTitle || "Product",
        quantity: Math.max(Number(item.quantity || 0), 0),
        unitPrice: round2(Number(item.price || 0)),
        lineTotal: round2(Number(item.subTotal || 0)),
        comboId: item.comboId || null,
        comboName: item.comboName || "",
      })),
      combos: (comboPayload.normalizedCombos || []).map((combo) => ({
        comboId: combo.comboId || null,
        comboName: combo.comboName || "Combo",
        quantity: Math.max(Number(combo.quantity || 0), 0),
        comboPrice: round2(Number(combo.comboPrice || 0)),
        originalPrice: round2(Number(combo.originalPrice || 0)),
        savings: round2(Number(combo.savings || 0)),
      })),
    };

    const localDiskInvoice = await persistInvoiceSnapshotToDisk({
      filenameSeed:
        testOrder.invoiceNumber ||
        testOrder._id ||
        `test_invoice_${Date.now()}`,
      invoicePath: testOrder.invoicePath || "",
      context: "createTestOrder",
      payload: {
        source: "demo_influencer_order",
        savedAt: new Date().toISOString(),
        shippingSuppressed: true,
        xpressbeesPosted: false,
        orderId: String(testOrder._id || ""),
        invoice: invoiceSummary,
        influencer: {
          code: testOrder.influencerCode || null,
          discount: round2(Number(testOrder.influencerDiscount || 0)),
          commission: round2(Number(testOrder.influencerCommission || 0)),
          statsSynced: influencerStatsSynced,
        },
        clientInvoice,
      },
    });

    let confirmationEmailSent = false;
    if (shouldSendConfirmationEmail) {
      confirmationEmailSent = await sendOrderConfirmationEmail(testOrder);
    }

    logger.info("createTestOrder", "Test order created", {
      orderId: testOrder._id,
      influencerCode: testOrder.influencerCode || null,
      influencerCommission: testOrder.influencerCommission || 0,
      influencerStatsSynced,
      comboCount: Array.isArray(testOrder.combos) ? testOrder.combos.length : 0,
      shippingSuppressed,
      invoiceNumber: testOrder.invoiceNumber || null,
      localInvoiceJsonPath: localDiskInvoice?.jsonPath || null,
    });

    return sendSuccess(
      res,
      {
        orderId: testOrder._id,
        shippingSuppressed: true,
        xpressbeesPosted: false,
        order: normalizeOrderForResponse(testOrder),
        influencer: {
          code: testOrder.influencerCode || null,
          discount: round2(Number(testOrder.influencerDiscount || 0)),
          commission: round2(Number(testOrder.influencerCommission || 0)),
          statsSynced: influencerStatsSynced,
        },
        coupon: {
          code: testOrder.couponCode || null,
          discount: round2(Number(testOrder.discountAmount || 0)),
        },
        email: {
          recipient:
            recipientEmailOverride ||
            String(user.email || "")
              .trim()
              .toLowerCase() ||
            null,
          sent: confirmationEmailSent,
        },
        invoice: invoiceSummary,
        clientInvoice,
        localDiskInvoice,
      },
      "Demo test order created successfully",
      201,
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "createTestOrder");
    return sendError(res, dbError);
  }
});

/**
 * Persist client test invoice snapshot (from localStorage) to server disk.
 * @route POST /api/orders/test/save-invoice
 * @access Development only
 */
export const saveClientTestInvoiceToDisk = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    throw new AppError("FORBIDDEN");
  }

  const payloadCandidate = req.body?.invoice || req.body || null;
  if (!payloadCandidate || typeof payloadCandidate !== "object") {
    throw new AppError("MISSING_FIELD", { field: "invoice" });
  }

  const invoiceRecord = {
    ...payloadCandidate,
    savedAt: new Date().toISOString(),
  };

  const invoicePath = String(invoiceRecord.invoicePath || "").trim();
  const filenameSeed =
    invoiceRecord.invoiceId ||
    invoiceRecord.invoiceNumber ||
    invoiceRecord.orderId ||
    `client_invoice_${Date.now()}`;

  const localDiskInvoice = await persistInvoiceSnapshotToDisk({
    filenameSeed,
    invoicePath,
    context: "saveClientTestInvoiceToDisk",
    payload: {
      source: "client_local_storage_invoice",
      actorUserId: req.user ? String(req.user) : null,
      invoice: invoiceRecord,
    },
  });

  if (!localDiskInvoice.ok) {
    return res.status(500).json({
      error: true,
      success: false,
      message: localDiskInvoice.error || "Failed to save invoice on disk",
      data: { localDiskInvoice },
    });
  }

  return sendSuccess(
    res,
    { localDiskInvoice },
    "Invoice snapshot saved to local disk",
    201,
  );
});
