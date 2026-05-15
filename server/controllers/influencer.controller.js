import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import sendEmailFun from "../config/sendEmail.js";
import InfluencerModel from "../models/influencer.model.js";
import OrderModel from "../models/order.model.js";
import { getInfluencerRefreshTokenSecret } from "../config/authSecrets.js";
import generateInfluencerToken from "../utils/generateInfluencerToken.js";
import generateInfluencerRefreshToken from "../utils/generateInfluencerRefreshToken.js";
import { matchesStoredToken, hashTokenValue, normalizeTokenString } from "../utils/tokenHash.js";
import { withOrderPresentation } from "../utils/orderPresentation.js";
import VerificationEmail from "../utils/verifyEmailTemplate.js";

/**
 * Influencer Controller
 *
 * Handles influencer CRUD operations (admin only)
 * Referral validation (public)
 * Commission tracking and statistics
 */

const normalizePromotionPlatforms = (platforms) => {
  if (!Array.isArray(platforms)) return [];

  const dedupe = new Set();
  return platforms
    .map((entry) => {
      const platform = String(entry?.platform || "").trim();
      let username = String(entry?.username || "").trim();
      if (username.startsWith("@")) {
        username = username.slice(1).trim();
      }
      return { platform, username };
    })
    .filter((entry) => entry.platform && entry.username)
    .filter((entry) => {
      const key = `${entry.platform.toLowerCase()}::${entry.username.toLowerCase()}`;
      if (dedupe.has(key)) return false;
      dedupe.add(key);
      return true;
    });
};

const PASSWORD_RESET_OTP_EXPIRY_MS = 15 * 60 * 1000;
const PORTAL_PASSWORD_MIN_LENGTH = 8;

const normalizeInfluencerCode = (code) =>
  String(code || "").toUpperCase().trim();

const normalizeEmail = (email) =>
  String(email || "").toLowerCase().trim();

const normalizePhone = (phone) => String(phone || "").trim();

const isExpiredInfluencer = (influencer) =>
  Boolean(influencer?.expiresAt && new Date() > influencer.expiresAt);

const validatePortalPassword = (password) => {
  const normalizedPassword = String(password || "");
  const hasUpperCase = /[A-Z]/.test(normalizedPassword);
  const hasLowerCase = /[a-z]/.test(normalizedPassword);
  const hasNumber = /\d/.test(normalizedPassword);

  if (normalizedPassword.length < PORTAL_PASSWORD_MIN_LENGTH) {
    return {
      isValid: false,
      message: `Password must be at least ${PORTAL_PASSWORD_MIN_LENGTH} characters`,
    };
  }

  if (!hasUpperCase || !hasLowerCase) {
    return {
      isValid: false,
      message: "Password must contain both uppercase and lowercase letters",
    };
  }

  if (!hasNumber) {
    return {
      isValid: false,
      message: "Password must contain at least one number",
    };
  }

  return { isValid: true, message: "" };
};

const sanitizeInfluencerForAdmin = (influencer) => {
  const source =
    typeof influencer?.toObject === "function"
      ? influencer.toObject({ virtuals: true })
      : { ...(influencer || {}) };

  const portalAccessConfigured = Boolean(
    source.portalPasswordHash || influencer?.portalPasswordHash,
  );

  delete source.refreshToken;
  delete source.portalPasswordHash;
  delete source.passwordResetOtpHash;
  delete source.passwordResetOtpExpiresAt;

  return {
    ...source,
    portalAccessConfigured,
  };
};

const getActiveInfluencerByCode = async (code, selectSecrets = "") => {
  const normalizedCode = normalizeInfluencerCode(code);
  if (!normalizedCode) return null;

  const query = InfluencerModel.findOne({
    code: normalizedCode,
    isActive: true,
  });

  if (selectSecrets) {
    query.select(selectSecrets);
  }

  const influencer = await query;
  if (!influencer || isExpiredInfluencer(influencer)) {
    return null;
  }

  return influencer;
};

