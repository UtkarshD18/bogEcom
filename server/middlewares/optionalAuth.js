import jwt from "jsonwebtoken";

/**
 * Optional Auth Middleware
 *
 * Extracts user ID from token if present, but doesn't require authentication.
 * Useful for endpoints that work for both guests and authenticated users.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken || req.headers?.authorization?.split(" ")[1];

    if (token) {
      const decode = await jwt.verify(
        token,
        process.env.SECRET_KEY_ACCESS_TOKEN,
      );
      if (decode) {
        req.user = decode.id;
      }
    }

    next();
  } catch (error) {
    // Token invalid or expired - continue as guest
    next();
  }
};

export default optionalAuth;
