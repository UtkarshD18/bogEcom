/**
 * Order Request Validation Middleware
 * Validates and sanitizes all order-related API requests
 */

import { AppError, validateAmount, validateMongoId, validateProductsArray } from "../utils/errorHandler.js";
import mongoose from "mongoose";
import {
  buildLegacyGuestDetails,
  composeAddressLine1,
  validateStructuredAddress,
} from "../utils/addressUtils.js";

const calculateProductsSubtotal = (products = [], combos = []) => {
  const productTotal = products.reduce(
    (sum, item) =>
      sum +
      Number(
        item.subTotal || Number(item.price || 0) * Number(item.quantity || 0),
      ),
    0,
  );

  const comboTotal = combos.reduce((sum, combo) => {
    const quantity = Number(combo.quantity || 1);
    const price = Number(
      combo.comboPrice || combo.price || combo.total || 0,
    );
    return sum + price * quantity;
  }, 0);

  return Number(productTotal + comboTotal || 0);
};

const normalizeGuestDetails = (guestDetails = {}) => {
  const legacy = buildLegacyGuestDetails(guestDetails, {
    email: guestDetails.email,
    gst: guestDetails.gst,
  });

  return {
    ...legacy,
    address:
      legacy.address ||
      composeAddressLine1({
        flat_house: guestDetails.flat_house,
        area_street_sector: guestDetails.area_street_sector,
      }),
  };
};

const normalizeLocationPayload = (location = null) => {
  if (!location || typeof location !== "object") return null;

  const source =
    String(location.source || "").toLowerCase() === "google_maps"
      ? "google_maps"
      : "manual";

  const latitude =
    location.latitude !== undefined && location.latitude !== null
      ? Number(location.latitude)
      : null;
  const longitude =
    location.longitude !== undefined && location.longitude !== null
      ? Number(location.longitude)
      : null;

  if (source === "google_maps") {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new AppError("INVALID_FORMAT", {
        field: "location",
        message: "Google Maps location must include valid latitude/longitude",
      });
    }
  }

  return {
    source,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    formattedAddress: String(location.formattedAddress || "").trim(),
    street: String(location.street || "").trim(),
    city: String(location.city || "").trim(),
    state: String(location.state || "").trim(),
    pincode: String(location.pincode || "").trim(),
    country: String(location.country || "").trim(),
  };
};

const validateGuestDetails = (guestDetails, { require = false } = {}) => {
  const hasAnyGuestField = Object.values(guestDetails).some(Boolean);
  if (!hasAnyGuestField) {
    if (require) {
      throw new AppError("INVALID_FORMAT", {
        field: "guestDetails",
        message: "Guest details are required for checkout",
      });
    }
    return;
  }

  const validation = validateStructuredAddress(
    {
      full_name: guestDetails.fullName,
      mobile_number: guestDetails.phone,
      pincode: guestDetails.pincode,
      flat_house: guestDetails.flat_house,
      area_street_sector: guestDetails.area_street_sector,
      landmark: guestDetails.landmark,
      city: guestDetails.city,
      state: guestDetails.state,
      email: guestDetails.email,
    },
    { requireEmail: true },
  );

  if (!validation.isValid) {
    const [field, message] = Object.entries(validation.errors)[0] || [];
    throw new AppError("INVALID_FORMAT", {
      field: field ? `guestDetails.${field}` : "guestDetails",
      message: message || "Guest address is invalid",
    });
  }
};

/**
 * Validate Create Order Request
 * Ensures all required fields are present and properly formatted
 */
