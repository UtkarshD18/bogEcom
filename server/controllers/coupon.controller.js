import CouponModel from "../models/coupon.model.js";
import OrderModel from "../models/order.model.js";
import SettingsModel from "../models/settings.model.js";
import {
  sendOfferNotification,
  shouldThrottleNotification,
} from "./notification.controller.js";

const isProduction = process.env.NODE_ENV === "production";
// Debug-only logging to keep production output clean
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

const isDateOnlyString = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeCouponDate = (value, boundary = "start") => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  // Treat date-only strings as local day boundaries
  if (isDateOnlyString(value)) {
    if (boundary === "end") {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
  }

  return date;
};

/**
 * Coupon Controller
 *
 * Handles coupon validation and CRUD operations
 * Auto-triggers offer notifications when coupons are created/activated
 */

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Validate and calculate coupon discount
 * @route POST /api/coupons/validate
 * @body { code, orderAmount }
 */
export const validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount, influencerCode } = req.body;
    const userId = req.user?.id || null;

    debugLog("[Coupon Validate] Request:", { code, orderAmount, userId });

    if (!code) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Coupon code is required",
      });
    }

    if (!orderAmount || orderAmount <= 0) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Valid order amount is required",
      });
    }

    const normalizedCode = code.toUpperCase().trim();
    const safeOrderAmount = Math.max(Number(orderAmount || 0), 0);

    // Discount rules from admin settings
    const [discountSetting, offerCouponSetting] = await Promise.all([
      SettingsModel.findOne({ key: "discountSettings" }).select("value").lean(),
      SettingsModel.findOne({ key: "offerCouponCode" }).select("value").lean(),
    ]);

    const discountSettings = discountSetting?.value || {};
    const stackableCoupons = Boolean(discountSettings?.stackableCoupons);

    if (!stackableCoupons && String(influencerCode || "").trim()) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Coupons cannot be combined with referral/affiliate discounts",
      });
    }

    const maxDiscountPercentage = Number(
      discountSettings?.maxDiscountPercentage,
    );
    const maxDiscountByPercent =
      Number.isFinite(maxDiscountPercentage) && maxDiscountPercentage > 0
        ? (safeOrderAmount * maxDiscountPercentage) / 100
        : null;

    const applyGlobalDiscountCaps = (discountAmount) => {
      let capped = Math.max(discountAmount || 0, 0);
      capped = Math.min(capped, safeOrderAmount);
      if (maxDiscountByPercent !== null) {
        capped = Math.min(capped, maxDiscountByPercent);
      }
      return Math.round(capped * 100) / 100;
    };

    // First order discount: tied to the offer popup coupon code (system rule)
    const firstOrderConfig = discountSettings?.firstOrderDiscount || {};
    const firstOrderEnabled = Boolean(firstOrderConfig?.enabled);
    const offerCouponCode = String(offerCouponSetting?.value || "")
      .trim()
      .toUpperCase();

    if (
      firstOrderEnabled &&
      offerCouponCode &&
      normalizedCode === offerCouponCode
    ) {
      if (userId) {
        const hasPriorOrders = await OrderModel.exists({ user: userId });
        if (hasPriorOrders) {
          return res.status(400).json({
            error: true,
            success: false,
            message: "This coupon is valid only on your first order",
          });
        }
      }

      // Use actual coupon document values if the coupon exists in the DB,
      // otherwise fall back to firstOrderDiscount settings
      const offerCoupon = await CouponModel.findOne({
        code: normalizedCode,
        isActive: true,
      });

      const percentage = offerCoupon
        ? Math.max(Number(offerCoupon.discountValue || 0), 0)
        : Math.max(Number(firstOrderConfig?.percentage || 0), 0);
      const maxDiscount = offerCoupon
        ? Math.max(Number(offerCoupon.maxDiscountAmount || 0), 0)
        : Math.max(Number(firstOrderConfig?.maxDiscount || 0), 0);

      const computed = (safeOrderAmount * percentage) / 100;
      const discountAmount = applyGlobalDiscountCaps(
        maxDiscount > 0 ? Math.min(computed, maxDiscount) : computed,
      );

      return res.status(200).json({
        error: false,
        success: true,
        message: "Coupon applied successfully",
        data: {
          code: normalizedCode,
          discountType: offerCoupon?.discountType || "percentage",
          discountValue: percentage,
          discountAmount,
          finalAmount:
            Math.round((safeOrderAmount - discountAmount) * 100) / 100,
          description: offerCoupon?.description || "First order discount",
          isAffiliateCoupon: false,
          affiliateSource: null,
        },
      });
    }

    // Find coupon
    const coupon = await CouponModel.findOne({
      code: normalizedCode,
      isActive: true,
    });

    debugLog(
      "[Coupon Validate] Found coupon:",
      coupon
        ? {
            code: coupon.code,
            isActive: coupon.isActive,
            startDate: coupon.startDate,
            endDate: coupon.endDate,
          }
        : null,
    );

    if (!coupon) {
      // List all active coupons for debugging
      const allCoupons = await CouponModel.find({ isActive: true }).select(
        "code",
      );
      debugLog(
        "[Coupon Validate] Available active coupons:",
        allCoupons.map((c) => c.code),
      );

      return res.status(404).json({
        error: true,
        success: false,
        message: "Invalid coupon code",
      });
    }

    // Check if coupon is valid (dates and usage)
    const now = new Date();
    let effectiveEndDate = coupon.endDate;

    // If coupon dates were saved as date-only (midnight), treat endDate as end-of-day
    if (
      effectiveEndDate instanceof Date &&
      !Number.isNaN(effectiveEndDate.getTime()) &&
      effectiveEndDate.getHours() === 0 &&
      effectiveEndDate.getMinutes() === 0 &&
      effectiveEndDate.getSeconds() === 0 &&
      effectiveEndDate.getMilliseconds() === 0
    ) {
      effectiveEndDate = new Date(effectiveEndDate);
      effectiveEndDate.setHours(23, 59, 59, 999);
    }

    if (now < coupon.startDate) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "This coupon is not yet active",
      });
    }

    if (now > effectiveEndDate) {
      debugLog(
        "[Coupon Validate] Coupon expired. Now:",
        now,
        "EndDate:",
        effectiveEndDate,
      );
      return res.status(400).json({
        error: true,
        success: false,
        message: "This coupon has expired",
      });
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "This coupon has reached its usage limit",
      });
    }

    // Check minimum order amount
    if (safeOrderAmount < coupon.minOrderAmount) {
      return res.status(400).json({
        error: true,
        success: false,
        message: `Minimum order of ₹${coupon.minOrderAmount} required for this coupon`,
      });
    }

    // Check per-user limit if user is logged in
    if (userId && coupon.perUserLimit > 0) {
      const userUsage = coupon.usedBy.filter(
        (u) => u.user && u.user.toString() === userId.toString(),
      ).length;

      if (userUsage >= coupon.perUserLimit) {
        return res.status(400).json({
          error: true,
          success: false,
          message:
            "You have already used this coupon the maximum number of times",
        });
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = (safeOrderAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    discountAmount = applyGlobalDiscountCaps(discountAmount);

    const finalAmount =
      Math.round((safeOrderAmount - discountAmount) * 100) / 100;

    // Check if this coupon is an affiliate/referral code
    const isAffiliateCoupon =
      coupon.description?.toLowerCase().includes("affiliate") ||
      coupon.description?.toLowerCase().includes("influencer") ||
      coupon.description?.toLowerCase().includes("referral");

    res.status(200).json({
      error: false,
      success: true,
      message: "Coupon applied successfully",
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        finalAmount,
        description: coupon.description,
        isAffiliateCoupon,
        affiliateSource: isAffiliateCoupon ? "influencer" : null,
      },
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to validate coupon",
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all coupons (Admin)
 * @route GET /api/coupons/admin/all
 */
export const getAllCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [coupons, total] = await Promise.all([
      CouponModel.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      CouponModel.countDocuments(),
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: coupons,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch coupons",
    });
  }
};

/**
 * Create coupon (Admin)
 * @route POST /api/coupons/admin/create
 */
export const createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      perUserLimit,
      startDate,
      endDate,
      isActive,
    } = req.body;

    // Validate required fields
    if (!code || !discountType || discountValue === undefined || !endDate) {
      return res.status(400).json({
        error: true,
        success: false,
        message:
          "Code, discount type, discount value, and end date are required",
      });
    }

    // Check if coupon code already exists
    const existingCoupon = await CouponModel.findOne({
      code: code.toUpperCase().trim(),
    });

    if (existingCoupon) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "A coupon with this code already exists",
      });
    }

    const normalizedStartDate = normalizeCouponDate(startDate, "start");
    const normalizedEndDate = normalizeCouponDate(endDate, "end");

    if (!normalizedEndDate) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid end date",
      });
    }

    const newCoupon = new CouponModel({
      code: code.toUpperCase().trim(),
      description: description || "",
      discountType,
      discountValue,
      minOrderAmount: minOrderAmount || 0,
      maxDiscountAmount: maxDiscountAmount || null,
      usageLimit: usageLimit || null,
      perUserLimit: perUserLimit || 1,
      startDate: normalizedStartDate || new Date(),
      endDate: normalizedEndDate,
      isActive: isActive !== false,
    });

    const savedCoupon = await newCoupon.save();

    // AUTO-TRIGGER: Send offer notification if coupon is active
    if (savedCoupon.isActive) {
      const notificationKey = `coupon:${savedCoupon._id}`;
      if (!shouldThrottleNotification(notificationKey)) {
        // Fire and forget - don't block response
        sendOfferNotification(savedCoupon).catch((err) =>
          console.error("Failed to send offer notification:", err.message),
        );
        debugLog(
          `Offer notification triggered for coupon: ${savedCoupon.code}`,
        );
      }
    }

    res.status(201).json({
      error: false,
      success: true,
      message: "Coupon created successfully",
      data: savedCoupon,
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create coupon",
    });
  }
};

