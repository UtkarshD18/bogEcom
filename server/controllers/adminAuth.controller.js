import bcrypt from "bcryptjs";
import UserModel from "../models/user.model.js";
import { normalizeManagerPermissions } from "../utils/adminPermissions.js";
import generateAccessToken from "../utils/generateAccessToken.js";
import generateRefreshToken from "../utils/generateRefreshToken.js";
import isPrivilegedAdminRole from "../utils/isPrivilegedAdminRole.js";

const AUTH_PERSIST_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 365 days
const ACCESS_TOKEN_MAX_AGE = AUTH_PERSIST_MAX_AGE;
const REFRESH_TOKEN_MAX_AGE = AUTH_PERSIST_MAX_AGE;
const COOKIE_DOMAIN = String(process.env.COOKIE_DOMAIN || "").trim();
const COOKIE_DOMAIN_REGEX =
  /^\.?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/i;

const normalizeCookieDomain = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const withoutProtocol = raw.replace(/^https?:\/\//i, "");
  const hostOnly = withoutProtocol.split("/")[0].trim();
  return hostOnly;
};

const parsedCookieDomain = normalizeCookieDomain(COOKIE_DOMAIN);
const isLocalCookieDomain = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(
  parsedCookieDomain.replace(/^\./, ""),
);
const RESOLVED_COOKIE_DOMAIN =
  COOKIE_DOMAIN_REGEX.test(parsedCookieDomain) && !isLocalCookieDomain
    ? parsedCookieDomain
    : "";

const parseRememberMe = (value) => {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "yes", "on"].includes(normalized);
  }
  return Boolean(value);
};

const resolveCookieMaxAge = (rememberMe) =>
  rememberMe ? AUTH_PERSIST_MAX_AGE : undefined;

const buildCookieOptions = (maxAge) => {
  const isProduction = process.env.NODE_ENV === "production";
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
  };

  if (maxAge !== undefined) {
    options.maxAge = maxAge;
  }

  if (isProduction && RESOLVED_COOKIE_DOMAIN) {
    options.domain = RESOLVED_COOKIE_DOMAIN;
  }

  return options;
};

const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const ADMIN_PRIMARY_EMAIL = normalizeEmail(
  process.env.ADMIN_PRIMARY_EMAIL || "admin@buyonegram.com",
);
const MANAGER_PRIMARY_EMAIL = normalizeEmail(
  process.env.MANAGER_PRIMARY_EMAIL || "manager@buyonegram.com",
);
const ADMIN_PRIMARY_PASSWORD = String(
  process.env.ADMIN_PRIMARY_PASSWORD || "",
).trim();
const MANAGER_PRIMARY_PASSWORD = String(
  process.env.MANAGER_PRIMARY_PASSWORD || "",
).trim();

const ADMIN_ALLOWED_EMAILS = new Set(
  String(process.env.ADMIN_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean),
);

if (ADMIN_PRIMARY_EMAIL) {
  ADMIN_ALLOWED_EMAILS.add(ADMIN_PRIMARY_EMAIL);
}
if (MANAGER_PRIMARY_EMAIL) {
  ADMIN_ALLOWED_EMAILS.add(MANAGER_PRIMARY_EMAIL);
}

const isAllowedAdminEmail = (email) =>
  ADMIN_ALLOWED_EMAILS.has(normalizeEmail(email));

const resolvePrivilegedRoleForEmail = (email) =>
  normalizeEmail(email) === ADMIN_PRIMARY_EMAIL ? "Admin" : "Manager";

const resolveBootstrapPasswordForEmail = (email) =>
  normalizeEmail(email) === ADMIN_PRIMARY_EMAIL
    ? ADMIN_PRIMARY_PASSWORD
    : MANAGER_PRIMARY_PASSWORD;

const resolveIsActiveMember = (user) => {
  if (!user) return false;
  const hasMemberFlag = Boolean(user.isMember) || Boolean(user.is_member);
  if (!hasMemberFlag) return false;
  if (!user.membershipExpiry) return true;
  const expiry = new Date(user.membershipExpiry);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry > new Date();
};