const getActiveInfluencerByCodeAndEmail = async ({
  code,
  email,
  selectSecrets = "",
}) => {
  const normalizedCode = normalizeInfluencerCode(code);
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedCode || !normalizedEmail) {
    return null;
  }

  const query = InfluencerModel.findOne({
    code: normalizedCode,
    email: normalizedEmail,
    isActive: true,
  });

  if (selectSecrets) {
    query.select(selectSecrets);
  }

  const influencer = await query;
  if (!influencer || isExpiredInfluencer(influencer)) {
    return null;
  }

  return influencer;
};

let influencerOtpEmailSender = async ({ email, name, otp }) =>
  sendEmailFun({
    sendTo: email,
    subject: "HealthyOneGram collaborator portal OTP",
    html: VerificationEmail(name || "Collaborator", otp),
    context: "influencer-auth",
  });

let influencerOtpGenerator = () =>
  String(randomInt(0, 1_000_000)).padStart(6, "0");

export const __setInfluencerOtpEmailSenderForTests = (sender) => {
  influencerOtpEmailSender = sender;
};

export const __setInfluencerOtpGeneratorForTests = (generator) => {
  influencerOtpGenerator = generator;
};

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Validate influencer code
 * @route GET /api/influencers/validate
 * @query code - Influencer referral code
 * @returns Influencer discount info (safe for client)
 */
export const validateInfluencerCode = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Referral code is required",
        valid: false,
      });
    }

    const influencer = await InfluencerModel.findActiveByCode(code);

    if (!influencer) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Invalid or expired referral code",
        valid: false,
      });
    }

    // Return only safe info for client (no commission details)
    res.status(200).json({
      error: false,
      success: true,
      valid: true,
      data: {
        code: influencer.code,
        discountType: influencer.discountType,
        discountValue: influencer.discountValue,
        maxDiscountAmount: influencer.maxDiscountAmount,
        minOrderAmount: influencer.minOrderAmount,
      },
    });
  } catch (error) {
    console.error("Error validating influencer code:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to validate referral code",
      valid: false,
    });
  }
};

const buildInfluencerPortalPayload = async (influencer) => {
  // Recent orders for this influencer
  const recentOrders = await OrderModel.find({
    influencerId: influencer._id,
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .select(
      "_id createdAt finalAmount totalAmt order_status payment_status influencerCommission commissionPaid",
    )
    .lean();
  const presentedRecentOrders = recentOrders.map(withOrderPresentation);

  // Monthly summary (last 12 entries)
  const monthlyStats = await OrderModel.aggregate([
    { $match: { influencerId: influencer._id } },
    {
      $addFields: {
        effectiveAmount: {
          $cond: [{ $gt: ["$finalAmount", 0] }, "$finalAmount", "$totalAmt"],
        },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        orders: { $sum: 1 },
        revenue: { $sum: "$effectiveAmount" },
        commission: { $sum: "$influencerCommission" },
      },
    },
    { $sort: { "_id.year": -1, "_id.month": -1 } },
    { $limit: 12 },
  ]);

  return {
    influencer: {
      _id: influencer._id,
      name: influencer.name,
      email: influencer.email,
      code: influencer.code,
      referralUrl: influencer.referralUrl,
      portalLoginUrl: influencer.portalLoginUrl,
      isActive: influencer.isActive,
      promotionPlatforms: influencer.promotionPlatforms || [],
    },
    stats: {
      totalOrders: influencer.totalOrders || 0,
      totalRevenue: influencer.totalRevenue || 0,
      totalCommission: influencer.totalCommissionEarned || 0,
      paidCommission: influencer.totalCommissionPaid || 0,
      pendingCommission:
        (influencer.totalCommissionEarned || 0) -
        (influencer.totalCommissionPaid || 0),
    },
    recentOrders: presentedRecentOrders,
    monthlyStats,
  };
};

/**
 * Influencer login (issue collaborator token)
 * @route POST /api/influencers/login
 * @access Public
 */
export const loginInfluencer = async (req, res) => {
  try {
    const { code, password } = req.body || {};

    if (!code || !password) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Referral code and password are required",
      });
    }

    const influencer = await getActiveInfluencerByCode(
      code,
      "+portalPasswordHash",
    );

    if (!influencer) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Invalid referral code or password",
      });
    }

    if (!influencer.portalPasswordHash) {
      return res.status(403).json({
        error: true,
        success: false,
        message:
          "Portal password is not set yet. Use the password reset flow or contact admin.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      String(password),
      influencer.portalPasswordHash,
    );

    if (!passwordMatches) {
      return res.status(403).json({
        error: true,
        success: false,
        message: "Invalid referral code or password",
      });
    }

    const accessToken = generateInfluencerToken(influencer._id);
    const refreshToken = await generateInfluencerRefreshToken(influencer._id);

    return res.status(200).json({
      error: false,
      success: true,
      message: "Collaborator login successful",
      data: {
        accessToken,
        refreshToken,
        influencer: {
          _id: influencer._id,
          name: influencer.name,
          email: influencer.email,
          code: influencer.code,
          referralUrl: influencer.referralUrl,
          promotionPlatforms: influencer.promotionPlatforms || [],
        },
      },
    });
  } catch (error) {
    console.error("Error logging in influencer:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to login collaborator",
    });
  }
};

