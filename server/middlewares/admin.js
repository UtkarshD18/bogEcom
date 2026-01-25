import UserModel from "../models/user.model.js";

/**
 * Admin Middleware
 *
 * Verifies that the authenticated user has Admin role.
 * Must be used after the auth middleware.
 */
const admin = async (req, res, next) => {
  try {
    const userId = req.user;

    if (!userId) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Authentication required",
      });
    }

    const user = await UserModel.findById(userId).select("role status");

    if (!user) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "User not found",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        error: true,
        success: false,
        message: "Account is not active",
      });
    }

    if (user.role !== "Admin") {
      return res.status(403).json({
        error: true,
        success: false,
        message: "Admin access required",
      });
    }

    next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Authorization failed",
    });
  }
};

export default admin;