/**
 * Update coupon (Admin)
 * @route PUT /api/coupons/admin/:id
 */
export const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Uppercase code if provided
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase().trim();
    }

    if (updateData.startDate) {
      const normalizedStartDate = normalizeCouponDate(
        updateData.startDate,
        "start",
      );
      if (!normalizedStartDate) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Invalid start date",
        });
      }
      updateData.startDate = normalizedStartDate;
    }

    if (updateData.endDate) {
      const normalizedEndDate = normalizeCouponDate(updateData.endDate, "end");
      if (!normalizedEndDate) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Invalid end date",
        });
      }
      updateData.endDate = normalizedEndDate;
    }

    // Check if coupon is being activated (for notification trigger)
    const oldCoupon = await CouponModel.findById(id);
    const wasInactive = oldCoupon && !oldCoupon.isActive;
    const willBeActive = updateData.isActive === true;

    const coupon = await CouponModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!coupon) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Coupon not found",
      });
    }

    // AUTO-TRIGGER: Send notification if coupon was activated
    if (wasInactive && willBeActive && coupon.isActive) {
      const notificationKey = `coupon:${coupon._id}:activated`;
      if (!shouldThrottleNotification(notificationKey)) {
        sendOfferNotification(coupon).catch((err) =>
          console.error("Failed to send offer notification:", err.message),
        );
        debugLog(
          `Offer notification triggered for activated coupon: ${coupon.code}`,
        );
      }
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Coupon updated successfully",
      data: coupon,
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update coupon",
    });
  }
};

/**
 * Delete coupon (Admin)
 * @route DELETE /api/coupons/admin/:id
 */
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await CouponModel.findByIdAndDelete(id);

    if (!coupon) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Coupon not found",
      });
    }

    res.status(200).json({
      error: false,
      success: false,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete coupon",
    });
  }
};
