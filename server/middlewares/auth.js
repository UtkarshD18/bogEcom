import jwt from "jsonwebtoken";

const auth = async (req, res, next) => {
  let token = null;
  try {
    // Debug: log raw headers
    const authHeader = req.headers.authorization;
    const headerPreview = authHeader
      ? (typeof authHeader === "string"
          ? authHeader.substring(0, 50)
          : String(authHeader).substring(0, 50)) + "..."
      : "none";

    console.log("Auth Raw Headers:", {
      authHeader: headerPreview,
      authHeaderType: typeof authHeader,
      cookie: req.headers.cookie
        ? req.headers.cookie.substring(0, 50) + "..."
        : "none",
    });

    // Try Authorization header first (Bearer token)
    if (req.headers?.authorization) {
      let authHeaderValue = req.headers.authorization;

      // If authorization header is an object (shouldn't happen, but handle it)
      if (typeof authHeaderValue === "object") {
        console.warn("Authorization header is an object, converting to string");
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

    // Debug logging
    console.log("Auth Debug:", {
      hasCookie: !!req.cookies?.accessToken,
      hasHeader: !!req.headers?.authorization,
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenType: token ? typeof token : "null",
      tokenPreview: token ? token.substring(0, 30) : "none",
      method: req.method,
      url: req.url,
    });

    if (!token || typeof token !== "string" || token.length === 0) {
      return res.status(401).json({
        message: "Please provide token",
        error: true,
        success: false,
      });
    }

    // Verify token exists and is not empty
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
    console.error("Auth middleware error:", error.message);
    console.error("Error details:", {
      tokenType: token ? typeof token : "null",
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? token.substring(0, 30) : "none",
      errorName: error.name,
    });
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
