import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Rate Limiting Configuration
 *
 * Prevents abuse and brute-force attacks on sensitive endpoints.
 * PRODUCTION-READY: Properly configured limits for security.
 */

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const realIp = req.headers["x-real-ip"];

  const firstForwardedIp =
    typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : "";
  const normalizedRealIp = typeof realIp === "string" ? realIp.trim() : "";

  return (
    firstForwardedIp ||
    normalizedRealIp ||
    req.ip ||
    req.socket?.remoteAddress ||
    "127.0.0.1"
  );
};

const getTopLevelApiBucket = (req) => {
  const rawPath = String(req.originalUrl || req.url || "").split("?")[0];
  const normalizedPath = rawPath.replace(/\/{2,}/g, "/");

  if (!normalizedPath.startsWith("/api/")) {
    return normalizedPath || "/";
  }

  const pathSegments = normalizedPath.split("/").filter(Boolean);
  return pathSegments.length >= 2 ? `/api/${pathSegments[1]}` : "/api";
};

const buildLimiterKey = (req, scope, includeApiBucket = false) => {
  const ipKey = ipKeyGenerator(getClientIp(req));
  if (!includeApiBucket) return `${scope}:${ipKey}`;
  return `${scope}:${getTopLevelApiBucket(req)}:${ipKey}`;
};

const skipPreflight = (req) => req.method === "OPTIONS";

const generalLimitMax = toPositiveInteger(process.env.RATE_LIMIT_GENERAL_MAX, 1500);
const adminLimitMax = toPositiveInteger(process.env.RATE_LIMIT_ADMIN_MAX, 2500);
const authLimitMax = toPositiveInteger(process.env.RATE_LIMIT_AUTH_MAX, 80);
const paymentLimitMax = toPositiveInteger(process.env.RATE_LIMIT_PAYMENT_MAX, 12);
const uploadLimitMax = toPositiveInteger(process.env.RATE_LIMIT_UPLOAD_MAX, 30);
const supportLimitMax = toPositiveInteger(process.env.RATE_LIMIT_SUPPORT_MAX, 10);

// General API rate limit - scoped by top-level /api/* route and client IP
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: generalLimitMax,
  message: {
    error: true,
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => buildLimiterKey(req, "general", true),
  skip: skipPreflight,
});

// Admin rate limit - Higher limit for admin panel operations
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: adminLimitMax,
  message: {
    error: true,
    success: false,
    message: "Too many admin requests. Please wait a moment.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => buildLimiterKey(req, "admin", true),
  skip: skipPreflight,
});

// Auth rate limit - 50 attempts per 15 minutes (reasonable for admin development)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: authLimitMax,
  message: {
    error: true,
    success: false,
    message:
      "Too many authentication attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => buildLimiterKey(req, "auth"),
  // Skip rate limiting for logout endpoint
  skip: (req) => skipPreflight(req) || req.path === "/logout",
});

// Payment rate limit - 10 requests per minute (prevent payment abuse)
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: paymentLimitMax,
  message: {
    error: true,
    success: false,
    message: "Too many payment requests. Please wait a moment.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => buildLimiterKey(req, "payment", true),
  skip: skipPreflight,
});

// Upload rate limit - 20 uploads per 10 minutes
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: uploadLimitMax,
  message: {
    error: true,
    success: false,
    message: "Upload limit reached. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => buildLimiterKey(req, "upload", true),
  skip: skipPreflight,
});

// Support ticket limiter - tighter limit to reduce spam on customer-care forms
export const supportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: supportLimitMax,
  message: {
    error: true,
    success: false,
    message: "Too many support requests. Please try again after a few minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => buildLimiterKey(req, "support", true),
  skip: skipPreflight,
});
