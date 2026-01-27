import { deleteFromCloudinary } from "../config/cloudinary.js";
import HomeSlideModel from "../models/homeSlide.model.js";
import { extractPublicIdFromUrl } from "../utils/imageUtils.js";

/**
 * Home Slide Controller
 *
 * CRUD operations for home page slides/carousel (Admin)
 * Public operations for viewing slides
 */

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get active home slides
 * @route GET /api/home-slides
 */
export const getHomeSlides = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

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

    const slides = await HomeSlideModel.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      error: false,
      success: true,
      data: slides,
    });
  } catch (error) {
    console.error("Error fetching home slides:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch home slides",
    });
  }
};

/**
 * Get single slide
 * @route GET /api/home-slides/:id
 */
export const getSlideById = async (req, res) => {
  try {
    const { id } = req.params;

    const slide = await HomeSlideModel.findById(id);
    if (!slide) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Slide not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      data: slide,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch slide",
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all slides (Admin - includes inactive)
 * @route GET /api/home-slides/admin/all
 */
export const getAllSlides = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const [slides, total] = await Promise.all([
      HomeSlideModel.find()
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      HomeSlideModel.countDocuments(),
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: slides,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch slides",
    });
  }
};

/**
 * Create slide (Admin only)
 * @route POST /api/home-slides
 */
export const createSlide = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      description,
      image,
      mobileImage,
      buttonText,
      buttonLink,
      secondaryButtonText,
      secondaryButtonLink,
      backgroundColor,
      textColor,
      textPosition,
      overlayOpacity,
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

    const slide = new HomeSlideModel({
      title,
      subtitle,
      description,
      image,
      mobileImage,
      buttonText: buttonText || "Shop Now",
      buttonLink: buttonLink || "/products",
      secondaryButtonText,
      secondaryButtonLink,
      backgroundColor,
      textColor,
      textPosition: textPosition || "left",
      overlayOpacity: overlayOpacity || 0,
      isActive: isActive !== false,
      sortOrder: sortOrder || 0,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    await slide.save();

    res.status(201).json({
      error: false,
      success: true,
      message: "Slide created successfully",
      data: slide,
    });
  } catch (error) {
    console.error("Error creating slide:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create slide",
      details: error.message,
    });
  }
};

/**
 * Update slide (Admin only)
 * @route PUT /api/home-slides/:id
 */
export const updateSlide = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    delete updateData._id;

    // Fetch existing slide to check for image changes
    const existingSlide = await HomeSlideModel.findById(id);
    if (!existingSlide) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Slide not found",
      });
    }

    // Clean up old images if they're being replaced
    if (updateData.image && existingSlide.image !== updateData.image) {
      const oldPublicId = extractPublicIdFromUrl(existingSlide.image);
      if (oldPublicId) {
        deleteFromCloudinary(oldPublicId).catch((err) => {
          console.warn("Failed to delete old slide image:", oldPublicId, err);
        });
      }
    }

    if (
      updateData.mobileImage &&
      existingSlide.mobileImage !== updateData.mobileImage
    ) {
      const oldPublicId = extractPublicIdFromUrl(existingSlide.mobileImage);
      if (oldPublicId) {
        deleteFromCloudinary(oldPublicId).catch((err) => {
          console.warn("Failed to delete old mobile image:", oldPublicId, err);
        });
      }
    }

    const slide = await HomeSlideModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    res.status(200).json({
      error: false,
      success: true,
      message: "Slide updated successfully",
      data: slide,
    });
  } catch (error) {
    console.error("Error updating slide:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update slide",
    });
  }
};

/**
 * Delete slide (Admin only)
 * @route DELETE /api/home-slides/:id
 */
export const deleteSlide = async (req, res) => {
  try {
    const { id } = req.params;

    const slide = await HomeSlideModel.findByIdAndDelete(id);
    if (!slide) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Slide not found",
      });
    }

    // Clean up images from Cloudinary
    if (slide.image) {
      const publicId = extractPublicIdFromUrl(slide.image);
      if (publicId) {
        deleteFromCloudinary(publicId).catch((err) => {
          console.warn("Failed to delete slide image:", publicId, err);
        });
      }
    }

    if (slide.mobileImage) {
      const publicId = extractPublicIdFromUrl(slide.mobileImage);
      if (publicId) {
        deleteFromCloudinary(publicId).catch((err) => {
          console.warn("Failed to delete mobile image:", publicId, err);
        });
      }
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Slide deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting slide:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete slide",
    });
  }
};

/**
 * Reorder slides (Admin only)
 * @route PATCH /api/home-slides/reorder
 */
export const reorderSlides = async (req, res) => {
  try {
    const { slides } = req.body; // Array of { id, sortOrder }

    if (!Array.isArray(slides)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Slides array is required",
      });
    }

    const bulkOps = slides.map((slide) => ({
      updateOne: {
        filter: { _id: slide.id },
        update: { $set: { sortOrder: slide.sortOrder } },
      },
    }));

    await HomeSlideModel.bulkWrite(bulkOps);

    res.status(200).json({
      error: false,
      success: true,
      message: "Slides reordered successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to reorder slides",
    });
  }
};

export default {
  getHomeSlides,
  getSlideById,
  getAllSlides,
  createSlide,
  updateSlide,
  deleteSlide,
  reorderSlides,
};
