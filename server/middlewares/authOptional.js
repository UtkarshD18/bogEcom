import jwt from "jsonwebtoken";
import { getAccessTokenSecret, getRefreshTokenSecret } from "../config/authSecrets.js";

/**
 * Optional auth middleware.
 *
 * - If a valid token is present, sets `req.user` to the user id and continues.
 * - If no/invalid token is present, continues without setting `req.user`.
 *
 * Intended for endpoints that can work for both guests and logged-in users
 * (e.g., registering push notification tokens).
 */
const authOptional = async (req, res, next) => {
  let accessToken = null;

  try {
    // Try Authorization header first (Bearer token)
    if (req.headers?.authorization) {
      let authHeaderValue = req.headers.authorization;

      // If authorization header is an object (shouldn't happen, but handle it)
      if (typeof authHeaderValue === "object") {
        authHeaderValue = String(authHeaderValue);
      }

      if (
        typeof authHeaderValue === "string" &&
        authHeaderValue.toLowerCase().startsWith("bearer ")
      ) {
        accessToken = authHeaderValue.slice(7).trim();
      }
    }

    // If no Bearer token, try cookies
    if (!accessToken && req.cookies?.accessToken) {
      const cookieToken = req.cookies.accessToken;
      accessToken = typeof cookieToken === "string" ? cookieToken : null;
    }

    if (accessToken && typeof accessToken === "string") {
      const accessSecretKey = getAccessTokenSecret();
      if (accessSecretKey) {
        try {
          const accessPayload = jwt.verify(accessToken.trim(), accessSecretKey);
          if (accessPayload?.id) {
            req.user = accessPayload.id;
            return next();
          }
        } catch (error) {
          // Fall through to refresh-token resolution for expired access tokens.
        }
      }
    }

    const refreshCookieToken =
      typeof req.cookies?.refreshToken === "string"
        ? req.cookies.refreshToken.trim()
        : "";

    if (!refreshCookieToken) {
      return next();
    }

    const refreshSecretKey = getRefreshTokenSecret();
    if (!refreshSecretKey) {
      return next();
    }

    const refreshPayload = jwt.verify(refreshCookieToken, refreshSecretKey);
    if (refreshPayload?.id) {
      req.user = refreshPayload.id;
    }
  } catch (error) {
    // Best-effort only: fall back to guest behavior.
  }

  return next();
};

export default authOptional;

