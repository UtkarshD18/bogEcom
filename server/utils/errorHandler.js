/**
 * Production-Grade Error Handler & Logger
 * Centralized error handling, logging, and user-friendly error responses
 */

// ==================== ERROR DEFINITIONS ====================

export const ERROR_CODES = {
  // Validation Errors (400-409)
  INVALID_INPUT: { code: "INVALID_INPUT", status: 400, message: "Invalid input provided" },
  MISSING_FIELD: { code: "MISSING_FIELD", status: 400, message: "Missing required field" },
  INVALID_FORMAT: { code: "INVALID_FORMAT", status: 400, message: "Invalid format" },
  INVALID_OBJECT_ID: { code: "INVALID_OBJECT_ID", status: 400, message: "Invalid ID format" },
  INVALID_AMOUNT: { code: "INVALID_AMOUNT", status: 400, message: "Invalid amount" },
  EMPTY_PRODUCTS: { code: "EMPTY_PRODUCTS", status: 400, message: "Products array cannot be empty" },
  INVALID_QUANTITY: { code: "INVALID_QUANTITY", status: 400, message: "Invalid product quantity" },
  INVALID_STATUS: { code: "INVALID_STATUS", status: 400, message: "Invalid status value" },
  CONFLICT: { code: "CONFLICT", status: 409, message: "Resource conflict" },

  // Authentication & Authorization (401-403)
  UNAUTHORIZED: { code: "UNAUTHORIZED", status: 401, message: "Authentication required" },
  INVALID_TOKEN: { code: "INVALID_TOKEN", status: 401, message: "Invalid or expired token" },
  TOKEN_EXPIRED: { code: "TOKEN_EXPIRED", status: 401, message: "Token has expired" },
  FORBIDDEN: { code: "FORBIDDEN", status: 403, message: "Access denied" },
  INSUFFICIENT_PERMISSIONS: { code: "INSUFFICIENT_PERMISSIONS", status: 403, message: "Insufficient permissions" },

  // Resource Not Found (404)
  NOT_FOUND: { code: "NOT_FOUND", status: 404, message: "Resource not found" },
  ORDER_NOT_FOUND: { code: "ORDER_NOT_FOUND", status: 404, message: "Order not found" },
  USER_NOT_FOUND: { code: "USER_NOT_FOUND", status: 404, message: "User not found" },
  PRODUCT_NOT_FOUND: { code: "PRODUCT_NOT_FOUND", status: 404, message: "Product not found" },
  ADDRESS_NOT_FOUND: { code: "ADDRESS_NOT_FOUND", status: 404, message: "Address not found" },

  // Payment Errors (402, 422)
  PAYMENT_REQUIRED: { code: "PAYMENT_REQUIRED", status: 402, message: "Payment required" },
  PAYMENT_FAILED: { code: "PAYMENT_FAILED", status: 422, message: "Payment processing failed" },
  PAYMENT_VERIFICATION_FAILED: { code: "PAYMENT_VERIFICATION_FAILED", status: 422, message: "Payment verification failed" },
  SIGNATURE_MISMATCH: { code: "SIGNATURE_MISMATCH", status: 422, message: "Signature verification failed" },
  INVALID_PAYMENT_METHOD: { code: "INVALID_PAYMENT_METHOD", status: 422, message: "Invalid payment method" },
  PAYMENT_GATEWAY_ERROR: { code: "PAYMENT_GATEWAY_ERROR", status: 503, message: "Payment gateway error" },

  // Service Unavailable (503)
  SERVICE_UNAVAILABLE: { code: "SERVICE_UNAVAILABLE", status: 503, message: "Service temporarily unavailable" },
  PAYMENT_DISABLED: { code: "PAYMENT_DISABLED", status: 503, message: "Payment service is currently unavailable" },
  DATABASE_ERROR: { code: "DATABASE_ERROR", status: 503, message: "Database service error" },

  // Server Errors (500+)
  INTERNAL_ERROR: { code: "INTERNAL_ERROR", status: 500, message: "Internal server error" },
  UNHANDLED_ERROR: { code: "UNHANDLED_ERROR", status: 500, message: "An unexpected error occurred" },
};

// ==================== CUSTOM ERROR CLASS ====================

