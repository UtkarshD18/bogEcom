import crypto from "crypto";
import Razorpay from "razorpay";
import MembershipPlanModel from "../models/membershipPlan.model.js";
import UserModel from "../models/user.model.js";

// Initialize Razorpay
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

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
    const plan = await MembershipPlanModel.findOne({ isActive: true });

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
 * Create membership order (initiates Razorpay payment)
 * @route POST /api/membership/create-order
 */
export const createMembershipOrder = async (req, res) => {
  try {
    const userId = req.user;
    const { planId } = req.body;

    if (!razorpay) {
      return res.status(503).json({
        error: true,
        success: false,
        message: "Payment service is not configured",
      });
    }

    // Get the plan
    const plan = planId
      ? await MembershipPlanModel.findById(planId)
      : await MembershipPlanModel.findOne({ isActive: true });

    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Membership plan not found",
      });
    }

    // Check if user already has active membership
    const user = await UserModel.findById(userId);
    if (
      user.isMember &&
      user.membershipExpiry &&
      new Date() < new Date(user.membershipExpiry)
    ) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "You already have an active membership",
        data: { expiry: user.membershipExpiry },
      });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(plan.price * 100), // Amount in paise
      currency: "INR",
      receipt: `membership_${userId}_${Date.now()}`,
      payment_capture: 1,
      notes: {
        userId: userId.toString(),
        planId: plan._id.toString(),
        type: "membership",
      },
    });

    res.status(201).json({
      error: false,
      success: true,
      message: "Membership order created",
      data: {
        orderId: razorpayOrder.id,
        amount: plan.price,
        currency: "INR",
        planId: plan._id,
        planName: plan.name,
        keyId: process.env.RAZORPAY_KEY_ID,
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
 * Verify membership payment
 * @route POST /api/membership/verify-payment
 */
export const verifyMembershipPayment = async (req, res) => {
  try {
    const userId = req.user;
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature, planId } =
      req.body;

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Payment details are required",
      });
    }

    // Verify signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Payment verification failed",
      });
    }

    // Get plan
    const plan = await MembershipPlanModel.findById(planId);
    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Membership plan not found",
      });
    }

    // Calculate expiry date
    let expiryDate = new Date();
    switch (plan.durationUnit) {
      case "months":
        expiryDate.setMonth(expiryDate.getMonth() + plan.duration);
        break;
      case "years":
        expiryDate.setFullYear(expiryDate.getFullYear() + plan.duration);
        break;
      default:
        expiryDate.setDate(expiryDate.getDate() + plan.duration);
    }

    // Update user membership
    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        isMember: true,
        membershipPlan: plan._id,
        membershipExpiry: expiryDate,
        membershipPaymentId: razorpayPaymentId,
      },
      { new: true },
    ).populate("membershipPlan", "name benefits");

    res.status(200).json({
      error: false,
      success: true,
      message: "Membership activated successfully!",
      data: {
        isMember: user.isMember,
        membershipPlan: user.membershipPlan,
        membershipExpiry: user.membershipExpiry,
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
      originalPrice,
      duration,
      durationUnit,
      benefits: benefits || [],
      isActive: isActive || false,
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
    const updates = req.body;

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
    await MembershipPlanModel.updateMany({}, { isActive: false });

    // Activate selected plan
    const plan = await MembershipPlanModel.findByIdAndUpdate(
      id,
      { isActive: true },
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
