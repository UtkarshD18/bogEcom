const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const normalizeOrigin = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const parseOriginFromReferer = (referer) => {
  const normalized = String(referer || "").trim();
  if (!normalized) return "";

  try {
    return new URL(normalized).origin;
  } catch {
    return "";
  }
};

const isLocalOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizeOrigin(origin));

export const createCookieCsrfGuard = ({
  allowedOrigins = [],
  isProduction = false,
} = {}) => {
  const allowed = new Set(
    (Array.isArray(allowedOrigins) ? allowedOrigins : [])
      .map(normalizeOrigin)
      .filter(Boolean),
  );

  return (req, res, next) => {
    const method = String(req.method || "").toUpperCase();
    if (!STATE_CHANGING_METHODS.has(method)) {
      return next();
    }

    // CSRF primarily targets cookie-authenticated requests.
    const hasAuthCookie = Boolean(
      req.cookies?.accessToken || req.cookies?.refreshToken,
    );
    if (!hasAuthCookie) {
      return next();
    }

    // Bearer-token requests are treated as explicit API clients.
    const authHeader = String(req.headers?.authorization || "").trim();
    if (authHeader) {
      return next();
    }

    const origin = normalizeOrigin(req.headers?.origin || "");
    const refererOrigin = normalizeOrigin(
      parseOriginFromReferer(req.headers?.referer || ""),
    );
    const requestOrigin = origin || refererOrigin;

    if (!requestOrigin) {
      return res.status(403).json({
        error: true,
        success: false,
        message: "CSRF protection blocked the request",
      });
    }

    if (allowed.has(requestOrigin)) {
      return next();
    }

    if (!isProduction && isLocalOrigin(requestOrigin)) {
      return next();
    }

    return res.status(403).json({
      error: true,
      success: false,
      message: "CSRF protection blocked the request",
    });
  };
};

export default createCookieCsrfGuard;

