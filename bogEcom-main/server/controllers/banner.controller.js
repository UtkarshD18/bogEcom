import { deleteFromCloudinary } from "../config/cloudinary.js";
import BannerModel from "../models/banner.model.js";
import { extractPublicIdFromUrl } from "../utils/imageUtils.js";

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
 * @description Supports both image and video banners
 * - Image banners: require image field (existing behavior)
 * - Video banners: require image (as poster/fallback) + videoUrl
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
      // ===== NEW VIDEO FIELDS (optional) =====
      mediaType,
      videoUrl,
    } = req.body;

    // Validation: title required, image required only for image banners
    if (!title) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Title is required",
      });
    }

    // For image banners, image is required
    if (mediaType !== "video" && !image) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Image is required for image banners",
      });
    }

    // ===== VIDEO VALIDATION (only when mediaType is "video") =====
    if (mediaType === "video") {
      if (!videoUrl) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Video URL is required for video banners",
        });
      }

      // Validate video URL format (must be mp4 or webm, or valid URL)
      const validVideoExtensions = [".mp4", ".webm"];
      const isValidVideoUrl =
        videoUrl.startsWith("http") ||
        validVideoExtensions.some((ext) =>
          videoUrl.toLowerCase().endsWith(ext),
        );

      if (!isValidVideoUrl) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Invalid video URL. Supported formats: MP4, WebM",
        });
      }
    }
    // ===== END VIDEO VALIDATION =====

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
      // ===== NEW VIDEO FIELDS =====
      mediaType: mediaType || "image", // Default to "image" for backward compatibility
      videoUrl: mediaType === "video" ? videoUrl : "",
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
 * @description Supports updating both image and video banners
 */
export const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    delete updateData._id;
    delete updateData.clickCount;
    delete updateData.viewCount;

    // Fetch existing banner to check for image changes
    const existingBanner = await BannerModel.findById(id);
    if (!existingBanner) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Banner not found",
      });
    }

    // ===== VIDEO VALIDATION (only when updating to video type) =====
    if (updateData.mediaType === "video") {
      const videoUrl = updateData.videoUrl || existingBanner.videoUrl;
      if (!videoUrl) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Video URL is required for video banners",
        });
      }

      // Validate video URL format
      const validVideoExtensions = [".mp4", ".webm"];
      const isValidVideoUrl =
        videoUrl.startsWith("http") ||
        validVideoExtensions.some((ext) =>
          videoUrl.toLowerCase().endsWith(ext),
        );

      if (!isValidVideoUrl) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Invalid video URL. Supported formats: MP4, WebM",
        });
      }
    }

    // Clear videoUrl if switching from video to image
    if (
      updateData.mediaType === "image" &&
      existingBanner.mediaType === "video"
    ) {
      updateData.videoUrl = "";
    }
    // ===== END VIDEO VALIDATION =====

    // Clean up old images if they're being replaced
    if (updateData.image && existingBanner.image !== updateData.image) {
      const oldPublicId = extractPublicIdFromUrl(existingBanner.image);
      if (oldPublicId) {
        deleteFromCloudinary(oldPublicId).catch((err) => {
          console.warn("Failed to delete old banner image:", oldPublicId, err);
        });
      }
    }

    if (
      updateData.mobileImage &&
      existingBanner.mobileImage !== updateData.mobileImage
    ) {
      const oldPublicId = extractPublicIdFromUrl(existingBanner.mobileImage);
      if (oldPublicId) {
        deleteFromCloudinary(oldPublicId).catch((err) => {
          console.warn("Failed to delete old mobile image:", oldPublicId, err);
        });
      }
    }

    const banner = await BannerModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    res.status(200).json({
      error: false,
      success: true,
      message: "Banner updated successfully",
      data: banner,
    });
  } catch (error) {
    console.error("Error updating banner:", error);
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

    // Clean up images from Cloudinary
    if (banner.image) {
      const publicId = extractPublicIdFromUrl(banner.image);
      if (publicId) {
        deleteFromCloudinary(publicId).catch((err) => {
          console.warn("Failed to delete banner image:", publicId, err);
        });
      }
    }

    if (banner.mobileImage) {
      const publicId = extractPublicIdFromUrl(banner.mobileImage);
      if (publicId) {
        deleteFromCloudinary(publicId).catch((err) => {
          console.warn("Failed to delete mobile image:", publicId, err);
        });
      }
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting banner:", error);
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
