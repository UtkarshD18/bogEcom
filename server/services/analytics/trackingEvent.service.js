import { gunzipSync } from "zlib";
import { z } from "zod";
import {
  DEFAULT_ANALYTICS_CONSENT_COOKIE,
  DEFAULT_TRACKING_BATCH_MAX_BYTES,
  DEFAULT_TRACKING_BATCH_MAX_EVENTS,
  EVENT_TYPE_PATTERN,
  SENSITIVE_FIELD_PATTERNS,
  SENSITIVE_QUERY_KEYS,
  TRACKED_EVENT_SET,
} from "./constants.js";

const MAX_STRING_FIELD_LENGTH = 2048;
const UNKNOWN_VALUE = "unknown";

const locationSchema = z.object({
  country: z.string().max(128).default(UNKNOWN_VALUE),
  city: z.string().max(128).default(UNKNOWN_VALUE),
});

const clientEventSchema = z.object({
  eventId: z.string().min(8).max(128),
  eventType: z.string().min(2).max(64),
  sessionId: z.string().min(8).max(128).optional(),
  userId: z.string().max(128).nullable().optional(),
  timestamp: z.string().datetime().optional(),
  pageUrl: z.string().max(MAX_STRING_FIELD_LENGTH).optional(),
  referrer: z.string().max(MAX_STRING_FIELD_LENGTH).optional(),
  ipAddress: z.string().max(128).optional(),
  deviceType: z.string().max(64).optional(),
  browser: z.string().max(128).optional(),
  location: z
    .object({
      country: z.string().max(128).optional(),
      city: z.string().max(128).optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const trackingBatchSchema = z.object({
  sessionId: z.string().min(8).max(128),
  consent: z.string().optional(),
  events: z
    .array(clientEventSchema)
    .min(1)
    .max(Number(process.env.TRACKING_BATCH_MAX_EVENTS || DEFAULT_TRACKING_BATCH_MAX_EVENTS)),
});

export const trackingEventSchema = z.object({
  eventId: z.string().min(8).max(128),
  eventType: z.string().min(2).max(64),
  userId: z.string().max(128).nullable(),
  sessionId: z.string().min(8).max(128),
  timestamp: z.string().datetime(),
  ipAddress: z.string().max(128),
  userAgent: z.string().max(MAX_STRING_FIELD_LENGTH),
  deviceType: z.string().max(64),
  browser: z.string().max(128),
  location: locationSchema,
  pageUrl: z.string().max(MAX_STRING_FIELD_LENGTH),
  referrer: z.string().max(MAX_STRING_FIELD_LENGTH),
  metadata: z.record(z.unknown()).default({}),
});

const toSafeString = (value, fallback = "") =>
  String(value ?? fallback)
    .trim()
    .slice(0, MAX_STRING_FIELD_LENGTH);

const toSmallString = (value, fallback = "") =>
  String(value ?? fallback)
    .trim()
    .slice(0, 128);

const toValidIsoTimestamp = (value) => {
  const candidate = value ? new Date(value) : new Date();
  if (Number.isNaN(candidate.getTime())) {
    return new Date().toISOString();
  }
  return candidate.toISOString();
};

const extractIpAddress = (req) => {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (forwarded.length > 0) {
    return forwarded[0];
  }

  return String(req.ip || req.socket?.remoteAddress || "").trim();
};

const maskIpAddress = (rawIp) => {
  const ip = String(rawIp || "").trim();
  if (!ip) return UNKNOWN_VALUE;

  const shouldMask =
    String(process.env.ANALYTICS_MASK_IP || "")
      .trim()
      .toLowerCase() === "true";

  if (!shouldMask) return ip;

  // IPv4: keep /24 range.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split(".");
    parts[3] = "0";
    return parts.join(".");
  }

  // IPv6: keep first 3 hextets.
  if (ip.includes(":")) {
    const segments = ip.split(":").filter((segment) => segment.length > 0);
    return `${segments.slice(0, 3).join(":")}::`;
  }

  return ip;
};

const resolveBrowserFromUserAgent = (userAgent) => {
  const ua = String(userAgent || "");
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/MSIE|Trident/i.test(ua)) return "Internet Explorer";
  return "Other";
};

const resolveDeviceTypeFromUserAgent = (userAgent) => {
  const ua = String(userAgent || "").toLowerCase();
  if (/bot|crawler|spider|crawling/.test(ua)) return "bot";
  if (/tablet|ipad/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  return "desktop";
};

const isSensitiveField = (key) =>
  SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(key));

const sanitizeScalar = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  return toSafeString(value);
};

export const sanitizeSensitiveData = (value, key = "") => {
  if (isSensitiveField(String(key || ""))) {
    return "[REDACTED]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 200).map((item) => sanitizeSensitiveData(item, key));
  }

  if (value && typeof value === "object") {
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      output[childKey] = sanitizeSensitiveData(childValue, childKey);
    }
    return output;
  }

  return sanitizeScalar(value);
};