/**
 * Influencer Portal Stats (Collaborator Dashboard)
 * @route GET /api/influencers/portal
 * @access Disabled legacy route
 */
export const getInfluencerPortalStats = async (req, res) => {
  return res.status(410).json({
    error: true,
    success: false,
    message:
      "Legacy portal access via referral code and email has been disabled. Please sign in with your collaborator password.",
  });
};

/**
 * Influencer Portal Stats (token-based)
 * @route GET /api/influencers/portal/me
 * @access Influencer (token)
 */
export const getInfluencerPortalStatsAuth = async (req, res) => {
  try {
    const influencerId = req.influencerId;
    if (!influencerId) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Authentication required",
      });
    }

    const influencer = await InfluencerModel.findById(influencerId);

    if (!influencer) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Influencer not found",
      });
    }

    if (!influencer.isActive) {
      return res.status(403).json({
        error: true,
        success: false,
        message: "Influencer account is inactive",
      });
    }

    const payload = await buildInfluencerPortalPayload(influencer);

    return res.status(200).json({
      error: false,
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error("Error fetching influencer portal stats (auth):", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch collaborator statistics",
    });
  }
};

/**
 * Refresh influencer access token
 * @route POST /api/influencers/refresh-token
 * @access Public (refresh token)
 */
export const refreshInfluencerToken = async (req, res) => {
  try {
    const refreshToken = normalizeTokenString(req.body?.refreshToken);

    if (!refreshToken) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Refresh token required",
      });
    }

    const secret = getInfluencerRefreshTokenSecret();

    if (!secret) {
      return res.status(500).json({
        error: true,
        success: false,
        message: "Server configuration error",
      });
    }

    const decoded = jwt.verify(refreshToken, secret);
    const influencer = await InfluencerModel.findById(decoded?.id);

    if (!influencer || !matchesStoredToken(influencer.refreshToken, refreshToken)) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Invalid refresh token",
      });
    }

    if (!influencer.isActive) {
      return res.status(403).json({
        error: true,
        success: false,
        message: "Influencer account is inactive",
      });
    }

    const accessToken = generateInfluencerToken(influencer._id);

    return res.status(200).json({
      error: false,
      success: true,
      message: "Access token refreshed",
      data: { accessToken },
    });
  } catch (error) {
    return res.status(401).json({
      error: true,
      success: false,
      message: "Refresh token expired or invalid",
    });
  }
};

/**
 * Request collaborator portal password reset OTP
 * @route POST /api/influencers/forgot-password
 * @access Public
 */
export const requestInfluencerPasswordReset = async (req, res) => {
  try {
    const { code, email } = req.body || {};

    if (!code || !email) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Referral code and email are required",
      });
    }

    const influencer = await getActiveInfluencerByCodeAndEmail({
      code,
      email,
      selectSecrets: "+passwordResetOtpHash +passwordResetOtpExpiresAt",
    });

    if (influencer?.email) {
      const otp = influencerOtpGenerator();
      influencer.passwordResetOtpHash = hashTokenValue(otp);
      influencer.passwordResetOtpExpiresAt = new Date(
        Date.now() + PASSWORD_RESET_OTP_EXPIRY_MS,
      );
      await influencer.save();

      const emailSent = await influencerOtpEmailSender({
        email: influencer.email,
        name: influencer.name,
        otp,
      });

      if (!emailSent) {
        return res.status(500).json({
          error: true,
          success: false,
          message: "Failed to send password reset OTP",
        });
      }
    }

    return res.status(200).json({
      error: false,
      success: true,
      message:
        "If the referral code and email match our records, an OTP has been sent.",
    });
  } catch (error) {
    console.error("Error requesting influencer password reset:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to process password reset request",
    });
  }
};

