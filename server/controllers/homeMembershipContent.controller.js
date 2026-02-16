import HomeMembershipContentModel from "../models/homeMembershipContent.model.js";

/**
 * Home Membership Content Controller
 * Manages the Home page membership section content (separate from the Membership landing page)
 */

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get home membership content (public)
 * @route GET /api/membership/home-content/public
 */
export const getHomeMembershipContent = async (req, res) => {
  try {
    let content = await HomeMembershipContentModel.findOne({ isActive: true });

    if (!content) {
      const defaultContent = HomeMembershipContentModel.getDefaultContent();
      content = await HomeMembershipContentModel.create({
        ...defaultContent,
        isActive: true,
      });
    }

    return res.status(200).json({
      error: false,
      success: true,
      data: content,
    });
  } catch (error) {
    console.error("Error fetching home membership content:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch home membership content",
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get home membership content for admin editing
 * @route GET /api/membership/home-content/admin
 */
export const getHomeMembershipContentAdmin = async (req, res) => {
  try {
    let content = await HomeMembershipContentModel.findOne()
      .populate("updatedBy", "name email")
      .sort({ updatedAt: -1 });

    if (!content) {
      const defaultContent = HomeMembershipContentModel.getDefaultContent();
      content = {
        ...defaultContent,
        isActive: true,
        _id: null,
      };
    }

    return res.status(200).json({
      error: false,
      success: true,
      data: content,
    });
  } catch (error) {
    console.error("Error fetching home membership content for admin:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch home membership content",
    });
  }
};

/**
 * Update home membership content
 * @route PUT /api/membership/home-content/admin
 */
export const updateHomeMembershipContent = async (req, res) => {
  try {
    const adminId = req.userId || req.user?._id || req.user;
    const {
      title,
      subtitle,
      benefits,
      checkItems,
      ctaButtonText,
      ctaButtonLink,
      isActive,
    } = req.body || {};

    let content = await HomeMembershipContentModel.findOne();

    const updateData = {
      updatedBy: adminId,
    };

    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle;
    if (benefits !== undefined) updateData.benefits = benefits;
    if (checkItems !== undefined) updateData.checkItems = checkItems;
    if (ctaButtonText !== undefined) updateData.ctaButtonText = ctaButtonText;
    if (ctaButtonLink !== undefined) updateData.ctaButtonLink = ctaButtonLink;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (content) {
      content = await HomeMembershipContentModel.findByIdAndUpdate(
        content._id,
        updateData,
        { new: true, runValidators: true },
      ).populate("updatedBy", "name email");
    } else {
      const defaultContent = HomeMembershipContentModel.getDefaultContent();
      content = await HomeMembershipContentModel.create({
        ...defaultContent,
        ...updateData,
        isActive: true,
      });
    }

    return res.status(200).json({
      error: false,
      success: true,
      message: "Home membership content updated successfully",
      data: content,
    });
  } catch (error) {
    console.error("Error updating home membership content:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update home membership content",
    });
  }
};

/**
 * Reset home membership content to defaults
 * @route POST /api/membership/home-content/admin/reset
 */
export const resetHomeMembershipContent = async (req, res) => {
  try {
    const adminId = req.userId || req.user?._id || req.user;
    const defaultContent = HomeMembershipContentModel.getDefaultContent();

    await HomeMembershipContentModel.deleteMany({});

    const content = await HomeMembershipContentModel.create({
      ...defaultContent,
      isActive: true,
      updatedBy: adminId,
    });

    return res.status(200).json({
      error: false,
      success: true,
      message: "Home membership content reset to defaults",
      data: content,
    });
  } catch (error) {
    console.error("Error resetting home membership content:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to reset home membership content",
    });
  }
};
