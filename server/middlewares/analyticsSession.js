import { v4 as uuidv4 } from "uuid";
import {
  DEFAULT_ANALYTICS_CONSENT_COOKIE,
  DEFAULT_ANALYTICS_SESSION_COOKIE,
} from "../services/analytics/constants.js";
import { emitTrackingEvent } from "../services/analytics/trackingEmitter.service.js";
import { isTrackingSuppressed } from "../services/analytics/trackingEvent.service.js";

const COOKIE_DOMAIN_REGEX =
  /^\.?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/i;

const normalizeCookieDomain = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const withoutProtocol = raw.replace(/^https?:\/\//i, "");
  const hostOnly = withoutProtocol.split("/")[0].trim();
  return hostOnly;
};

const buildCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  const configuredCookieDomain = normalizeCookieDomain(process.env.COOKIE_DOMAIN);
  const isLocalCookieDomain = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(
    configuredCookieDomain.replace(/^\./, ""),
  );

  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: "/",
  };

  if (
    isProduction &&
    configuredCookieDomain &&
    !isLocalCookieDomain &&
    COOKIE_DOMAIN_REGEX.test(configuredCookieDomain)
  ) {
    options.domain = configuredCookieDomain;
  }

  return options;
};

const normalizeSessionId = (value) => {
  const sessionId = String(value || "").trim();
  if (!sessionId) return "";
  return sessionId.slice(0, 128);
};

const resolveSessionId = (req) => {
  const candidates = [
    req.cookies?.[DEFAULT_ANALYTICS_SESSION_COOKIE],
    req.cookies?.sessionId,
    req.headers["x-session-id"],
    req.body?.sessionId,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSessionId(candidate);
    if (normalized) return normalized;
  }

  return "";
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

  return "";
};

const shouldEmitSessionStartEvent = (req) => {
  const path = String(req.originalUrl || req.path || "")
    .trim()
    .toLowerCase();

  if (!path) return true;
  // API traffic is noisy for behavior analytics. Frontend tracker emits
  // session_start with real page context, so suppress middleware auto-event here.
  if (path.startsWith("/api/")) {
    return false;
  }

  return true;
};

const analyticsSession = (req, res, next) => {
  const cookieName =
    String(process.env.ANALYTICS_SESSION_COOKIE || DEFAULT_ANALYTICS_SESSION_COOKIE).trim() ||
    DEFAULT_ANALYTICS_SESSION_COOKIE;

  let sessionId = resolveSessionId(req);
  const isNewSession = !sessionId;

  if (!sessionId) {
    sessionId = uuidv4();
  }

  req.analyticsSessionId = sessionId;
  res.locals.analyticsSessionId = sessionId;

  const cookieOptions = buildCookieOptions();
  if (req.cookies?.[cookieName] !== sessionId) {
    res.cookie(cookieName, sessionId, cookieOptions);
  }

  const consentHeader = normalizeConsent(req.headers["x-analytics-consent"]);
  if (consentHeader) {
    res.cookie(DEFAULT_ANALYTICS_CONSENT_COOKIE, consentHeader, {
      ...cookieOptions,
      httpOnly: false,
    });
  }

  if (
    isNewSession &&
    shouldEmitSessionStartEvent(req) &&
    !isTrackingSuppressed(req, consentHeader)
  ) {
    emitTrackingEvent({
      req,
      eventType: "session_start",
      sessionId,
      metadata: {
        source: "session_middleware",
      },
      async: true,
      userId: req.user || null,
    });
  }

  return next();
};

export default analyticsSession;