/**
 * Reset collaborator portal password using OTP
 * @route POST /api/influencers/reset-password
 * @access Public
 */
export const resetInfluencerPassword = async (req, res) => {
  try {
    const { code, email, otp, newPassword, confirmPassword } = req.body || {};

    if (!code || !email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: true,
        success: false,
        message:
          "Referral code, email, OTP, new password, and confirmation are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Password and confirm password must match",
      });
    }

    const passwordValidation = validatePortalPassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: true,
        success: false,
        message: passwordValidation.message,
      });
    }

    const influencer = await getActiveInfluencerByCodeAndEmail({
      code,
      email,
      selectSecrets:
        "+portalPasswordHash +passwordResetOtpHash +passwordResetOtpExpiresAt",
    });

    if (!influencer) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid password reset request",
      });
    }

    const otpIsValid = matchesStoredToken(
      influencer.passwordResetOtpHash,
      String(otp).trim(),
    );

    if (
      !otpIsValid ||
      !influencer.passwordResetOtpExpiresAt ||
      influencer.passwordResetOtpExpiresAt.getTime() < Date.now()
    ) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "OTP is invalid or expired",
      });
    }

    influencer.portalPasswordHash = await bcrypt.hash(String(newPassword), 10);
    influencer.passwordResetOtpHash = "";
    influencer.passwordResetOtpExpiresAt = null;
    influencer.refreshToken = "";
    await influencer.save();

    return res.status(200).json({
      error: false,
      success: true,
      message: "Portal password updated successfully. Please sign in.",
    });
  } catch (error) {
    console.error("Error resetting influencer password:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to reset portal password",
    });
  }
};

/**
 * Calculate referral discount for an order
 * Called internally from checkout flow
 */
export const calculateReferralDiscount = async (code, orderAmount) => {
  if (!code || !orderAmount) {
    return { discount: 0, influencer: null };
  }

  try {
    const influencer = await InfluencerModel.findActiveByCode(code);

    if (!influencer) {
      return { discount: 0, influencer: null };
    }

    const discount = influencer.calculateDiscount(orderAmount);

    return {
      discount: Math.round(discount * 100) / 100, // Round to 2 decimal places
      influencer,
    };
  } catch (error) {
    console.error("Error calculating referral discount:", error);
    return { discount: 0, influencer: null };
  }
};

/**
 * Calculate influencer commission for an order
 * Called internally after order completion
 */
export const calculateInfluencerCommission = async (
  influencerId,
  finalAmount,
) => {
  if (!influencerId || !finalAmount) {
    return 0;
  }

  try {
    const influencer = await InfluencerModel.findById(influencerId);

    if (!influencer || !influencer.isActive) {
      return 0;
    }

    const commission = influencer.calculateCommission(finalAmount);
    return Math.round(commission * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error("Error calculating commission:", error);
    return 0;
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all influencers
 * @route GET /api/influencers/admin/all
 */
export const getAllInfluencers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter = {};

    // Status filter
    if (status === "active") {
      filter.isActive = true;
    } else if (status === "inactive") {
      filter.isActive = false;
    }

    // Search by name or code
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { email: searchRegex },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === "asc" ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);

    const [influencers, total] = await Promise.all([
      InfluencerModel.find(filter)
        .select("+portalPasswordHash")
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .lean({ virtuals: true }),
      InfluencerModel.countDocuments(filter),
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: influencers.map((entry) => sanitizeInfluencerForAdmin(entry)),
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error("Error fetching influencers:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch influencers",
    });
  }
};

/**
 * Get single influencer by ID
 * @route GET /api/influencers/admin/:id
 */
export const getInfluencerById = async (req, res) => {
  try {
    const { id } = req.params;

    const influencer = await InfluencerModel.findById(id)
      .select("+portalPasswordHash")
      .lean({ virtuals: true });

    if (!influencer) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Influencer not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      data: sanitizeInfluencerForAdmin(influencer),
    });
  } catch (error) {
    console.error("Error fetching influencer:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch influencer",
    });
  }
};

