const MONITORED_USER_AGENT_REGEX =
  /(?:\bbot\b|crawler|spider|curl|wget|python-requests|scrapy|httpclient|aiohttp|go-http-client|okhttp|java\/|node-fetch)/i;
const AGGRESSIVE_USER_AGENT_REGEX =
  /(?:sqlmap|nikto|acunetix|netsparker|nmap|masscan|zgrab|dirbuster|wfuzz|ffuf)/i;
const TRUSTED_BOT_REGEX =
  /(?:googlebot|bingbot|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot)/i;
const BOT_PROTECTION_EXEMPT_PREFIXES = [
  "/api/user",
  "/api/admin",
  "/api/orders",
  "/api/membership",
  "/api/webhooks",
  "/api/upload",
  "/api/support",
];
const BOT_PROTECTION_ALLOWED_PREFIXES = [
  "/api/about",
  "/api/banners",
  "/api/blogs",
  "/api/categories",
  "/api/combos",
  "/api/coupons",
  "/api/home-slides",
  "/api/policies",
  "/api/products",
  "/api/settings/public",
  "/api/settings/maintenance-status",
];

const toBoolean = (value, fallback = false) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizePath = (value) => {
  const normalized = String(value || "")
    .split("?")[0]
    .trim()
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "");
  return normalized || "/";
};

const isPublicGetApiRequest = (req) => {
  const method = String(req?.method || "")
    .trim()
    .toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;

  const requestPath = normalizePath(req?.originalUrl || req?.url || "");
  if (!requestPath.startsWith("/api/")) return false;

  if (
    !BOT_PROTECTION_ALLOWED_PREFIXES.some((prefix) =>
      requestPath.startsWith(prefix),
    )
  ) {
    return false;
  }

  return !BOT_PROTECTION_EXEMPT_PREFIXES.some((prefix) =>
    requestPath.startsWith(prefix),
  );
};

const recentBotLogs = new Map();
const shouldLogNow = (key, windowMs) => {
  const now = Date.now();
  const last = Number(recentBotLogs.get(key) || 0);
  if (now - last < windowMs) {
    return false;
  }
  recentBotLogs.set(key, now);
  return true;
};

export const botProtectionMonitor = (req, res, next) => {
  const enabled = toBoolean(process.env.PERF_BOT_PROTECTION_ENABLED, true);
  if (!enabled) return next();
  if (!isPublicGetApiRequest(req)) return next();

  const userAgent = String(req.headers?.["user-agent"] || "")
    .trim()
    .slice(0, 300);
  const hasTrustedBotSignature = TRUSTED_BOT_REGEX.test(userAgent);
  const isAggressive = AGGRESSIVE_USER_AGENT_REGEX.test(userAgent);
  const isSuspicious =
    !hasTrustedBotSignature &&
    (!userAgent || MONITORED_USER_AGENT_REGEX.test(userAgent) || isAggressive);

  if (!isSuspicious) return next();

  const logWindowMs = toPositiveInteger(
    process.env.PERF_BOT_PROTECTION_LOG_WINDOW_MS,
    60000,
  );
  const requestPath = normalizePath(req?.originalUrl || req?.url || "");
  const logKey = `${requestPath}:${userAgent || "<empty-ua>"}`;

  if (shouldLogNow(logKey, logWindowMs)) {
    console.warn("[bot-protection] Suspicious user-agent observed", {
      path: requestPath,
      method: req.method,
      userAgent: userAgent || "<empty>",
      ip: req.ip || req.socket?.remoteAddress || "unknown",
      aggressive: isAggressive,
      mode: toBoolean(process.env.PERF_BOT_PROTECTION_BLOCK_ENABLED, false)
        ? "block-enabled"
        : "monitor",
    });
  }

  const blockEnabled = toBoolean(
    process.env.PERF_BOT_PROTECTION_BLOCK_ENABLED,
    false,
  );
  const monitorOnly = toBoolean(
    process.env.PERF_BOT_PROTECTION_MONITOR_ONLY,
    true,
  );

  // Safety-first: default monitor mode logs only. Blocking can be enabled later.
  if (blockEnabled && !monitorOnly && isAggressive) {
    return res.status(403).json({
      error: true,
      success: false,
      message: "Request blocked",
    });
  }

  return next();
};

export default botProtectionMonitor;
