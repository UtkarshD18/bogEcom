import jwt from "jsonwebtoken";

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
    if (req.headers?.authorization) {
      const authHeader = req.headers.authorization;
      if (
        typeof authHeader === "string" &&
        authHeader.toLowerCase().startsWith("bearer ")
      ) {
        token = authHeader.slice(7).trim();
      }
    }

    // If no Bearer token, try cookies
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token && typeof token === "string" && token.length > 0) {
      const decode = jwt.verify(token, process.env.SECRET_KEY_ACCESS_TOKEN);
      if (decode && decode.id) {
        req.user = decode.id;
        if (!isProduction) {
          console.log("✓ optionalAuth: User authenticated");
        }
      }
    }

    next();
  } catch (error) {
    // Token invalid or expired - continue as guest (silent failure)
    if (!isProduction) {
      console.log("! optionalAuth: Continuing as guest");
    }
    next();
  }
};

export default optionalAuth;