export class AppError extends Error {
  constructor(errorCode, details = null, originalError = null) {
    const errorDef = ERROR_CODES[errorCode] || ERROR_CODES.INTERNAL_ERROR;
    super(errorDef.message);

    this.code = errorCode;
    this.status = errorDef.status;
    this.message = errorDef.message;
    this.details = details;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

// ==================== LOGGING UTILITIES ====================

const LOG_LEVELS = {
  ERROR: "ERROR",
  WARN: "WARN",
  INFO: "INFO",
  DEBUG: "DEBUG",
};

function formatLog(level, context, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    context,
    message,
    ...meta,
  };

  // In production, send to logging service (e.g., Sentry, LogRocket, CloudWatch)
  if (process.env.NODE_ENV === "production") {
    // TODO: Send to your logging service
    // sentry.captureException() or similar
  }

  return logEntry;
}

export const logger = {
  error: (context, message, meta = {}) => {
    const log = formatLog(LOG_LEVELS.ERROR, context, message, meta);
    console.error(`[${log.timestamp}] ${log.level} [${log.context}]: ${log.message}`, meta);
    return log;
  },

  warn: (context, message, meta = {}) => {
    const log = formatLog(LOG_LEVELS.WARN, context, message, meta);
    console.warn(`[${log.timestamp}] ${log.level} [${log.context}]: ${log.message}`, meta);
    return log;
  },

  info: (context, message, meta = {}) => {
    const log = formatLog(LOG_LEVELS.INFO, context, message, meta);
    console.log(`[${log.timestamp}] ${log.level} [${log.context}]: ${log.message}`, meta);
    return log;
  },

  debug: (context, message, meta = {}) => {
    if (process.env.NODE_ENV !== "production") {
      const log = formatLog(LOG_LEVELS.DEBUG, context, message, meta);
      console.log(`[${log.timestamp}] ${log.level} [${log.context}]: ${log.message}`, meta);
      return log;
    }
  },
};

// ==================== RESPONSE FORMATTERS ====================

/**
 * Send success response
 */
export function sendSuccess(res, data, message = "Success", statusCode = 200) {
  return res.status(statusCode).json({
    error: false,
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send error response
 */
export function sendError(res, error, statusCode = 500, includeDetails = false) {
  let errorCode = "INTERNAL_ERROR";
  let message = "Internal server error";
  let details = null;

  if (error instanceof AppError) {
    errorCode = error.code;
    message = error.message;
    statusCode = error.status;
    details = error.details;

    logger.error("AppError", message, {
      code: errorCode,
      details: error.details,
      stack: error.stack,
    });
  } else if (error instanceof Error) {
    message = error.message;
    logger.error("Error", message, {
      stack: error.stack,
      name: error.name,
    });
  }

  const response = {
    error: true,
    success: false,
    code: errorCode,
    message,
    timestamp: new Date().toISOString(),
  };

  // Include details only in development or if explicitly requested
  if (includeDetails && (process.env.NODE_ENV === "development" || details)) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
}

/**
 * Wrap async route handlers with error handling
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ==================== VALIDATION HELPERS ====================

export function validateMongoId(id, fieldName = "ID") {
  if (!id || typeof id !== "string") {
    throw new AppError("INVALID_OBJECT_ID", { fieldName, value: id });
  }

  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw new AppError("INVALID_OBJECT_ID", { fieldName, value: id });
  }

  return id;
}

export function validateAmount(amount, fieldName = "amount", minAmount = 1) {
  const numAmount = Number(amount);

  if (isNaN(numAmount) || numAmount < minAmount) {
    throw new AppError("INVALID_AMOUNT", {
      fieldName,
      value: amount,
      minAmount,
    });
  }

  return numAmount;
}

export function validateProductsArray(products, fieldName = "products") {
  if (!Array.isArray(products) || products.length === 0) {
    throw new AppError("EMPTY_PRODUCTS", {
      fieldName,
      value: products,
    });
  }

  // Validate each product
  products.forEach((product, index) => {
    if (!product.productId) {
      throw new AppError("MISSING_FIELD", {
        fieldName: `${fieldName}[${index}].productId`,
      });
    }

    if (!product.productTitle) {
      throw new AppError("MISSING_FIELD", {
        fieldName: `${fieldName}[${index}].productTitle`,
      });
    }

    const quantity = Number(product.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new AppError("INVALID_QUANTITY", {
        fieldName: `${fieldName}[${index}].quantity`,
        value: product.quantity,
      });
    }

    const price = Number(product.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new AppError("INVALID_AMOUNT", {
        fieldName: `${fieldName}[${index}].price`,
        value: product.price,
      });
    }

    if (product.subTotal !== undefined) {
      const subTotal = Number(product.subTotal);
      if (!Number.isFinite(subTotal) || subTotal < 0) {
        throw new AppError("INVALID_AMOUNT", {
          fieldName: `${fieldName}[${index}].subTotal`,
          value: product.subTotal,
        });
      }
    }
  });

  return products;
}

/**
 * Rate limit helper - returns true if should rate limit
 */
export function checkRateLimit(key, maxAttempts = 5, windowMs = 60000) {
  // This is a simple in-memory implementation
  // For production, use Redis-backed rate limiting
  const now = Date.now();

  if (!global.rateLimitStore) {
    global.rateLimitStore = {};
  }

  if (!global.rateLimitStore[key]) {
    global.rateLimitStore[key] = {
      count: 0,
      resetAt: now + windowMs,
    };
  }

  const entry = global.rateLimitStore[key];

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }

  entry.count++;

  return entry.count > maxAttempts;
}

// ==================== PAYMENT ERROR HELPERS ====================

/**
 * Handle payment gateway errors
 */
export function handlePaymentError(error, context = "Payment Processing") {
  logger.error(context, "Payment error occurred", {
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack,
  });

  // Map specific payment errors
  if (error.statusCode === 400) {
    throw new AppError("INVALID_PAYMENT_METHOD", { originalError: error.message });
  }

  if (error.statusCode === 401 || error.statusCode === 403) {
    throw new AppError("PAYMENT_GATEWAY_ERROR", { originalError: "Payment gateway authentication failed" });
  }

  if (error.statusCode >= 500) {
    throw new AppError("PAYMENT_GATEWAY_ERROR", { originalError: "Payment gateway is temporarily unavailable" });
  }

  throw new AppError("PAYMENT_FAILED", { originalError: error.message });
}

// ==================== DATABASE ERROR HELPERS ====================

/**
 * Handle database errors
 */
export function handleDatabaseError(error, context = "Database Operation") {
  logger.error(context, "Database error occurred", {
    errorName: error.name,
    errorMessage: error.message,
  });

  // Map mongoose-specific errors
  if (error.name === "ValidationError") {
    const details = Object.entries(error.errors).reduce((acc, [field, err]) => {
      acc[field] = err.message;
      return acc;
    }, {});
    throw new AppError("INVALID_INPUT", details);
  }

  if (error.name === "CastError") {
    throw new AppError("INVALID_OBJECT_ID", { field: error.path, value: error.value });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    throw new AppError("CONFLICT", { field, message: `${field} already exists` });
  }

  throw new AppError("DATABASE_ERROR", { originalError: error.message });
}
