/**
 * Order Request Validation Middleware
 * Validates and sanitizes all order-related API requests
 */

import { AppError, validateAmount, validateMongoId, validateProductsArray } from "../utils/errorHandler.js";
import mongoose from "mongoose";

const calculateProductsSubtotal = (products = []) =>
  Number(
    products.reduce(
      (sum, item) =>
        sum +
        Number(
          item.subTotal || Number(item.price || 0) * Number(item.quantity || 0),
        ),
      0,
    ) || 0,
  );

const normalizeGuestDetails = (guestDetails = {}) => ({
  fullName: String(guestDetails.fullName || "").trim(),
  phone: String(guestDetails.phone || "").trim(),
  address: String(guestDetails.address || "").trim(),
  pincode: String(guestDetails.pincode || "").trim(),
  state: String(guestDetails.state || "").trim(),
  email: String(guestDetails.email || "").trim().toLowerCase(),
  gst: String(guestDetails.gst || "").trim(),
});

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

const validateGuestDetails = (guestDetails) => {
  const hasAnyGuestField = Object.values(guestDetails).some(Boolean);
  if (!hasAnyGuestField) return;

  const requiredFields = [
    "fullName",
    "phone",
    "address",
    "pincode",
    "state",
    "email",
  ];

  for (const field of requiredFields) {
    if (!guestDetails[field]) {
      throw new AppError("MISSING_FIELD", {
        field: `guestDetails.${field}`,
      });
    }
  }

  if (!/^\d{10}$/.test(guestDetails.phone)) {
    throw new AppError("INVALID_FORMAT", {
      field: "guestDetails.phone",
      message: "Phone must be 10 digits",
    });
  }

  if (!/^\d{6}$/.test(guestDetails.pincode)) {
    throw new AppError("INVALID_FORMAT", {
      field: "guestDetails.pincode",
      message: "Pincode must be 6 digits",
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestDetails.email)) {
    throw new AppError("INVALID_FORMAT", {
      field: "guestDetails.email",
      message: "Invalid email format",
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
      location,
    } = req.body;

    // Validate products array
    validateProductsArray(products, "products");

    // Validate total amount (fallback to subtotal if omitted by client)
    const subtotalFromProducts = calculateProductsSubtotal(products);
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
      "address",
      "pincode",
      "state",
      "email",
    ].some((field) => Boolean(normalizedGuest[field]));
    if (!req.user || hasGuestIdentity) {
      validateGuestDetails(normalizedGuest);
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
      location,
    } = req.body;

    // Validate products array
    validateProductsArray(products, "products");

    // Validate total amount
    const subtotalFromProducts = calculateProductsSubtotal(products);
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
      "address",
      "pincode",
      "state",
      "email",
    ].some((field) => Boolean(normalizedGuest[field]));
    if (!req.user || hasGuestIdentity) {
      validateGuestDetails(normalizedGuest);
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
