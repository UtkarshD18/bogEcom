import SettingsModel from "../models/settings.model.js";
import CouponModel from "../models/coupon.model.js";

const isProduction = process.env.NODE_ENV === "production";
// Debug-only logging to keep production output clean
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

// GST is always enabled and system-controlled for this project.
const FIXED_TAX_SETTINGS = Object.freeze({
  enabled: true,
  taxRate: 5,
  taxName: "GST",
  taxIncludedInPrice: true,
});

/**
 * Settings Controller
 * Manages site-wide configuration settings
 */

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get public settings (for client-side use)
 * @route GET /api/settings/public
 */
export const getPublicSettings = async (req, res) => {
  try {
    // Only return specific settings that are safe for public access
    const publicKeys = [
      "highTrafficNotice",
      "paymentGatewayEnabled",
      "maintenanceMode",
      // Offer popup settings
      "showOfferPopup",
      "offerCouponCode",
      "offerTitle",
      "offerDescription",
      "offerDiscountText",
      // Checkout settings (needed for cart/checkout)
      "shippingSettings",
      "taxSettings",
      "orderSettings",
      "discountSettings",
      "storeInfo",
    ];

    const settings = await SettingsModel.find({
      key: { $in: publicKeys },
      isActive: true,
    }).select("key value -_id");

    // Convert to object for easier client-side use
    const settingsObject = {};
    settings.forEach((setting) => {
      settingsObject[setting.key] = setting.value;
    });

    // Enforce free-shipping business rule for customer storefront.
    settingsObject.shippingSettings = {
      ...(settingsObject.shippingSettings || {}),
      freeShippingEnabled: true,
      freeShippingThreshold: 0,
      standardShippingCost: 0,
      expressShippingCost: 0,
    };

    // Enforce fixed GST settings (admin cannot disable GST)
    settingsObject.taxSettings = FIXED_TAX_SETTINGS;

    debugLog(
      "[Settings] Public settings:",
      JSON.stringify(settingsObject.taxSettings),
    );

    res.status(200).json({
      error: false,
      success: true,
      data: settingsObject,
    });
  } catch (error) {
    console.error("Error fetching public settings:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch settings",
    });
  }
};

/**
 * Get a specific setting by key (public)
 * @route GET /api/settings/public/:key
 */
export const getSettingByKey = async (req, res) => {
  try {
    const { key } = req.params;

    const setting = await SettingsModel.findOne({
      key,
      isActive: true,
    }).select("key value -_id");

    if (!setting) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Setting not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      data: setting,
    });
  } catch (error) {
    console.error("Error fetching setting:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch setting",
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all settings (Admin)
 * @route GET /api/settings/admin/all
 */
export const getAllSettings = async (req, res) => {
  try {
    const settings = await SettingsModel.find()
      .populate("updatedBy", "name email")
      .sort({ category: 1, key: 1 });

    res.status(200).json({
      error: false,
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching all settings:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch settings",
    });
  }
};

/**
 * Update a setting (Admin)
 * @route PUT /api/settings/admin/:key
 */
export const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { description, isActive, category } = req.body;
    const adminId = req.user?.id || req.user;

    // Enforce fixed GST settings (ignore admin-provided values)
    if (key === "taxSettings") {
      req.body.value = FIXED_TAX_SETTINGS;
    }

    // Enforce free-shipping business rule (ignore paid-shipping values).
    if (key === "shippingSettings") {
      req.body.value = {
        ...(req.body.value || {}),
        freeShippingEnabled: true,
        freeShippingThreshold: 0,
        standardShippingCost: 0,
        expressShippingCost: 0,
      };
    }

    if (req.body.value === undefined) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Value is required",
      });
    }

    // Enforce offer popup coupon validation (must match an existing coupon)
    if (key === "offerCouponCode") {
      const normalizedCode =
        typeof req.body.value === "string"
          ? req.body.value.trim().toUpperCase()
          : "";

      if (normalizedCode) {
        const couponExists = await CouponModel.exists({
          code: normalizedCode,
        });

        if (!couponExists) {
          return res.status(400).json({
            error: true,
            success: false,
            message:
              "Offer coupon code must match an existing coupon. Please create the coupon first.",
          });
        }
      }

      req.body.value = normalizedCode;
    }

    const updateData = {
      value: req.body.value,
      updatedBy: adminId,
    };

    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (category !== undefined) updateData.category = category;

    // Use upsert to create if not exists
    const setting = await SettingsModel.findOneAndUpdate(
      { key },
      {
        $set: updateData,
        $setOnInsert: { key, category: category || "checkout" },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    ).populate("updatedBy", "name email");

    debugLog(`✓ Setting "${key}" updated/created by admin`);

    res.status(200).json({
      error: false,
      success: true,
      message: "Setting updated successfully",
      data: setting,
    });
  } catch (error) {
    console.error("Error updating setting:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update setting",
    });
  }
};

/**
 * Create a new setting (Admin)
 * @route POST /api/settings/admin/create
 */
export const createSetting = async (req, res) => {
  try {
    const { key, value, description, category } = req.body;
    const adminId = req.user?.id || req.user;

    if (!key || value === undefined) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Key and value are required",
      });
    }

    // Check if setting already exists
    const existing = await SettingsModel.findOne({ key });
    if (existing) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Setting with this key already exists",
      });
    }

    const setting = new SettingsModel({
      key,
      value,
      description: description || "",
      category: category || "general",
      updatedBy: adminId,
    });

    await setting.save();

    debugLog(`✓ Setting "${key}" created by admin`);

    res.status(201).json({
      error: false,
      success: true,
      message: "Setting created successfully",
      data: setting,
    });
  } catch (error) {
    console.error("Error creating setting:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create setting",
    });
  }
};

/**
 * Delete a setting (Admin)
 * @route DELETE /api/settings/admin/:key
 */
export const deleteSetting = async (req, res) => {
  try {
    const { key } = req.params;

    // Prevent deletion of core settings
    const protectedKeys = [
      "highTrafficNotice",
      "paymentGatewayEnabled",
      "maintenanceMode",
      "shippingSettings",
      "taxSettings",
      "orderSettings",
      "storeInfo",
      "discountSettings",
    ];
    if (protectedKeys.includes(key)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Cannot delete core settings. You can disable them instead.",
      });
    }

    const setting = await SettingsModel.findOneAndDelete({ key });

    if (!setting) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Setting not found",
      });
    }

    debugLog(`✓ Setting "${key}" deleted`);

    res.status(200).json({
      error: false,
      success: true,
      message: "Setting deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting setting:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete setting",
    });
  }
};

/**
 * Initialize default settings (called on server start)
 */
export const initializeSettings = async () => {
  try {
    await SettingsModel.initializeDefaults();
    debugLog("✓ Default settings initialized");
  } catch (error) {
    console.error("Error initializing settings:", error);
  }
};
