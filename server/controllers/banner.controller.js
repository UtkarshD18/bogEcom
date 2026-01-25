import BannerModel from "../models/banner.model.js";

/**
 * Banner Controller
 *
 * CRUD operations for banners (Admin)
 * Public operations for viewing banners
 */

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get active banners
 * @route GET /api/banners
 */
export const getBanners = async (req, res) => {
  try {
    const { position, limit = 10 } = req.query;

    const now = new Date();
    const filter = {
      isActive: true,
      $or: [{ startDate: null }, { startDate: { $lte: now } }],
      $and: [
        {
          $or: [{ endDate: null }, { endDate: { $gte: now } }],
        },
      ],
    };

    if (position) {
      filter.position = position;
    }

    const banners = await BannerModel.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      error: false,
      success: true,
      data: banners,
    });
  } catch (error) {
    console.error("Error fetching banners:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch banners",
    });
  }
};

/**
 * Get single banner
 * @route GET /api/banners/:id
 */
export const getBannerById = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await BannerModel.findById(id);
    if (!banner) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Banner not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      data: banner,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch banner",
    });
  }
};

/**
 * Track banner click
 * @route POST /api/banners/:id/click
 */
export const trackBannerClick = async (req, res) => {
  try {
    const { id } = req.params;

    await BannerModel.findByIdAndUpdate(id, {
      $inc: { clickCount: 1 },
    });

    res.status(200).json({
      error: false,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all banners (Admin - includes inactive)
 * @route GET /api/banners/admin/all
 */
export const getAllBanners = async (req, res) => {
  try {
    const { page = 1, limit = 20, position } = req.query;

    const filter = {};
    if (position) filter.position = position;

    const skip = (Number(page) - 1) * Number(limit);

    const [banners, total] = await Promise.all([
      BannerModel.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      BannerModel.countDocuments(filter),
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: banners,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch banners",
    });
  }
};

/**
 * Create banner (Admin only)
 * @route POST /api/banners
 */
export const createBanner = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      image,
      mobileImage,
      link,
      linkText,
      position,
      backgroundColor,
      textColor,
      isActive,
      sortOrder,
      startDate,
      endDate,
    } = req.body;

    if (!title || !image) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Title and image are required",
      });
    }

    const banner = new BannerModel({
      title,
      subtitle,
      image,
      mobileImage,
      link,
      linkText,
      position: position || "home-top",
      backgroundColor,
      textColor,
      isActive: isActive !== false,
      sortOrder: sortOrder || 0,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    await banner.save();

    res.status(201).json({
      error: false,
      success: true,
      message: "Banner created successfully",
      data: banner,
    });
  } catch (error) {
    console.error("Error creating banner:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create banner",
      details: error.message,
    });
  }
};

/**
 * Update banner (Admin only)
 * @route PUT /api/banners/:id
 */
export const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    delete updateData._id;
    delete updateData.clickCount;
    delete updateData.viewCount;

    const banner = await BannerModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!banner) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Banner not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Banner updated successfully",
      data: banner,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update banner",
    });
  }
};

/**
 * Delete banner (Admin only)
 * @route DELETE /api/banners/:id
 */
export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await BannerModel.findByIdAndDelete(id);
    if (!banner) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Banner not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete banner",
    });
  }
};

export default {
  getBanners,
  getBannerById,
  trackBannerClick,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
};
