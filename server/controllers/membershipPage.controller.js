import MembershipPageModel from "../models/membershipPage.model.js";

/**
 * Membership Page Controller
 * Manages the Membership landing page content
 */

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get membership page content (public)
 * @route GET /api/membership/page/public
 */
export const getMembershipPageContent = async (req, res) => {
  try {
    let page = await MembershipPageModel.findOne({ isActive: true });

    if (!page) {
      const defaultContent = MembershipPageModel.getDefaultContent();
      page = await MembershipPageModel.create({
        ...defaultContent,
        isActive: true,
      });
    }

    return res.status(200).json({
      error: false,
      success: true,
      data: page,
    });
  } catch (error) {
    console.error("Error fetching membership page:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch membership page content",
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get membership page content for admin editing
 * @route GET /api/membership/page/admin
 */
export const getMembershipPageAdmin = async (req, res) => {
  try {
    let page = await MembershipPageModel.findOne()
      .populate("updatedBy", "name email")
      .sort({ updatedAt: -1 });

    if (!page) {
      const defaultContent = MembershipPageModel.getDefaultContent();
      page = {
        ...defaultContent,
        isActive: true,
        _id: null,
      };
    }

    return res.status(200).json({
      error: false,
      success: true,
      data: page,
    });
  } catch (error) {
    console.error("Error fetching membership page for admin:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch membership page content",
    });
  }
};

/**
 * Update membership page content
 * @route PUT /api/membership/page/admin
 */
export const updateMembershipPage = async (req, res) => {
  try {
    const adminId = req.userId || req.user?._id || req.user;
    const { theme, hero, benefits, pricing, cta, isActive } = req.body || {};

    let page = await MembershipPageModel.findOne();

    const updateData = {
      updatedBy: adminId,
    };

    if (theme !== undefined) updateData.theme = theme;
    if (hero !== undefined) updateData.hero = hero;
    if (benefits !== undefined) updateData.benefits = benefits;
    if (pricing !== undefined) updateData.pricing = pricing;
    if (cta !== undefined) updateData.cta = cta;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (page) {
      page = await MembershipPageModel.findByIdAndUpdate(
        page._id,
        updateData,
        { new: true, runValidators: true },
      ).populate("updatedBy", "name email");
    } else {
      const defaultContent = MembershipPageModel.getDefaultContent();
      page = await MembershipPageModel.create({
        ...defaultContent,
        ...updateData,
        isActive: true,
      });
    }

    return res.status(200).json({
      error: false,
      success: true,
      message: "Membership page updated successfully",
      data: page,
    });
  } catch (error) {
    console.error("Error updating membership page:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update membership page content",
    });
  }
};

/**
 * Reset membership page to defaults
 * @route POST /api/membership/page/admin/reset
 */
export const resetMembershipPage = async (req, res) => {
  try {
    const adminId = req.userId || req.user?._id || req.user;
    const defaultContent = MembershipPageModel.getDefaultContent();

    await MembershipPageModel.deleteMany({});

    const page = await MembershipPageModel.create({
      ...defaultContent,
      isActive: true,
      updatedBy: adminId,
    });

    return res.status(200).json({
      error: false,
      success: true,
      message: "Membership page reset to defaults",
      data: page,
    });
  } catch (error) {
    console.error("Error resetting membership page:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to reset membership page",
    });
  }
};
