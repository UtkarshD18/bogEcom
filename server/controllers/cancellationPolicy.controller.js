import CancellationPolicyModel from "../models/cancellationPolicy.model.js";
import { sanitizePolicyHtml } from "../utils/policySanitizer.js";

const LEGACY_DEFAULT_POLICY_CONTENT = `## Non-Cancellable & Non-Returnable Orders

Orders placed with a discount or during any sale events are not eligible for cancellation or return.

Once an order is shipped, no modifications or cancellations can be made.`;

const DEFAULT_POLICY_CONTENT = `## Non-Cancellable & Non-Returnable Orders

Orders placed with a discount or during any sale events are not eligible for cancellation, return, or exchange.

Once an order is shipped, no modifications or cancellations can be made.

## Important Notice

We do not accept returns, exchanges, or refunds once an order is processed.`;

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

const LEGACY_RETURN_ACCEPTANCE_PATTERNS = [
  /##\s*Return\s*\/\s*Exchange\s*\/\s*Refund Policy/i,
  /we offer refund\s*\/\s*exchange/i,
  /return accepted request/i,
];

const stripLegacyReturnAcceptanceCopy = (rawContent) => {
  const content = String(rawContent || "").trim();
  if (!content) return content;

  const hasLegacyAcceptanceCopy = LEGACY_RETURN_ACCEPTANCE_PATTERNS.some(
    (pattern) => pattern.test(content),
  );
  if (!hasLegacyAcceptanceCopy) {
    return content;
  }

  const withoutLegacySection = content
    .replace(/##\s*Return\s*\/\s*Exchange\s*\/\s*Refund Policy[\s\S]*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return withoutLegacySection || DEFAULT_POLICY_CONTENT;
};

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
  const cleanedContent = stripLegacyReturnAcceptanceCopy(current);

  if (
    !current ||
    current === LEGACY_DEFAULT_POLICY_CONTENT.trim() ||
    cleanedContent !== current
  ) {
    policy.content = DEFAULT_POLICY_CONTENT;
    if (cleanedContent && cleanedContent !== DEFAULT_POLICY_CONTENT) {
      policy.content = cleanedContent;
    }
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
    const sanitizedWithoutLegacyAcceptance =
      stripLegacyReturnAcceptanceCopy(sanitizedContent);

    let policy = await CancellationPolicyModel.findOne({ isActive: true });

    if (!policy) {
      // Create new policy
      policy = await CancellationPolicyModel.create({
        content: sanitizedWithoutLegacyAcceptance,
        isActive: true,
        updatedBy: adminId,
        ...(normalizedTheme ? { theme: normalizedTheme } : {}),
      });
    } else {
      // Update existing policy
      policy.content = sanitizedWithoutLegacyAcceptance;
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
