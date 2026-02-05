/**
 * Order Request Validation Middleware
 * Validates and sanitizes all order-related API requests
 */

import { AppError, validateAmount, validateMongoId, validateProductsArray } from "../utils/errorHandler.js";
import mongoose from "mongoose";

/**
 * Validate Create Order Request
 * Ensures all required fields are present and properly formatted
 */
export const validateCreateOrderRequest = (req, res, next) => {
  try {
    const { products, totalAmt, delivery_address } = req.body;

    // Validate products array
    validateProductsArray(products, "products");

    // Validate total amount
    validateAmount(totalAmt, "totalAmt", 1);

    // Validate delivery_address if provided
    if (delivery_address) {
      validateMongoId(delivery_address, "delivery_address");
    }

    // Store validated data back to req.body
    req.validatedData = {
      products,
      totalAmt: Number(totalAmt),
      delivery_address: delivery_address || null,
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
      notes,
    } = req.body;

    // Validate products array
    validateProductsArray(products, "products");

    // Validate total amount
    const totalAmount = validateAmount(totalAmt, "totalAmt", 1);

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
 * Validate Update Order Status Request
 */
export const validateUpdateOrderStatusRequest = (req, res, next) => {
  try {
    const { id } = req.params;
    const { order_status, notes } = req.body;

    // Validate order ID
    validateMongoId(id, "id");

    // Validate order status
    const validStatuses = ["pending", "pending_payment", "confirmed", "shipped", "delivered", "cancelled"];
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
export const validateVerifyPaymentRequest = (req, res, next) => {
  try {
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    // Validate order ID
    if (orderId) {
      validateMongoId(orderId, "orderId");
    }

    // Validate payment ID
    if (!razorpayPaymentId || typeof razorpayPaymentId !== "string" || razorpayPaymentId.trim().length === 0) {
      throw new AppError("MISSING_FIELD", { field: "razorpayPaymentId" });
    }

    // Validate razorpay order ID
    if (!razorpayOrderId || typeof razorpayOrderId !== "string" || razorpayOrderId.trim().length === 0) {
      throw new AppError("MISSING_FIELD", { field: "razorpayOrderId" });
    }

    // Validate signature
    if (!razorpaySignature || typeof razorpaySignature !== "string" || razorpaySignature.trim().length === 0) {
      throw new AppError("MISSING_FIELD", { field: "razorpaySignature" });
    }

    req.validatedData = {
      orderId,
      razorpayPaymentId: razorpayPaymentId.trim(),
      razorpayOrderId: razorpayOrderId.trim(),
      razorpaySignature: razorpaySignature.trim(),
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
 * Validate Get Order Request
 */
export const validateGetOrderRequest = (req, res, next) => {
  try {
    const { id } = req.params;

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
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
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
  validateVerifyPaymentRequest,
  validateGetOrderRequest,
  validatePaginationQuery,
};
