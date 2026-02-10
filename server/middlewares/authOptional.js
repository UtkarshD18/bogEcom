import jwt from "jsonwebtoken";

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
  let token = null;

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
        token = authHeaderValue.slice(7).trim();
      }
    }

    // If no Bearer token, try cookies
    if (!token && req.cookies?.accessToken) {
      const cookieToken = req.cookies.accessToken;
      token = typeof cookieToken === "string" ? cookieToken : null;
    }

    if (!token || typeof token !== "string") {
      return next();
    }

    const secretKey = process.env.SECRET_KEY_ACCESS_TOKEN;
    if (!secretKey) {
      return next();
    }

    const decode = jwt.verify(token.trim(), secretKey);
    if (decode?.id) {
      req.user = decode.id;
    }
  } catch (error) {
    // Best-effort only: fall back to guest behavior.
  }

  return next();
};

export default authOptional;