/**
 * Create new influencer
 * @route POST /api/influencers/admin
 */
export const createInfluencer = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      promotionPlatforms,
      code,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      commissionType,
      commissionValue,
      isActive,
      expiresAt,
      notes,
      portalPassword,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !code ||
      discountValue === undefined ||
      commissionValue === undefined
    ) {
      return res.status(400).json({
        error: true,
        success: false,
        message:
          "Name, code, discount value, and commission value are required",
      });
    }

    // Check if code already exists
    const existingInfluencer = await InfluencerModel.findOne({
      code: code.toUpperCase().trim(),
    });

    if (existingInfluencer) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "An influencer with this code already exists",
      });
    }

    let portalPasswordHash = "";
    if (String(portalPassword || "").trim()) {
      const passwordValidation = validatePortalPassword(portalPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: true,
          success: false,
          message: passwordValidation.message,
        });
      }
      portalPasswordHash = await bcrypt.hash(String(portalPassword), 10);
    }

    const influencer = new InfluencerModel({
      name,
      email: normalizeEmail(email) || null,
      phone: normalizePhone(phone) || null,
      promotionPlatforms: normalizePromotionPlatforms(promotionPlatforms),
      code: normalizeInfluencerCode(code),
      discountType: discountType || "PERCENT",
      discountValue,
      maxDiscountAmount: maxDiscountAmount || null,
      minOrderAmount: minOrderAmount || 0,
      commissionType: commissionType || "PERCENT",
      commissionValue,
      isActive: isActive !== false,
      expiresAt: expiresAt || null,
      notes: notes || "",
      portalPasswordHash,
      createdBy: req.user?.id || null,
    });

    await influencer.save();

    res.status(201).json({
      error: false,
      success: true,
      message: "Influencer created successfully",
      data: sanitizeInfluencerForAdmin(influencer),
    });
  } catch (error) {
    console.error("Error creating influencer:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "An influencer with this code already exists",
      });
    }

    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create influencer",
      details: error.message,
    });
  }
};

/**
 * Update influencer
 * @route PATCH /api/influencers/admin/:id
 */
export const updateInfluencer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...(req.body || {}) };
    const portalPassword = String(updateData.portalPassword || "").trim();

    // Don't allow changing the code
    delete updateData.code;
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.totalOrders;
    delete updateData.totalRevenue;
    delete updateData.totalCommissionEarned;
    delete updateData.totalCommissionPaid;
    delete updateData.refreshToken;
    delete updateData.portalPasswordHash;
    delete updateData.passwordResetOtpHash;
    delete updateData.passwordResetOtpExpiresAt;
    delete updateData.portalAccessConfigured;
    delete updateData.portalPassword;
    delete updateData.confirmPortalPassword;
    if ("promotionPlatforms" in updateData) {
      updateData.promotionPlatforms = normalizePromotionPlatforms(
        updateData.promotionPlatforms,
      );
    }
    if ("email" in updateData) {
      updateData.email = normalizeEmail(updateData.email) || null;
    }
    if ("phone" in updateData) {
      updateData.phone = normalizePhone(updateData.phone) || null;
    }

    const influencer = await InfluencerModel.findById(id).select(
      "+portalPasswordHash",
    );

    if (!influencer) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Influencer not found",
      });
    }

    Object.assign(influencer, updateData);
    if (portalPassword) {
      const passwordValidation = validatePortalPassword(portalPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: true,
          success: false,
          message: passwordValidation.message,
        });
      }
      influencer.portalPasswordHash = await bcrypt.hash(portalPassword, 10);
      influencer.passwordResetOtpHash = "";
      influencer.passwordResetOtpExpiresAt = null;
      influencer.refreshToken = "";
    }
    await influencer.save();

    res.status(200).json({
      error: false,
      success: true,
      message: "Influencer updated successfully",
      data: sanitizeInfluencerForAdmin(influencer),
    });
  } catch (error) {
    console.error("Error updating influencer:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update influencer",
    });
  }
};

