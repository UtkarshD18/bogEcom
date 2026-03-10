import bcrypt from "bcryptjs";
import UserModel from "../models/user.model.js";
import generateAccessToken from "../utils/generateAccessToken.js";
import generateRefreshToken from "../utils/generateRefreshToken.js";
import { emitTrackingEvent } from "../services/analytics/trackingEmitter.service.js";

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

const buildCookieOptions = (maxAge) => {
  const isProduction = process.env.NODE_ENV === "production";
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    maxAge,
    path: "/",
  };

  if (isProduction && RESOLVED_COOKIE_DOMAIN) {
    options.domain = RESOLVED_COOKIE_DOMAIN;
  }

  return options;
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const ADMIN_PRIMARY_EMAIL = normalizeEmail(
  process.env.ADMIN_PRIMARY_EMAIL || "admin@buyonegram.com",
);

const isAllowedAdminEmail = (email) =>
  normalizeEmail(email) === ADMIN_PRIMARY_EMAIL;

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

    if (!isAllowedAdminEmail(normalizedEmail)) {
      return res.status(403).json({
        success: false,
        error: true,
        message: "Access denied. Admin privileges required.",
      });
    }

    const user = await UserModel.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(403).json({
        success: false,
        error: true,
        message: "Admin account not found",
      });
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

    if (user.role !== "Admin") {
      user.role = "Admin";
      await user.save();
    }

    const accessToken = await generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    await UserModel.findByIdAndUpdate(user?._id, {
      last_login_date: new Date(),
    });

    const accessCookieOptions = buildCookieOptions(ACCESS_TOKEN_MAX_AGE);
    const refreshCookieOptions = buildCookieOptions(REFRESH_TOKEN_MAX_AGE);

    res.cookie("accessToken", accessToken, accessCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    emitTrackingEvent({
      req,
      eventType: "login",
      userId: String(user?._id || ""),
      metadata: {
        method: "email_password",
        role: "Admin",
      },
      async: true,
    });

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

    if (!isAllowedAdminEmail(normalizedEmail)) {
      return res.status(403).json({
        success: false,
        error: true,
        message: "Access denied. Admin privileges required.",
      });
    }

    const sanitizedName = String(name || "")
      .trim()
      .replace(/<[^>]*>/g, "");
    const resolvedName = sanitizedName || normalizedEmail.split("@")[0] || "Admin";

    let user = await UserModel.findOne({ email: normalizedEmail });

    let isNewGoogleUser = false;
    if (!user) {
      user = new UserModel({
        email: normalizedEmail,
        name: resolvedName,
        verifyEmail: true,
        signUpWithGoogle: true,
        role: "Admin",
        avatar: avatar || "",
        mobile: mobile || "",
        googleId: googleId || null,
        provider: "google",
      });
      await user.save();
      isNewGoogleUser = true;
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
      if (user.role !== "Admin") {
        user.role = "Admin";
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

    const accessCookieOptions = buildCookieOptions(ACCESS_TOKEN_MAX_AGE);
    const refreshCookieOptions = buildCookieOptions(REFRESH_TOKEN_MAX_AGE);

    res.cookie("accessToken", accessToken, accessCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    emitTrackingEvent({
      req,
      eventType: isNewGoogleUser ? "signup" : "login",
      userId: String(user?._id || ""),
      metadata: {
        method: "google_oauth",
        role: "Admin",
        isNewUser: isNewGoogleUser,
      },
      async: true,
    });

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
