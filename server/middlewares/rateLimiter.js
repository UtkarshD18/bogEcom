import rateLimit from "express-rate-limit";

/**
 * Rate Limiting Configuration
 *
 * Prevents abuse and brute-force attacks on sensitive endpoints.
 * Adjust limits based on expected traffic patterns.
 */

// General API rate limit - 100 requests per 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    error: true,
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "development", // Skip in dev
});

// Auth rate limit - 5 attempts per 15 minutes (stricter for login/register)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    error: true,
    success: false,
    message:
      "Too many authentication attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment rate limit - 10 requests per minute
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
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
  max: 200,
  message: {
    error: true,
    success: false,
    message: "Upload limit reached. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
