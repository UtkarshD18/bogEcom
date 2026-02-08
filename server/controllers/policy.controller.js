import PolicyModel from "../models/policy.model.js";
import {
  sanitizePolicyHtml,
  slugifyPolicyTitle,
} from "../utils/policySanitizer.js";

const toPublicPolicy = (policy) => ({
  _id: policy._id,
  title: policy.title,
  slug: policy.slug,
  content: policy.content,
  version: policy.version,
  effectiveDate: policy.effectiveDate,
  updatedAt: policy.updatedAt,
});

export const getActivePolicies = async (req, res) => {
  try {
    const policies = await PolicyModel.find({ isActive: true })
      .select("title slug version effectiveDate updatedAt")
      .sort({ title: 1 })
      .lean();

    return res.json({
      error: false,
      success: true,
      data: policies,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch policies",
    });
  }
};

export const getPolicyBySlug = async (req, res) => {
  try {
    const slug = slugifyPolicyTitle(req.params.slug);
    const policy = await PolicyModel.findOne({
      slug,
      isActive: true,
    }).lean();

    if (!policy) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Policy not found",
      });
    }

    return res.json({
      error: false,
      success: true,
      data: toPublicPolicy(policy),
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch policy",
    });
  }
};

export const getAllPoliciesAdmin = async (req, res) => {
  try {
    const policies = await PolicyModel.find()
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      error: false,
      success: true,
      data: policies,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch policies",
    });
  }
};

export const createPolicy = async (req, res) => {
  try {
    const { title, slug, content, isActive = true, effectiveDate } = req.body;
    const adminId = req.user?._id || req.user?.id || req.user || null;

    if (!title || !content) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Title and content are required",
      });
    }

    const normalizedSlug = slugifyPolicyTitle(slug || title);
    if (!normalizedSlug) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Valid slug could not be generated",
      });
    }

    const sanitizedContent = sanitizePolicyHtml(content);

    const existing = await PolicyModel.findOne({ slug: normalizedSlug }).lean();
    if (existing) {
      return res.status(409).json({
        error: true,
        success: false,
        message: "Policy slug already exists",
      });
    }

    const created = await PolicyModel.create({
      title: String(title).trim(),
      slug: normalizedSlug,
      content: sanitizedContent,
      isActive: Boolean(isActive),
      version: 1,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      createdBy: adminId,
      updatedBy: adminId,
    });

    return res.status(201).json({
      error: false,
      success: true,
      message: "Policy created successfully",
      data: created,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create policy",
    });
  }
};

export const updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, content, isActive, effectiveDate } = req.body;
    const adminId = req.user?._id || req.user?.id || req.user || null;

    const policy = await PolicyModel.findById(id);
    if (!policy) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Policy not found",
      });
    }

    if (title !== undefined) {
      policy.title = String(title).trim();
    }

    if (slug !== undefined || title !== undefined) {
      const normalizedSlug = slugifyPolicyTitle(slug || policy.title);
      if (!normalizedSlug) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Invalid slug",
        });
      }

      const duplicate = await PolicyModel.findOne({
        _id: { $ne: policy._id },
        slug: normalizedSlug,
      }).lean();
      if (duplicate) {
        return res.status(409).json({
          error: true,
          success: false,
          message: "Policy slug already exists",
        });
      }

      policy.slug = normalizedSlug;
    }

    if (content !== undefined) {
      policy.content = sanitizePolicyHtml(content);
    }
    if (isActive !== undefined) {
      policy.isActive = Boolean(isActive);
    }
    if (effectiveDate !== undefined) {
      policy.effectiveDate = new Date(effectiveDate);
    }

    policy.version = Number(policy.version || 1) + 1;
    policy.updatedBy = adminId;
    await policy.save();

    return res.json({
      error: false,
      success: true,
      message: "Policy updated successfully",
      data: policy,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update policy",
    });
  }
};

export const togglePolicyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?._id || req.user?.id || req.user || null;

    const policy = await PolicyModel.findById(id);
    if (!policy) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Policy not found",
      });
    }

    policy.isActive = !policy.isActive;
    policy.updatedBy = adminId;
    policy.version = Number(policy.version || 1) + 1;
    await policy.save();

    return res.json({
      error: false,
      success: true,
      message: "Policy status updated",
      data: policy,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to toggle policy",
    });
  }
};

export const deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await PolicyModel.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Policy not found",
      });
    }

    return res.json({
      error: false,
      success: true,
      message: "Policy deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete policy",
    });
  }
};

export default {
  createPolicy,
  deletePolicy,
  getActivePolicies,
  getAllPoliciesAdmin,
  getPolicyBySlug,
  togglePolicyStatus,
  updatePolicy,
};
