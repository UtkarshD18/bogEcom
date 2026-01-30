import rateLimit from "express-rate-limit";

/**
 * Rate Limiting Configuration
 *
 * Prevents abuse and brute-force attacks on sensitive endpoints.
 * PRODUCTION-READY: Properly configured limits for security.
 */

// General API rate limit - 100 requests per 15 minutes per IP
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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

// Auth rate limit - 10 attempts per 15 minutes (stricter for login/register)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Strict limit for auth endpoints
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
