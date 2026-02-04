import mongoose from "mongoose";

/**
 * Settings Schema
 * Stores site-wide configuration settings manageable by admin
 * Uses a key-value structure for flexibility
 */
const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      enum: ["general", "checkout", "payment", "notification", "display"],
      default: "general",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Default settings that should exist
settingsSchema.statics.defaultSettings = [
  {
    key: "highTrafficNotice",
    value: {
      enabled: false,
      message:
        "High traffic — availability may vary. Your order will be processed once confirmed.",
    },
    description: "Show high traffic notice on checkout page",
    category: "checkout",
  },
  {
    key: "paymentGatewayEnabled",
    value: false,
    description: "Enable/disable payment gateway (PhonePe)",
    category: "payment",
  },
  {
    key: "maintenanceMode",
    value: false,
    description: "Put site in maintenance mode",
    category: "general",
  },
  {
    key: "showOfferPopup",
    value: false,
    description: "Show offer popup to guests/users",
    category: "notification",
  },
  {
    key: "offerCouponCode",
    value: "",
    description: "Coupon code to display in offer popup",
    category: "notification",
  },
  {
    key: "offerTitle",
    value: "Special Offer!",
    description: "Title for offer popup",
    category: "notification",
  },
  {
    key: "offerDescription",
    value: "Use this code to get a discount on your order!",
    description: "Description for offer popup",
    category: "notification",
  },
  {
    key: "offerDiscountText",
    value: "Get Discount",
    description: "Discount text for offer popup header",
    category: "notification",
  },
  // ========== SHIPPING SETTINGS ==========
  {
    key: "shippingSettings",
    value: {
      freeShippingThreshold: 500,
      standardShippingCost: 50,
      expressShippingCost: 100,
      freeShippingEnabled: true,
      estimatedDelivery: {
        standard: "5-7 business days",
        express: "2-3 business days",
      },
    },
    description: "Shipping charges and free shipping threshold",
    category: "checkout",
  },
  // ========== TAX SETTINGS ==========
  {
    key: "taxSettings",
    value: {
      enabled: false,
      taxRate: 0, // Percentage (e.g., 18 for 18% GST)
      taxName: "GST",
      taxIncludedInPrice: true, // If true, prices shown include tax
    },
    description: "Tax/GST configuration",
    category: "checkout",
  },
  // ========== ORDER SETTINGS ==========
  {
    key: "orderSettings",
    value: {
      minimumOrderValue: 0,
      maximumOrderValue: 50000,
      maxItemsPerOrder: 20,
      codEnabled: false, // Cash on Delivery
      codMinOrder: 200,
      codMaxOrder: 5000,
    },
    description: "Order limits and COD settings",
    category: "checkout",
  },
  // ========== DISCOUNT SETTINGS ==========
  {
    key: "discountSettings",
    value: {
      maxDiscountPercentage: 50, // Maximum discount allowed
      stackableCoupons: false, // Allow multiple coupons
      firstOrderDiscount: {
        enabled: true,
        percentage: 10,
        maxDiscount: 100,
      },
    },
    description: "Discount and coupon configuration",
    category: "checkout",
  },
  // ========== STORE INFO ==========
  {
    key: "storeInfo",
    value: {
      name: "BuyOneGram",
      email: "support@buyonegram.com",
      phone: "+91 9876541234",
      address: "Sitapura Industrial Area, Jaipur, Rajasthan 302019",
      gstNumber: "",
      currency: "INR",
      currencySymbol: "₹",
    },
    description: "Store contact and business information",
    category: "general",
  },
];

// Initialize default settings if they don't exist
settingsSchema.statics.initializeDefaults = async function () {
  for (const setting of this.defaultSettings) {
    await this.findOneAndUpdate(
      { key: setting.key },
      { $setOnInsert: setting },
      { upsert: true, new: true },
    );
  }
};

const SettingsModel = mongoose.model("Settings", settingsSchema);

export default SettingsModel;
