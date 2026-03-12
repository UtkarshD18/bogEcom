import jwt from "jsonwebtoken";
import { getAccessTokenSecret } from "../config/authSecrets.js";

/**
 * Optional Auth Middleware
 *
 * Extracts user ID from token if present, but doesn't require authentication.
 * Useful for endpoints that work for both guests and authenticated users.
 */
const optionalAuth = async (req, res, next) => {
  const isProduction = process.env.NODE_ENV === "production";

  try {
    let token = null;

    // Try Authorization header first (Bearer token)
    const hasExplicitAuth = Boolean(req.headers?.authorization);
    if (hasExplicitAuth) {
      const authHeader = req.headers.authorization;
      if (
        typeof authHeader === "string" &&
        authHeader.toLowerCase().startsWith("bearer ")
      ) {
        token = authHeader.slice(7).trim();
      }
    }

    // Only fall back to cookies for GET/HEAD requests.
    // For POST/PUT/PATCH (e.g. checkout), the client must explicitly send an
    // Authorization header; otherwise stale cookies from a previous login can
    // silently attribute a guest order to the wrong user.
    const safeForCookieFallback =
      !hasExplicitAuth &&
      ["GET", "HEAD"].includes(String(req.method).toUpperCase());
    if (!token && safeForCookieFallback && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token && typeof token === "string" && token.length > 0) {
      const secret = getAccessTokenSecret();
      if (!secret) {
        return next();
      }

      const decode = jwt.verify(token, secret);
      if (decode && decode.id) {
        req.user = decode.id;
        if (!isProduction) {
          console.log("optionalAuth: User authenticated");
        }
      }
    }

    next();
  } catch (error) {
    // Token invalid or expired - continue as guest (silent failure)
    if (!isProduction) {
      console.log("optionalAuth: Continuing as guest");
    }
    next();
  }
};

export default optionalAuth;
