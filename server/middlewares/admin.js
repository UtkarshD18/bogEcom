import UserModel from "../models/user.model.js";
import { hasManagerPermission } from "../utils/adminPermissions.js";
import isPrivilegedAdminRole from "../utils/isPrivilegedAdminRole.js";

const MANAGER_ROUTE_PERMISSION_RULES = [
  {
    permission: "manage_users",
    patterns: [/^\/api\/user\/admin\/users(?:\/|$)/i],
  },
  {
    permission: "view_analytics",
    patterns: [
      /^\/api\/admin\/analytics(?:\/|$)/i,
      /^\/api\/statistics(?:\/|$)/i,
      /^\/api\/orders\/admin\/(?:stats|dashboard-stats)(?:\/|$)/i,
      /^\/api\/admin\/orders\/(?:report|export)(?:\/|$)/i,
      /^\/api\/location-logs\/admin(?:\/|$)/i,
    ],
  },
  {
    permission: "manage_crm",
    patterns: [
      /^\/api\/admin\/crm(?:\/|$)/i,
      /^\/api\/crm\/admin(?:\/|$)/i,
      /^\/api\/support\/admin(?:\/|$)/i,
      /^\/api\/notifications\/admin(?:\/|$)/i,
      /^\/api\/newsletter\/(?:subscribers|campaign\/send)(?:\/|$)/i,
      /^\/api\/email\/admin(?:\/|$)/i,
      /^\/api\/admin\/email-templates(?:\/|$)/i,
      /^\/api\/admin\/reviews(?:\/|$)/i,
    ],
  },
  {
    permission: "manage_shipping",
    patterns: [
      /^\/api\/shipping(?:\/|$)/i,
      /^\/api\/orders\/admin\/(?:all|repair-paid|backfill-payment-ids|pending|demo-orders)(?:\/|$)/i,
      /^\/api\/purchase-orders\/admin(?:\/|$)/i,
    ],
  },
  {
    permission: "manage_orders",
    patterns: [/^\/api\/orders\/[^/]+\/status(?:\/|$)/i],
  },
  {
    permission: "manage_membership",
    patterns: [
      /^\/api\/admin\/membership(?:\/|$)/i,
      /^\/api\/membership\/admin(?:\/|$)/i,
      /^\/api\/membership\/page\/admin(?:\/|$)/i,
      /^\/api\/home-membership-content\/admin(?:\/|$)/i,
      /^\/api\/coins\/admin\/settings(?:\/|$)/i,
    ],
  },
];

const normalizeRequestPath = (value) => {
  const normalized = String(value || "")
    .split("?")[0]
    .trim()
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "");

  return normalized || "/";
};

const resolveRequiredManagerPermission = (req) => {
  const requestPath = normalizeRequestPath(
    req?.originalUrl || `${req?.baseUrl || ""}${req?.path || ""}`,
  );

  for (const rule of MANAGER_ROUTE_PERMISSION_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(requestPath))) {
      return rule.permission;
    }
  }

  // Treat all remaining privileged routes as platform-level access.
  return "manage_settings";
};

/**
 * Admin Middleware
 *
 * Verifies that the authenticated user has Admin role.
 * Must be used after the auth middleware.
 */
const admin = async (req, res, next) => {
  try {
    const userId = req.userId || req.user;

    if (!userId) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Authentication required",
      });
    }

    const user = await UserModel.findById(userId).select(
      "_id role status name email managerPermissions",
    );

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

    if (!isPrivilegedAdminRole(user.role)) {
      return res.status(403).json({
        error: true,
        success: false,
        message: "Admin access required",
      });
    }

    // Attach full user object for controllers that need it
    req.user = user;
    req.userId = user._id;

    if (String(user.role || "").trim() === "Manager") {
      const requiredPermission = resolveRequiredManagerPermission(req);
      if (!hasManagerPermission(user, requiredPermission)) {
        return res.status(403).json({
          error: true,
          success: false,
          message: "You do not have permission to access this module",
        });
      }

      req.requiredAdminPermission = requiredPermission;
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

// Backward-compatible named export for older route files
export const isAdmin = admin;
export default admin;