export const sanitizeUrl = (rawUrl) => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";

  try {
    const parsed = new URL(value, "https://tracking.local");
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEYS.has(String(key || "").toLowerCase())) {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }

    const pathname = parsed.pathname || "/";
    const search = parsed.search || "";
    const hash = parsed.hash || "";

    if (/^https?:\/\//i.test(value)) {
      return `${parsed.origin}${pathname}${search}${hash}`.slice(0, MAX_STRING_FIELD_LENGTH);
    }

    return `${pathname}${search}${hash}`.slice(0, MAX_STRING_FIELD_LENGTH);
  } catch {
    return value.slice(0, MAX_STRING_FIELD_LENGTH);
  }
};

const normalizeConsent = (value) => {
  const normalized = String(value || "")
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

const shouldRespectDoNotTrack = () => {
  const explicit = String(process.env.ANALYTICS_RESPECT_DNT || "")
    .trim()
    .toLowerCase();

  if (explicit) {
    return ["true", "1", "yes", "on"].includes(explicit);
  }

  return process.env.NODE_ENV === "production";
};

export const isTrackingSuppressed = (req, explicitConsent = "") => {
  const dntHeader = String(req.headers.dnt || "").trim();
  const gpcHeader = String(req.headers["sec-gpc"] || "").trim();

  if (shouldRespectDoNotTrack() && (dntHeader === "1" || gpcHeader === "1")) {
    return true;
  }

  const consentCandidate = normalizeConsent(
    explicitConsent ||
      req.headers["x-analytics-consent"] ||
      req.cookies?.[DEFAULT_ANALYTICS_CONSENT_COOKIE] ||
      req.body?.consent ||
      "",
  );

  return consentCandidate === "denied";
};

const resolveLocation = (req, sourceLocation = {}) => {
  const country =
    toSmallString(
      sourceLocation?.country ||
        req.headers["x-appengine-country"] ||
        req.headers["x-country"] ||
        UNKNOWN_VALUE,
      UNKNOWN_VALUE,
    ) || UNKNOWN_VALUE;

  const city =
    toSmallString(
      sourceLocation?.city ||
        req.headers["x-appengine-city"] ||
        req.headers["x-city"] ||
        UNKNOWN_VALUE,
      UNKNOWN_VALUE,
    ) || UNKNOWN_VALUE;

  return { country, city };
};

const resolveEventType = (rawType) => {
  const candidate = String(rawType || "")
    .trim()
    .toLowerCase();

  if (!candidate) {
    throw new Error("eventType is required");
  }

  if (TRACKED_EVENT_SET.has(candidate)) {
    return candidate;
  }

  if (EVENT_TYPE_PATTERN.test(candidate)) {
    return candidate;
  }

  throw new Error(`Unsupported event type: ${candidate}`);
};

export const buildTrackingEvent = ({
  req,
  event,
  sessionId,
  userId = null,
}) => {
  const parsedEvent = clientEventSchema.parse(event || {});
  const resolvedSessionId = toSmallString(
    sessionId || parsedEvent.sessionId || req.analyticsSessionId || req.cookies?.hog_sid || "",
  );

  if (!resolvedSessionId) {
    throw new Error("sessionId is required");
  }

  const userAgent =
    toSafeString(req.headers["user-agent"] || "unknown", "unknown") || "unknown";

  const resolvedDeviceType =
    toSafeString(
      parsedEvent.deviceType || resolveDeviceTypeFromUserAgent(userAgent),
      "desktop",
    ) || "desktop";

  const resolvedBrowser =
    toSafeString(
      parsedEvent.browser || resolveBrowserFromUserAgent(userAgent),
      "Other",
    ) || "Other";

  const normalizedEvent = {
    eventId: toSmallString(parsedEvent.eventId),
    eventType: resolveEventType(parsedEvent.eventType),
    userId: userId ? toSmallString(userId) : parsedEvent.userId ? toSmallString(parsedEvent.userId) : null,
    sessionId: resolvedSessionId,
    timestamp: toValidIsoTimestamp(parsedEvent.timestamp),
    ipAddress:
      toSmallString(
        maskIpAddress(parsedEvent.ipAddress || extractIpAddress(req)),
        UNKNOWN_VALUE,
      ) || UNKNOWN_VALUE,
    userAgent,
    deviceType: resolvedDeviceType,
    browser: resolvedBrowser,
    location: resolveLocation(req, parsedEvent.location || {}),
    pageUrl: sanitizeUrl(parsedEvent.pageUrl || req.headers["x-page-url"] || req.originalUrl || ""),
    referrer: sanitizeUrl(
      parsedEvent.referrer || req.headers.referer || req.headers.referrer || "",
    ),
    metadata: sanitizeSensitiveData(parsedEvent.metadata || {}, "metadata") || {},
  };

  return trackingEventSchema.parse(normalizedEvent);
};

export const decodeCompressedTrackingPayload = (payload = {}) => {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const isCompressed = Boolean(payload.compressed);
  const encoding = String(payload.encoding || "").trim().toLowerCase();
  const compressedPayload = payload.payload;

  if (!isCompressed || !compressedPayload) {
    return payload;
  }

  if (encoding !== "gzip-base64") {
    throw new Error(`Unsupported tracking payload encoding: ${encoding || "unknown"}`);
  }

  const rawBuffer = Buffer.from(String(compressedPayload || ""), "base64");
  const maxBytes = Number(process.env.TRACKING_BATCH_MAX_BYTES || DEFAULT_TRACKING_BATCH_MAX_BYTES);
  if (rawBuffer.length > maxBytes * 2) {
    throw new Error("Compressed tracking payload exceeded maximum size");
  }

  const uncompressed = gunzipSync(rawBuffer);
  if (uncompressed.byteLength > maxBytes) {
    throw new Error("Tracking payload exceeded maximum uncompressed size");
  }

  const decoded = JSON.parse(uncompressed.toString("utf8"));
  if (!decoded || typeof decoded !== "object") {
    throw new Error("Invalid decoded tracking payload");
  }

  return decoded;
};

export const normalizeTrackingBatchPayload = ({
  req,
  payload,
  userId = null,
}) => {
  const decodedPayload = decodeCompressedTrackingPayload(payload || {});
  const maxBytes = Number(process.env.TRACKING_BATCH_MAX_BYTES || DEFAULT_TRACKING_BATCH_MAX_BYTES);
  const payloadBytes = Buffer.byteLength(JSON.stringify(decodedPayload || {}), "utf8");
  if (payloadBytes > maxBytes) {
    throw new Error("Tracking payload exceeded maximum size");
  }
  const parsedBatch = trackingBatchSchema.parse(decodedPayload);

  const sessionId =
    toSmallString(parsedBatch.sessionId || req.analyticsSessionId || req.cookies?.hog_sid || "") ||
    "";

  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const events = parsedBatch.events.map((event) =>
    buildTrackingEvent({
      req,
      event,
      sessionId,
      userId,
    }),
  );

  return {
    sessionId,
    consent: normalizeConsent(parsedBatch.consent || ""),
    events,
  };
};
