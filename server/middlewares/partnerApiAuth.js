import crypto from "node:crypto";
import Partner from "../models/partner.model.js";
import PartnerApiKey from "../models/partnerApiKey.model.js";

const PARTNER_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const PARTNER_RATE_LIMIT_DEFAULT_MAX = 120;
const PARTNER_RATE_LIMIT_MIN_MAX = 10;
const PARTNER_RATE_LIMIT_MAX_MAX = 5000;

const partnerRateLimitStore = new Map();

const toClampedRateLimit = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return PARTNER_RATE_LIMIT_DEFAULT_MAX;
  return Math.min(
    PARTNER_RATE_LIMIT_MAX_MAX,
    Math.max(PARTNER_RATE_LIMIT_MIN_MAX, parsed),
  );
};

const sweepPartnerRateLimitStore = () => {
  const now = Date.now();
  for (const [key, entry] of partnerRateLimitStore.entries()) {
    if (!entry || Number(entry.resetAt || 0) <= now) {
      partnerRateLimitStore.delete(key);
    }
  }
};

setInterval(sweepPartnerRateLimitStore, 5 * 60 * 1000).unref?.();

export const getPartnerRateLimitSnapshot = ({
  partnerId,
  keyPrefix,
  configuredRateLimitPerMinute,
}) => {
  const safePartnerId = String(partnerId || "").trim();
  const safeKeyPrefix = String(keyPrefix || "").trim();
  const limit = toClampedRateLimit(configuredRateLimitPerMinute);
  if (!safePartnerId || !safeKeyPrefix) {
    return {
      limit,
      used: 0,
      remaining: limit,
      resetInSeconds: 0,
      isLimited: false,
    };
  }

  const now = Date.now();
  const rateKey = `partner:${safePartnerId}:${safeKeyPrefix}`;
  const bucket = partnerRateLimitStore.get(rateKey);
  if (!bucket || Number(bucket.resetAt || 0) <= now) {
    if (bucket) {
      partnerRateLimitStore.delete(rateKey);
    }
    return {
      limit,
      used: 0,
      remaining: limit,
      resetInSeconds: 0,
      isLimited: false,
    };
  }

  const used = Math.max(Number(bucket.count || 0), 0);
  const remaining = Math.max(limit - used, 0);
  const resetInSeconds = Math.max(
    1,
    Math.ceil((Number(bucket.resetAt || now) - now) / 1000),
  );

  return {
    limit,
    used,
    remaining,
    resetInSeconds,
    isLimited: remaining <= 0,
  };
};

const hashApiKey = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const extractApiKey = (req) => {
  const authHeader = String(req.headers?.authorization || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  const keyHeader = String(req.headers?.["x-api-key"] || "").trim();
  if (keyHeader) return keyHeader;

  return "";
};

const hasScope = (partner, requiredScope) => {
  const scopes = Array.isArray(partner?.scopes) ? partner.scopes : [];
  return scopes.includes("*") || scopes.includes(requiredScope);
};

export const requirePartnerScope = (scope) => (req, res, next) => {
  if (!hasScope(req.partner, scope)) {
    return res.status(403).json({
      success: false,
      error: {
        code: "INSUFFICIENT_SCOPE",
        message: `Required scope missing: ${scope}`,
        details: null,
      },
      meta: {
        requestId: req.requestId || "",
      },
    });
  }

  return next();
};

export const partnerApiAuth = async (req, res, next) => {
  try {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Missing API key",
          details: null,
        },
      });
    }

    const keyPrefix = String(apiKey).split(".")[0]?.trim();
    if (!keyPrefix || !keyPrefix.startsWith("hogp_")) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid API key format",
          details: null,
        },
      });
    }

    const keyRecord = await PartnerApiKey.findOne({
      keyPrefix,
      status: "active",
    }).lean();

    if (!keyRecord) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "API key not found",
          details: null,
        },
      });
    }

    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      return res.status(401).json({
        success: false,
        error: {
          code: "KEY_EXPIRED",
          message: "API key expired",
          details: null,
        },
      });
    }

    const incomingHash = hashApiKey(apiKey);
    if (incomingHash !== keyRecord.keyHash) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid API key",
          details: null,
        },
      });
    }

    const partner = await Partner.findById(keyRecord.partnerId).lean();
    if (!partner || partner.status !== "active") {
      return res.status(403).json({
        success: false,
        error: {
          code: "PARTNER_INACTIVE",
          message: "Partner is inactive",
          details: null,
        },
      });
    }

    req.partner = partner;
    req.partnerKey = keyRecord;

    PartnerApiKey.updateOne(
      { _id: keyRecord._id },
      {
        $set: {
          lastUsedAt: new Date(),
          lastUsedIp: String(req.ip || req.socket?.remoteAddress || ""),
        },
      },
    ).catch(() => null);

    return next();
  } catch (error) {
    console.error("partnerApiAuth error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: "AUTH_FAILED",
        message: "Partner authentication failed",
        details: null,
      },
    });
  }
};

export const partnerRuntimeLimiter = (req, res, next) => {
  try {
    if (req.method === "OPTIONS") return next();
    if (!req.partner || !req.partnerKey) return next();

    const partnerId = String(req.partner?._id || "").trim();
    const keyPrefix = String(req.partnerKey?.keyPrefix || "").trim();
    if (!partnerId || !keyPrefix) return next();

    const limit = toClampedRateLimit(req.partner?.rateLimitPerMinute);
    const now = Date.now();
    const rateKey = `partner:${partnerId}:${keyPrefix}`;

    let bucket = partnerRateLimitStore.get(rateKey);
    if (!bucket || Number(bucket.resetAt || 0) <= now) {
      bucket = {
        count: 0,
        resetAt: now + PARTNER_RATE_LIMIT_WINDOW_MS,
      };
      partnerRateLimitStore.set(rateKey, bucket);
    }

    const resetInSeconds = Math.max(
      1,
      Math.ceil((Number(bucket.resetAt || now) - now) / 1000),
    );

    const baseHeaders = {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Reset": String(resetInSeconds),
      "RateLimit-Limit": `${limit};w=60`,
      "RateLimit-Reset": String(resetInSeconds),
    };

    if (bucket.count >= limit) {
      res.setHeader("Retry-After", String(resetInSeconds));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("RateLimit-Remaining", "0");
      for (const [header, value] of Object.entries(baseHeaders)) {
        res.setHeader(header, value);
      }

      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Partner API rate limit exceeded. Please retry later.",
          details: {
            limit,
            windowSeconds: 60,
            retryAfterSeconds: resetInSeconds,
          },
        },
        meta: {
          requestId: req.requestId || "",
          partnerId,
        },
      });
    }

    bucket.count += 1;
    const remaining = Math.max(limit - bucket.count, 0);
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Remaining", String(remaining));
    for (const [header, value] of Object.entries(baseHeaders)) {
      res.setHeader(header, value);
    }

    return next();
  } catch (error) {
    console.error("partnerRuntimeLimiter error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: "RATE_LIMIT_CHECK_FAILED",
        message: "Unable to validate partner rate limit",
        details: null,
      },
    });
  }
};

export default partnerApiAuth;
