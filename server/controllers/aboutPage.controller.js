import AboutPageModel from "../models/aboutPage.model.js";

/**
 * About Page Controller
 * Manages the About Us page content
 */

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get about page content (public)
 * @route GET /api/about/public
 */
export const getAboutPageContent = async (req, res) => {
  try {
    // Find the active about page content
    let aboutPage = await AboutPageModel.findOne({ isActive: true });

    // If no content exists, create default
    if (!aboutPage) {
      const defaultContent = AboutPageModel.getDefaultContent();
      aboutPage = await AboutPageModel.create({
        ...defaultContent,
        isActive: true,
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      data: aboutPage,
    });
  } catch (error) {
    console.error("Error fetching about page:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch about page content",
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get about page content for admin editing
 * @route GET /api/about/admin
 */
export const getAboutPageAdmin = async (req, res) => {
  try {
    let aboutPage = await AboutPageModel.findOne()
      .populate("updatedBy", "name email")
      .sort({ updatedAt: -1 });

    // If no content exists, return defaults
    if (!aboutPage) {
      const defaultContent = AboutPageModel.getDefaultContent();
      aboutPage = {
        ...defaultContent,
        isActive: true,
        _id: null,
      };
    }

    res.status(200).json({
      error: false,
      success: true,
      data: aboutPage,
    });
  } catch (error) {
    console.error("Error fetching about page for admin:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch about page content",
    });
  }
};

/**
 * Update about page content
 * @route PUT /api/about/admin
 */
export const updateAboutPage = async (req, res) => {
  try {
    const adminId = req.user?.id || req.user;
    const { hero, standard, whyUs, values, cta, isActive } = req.body;

    // Find existing or create new
    let aboutPage = await AboutPageModel.findOne();

    const updateData = {
      updatedBy: adminId,
    };

    // Only update provided fields
    if (hero !== undefined) updateData.hero = hero;
    if (standard !== undefined) updateData.standard = standard;
    if (whyUs !== undefined) updateData.whyUs = whyUs;
    if (values !== undefined) updateData.values = values;
    if (cta !== undefined) updateData.cta = cta;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (aboutPage) {
      // Update existing
      aboutPage = await AboutPageModel.findByIdAndUpdate(
        aboutPage._id,
        updateData,
        { new: true, runValidators: true },
      ).populate("updatedBy", "name email");
    } else {
      // Create new with defaults merged
      const defaultContent = AboutPageModel.getDefaultContent();
      aboutPage = await AboutPageModel.create({
        ...defaultContent,
        ...updateData,
        isActive: true,
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "About page updated successfully",
      data: aboutPage,
    });
  } catch (error) {
    console.error("Error updating about page:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update about page content",
    });
  }
};

/**
 * Reset about page to defaults
 * @route POST /api/about/admin/reset
 */
export const resetAboutPage = async (req, res) => {
  try {
    const adminId = req.user?.id || req.user;
    const defaultContent = AboutPageModel.getDefaultContent();

    // Delete existing and create fresh
    await AboutPageModel.deleteMany({});

    const aboutPage = await AboutPageModel.create({
      ...defaultContent,
      isActive: true,
      updatedBy: adminId,
    });

    res.status(200).json({
      error: false,
      success: true,
      message: "About page reset to defaults",
      data: aboutPage,
    });
  } catch (error) {
    console.error("Error resetting about page:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to reset about page",
    });
  }
};
