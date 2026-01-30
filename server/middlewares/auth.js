import jwt from "jsonwebtoken";

const auth = async (req, res, next) => {
  let token = null;
  const isProduction = process.env.NODE_ENV === "production";

  try {
    // Try Authorization header first (Bearer token)
    if (req.headers?.authorization) {
      let authHeaderValue = req.headers.authorization;

      // If authorization header is an object (shouldn't happen, but handle it)
      if (typeof authHeaderValue === "object") {
        authHeaderValue = String(authHeaderValue);
      }

      // Handle "Bearer <token>" format
      if (
        typeof authHeaderValue === "string" &&
        authHeaderValue.toLowerCase().startsWith("bearer ")
      ) {
        token = authHeaderValue.slice(7).trim(); // Remove "Bearer " prefix and trim whitespace
      }
    }

    // If no Bearer token, try cookies
    if (!token && req.cookies?.accessToken) {
      const cookieToken = req.cookies.accessToken;
      token = typeof cookieToken === "string" ? cookieToken : null;
    }

    // Ensure token is a non-empty string
    if (token && typeof token === "string") {
      token = token.trim();
    } else {
      token = null;
    }

    // Debug logging only in development
    if (!isProduction) {
      console.log("Auth Debug:", {
        hasToken: !!token,
        method: req.method,
        url: req.url,
      });
    }

    if (!token || typeof token !== "string" || token.length === 0) {
      return res.status(401).json({
        message: "Please provide token",
        error: true,
        success: false,
      });
    }

    // Verify secret key exists
    const secretKey = process.env.SECRET_KEY_ACCESS_TOKEN;
    if (!secretKey) {
      console.error("SECRET_KEY_ACCESS_TOKEN is not defined");
      return res.status(500).json({
        message: "Server configuration error",
        error: true,
        success: false,
      });
    }

    const decode = jwt.verify(token, secretKey);

    if (!decode || !decode.id) {
      return res.status(401).json({
        message: "Invalid token",
        error: true,
        success: false,
      });
    }
    req.user = decode.id;
    next();
  } catch (error) {
    // Log error details only in development
    if (!isProduction) {
      console.error("Auth middleware error:", error.message);
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired, please login again",
        error: true,
        success: false,
      });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid token",
        error: true,
        success: false,
      });
    }
    return res.status(500).json({
      message: "Authentication failed",
      error: true,
      success: false,
    });
  }
};
export default auth;
