import BlogPageModel from "../models/blogPage.model.js";

const mergeWithDefaults = (page) => {
  const defaults = BlogPageModel.getDefaultContent();
  if (!page) return defaults;

  const data = typeof page?.toObject === "function" ? page.toObject() : page;

  return {
    ...defaults,
    ...data,
    theme: { ...defaults.theme, ...(data.theme || {}) },
    sections: { ...defaults.sections, ...(data.sections || {}) },
    hero: { ...defaults.hero, ...(data.hero || {}) },
    newsletter: { ...defaults.newsletter, ...(data.newsletter || {}) },
  };
};

/**
 * Get blogs page config (public)
 * @route GET /api/blogs/page/public
 */
export const getBlogPageContent = async (req, res) => {
  try {
    let page = await BlogPageModel.findOne({ isActive: true });

    if (!page) {
      const defaults = BlogPageModel.getDefaultContent();
      page = await BlogPageModel.create({
        ...defaults,
        isActive: true,
      });
    }

    return res.status(200).json({
      error: false,
      success: true,
      data: mergeWithDefaults(page),
    });
  } catch (error) {
    console.error("Error fetching blog page:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch blog page content",
    });
  }
};

/**
 * Get blogs page config (admin)
 * @route GET /api/blogs/page/admin
 */
export const getBlogPageAdmin = async (req, res) => {
  try {
    let page = await BlogPageModel.findOne()
      .populate("updatedBy", "name email")
      .sort({ updatedAt: -1 });

    if (!page) {
      const defaults = BlogPageModel.getDefaultContent();
      page = mergeWithDefaults({
        ...defaults,
        isActive: true,
        _id: null,
      });
    }

    return res.status(200).json({
      error: false,
      success: true,
      data: mergeWithDefaults(page),
    });
  } catch (error) {
    console.error("Error fetching blog page for admin:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch blog page content",
    });
  }
};

/**
 * Update blogs page config (admin)
 * @route PUT /api/blogs/page/admin
 */
export const updateBlogPage = async (req, res) => {
  try {
    const adminId = req.userId || req.user?._id || req.user;
    const { theme, sections, hero, newsletter, isActive } = req.body || {};

    let page = await BlogPageModel.findOne();

    const updateData = {
      updatedBy: adminId,
    };

    if (theme !== undefined) updateData.theme = theme;
    if (sections !== undefined) updateData.sections = sections;
    if (hero !== undefined) updateData.hero = hero;
    if (newsletter !== undefined) updateData.newsletter = newsletter;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (page) {
      page = await BlogPageModel.findByIdAndUpdate(page._id, updateData, {
        new: true,
        runValidators: true,
      }).populate("updatedBy", "name email");
    } else {
      const defaults = BlogPageModel.getDefaultContent();
      page = await BlogPageModel.create({
        ...defaults,
        ...updateData,
        isActive: true,
      });
    }

    return res.status(200).json({
      error: false,
      success: true,
      message: "Blog page updated successfully",
      data: mergeWithDefaults(page),
    });
  } catch (error) {
    console.error("Error updating blog page:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update blog page content",
    });
  }
};