export const validateCreateOrderRequest = (req, res, next) => {
  try {
    const {
      products,
      combos,
      totalAmt,
      delivery_address,
      couponCode,
      discountAmount,
      finalAmount,
      influencerCode,
      notes,
      tax,
      shipping,
      originalAmount,
      affiliateCode,
      affiliateSource,
      guestDetails,
      coinRedeem,
      purchaseOrderId,
      paymentType,
      paymentProvider,
      location,
    } = req.body;

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

    if (hasCombos) {
      combos.forEach((combo, index) => {
        if (!combo.comboId && !combo.id) {
          throw new AppError("MISSING_FIELD", {
            fieldName: `combos[${index}].comboId`,
          });
        }
        const quantity = Number(combo.quantity || 1);
        if (!Number.isFinite(quantity) || quantity < 1) {
          throw new AppError("INVALID_QUANTITY", {
            fieldName: `combos[${index}].quantity`,
            value: combo.quantity,
          });
        }
      });
    }

    // Validate total amount (fallback to subtotal if omitted by client)
    const subtotalFromProducts = calculateProductsSubtotal(products || [], combos || []);
    const validatedTotal =
      totalAmt !== undefined
        ? validateAmount(totalAmt, "totalAmt", 0)
        : subtotalFromProducts;

    // Validate delivery_address if provided
    if (delivery_address) {
      validateMongoId(delivery_address, "delivery_address");
    }

    if (purchaseOrderId) {
      validateMongoId(purchaseOrderId, "purchaseOrderId");
    }

    // Optional monetary fields
    const validatedDiscount =
      discountAmount !== undefined
        ? validateAmount(discountAmount, "discountAmount", 0)
        : null;
    const validatedFinal =
      finalAmount !== undefined
        ? validateAmount(finalAmount, "finalAmount", 1)
        : null;
    const validatedTax =
      tax !== undefined ? validateAmount(tax, "tax", 0) : 0;
    const validatedShipping =
      shipping !== undefined ? validateAmount(shipping, "shipping", 0) : 0;
    const validatedOriginal =
      originalAmount !== undefined
        ? validateAmount(originalAmount, "originalAmount", 1)
        : null;
    const validatedCoinRedeem =
      coinRedeem !== undefined
        ? validateAmount(
            typeof coinRedeem === "object" ? coinRedeem.coins : coinRedeem,
            "coinRedeem",
            0,
          )
        : 0;

    const normalizedGuest = normalizeGuestDetails(guestDetails || {});
    const normalizedLocation = normalizeLocationPayload(location || null);
    const hasGuestIdentity = [
      "fullName",
      "phone",
      "flat_house",
      "area_street_sector",
      "pincode",
      "state",
      "email",
    ].some((field) => Boolean(normalizedGuest[field]));
    if (!req.user || hasGuestIdentity) {
      validateGuestDetails(normalizedGuest, { require: !req.user });
    }

    const allowedPaymentTypes = ["prepaid", "cod", "reverse"];
    const normalizedPaymentType = paymentType
      ? String(paymentType).toLowerCase()
      : "prepaid";
    if (!allowedPaymentTypes.includes(normalizedPaymentType)) {
      throw new AppError("INVALID_FORMAT", {
        field: "paymentType",
        validValues: allowedPaymentTypes,
      });
    }

    const normalizedPaymentProvider = paymentProvider
      ? String(paymentProvider).trim().toUpperCase()
      : null;
    if (
      normalizedPaymentProvider &&
      !["PAYTM", "PHONEPE"].includes(normalizedPaymentProvider)
    ) {
      throw new AppError("INVALID_FORMAT", {
        field: "paymentProvider",
        validValues: ["PAYTM", "PHONEPE"],
      });
    }

    // Validate coupon code format (alphanumeric, underscore, hyphen)
    if (couponCode && typeof couponCode === "string") {
      if (couponCode.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(couponCode)) {
        throw new AppError("INVALID_FORMAT", {
          field: "couponCode",
          message: "Invalid coupon code format",
        });
      }
    }

    // Validate influencer code format (alphanumeric, underscore, hyphen)
    if (influencerCode && typeof influencerCode === "string") {
      if (
        influencerCode.length > 50 ||
        !/^[a-zA-Z0-9_-]+$/.test(influencerCode)
      ) {
        throw new AppError("INVALID_FORMAT", {
          field: "influencerCode",
          message: "Invalid influencer code format",
        });
      }
    }

    // Validate affiliate code format (alphanumeric, underscore, hyphen)
    if (affiliateCode && typeof affiliateCode === "string") {
      if (
        affiliateCode.length > 50 ||
        !/^[a-zA-Z0-9_-]+$/.test(affiliateCode)
      ) {
        throw new AppError("INVALID_FORMAT", {
          field: "affiliateCode",
          message: "Invalid affiliate code format",
        });
      }
    }

    // Validate affiliate source
    if (affiliateSource) {
      const allowedSources = [
        "influencer",
        "campaign",
        "referral",
        "organic",
      ];
      if (!allowedSources.includes(String(affiliateSource))) {
        throw new AppError("INVALID_FORMAT", {
          field: "affiliateSource",
          validValues: allowedSources,
        });
      }
    }

    // Validate notes if provided (max 500 chars)
    if (notes && typeof notes === "string" && notes.length > 500) {
      throw new AppError("INVALID_FORMAT", {
        field: "notes",
        message: "Notes cannot exceed 500 characters",
      });
    }

    // Store validated data back to req.body
    req.validatedData = {
      products,
      combos: Array.isArray(combos) ? combos : [],
      totalAmt: Number(validatedTotal),
      delivery_address: delivery_address || null,
      couponCode: couponCode ? String(couponCode).trim() : null,
      discountAmount: validatedDiscount ?? null,
      finalAmount: validatedFinal ?? null,
      influencerCode: influencerCode ? String(influencerCode).trim() : null,
      notes: notes ? notes.trim().substring(0, 500) : null,
      tax: validatedTax,
      shipping: validatedShipping,
      originalAmount: validatedOriginal,
      affiliateCode: affiliateCode ? String(affiliateCode).trim() : null,
      affiliateSource: affiliateSource ? String(affiliateSource) : null,
      guestDetails: normalizedGuest,
      location: normalizedLocation,
      coinRedeem: validatedCoinRedeem,
      purchaseOrderId: purchaseOrderId || null,
      paymentType: normalizedPaymentType,
      paymentProvider: normalizedPaymentProvider,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.status).json({
        error: true,
        success: false,
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }

    return res.status(400).json({
      error: true,
      success: false,
      message: "Invalid request format",
      details: error.message,
    });
  }
};

/**
 * Validate Save Order for Later Request
 * Extended validation for the saveOrderForLater endpoint
 */
export const validateSaveOrderRequest = (req, res, next) => {
  try {
    const {
      products,
      combos,
      totalAmt,
      delivery_address,
      couponCode,
      discountAmount,
      finalAmount,
      influencerCode,
      affiliateCode,
      affiliateSource,
      notes,
      guestDetails,
      coinRedeem,
      purchaseOrderId,
      paymentType,
      paymentProvider,
      location,
    } = req.body;

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

    if (hasCombos) {
      combos.forEach((combo, index) => {
        if (!combo.comboId && !combo.id) {
          throw new AppError("MISSING_FIELD", {
            fieldName: `combos[${index}].comboId`,
          });
        }
        const quantity = Number(combo.quantity || 1);
        if (!Number.isFinite(quantity) || quantity < 1) {
          throw new AppError("INVALID_QUANTITY", {
            fieldName: `combos[${index}].quantity`,
            value: combo.quantity,
          });
        }
      });
    }

    // Validate total amount
    const subtotalFromProducts = calculateProductsSubtotal(products || [], combos || []);
    const totalAmount =
      totalAmt !== undefined
        ? validateAmount(totalAmt, "totalAmt", 0)
        : subtotalFromProducts;

    // Validate discount amounts if provided
    if (discountAmount !== undefined) {
      const discount = validateAmount(discountAmount, "discountAmount", 0);
      if (discount > totalAmount) {
        throw new AppError("INVALID_AMOUNT", {
          field: "discountAmount",
          message: "Discount cannot exceed total amount",
        });
      }
    }

    // Validate final amount if provided
    if (finalAmount !== undefined) {
      const final = validateAmount(finalAmount, "finalAmount", 1);
      if (final > totalAmount) {
        throw new AppError("INVALID_AMOUNT", {
          field: "finalAmount",
          message: "Final amount cannot exceed total amount",
        });
      }
    }

    // Validate delivery_address if provided
    if (delivery_address && !mongoose.Types.ObjectId.isValid(delivery_address)) {
      throw new AppError("INVALID_OBJECT_ID", { field: "delivery_address" });
    }
    if (purchaseOrderId && !mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
      throw new AppError("INVALID_OBJECT_ID", { field: "purchaseOrderId" });
    }

    const normalizedGuest = normalizeGuestDetails(guestDetails || {});
    const normalizedLocation = normalizeLocationPayload(location || null);
    const hasGuestIdentity = [
      "fullName",
      "phone",
      "flat_house",
      "area_street_sector",
      "pincode",
      "state",
      "email",
    ].some((field) => Boolean(normalizedGuest[field]));
    if (!req.user || hasGuestIdentity) {
      validateGuestDetails(normalizedGuest, { require: !req.user });
    }

    const validatedCoinRedeem =
      coinRedeem !== undefined
        ? validateAmount(
            typeof coinRedeem === "object" ? coinRedeem.coins : coinRedeem,
            "coinRedeem",
            0,
          )
        : 0;

    const allowedPaymentTypes = ["prepaid", "cod", "reverse"];
    const normalizedPaymentType = paymentType
      ? String(paymentType).toLowerCase()
      : "prepaid";
    if (!allowedPaymentTypes.includes(normalizedPaymentType)) {
      throw new AppError("INVALID_FORMAT", {
        field: "paymentType",
        validValues: allowedPaymentTypes,
      });
    }

    const normalizedPaymentProvider = paymentProvider
      ? String(paymentProvider).trim().toUpperCase()
      : null;
    if (
      normalizedPaymentProvider &&
      !["PAYTM", "PHONEPE"].includes(normalizedPaymentProvider)
    ) {
      throw new AppError("INVALID_FORMAT", {
        field: "paymentProvider",
        validValues: ["PAYTM", "PHONEPE"],
      });
    }

    // Validate coupon code format (alphanumeric, max 50 chars)
    if (couponCode && typeof couponCode === "string") {
      if (couponCode.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(couponCode)) {
        throw new AppError("INVALID_FORMAT", {
          field: "couponCode",
          message: "Invalid coupon code format",
        });
      }
    }

    // Validate influencer code format (alphanumeric, max 50 chars)
    if (influencerCode && typeof influencerCode === "string") {
      if (influencerCode.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(influencerCode)) {
        throw new AppError("INVALID_FORMAT", {
          field: "influencerCode",
          message: "Invalid influencer code format",
        });
      }
    }

    // Validate affiliate code format (alphanumeric, max 50 chars)
    if (affiliateCode && typeof affiliateCode === "string") {
      if (affiliateCode.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(affiliateCode)) {
        throw new AppError("INVALID_FORMAT", {
          field: "affiliateCode",
          message: "Invalid affiliate code format",
        });
      }
    }

    // Validate affiliate source
    if (affiliateSource) {
      const allowedSources = ["influencer", "campaign", "referral", "organic"];
      if (!allowedSources.includes(String(affiliateSource))) {
        throw new AppError("INVALID_FORMAT", {
          field: "affiliateSource",
          validValues: allowedSources,
        });
      }
    }

    // Validate notes if provided (max 500 chars)
    if (notes && typeof notes === "string" && notes.length > 500) {
      throw new AppError("INVALID_FORMAT", {
        field: "notes",
        message: "Notes cannot exceed 500 characters",
      });
    }

    // Store validated data
    req.validatedData = {
      products,
      combos: Array.isArray(combos) ? combos : [],
      totalAmt: totalAmount,
      delivery_address: delivery_address || null,
      couponCode: couponCode || null,
      discountAmount: discountAmount ? validateAmount(discountAmount, "discountAmount", 0) : 0,
      finalAmount: finalAmount ? validateAmount(finalAmount, "finalAmount", 1) : totalAmount,
      influencerCode: influencerCode || null,
      affiliateCode: affiliateCode || null,
      affiliateSource: affiliateSource || null,
      notes: notes ? notes.trim().substring(0, 500) : null,
      guestDetails: normalizedGuest,
      location: normalizedLocation,
      coinRedeem: validatedCoinRedeem,
      purchaseOrderId: purchaseOrderId || null,
      paymentType: normalizedPaymentType,
      paymentProvider: normalizedPaymentProvider,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.status).json({
        error: true,
        success: false,
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }

    return res.status(400).json({
      error: true,
      success: false,
      message: "Invalid request format",
      details: error.message,
    });
  }
};

/**
 * Validate Update Order Status Request
 */
export const validateUpdateOrderStatusRequest = (req, res, next) => {
  try {
    const { id } = req.params;
    const { order_status, notes } = req.body;

    // Validate order ID
    validateMongoId(id, "id");

    // Validate order status
    const validStatuses = [
      "pending",
      "pending_payment",
      "accepted",
      "in_warehouse",
      "shipped",
      "out_for_delivery",
      "delivered",
      "completed",
      "cancelled",
      "rto",
      "rto_completed",
      "confirmed",
    ];
    if (!order_status || !validStatuses.includes(order_status)) {
      throw new AppError("INVALID_STATUS", {
        field: "order_status",
        validValues: validStatuses,
      });
    }

    // Validate notes if provided
    if (notes && typeof notes === "string" && notes.length > 500) {
      throw new AppError("INVALID_FORMAT", {
        field: "notes",
        message: "Notes cannot exceed 500 characters",
      });
    }

    req.validatedData = {
      id,
      order_status,
      notes: notes ? notes.trim().substring(0, 500) : null,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.status).json({
        error: true,
        success: false,
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }

    return res.status(400).json({
      error: true,
      success: false,
      message: "Invalid request format",
      details: error.message,
    });
  }
};

/**
 * Validate Verify Payment Request
 */
/**
 * Validate Get Order Request
 */
export const validateGetOrderRequest = (req, res, next) => {
  try {
    const id = req.params.id || req.params.orderId;

    // Validate order ID
    validateMongoId(id, "id");

    req.validatedData = { id };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.status).json({
        error: true,
        success: false,
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }

    return res.status(400).json({
      error: true,
      success: false,
      message: "Invalid request format",
      details: error.message,
    });
  }
};

/**
 * Validate pagination query parameters
 */
export const validatePaginationQuery = (req, res, next) => {
  try {
    let { page = 1, limit = 20, search, status } = req.query;

    // Validate page
    page = Number(page);
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    // Validate limit
    limit = Number(limit);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      limit = 20;
    }

    // Validate status if provided
    if (status) {
      const validStatuses = [
        "all",
        "pending",
        "successful",
        "failed",
        "pending_payment",
        "accepted",
        "in_warehouse",
        "out_for_delivery",
        "confirmed",
        "shipped",
        "delivered",
        "completed",
        "cancelled",
        "rto",
        "rto_completed",
      ];
      if (!validStatuses.includes(status)) {
        status = "all";
      }
    }

    // Sanitize search string (prevent injection)
    if (search && typeof search === "string") {
      search = search.trim().substring(0, 100);
      // Escape special regex characters
      search = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    req.pagination = { page, limit, search: search || null, status: status || "all" };

    next();
  } catch (error) {
    return res.status(400).json({
      error: true,
      success: false,
      message: "Invalid query parameters",
      details: error.message,
    });
  }
};

export default {
  validateCreateOrderRequest,
  validateSaveOrderRequest,
  validateUpdateOrderStatusRequest,
  validateGetOrderRequest,
  validatePaginationQuery,
};
