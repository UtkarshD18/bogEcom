import jwt from "jsonwebtoken";

const influencerAuth = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers?.authorization) {
      const authHeader = req.headers.authorization;
      if (
        typeof authHeader === "string" &&
        authHeader.toLowerCase().startsWith("bearer ")
      ) {
        token = authHeader.slice(7).trim();
      }
    }

    if (!token || typeof token !== "string") {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Authentication token required",
      });
    }

    const secret =
      process.env.INFLUENCER_JWT_SECRET ||
      process.env.JSON_WEB_TOKEN_SECRET_KEY ||
      "";

    if (!secret) {
      return res.status(500).json({
        error: true,
        success: false,
        message: "Server configuration error",
      });
    }

    const decoded = jwt.verify(token, secret);

    if (!decoded?.id) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Invalid token",
      });
    }

    req.influencerId = decoded.id;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Token expired, please login again",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Invalid token",
      });
    }

    return res.status(500).json({
      error: true,
      success: false,
      message: "Authentication failed",
    });
  }
};

export default influencerAuth;
