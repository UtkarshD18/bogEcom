import CancellationPolicyModel from "../models/cancellationPolicy.model.js";
import { sanitizePolicyHtml } from "../utils/policySanitizer.js";

const LEGACY_DEFAULT_POLICY_CONTENT = `## Non-Cancellable & Non-Returnable Orders

Orders placed with a discount or during any sale events are not eligible for cancellation or return.

Once an order is shipped, no modifications or cancellations can be made.`;

const DEFAULT_POLICY_CONTENT = `## Non-Cancellable & Non-Returnable Orders

Orders placed with a discount or during any sale events are not eligible for cancellation or return.

Once an order is shipped, no modifications or cancellations can be made.

## Return / Exchange / Refund Policy

We offer refund / exchange within first 1 days from the date of your purchase. If 1 days have passed
since your purchase, you will not be offered a return, exchange or refund of any kind. In order to become
eligible for a return or an exchange, (i) the purchased item should be unused and in the same condition as
you received it, (ii) the item must have original packaging, (iii) if the item that you purchased on a sale,
then the item may not be eligible for a return / exchange. Further, only such items are replaced by us
(based on an exchange request), if such items are found defective or damaged.
You agree that there may be a certain category of products / items that are exempted from returns or
refunds. Such categories of the products would be identified to you at the item of purchase. For exchange
/ return accepted request(s) (as applicable), once your returned product / item is received and inspected
by us, we will send you an email to notify you about receipt of the returned / exchanged product. Further.
If the same has been approved after the quality check at our end, your request (i.e. return / exchange) will
be processed in accordance with our policies.
Replacement of damaged products will be processed and delivered within 5-7 Days of receiving the request and approval`;

const DEFAULT_THEME = { style: "mint", layout: "glass" };
const THEME_STYLES = [
  "mint",
  "sky",
  "aurora",
  "lavender",
  "sunset",
  "midnight",
];
const THEME_LAYOUTS = ["glass", "minimal"];

const normalizeTheme = (value) => {
  if (!value || typeof value !== "object") return null;
  const next = {};
  if (THEME_STYLES.includes(value.style)) {
    next.style = value.style;
  }
  if (THEME_LAYOUTS.includes(value.layout)) {
    next.layout = value.layout;
  }
  return Object.keys(next).length ? next : null;
};

const ensureActivePolicy = async () => {
  let policy = await CancellationPolicyModel.findOne({ isActive: true });

  if (!policy) {
    policy = await CancellationPolicyModel.create({
      content: DEFAULT_POLICY_CONTENT,
      isActive: true,
    });
    return policy;
  }

  // Safe upgrade: only overwrite content if it was never customized.
  const current = String(policy.content || "").trim();
  if (!current || current === LEGACY_DEFAULT_POLICY_CONTENT.trim()) {
    policy.content = DEFAULT_POLICY_CONTENT;
    policy.theme = { ...DEFAULT_THEME, ...(policy.theme || {}) };
    await policy.save();
  }

  if (!policy.theme?.style || !policy.theme?.layout) {
    policy.theme = { ...DEFAULT_THEME, ...(policy.theme || {}) };
    await policy.save();
  }

  return policy;
};

/**
 * Get cancellation policy (Public)
 * @route GET /api/cancellation
 */
export const getCancellationPolicy = async (req, res) => {
  try {
    const policy = await ensureActivePolicy();

    res.status(200).json({
      error: false,
      success: true,
      data: {
        content: policy.content,
        updatedAt: policy.updatedAt,
        theme: policy.theme,
      },
    });
  } catch (error) {
    console.error("Error fetching cancellation policy:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch cancellation policy",
    });
  }
};

/**
 * Get cancellation policy for admin
 * @route GET /api/cancellation/admin
 */
export const getCancellationPolicyAdmin = async (req, res) => {
  try {
    const policy = await ensureActivePolicy();

    res.status(200).json({
      error: false,
      success: true,
      data: policy,
    });
  } catch (error) {
    console.error("Error fetching cancellation policy for admin:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch cancellation policy",
    });
  }
};

/**
 * Update cancellation policy (Admin only)
 * @route PUT /api/cancellation/admin
 */
export const updateCancellationPolicy = async (req, res) => {
  try {
    const { content, theme } = req.body;
    // `auth` sets `req.user` to userId; `admin` replaces it with full user doc.
    const adminId = req.userId || req.user?._id || req.user;
    const normalizedTheme = normalizeTheme(theme);

    if (!content || typeof content !== "string") {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Content is required and must be a string",
      });
    }
    const sanitizedContent = sanitizePolicyHtml(content);

    let policy = await CancellationPolicyModel.findOne({ isActive: true });

    if (!policy) {
      // Create new policy
      policy = await CancellationPolicyModel.create({
        content: sanitizedContent,
        isActive: true,
        updatedBy: adminId,
        ...(normalizedTheme ? { theme: normalizedTheme } : {}),
      });
    } else {
      // Update existing policy
      policy.content = sanitizedContent;
      if (normalizedTheme) {
        const existingTheme =
          policy.theme?.toObject?.() || policy.theme || {};
        policy.theme = {
          ...existingTheme,
          ...normalizedTheme,
        };
      }
      policy.updatedBy = adminId;
      await policy.save();
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Cancellation policy updated successfully",
      data: policy,
    });
  } catch (error) {
    console.error("Error updating cancellation policy:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update cancellation policy",
    });
  }
};
