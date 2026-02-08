import MembershipPlanModel from "../models/membershipPlan.model.js";
import UserModel from "../models/user.model.js";
import { createPhonePePayment, getPhonePeStatus } from "../services/phonepe.service.js";

// ==================== PAYMENT PROVIDER CONFIGURATION ====================

/**
 * Payment Provider Constant
 * Currently: PhonePe (onboarding in progress)
 */
const PAYMENT_PROVIDER = "PHONEPE";

/**
 * Check if payment gateway is enabled
 * Currently returns false - PhonePe onboarding in progress
 * Set PHONEPE_ENABLED=true in .env when PhonePe is activated
 */
const isPaymentEnabled = () => {
  return process.env.PHONEPE_ENABLED === "true";
};

/**
 * Membership Controller
 */

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get active membership plan (public)
 * @route GET /api/membership/active
 */
export const getActivePlan = async (req, res) => {
  try {
    const plan = await MembershipPlanModel.findOne({
      $or: [{ isActive: true }, { active: true }],
    });

    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "No active membership plan available",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error("Error fetching active plan:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch membership plan",
    });
  }
};

/**
 * Get user membership status
 * @route GET /api/membership/status
 */
export const getMembershipStatus = async (req, res) => {
  try {
    const userId = req.user;

    const user = await UserModel.findById(userId)
      .select("isMember membershipPlan membershipExpiry")
      .populate(
        "membershipPlan",
        "name benefits discountPercent pointsMultiplier",
      );

    if (!user) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "User not found",
      });
    }

    // Check if membership has expired
    const isExpired =
      user.membershipExpiry && new Date() > new Date(user.membershipExpiry);

    res.status(200).json({
      error: false,
      success: true,
      data: {
        isMember: user.isMember && !isExpired,
        membershipPlan: user.membershipPlan,
        membershipExpiry: user.membershipExpiry,
        isExpired,
      },
    });
  } catch (error) {
    console.error("Error fetching membership status:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch membership status",
    });
  }
};

// ==================== USER ENDPOINTS ====================

/**
 * Create membership order (PhonePe - onboarding in progress)
 * @route POST /api/membership/create-order
 */
export const createMembershipOrder = async (req, res) => {
  try {
    // Check if payments are enabled (PhonePe onboarding)
    if (!isPaymentEnabled()) {
      return res.status(503).json({
        error: true,
        success: false,
        message:
          "Membership payments are temporarily unavailable. PhonePe onboarding is in progress.",
        paymentProvider: PAYMENT_PROVIDER,
      });
    }

    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "planId is required",
      });
    }

    const plan = await MembershipPlanModel.findById(planId);
    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Membership plan not found",
      });
    }

    const userId = req.user;
    const primaryOrigin = (process.env.FRONTEND_URL || "http://localhost:3000")
      .split(",")[0]
      .trim();
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

    const merchantTransactionId = `MEM_${userId}_${Date.now()}`;
    const redirectUrl =
      process.env.PHONEPE_MEMBERSHIP_REDIRECT_URL ||
      process.env.PHONEPE_REDIRECT_URL ||
      `${primaryOrigin}/membership/checkout`;
    const callbackUrl =
      process.env.PHONEPE_MEMBERSHIP_CALLBACK_URL ||
      process.env.PHONEPE_CALLBACK_URL ||
      `${backendUrl}/api/membership/verify-payment`;

    const phonepeResponse = await createPhonePePayment({
      amount: plan.price,
      merchantTransactionId,
      merchantUserId: String(userId),
      redirectUrl,
      callbackUrl,
    });

    const paymentUrl =
      phonepeResponse?.data?.instrumentResponse?.redirectInfo?.url ||
      phonepeResponse?.data?.redirectInfo?.url ||
      null;

    if (!paymentUrl) {
      return res.status(503).json({
        error: true,
        success: false,
        message: "PhonePe payment URL not received",
        paymentProvider: PAYMENT_PROVIDER,
      });
    }

    return res.status(200).json({
      error: false,
      success: true,
      message: "Membership order created",
      data: {
        paymentUrl,
        merchantTransactionId,
        planId: plan._id,
      },
    });
  } catch (error) {
    console.error("Error creating membership order:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create membership order",
    });
  }
};

/**
 * Verify membership payment (PhonePe - onboarding in progress)
 * @route POST /api/membership/verify-payment
 */
