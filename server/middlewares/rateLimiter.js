import rateLimit from "express-rate-limit";

/**
 * Rate Limiting Configuration
 *
 * Prevents abuse and brute-force attacks on sensitive endpoints.
 * PRODUCTION-READY: Properly configured limits for security.
 */

// General API rate limit - 500 requests per 15 minutes per IP
// Increased for SPA with multiple parallel requests
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: {
    error: true,
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Don't skip in development for testing purposes
  skip: () => false,
});

// Admin rate limit - Higher limit for admin panel operations
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Admin needs more requests for bulk operations
  message: {
    error: true,
    success: false,
    message: "Too many admin requests. Please wait a moment.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limit - 50 attempts per 15 minutes (reasonable for admin development)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // More reasonable limit for development and admin usage
  message: {
    error: true,
    success: false,
    message:
      "Too many authentication attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for logout endpoint
  skip: (req) => req.path === "/logout",
});

// Payment rate limit - 10 requests per minute (prevent payment abuse)
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    error: true,
    success: false,
    message: "Too many payment requests. Please wait a moment.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload rate limit - 20 uploads per 10 minutes
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: {
    error: true,
    success: false,
    message: "Upload limit reached. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Support ticket limiter - tighter limit to reduce spam on customer-care forms
export const supportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: true,
    success: false,
    message: "Too many support requests. Please try again after a few minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