/**
 * Delete influencer
 * @route DELETE /api/influencers/admin/:id
 */
export const deleteInfluencer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid influencer id",
      });
    }

    const influencer = await InfluencerModel.findById(id).select("_id");
    if (!influencer) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Influencer not found",
      });
    }

    // Check if influencer has orders
    const orderCount = await OrderModel.countDocuments({ influencerId: id });

    if (orderCount > 0) {
      // Soft delete - just deactivate
      await InfluencerModel.findByIdAndUpdate(id, { isActive: false });

      return res.status(200).json({
        error: false,
        success: true,
        message: "Influencer deactivated (has associated orders)",
      });
    }

    await InfluencerModel.findByIdAndDelete(id);

    return res.status(200).json({
      error: false,
      success: true,
      message: "Influencer deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting influencer:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete influencer",
    });
  }
};

/**
 * Get influencer statistics
 * @route GET /api/influencers/admin/:id/stats
 */
export const getInfluencerStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const influencer = await InfluencerModel.findById(id);

    if (!influencer) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Influencer not found",
      });
    }

    // Build date filter
    const dateFilter = { influencerId: id };
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get order statistics
    const orderStats = await OrderModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$finalAmount" },
          totalCommission: { $sum: "$influencerCommission" },
          avgOrderValue: { $avg: "$finalAmount" },
          paidCommission: {
            $sum: {
              $cond: ["$commissionPaid", "$influencerCommission", 0],
            },
          },
        },
      },
    ]);

    // Get recent orders
    const recentOrders = await OrderModel.find({ influencerId: id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select(
        "_id createdAt finalAmount influencerCommission order_status commissionPaid",
      )
      .lean();
    const presentedRecentOrders = recentOrders.map(withOrderPresentation);

    // Get monthly breakdown
    const monthlyStats = await OrderModel.aggregate([
      { $match: { influencerId: influencer._id } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          orders: { $sum: 1 },
          revenue: { $sum: "$finalAmount" },
          commission: { $sum: "$influencerCommission" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]);

    const stats = orderStats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      totalCommission: 0,
      avgOrderValue: 0,
      paidCommission: 0,
    };

    res.status(200).json({
      error: false,
      success: true,
      data: {
        influencer: {
          _id: influencer._id,
          name: influencer.name,
          code: influencer.code,
          referralUrl: influencer.referralUrl,
          isActive: influencer.isActive,
          promotionPlatforms: influencer.promotionPlatforms || [],
        },
        stats: {
          ...stats,
          pendingCommission: stats.totalCommission - stats.paidCommission,
        },
        recentOrders: presentedRecentOrders,
        monthlyStats,
      },
    });
  } catch (error) {
    console.error("Error fetching influencer stats:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch influencer statistics",
    });
  }
};

/**
 * Mark commission as paid
 * @route POST /api/influencers/admin/:id/pay-commission
 */
export const payCommission = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderIds, amount, notes } = req.body;

    if (!orderIds || !orderIds.length) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Order IDs are required",
      });
    }

    // Mark orders as commission paid
    await OrderModel.updateMany(
      { _id: { $in: orderIds }, influencerId: id },
      { commissionPaid: true },
    );

    // Update influencer total paid
    const influencer = await InfluencerModel.findById(id);
    if (influencer) {
      influencer.totalCommissionPaid += amount || 0;
      await influencer.save();
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Commission marked as paid",
    });
  } catch (error) {
    console.error("Error paying commission:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to process commission payment",
    });
  }
};

/**
 * Update influencer statistics after order completion
 * Called internally after successful order
 */
export const updateInfluencerStats = async (
  influencerId,
  orderAmount,
  commission,
) => {
  if (!influencerId) return false;

  try {
    const updatedInfluencer = await InfluencerModel.findByIdAndUpdate(influencerId, {
      $inc: {
        totalOrders: 1,
        totalRevenue: orderAmount,
        totalCommissionEarned: commission,
      },
    });
    return Boolean(updatedInfluencer);
  } catch (error) {
    console.error("Error updating influencer stats:", error);
    return false;
  }
};