export const verifyMembershipPayment = async (req, res) => {
  try {
    // Check if payments are enabled (PhonePe onboarding)
    if (!isPaymentEnabled()) {
      return res.status(503).json({
        error: true,
        success: false,
        message:
          "Membership payment verification unavailable. PhonePe onboarding in progress.",
        paymentProvider: PAYMENT_PROVIDER,
      });
    }

    const { merchantTransactionId, planId } = req.body || {};

    if (!merchantTransactionId || !planId) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "merchantTransactionId and planId are required",
      });
    }

    const status = await getPhonePeStatus({ merchantTransactionId });
    const state =
      status?.data?.state ||
      status?.data?.status ||
      status?.data?.code ||
      "";

    if (!String(state).toLowerCase().includes("success")) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Payment not successful yet",
      });
    }

    const user = await UserModel.findById(req.user);
    if (!user) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "User not found",
      });
    }

    const plan = await MembershipPlanModel.findById(planId);
    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Membership plan not found",
      });
    }

    const expiry = new Date();
    if (plan.durationUnit === "months") {
      expiry.setMonth(expiry.getMonth() + plan.duration);
    } else if (plan.durationUnit === "years") {
      expiry.setFullYear(expiry.getFullYear() + plan.duration);
    } else {
      expiry.setDate(expiry.getDate() + plan.duration);
    }

    user.isMember = true;
    user.membershipPlan = plan._id;
    user.membershipExpiry = expiry;
    user.membershipPaymentId = merchantTransactionId;
    await user.save();

    return res.status(200).json({
      error: false,
      success: true,
      message: "Membership activated",
      data: {
        membershipPlan: plan._id,
        membershipExpiry: expiry,
      },
    });
  } catch (error) {
    console.error("Error verifying membership payment:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to verify payment",
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all membership plans (Admin)
 * @route GET /api/membership/admin/plans
 */
export const getAllPlans = async (req, res) => {
  try {
    const plans = await MembershipPlanModel.find().sort({
      sortOrder: 1,
      createdAt: -1,
    });

    res.status(200).json({
      error: false,
      success: true,
      data: plans,
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch membership plans",
    });
  }
};

/**
 * Create membership plan (Admin)
 * @route POST /api/membership/admin/plans
 */
export const createPlan = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      durationDays,
      discountPercentage,
      active,
      originalPrice,
      duration,
      durationUnit,
      benefits,
      isActive,
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Name and price are required",
      });
    }

    const plan = new MembershipPlanModel({
      name,
      description,
      price,
      durationDays: Number(durationDays || duration || 365),
      discountPercentage: Number(
        discountPercentage ?? req.body.discountPercent ?? 0,
      ),
      active: Boolean(active ?? isActive ?? false),
      originalPrice,
      duration: Number(duration || durationDays || 365),
      durationUnit: durationUnit || "days",
      benefits: benefits || [],
      isActive: Boolean(isActive ?? active ?? false),
    });

    await plan.save();

    res.status(201).json({
      error: false,
      success: true,
      message: "Membership plan created",
      data: plan,
    });
  } catch (error) {
    console.error("Error creating plan:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create membership plan",
    });
  }
};

/**
 * Update membership plan (Admin)
 * @route PUT /api/membership/admin/plans/:id
 */
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.durationDays !== undefined || updates.duration !== undefined) {
      updates.durationDays = Number(updates.durationDays || updates.duration);
      updates.duration = Number(updates.duration || updates.durationDays);
      updates.durationUnit = "days";
    }

    if (
      updates.discountPercentage !== undefined ||
      updates.discountPercent !== undefined
    ) {
      const value = Number(
        updates.discountPercentage ?? updates.discountPercent ?? 0,
      );
      updates.discountPercentage = value;
      updates.discountPercent = value;
    }

    if (updates.active !== undefined || updates.isActive !== undefined) {
      const activeValue = Boolean(updates.active ?? updates.isActive);
      updates.active = activeValue;
      updates.isActive = activeValue;
    }

    const plan = await MembershipPlanModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Plan not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Plan updated",
      data: plan,
    });
  } catch (error) {
    console.error("Error updating plan:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update plan",
    });
  }
};

/**
 * Delete membership plan (Admin)
 * @route DELETE /api/membership/admin/plans/:id
 */
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await MembershipPlanModel.findByIdAndDelete(id);

    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Plan not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Plan deleted",
    });
  } catch (error) {
    console.error("Error deleting plan:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete plan",
    });
  }
};

/**
 * Set plan as active (Admin)
 * @route PUT /api/membership/admin/plans/:id/activate
 */
export const activatePlan = async (req, res) => {
  try {
    const { id } = req.params;

    // Deactivate all plans
    await MembershipPlanModel.updateMany({}, { isActive: false, active: false });

    // Activate selected plan
    const plan = await MembershipPlanModel.findByIdAndUpdate(
      id,
      { isActive: true, active: true },
      { new: true },
    );

    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Plan not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Plan activated",
      data: plan,
    });
  } catch (error) {
    console.error("Error activating plan:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to activate plan",
    });
  }
};

/**
 * Get membership statistics (Admin)
 * @route GET /api/membership/admin/stats
 */
export const getMembershipStats = async (req, res) => {
  try {
    const [totalMembers, activeMembers, expiredMembers] = await Promise.all([
      UserModel.countDocuments({ isMember: true }),
      UserModel.countDocuments({
        isMember: true,
        membershipExpiry: { $gt: new Date() },
      }),
      UserModel.countDocuments({
        isMember: true,
        membershipExpiry: { $lte: new Date() },
      }),
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: {
        totalMembers,
        activeMembers,
        expiredMembers,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch statistics",
    });
  }
};
