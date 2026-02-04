import InfluencerModel from "../models/influencer.model.js";
import OrderModel from "../models/order.model.js";

/**
 * Influencer Controller
 *
 * Handles influencer CRUD operations (admin only)
 * Referral validation (public)
 * Commission tracking and statistics
 */

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
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      InfluencerModel.countDocuments(filter),
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: influencers,
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

    const influencer = await InfluencerModel.findById(id);

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
      data: influencer,
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

    const influencer = new InfluencerModel({
      name,
      email,
      phone,
      code: code.toUpperCase().trim(),
      discountType: discountType || "PERCENT",
      discountValue,
      maxDiscountAmount: maxDiscountAmount || null,
      minOrderAmount: minOrderAmount || 0,
      commissionType: commissionType || "PERCENT",
      commissionValue,
      isActive: isActive !== false,
      expiresAt: expiresAt || null,
      notes: notes || "",
      createdBy: req.user?.id || null,
    });

    await influencer.save();

    res.status(201).json({
      error: false,
      success: true,
      message: "Influencer created successfully",
      data: influencer,
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
    const updateData = req.body;

    // Don't allow changing the code
    delete updateData.code;
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.totalOrders;
    delete updateData.totalRevenue;
    delete updateData.totalCommissionEarned;

    const influencer = await InfluencerModel.findById(id);

    if (!influencer) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Influencer not found",
      });
    }

    Object.assign(influencer, updateData);
    await influencer.save();

    res.status(200).json({
      error: false,
      success: true,
      message: "Influencer updated successfully",
      data: influencer,
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

    res.status(200).json({
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
        },
        stats: {
          ...stats,
          pendingCommission: stats.totalCommission - stats.paidCommission,
        },
        recentOrders,
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
  if (!influencerId) return;

  try {
    await InfluencerModel.findByIdAndUpdate(influencerId, {
      $inc: {
        totalOrders: 1,
        totalRevenue: orderAmount,
        totalCommissionEarned: commission,
      },
    });
  } catch (error) {
    console.error("Error updating influencer stats:", error);
  }
};
