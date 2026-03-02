import { v4 as uuidv4 } from "uuid";
import {
  DEFAULT_ANALYTICS_CONSENT_COOKIE,
} from "../services/analytics/constants.js";
import {
  publishTrackingBatchAsync,
} from "../services/analytics/eventPublisher.service.js";
import {
  isTrackingSuppressed,
  normalizeTrackingBatchPayload,
} from "../services/analytics/trackingEvent.service.js";

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

const resolveRequestId = (req) =>
  String(req.headers["x-request-id"] || req.headers["x-correlation-id"] || uuidv4())
    .trim()
    .slice(0, 128);

export const trackUserActivity = async (req, res) => {
  const consent = normalizeConsent(
    req.body?.consent ||
      req.headers["x-analytics-consent"] ||
      req.cookies?.[DEFAULT_ANALYTICS_CONSENT_COOKIE],
  );

  if (isTrackingSuppressed(req, consent)) {
    return res.status(202).json({
      success: true,
      error: false,
      message: "Tracking skipped by user preference",
      data: {
        accepted: 0,
        dropped: 0,
      },
    });
  }

  let normalizedBatch;
  try {
    normalizedBatch = normalizeTrackingBatchPayload({
      req,
      payload: req.body,
      userId: req.user || null,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: true,
      message: `Invalid tracking payload: ${error?.message || "validation failed"}`,
    });
  }

  const requestId = resolveRequestId(req);

  publishTrackingBatchAsync({
    sessionId: normalizedBatch.sessionId,
    events: normalizedBatch.events,
    consent,
    source: "tracking_api",
    requestId,
  });

  return res.status(202).json({
    success: true,
    error: false,
    message: "Tracking batch accepted",
    data: {
      requestId,
      sessionId: normalizedBatch.sessionId,
      accepted: normalizedBatch.events.length,
      dropped: 0,
    },
  });
};

export const updateTrackingConsent = async (req, res) => {
  const consent = normalizeConsent(req.body?.consent || req.query?.consent || "");

  if (consent === "unknown") {
    return res.status(400).json({
      success: false,
      error: true,
      message: "Consent must be either 'granted' or 'denied'",
    });
  }

  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(DEFAULT_ANALYTICS_CONSENT_COOKIE, consent, {
    httpOnly: false,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  return res.status(200).json({
    success: true,
    error: false,
    message: "Tracking consent updated",
    data: { consent },
  });
};

export const getTrackingSession = async (req, res) => {
  return res.status(200).json({
    success: true,
    error: false,
    data: {
      sessionId: req.analyticsSessionId || null,
      trackingSuppressed: isTrackingSuppressed(req),
      consent: normalizeConsent(req.cookies?.[DEFAULT_ANALYTICS_CONSENT_COOKIE] || ""),
    },
  });
};