export const adminLoginController = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Email and password are required",
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Please provide a valid email address",
      });
    }

    let user = await UserModel.findOne({ email: normalizedEmail });
    if (!user) {
      if (!isAllowedAdminEmail(normalizedEmail)) {
        return res.status(403).json({
          success: false,
          error: true,
          message: "Access denied. Admin or Manager privileges required.",
        });
      }

      const bootstrapPassword = resolveBootstrapPasswordForEmail(normalizedEmail);
      if (!bootstrapPassword) {
        return res.status(403).json({
          success: false,
          error: true,
          message:
            "Privileged account not found. Set the bootstrap password and run the privileged-user seeder.",
        });
      }

      if (password !== bootstrapPassword) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Check your password",
        });
      }

      const hashedPassword = await bcrypt.hash(bootstrapPassword, 10);
      user = new UserModel({
        name: normalizedEmail === ADMIN_PRIMARY_EMAIL ? "Admin" : "Manager",
        email: normalizedEmail,
        password: hashedPassword,
        role: resolvePrivilegedRoleForEmail(normalizedEmail),
        verifyEmail: true,
        status: "active",
        managerPermissions:
          normalizeEmail(normalizedEmail) === ADMIN_PRIMARY_EMAIL
            ? []
            : normalizeManagerPermissions([]),
      });
      await user.save();
    }

    if (user.status !== "active") {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Please contact support.",
      });
    }

    if (user?.verifyEmail !== true) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Please verify your email before logging in.",
      });
    }

    const storedPasswordHash =
      typeof user?.password === "string" ? user.password.trim() : "";

    if (!storedPasswordHash) {
      const isGoogleOnlyAccount =
        Boolean(user?.signUpWithGoogle) || user?.provider === "google";
      return res.status(400).json({
        success: false,
        error: true,
        message: isGoogleOnlyAccount
          ? "This account uses Google sign-in. Use Google login or set a backup password."
          : "Password login is not available for this account. Please reset your password.",
      });
    }

    let checkPassword = false;
    try {
      checkPassword = await bcrypt.compare(password, storedPasswordHash);
    } catch (compareError) {
      console.error("Admin password verification failed:", {
        email: normalizedEmail,
        error: compareError?.message || compareError,
      });
      return res.status(400).json({
        success: false,
        error: true,
        message: "Unable to verify password. Please reset your password.",
      });
    }

    if (!checkPassword) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Check your password",
      });
    }

    const allowedByEmail = isAllowedAdminEmail(normalizedEmail);
    const hasPrivilegedRole = isPrivilegedAdminRole(user.role);

    if (!hasPrivilegedRole && !allowedByEmail) {
      return res.status(403).json({
        success: false,
        error: true,
        message: "Access denied. Admin or Manager privileges required.",
      });
    }

    const expectedRole = resolvePrivilegedRoleForEmail(normalizedEmail);
    if (
      allowedByEmail &&
      (!hasPrivilegedRole ||
        (expectedRole === "Admin" && user.role !== "Admin"))
    ) {
      user.role = expectedRole;
      await user.save();
    }

    const accessToken = await generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    await UserModel.findByIdAndUpdate(user?._id, {
      last_login_date: new Date(),
    });

    const rememberMe = parseRememberMe(req.body?.rememberMe);
    const accessCookieOptions = buildCookieOptions(
      resolveCookieMaxAge(rememberMe),
    );
    const refreshCookieOptions = buildCookieOptions(
      resolveCookieMaxAge(rememberMe),
    );

    res.cookie("accessToken", accessToken, accessCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    const managerPermissions =
      user?.role === "Manager"
        ? normalizeManagerPermissions(user?.managerPermissions)
        : [];

    return res.json({
      message: "Login successful",
      success: true,
      error: false,
      data: {
        accessToken,
        refreshToken,
        userEmail: user?.email,
        userName: user?.name,
        role: user?.role,
        userId: user?._id,
        avatar: user?.avatar,
        isMember: resolveIsActiveMember(user),
        managerPermissions,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
};

export const adminGoogleLoginController = async (req, res) => {
  try {
    const { name, avatar, mobile, googleId } = req.body;
    const normalizedEmail = normalizeEmail(req.body?.email);

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Valid email is required",
      });
    }

    const sanitizedName = String(name || "")
      .trim()
      .replace(/<[^>]*>/g, "");
    const resolvedName =
      sanitizedName || normalizedEmail.split("@")[0] || "Admin";

    let user = await UserModel.findOne({ email: normalizedEmail });
    const allowedByEmail = isAllowedAdminEmail(normalizedEmail);
    const hasPrivilegedRole = isPrivilegedAdminRole(user?.role);

    if (!allowedByEmail && !hasPrivilegedRole) {
      return res.status(403).json({
        success: false,
        error: true,
        message: "Access denied. Admin or Manager privileges required.",
      });
    }

    const expectedRole = resolvePrivilegedRoleForEmail(normalizedEmail);

    if (!user) {
      user = new UserModel({
        email: normalizedEmail,
        name: resolvedName,
        verifyEmail: true,
        signUpWithGoogle: true,
        role: expectedRole,
        avatar: avatar || "",
        mobile: mobile || "",
        googleId: googleId || null,
        provider: "google",
      });
      await user.save();
    } else {
      if (avatar && !user.avatar) {
        user.avatar = avatar;
      }
      if (googleId && !user.googleId) {
        user.googleId = googleId;
      }
      if (user.provider === "local") {
        user.provider = "google";
        user.signUpWithGoogle = true;
      }
      if (
        allowedByEmail &&
        (!isPrivilegedAdminRole(user.role) ||
          (expectedRole === "Admin" && user.role !== "Admin"))
      ) {
        user.role = expectedRole;
      }
      if (user.name !== resolvedName && !user.name) {
        user.name = resolvedName;
      }
      await user.save();
    }

    const accessToken = await generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);
    await UserModel.findByIdAndUpdate(user._id, {
      last_login_date: new Date(),
    });

    const rememberMe = parseRememberMe(req.body?.rememberMe);
    const accessCookieOptions = buildCookieOptions(
      resolveCookieMaxAge(rememberMe),
    );
    const refreshCookieOptions = buildCookieOptions(
      resolveCookieMaxAge(rememberMe),
    );

    res.cookie("accessToken", accessToken, accessCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    const managerPermissions =
      user?.role === "Manager"
        ? normalizeManagerPermissions(user?.managerPermissions)
        : [];

    return res.json({
      message: "Google login successful",
      success: true,
      error: false,
      data: {
        accessToken,
        refreshToken,
        userEmail: user?.email,
        userName: user?.name,
        role: user?.role,
        userId: user?._id,
        avatar: user?.avatar,
        isMember: resolveIsActiveMember(user),
        managerPermissions,
      },
    });
  } catch (error) {
    console.error("Admin Google auth error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
};
