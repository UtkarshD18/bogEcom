import SettingsModel from "../models/settings.model.js";

const POPUP_SETTINGS_KEY = "popupSettings";
const ALLOWED_REDIRECT_TYPES = new Set(["product", "category", "custom"]);

const createDefaultPopupSettings = () => ({
  title: "Limited Time Offer",
  description: "Discover our latest products and exclusive offers.",
  imageUrl: "",
  redirectType: "custom",
  redirectValue: "",
  startDate: new Date(),
  expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  isActive: false,
  showOncePerSession: true,
  backgroundColor: "#fff7ed",
  buttonText: "Shop Now",
});

const sanitizeText = (value, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
};

const normalizeColor = (value, fallback = "#fff7ed") => {
  const normalized = sanitizeText(value, fallback);
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeDate = (value, fallback) => {
  const parsed = value ? new Date(value) : new Date(fallback);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(fallback);
  }
  return parsed;
};

const serializePopup = (popup) => ({
  title: popup.title,
  description: popup.description,
  imageUrl: popup.imageUrl,
  redirectType: popup.redirectType,
  redirectValue: popup.redirectValue,
  startDate: popup.startDate.toISOString(),
  expiryDate: popup.expiryDate.toISOString(),
  isActive: popup.isActive,
  showOncePerSession: popup.showOncePerSession,
  backgroundColor: popup.backgroundColor,
  buttonText: popup.buttonText,
});

const normalizePopupPayload = (input = {}) => {
  const defaults = createDefaultPopupSettings();
  const errors = [];

  const redirectType = ALLOWED_REDIRECT_TYPES.has(input.redirectType)
    ? input.redirectType
    : defaults.redirectType;

  const popup = {
    title: sanitizeText(input.title, defaults.title) || defaults.title,
    description: sanitizeText(input.description, defaults.description),
    imageUrl: sanitizeText(input.imageUrl, defaults.imageUrl),
    redirectType,
    redirectValue: sanitizeText(input.redirectValue, defaults.redirectValue),
    startDate: normalizeDate(input.startDate, defaults.startDate),
    expiryDate: normalizeDate(input.expiryDate, defaults.expiryDate),
    isActive: normalizeBoolean(input.isActive, defaults.isActive),
    showOncePerSession: normalizeBoolean(
      input.showOncePerSession,
      defaults.showOncePerSession,
    ),
    backgroundColor: normalizeColor(
      input.backgroundColor,
      defaults.backgroundColor,
    ),
    buttonText:
      sanitizeText(input.buttonText, defaults.buttonText) || defaults.buttonText,
  };

  if (popup.expiryDate <= popup.startDate) {
    errors.push("expiryDate must be greater than startDate");
  }

  if (
    (popup.redirectType === "product" || popup.redirectType === "category") &&
    !popup.redirectValue
  ) {
    errors.push("redirectValue is required for product/category redirect");
  }

  return { popup, errors };
};

const getOrCreatePopupSetting = async () => {
  const existing = await SettingsModel.findOne({ key: POPUP_SETTINGS_KEY });
  if (existing) return existing;

  return SettingsModel.findOneAndUpdate(
    { key: POPUP_SETTINGS_KEY },
    {
      $setOnInsert: {
        key: POPUP_SETTINGS_KEY,
        value: createDefaultPopupSettings(),
        description: "Homepage popup configuration",
        category: "display",
        isActive: true,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    },
  );
};

/**
 * Get popup settings for admin panel
 * @route GET /api/admin/popup
 */
export const getAdminPopupSettings = async (req, res) => {
  try {
    const setting = await getOrCreatePopupSetting();
    const { popup } = normalizePopupPayload(setting?.value || {});

    res.status(200).json({
      error: false,
      success: true,
      data: {
        id: String(setting._id),
        ...serializePopup(popup),
      },
    });
  } catch (error) {
    console.error("Error fetching admin popup settings:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch popup settings",
    });
  }
};

/**
 * Update popup settings for admin panel
 * @route PUT /api/admin/popup
 */
export const updateAdminPopupSettings = async (req, res) => {
  try {
    const adminId = req.user?.id || req.user || null;
    const { popup, errors } = normalizePopupPayload(req.body || {});

    if (errors.length > 0) {
      return res.status(400).json({
        error: true,
        success: false,
        message: errors[0],
        errors,
      });
    }

    const setting = await SettingsModel.findOneAndUpdate(
      { key: POPUP_SETTINGS_KEY },
      {
        $set: {
          value: popup,
          updatedBy: adminId,
          description: "Homepage popup configuration",
          category: "display",
          isActive: true,
        },
        $setOnInsert: {
          key: POPUP_SETTINGS_KEY,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    );

    res.status(200).json({
      error: false,
      success: true,
      message: "Popup settings updated successfully",
      data: {
        id: String(setting._id),
        ...serializePopup(popup),
      },
    });
  } catch (error) {
    console.error("Error updating popup settings:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update popup settings",
    });
  }
};

/**
 * Get currently active popup for storefront
 * @route GET /api/popup/active
 */
export const getActivePopup = async (_req, res) => {
  try {
    const setting = await SettingsModel.findOne({
      key: POPUP_SETTINGS_KEY,
      isActive: true,
    }).select("_id value");

    if (!setting) {
      return res.status(200).json({
        error: false,
        success: true,
        data: null,
      });
    }

    const { popup, errors } = normalizePopupPayload(setting.value || {});
    if (errors.length > 0) {
      return res.status(200).json({
        error: false,
        success: true,
        data: null,
      });
    }

    const now = new Date();
    const isWithinDateRange =
      now >= popup.startDate && now <= popup.expiryDate;

    if (!popup.isActive || !isWithinDateRange) {
      return res.status(200).json({
        error: false,
        success: true,
        data: null,
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      data: {
        id: String(setting._id),
        ...serializePopup(popup),
      },
    });
  } catch (error) {
    console.error("Error fetching active popup:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch active popup",
    });
  }
};

