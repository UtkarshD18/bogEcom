import mongoose from "mongoose";

const DEFAULT_FLAVOUR_BUTTON_SETTINGS = [
  {
    key: "flavour_button_1_text",
    value: "Creamy",
    description: "Homepage flavour button 1 text",
    category: "display",
  },
  {
    key: "flavour_button_1_bg_color",
    value: "#F6E6C9",
    description: "Homepage flavour button 1 background color",
    category: "display",
  },
  {
    key: "flavour_button_1_text_color",
    value: "#6B4F2A",
    description: "Homepage flavour button 1 text color",
    category: "display",
  },
  {
    key: "flavour_button_2_text",
    value: "Chocolate",
    description: "Homepage flavour button 2 text",
    category: "display",
  },
  {
    key: "flavour_button_2_bg_color",
    value: "#5A3A2E",
    description: "Homepage flavour button 2 background color",
    category: "display",
  },
  {
    key: "flavour_button_2_text_color",
    value: "#FFFFFF",
    description: "Homepage flavour button 2 text color",
    category: "display",
  },
  {
    key: "flavour_button_3_text",
    value: "Daizu",
    description: "Homepage flavour button 3 text",
    category: "display",
  },
  {
    key: "flavour_button_3_bg_color",
    value: "#8FAE5D",
    description: "Homepage flavour button 3 background color",
    category: "display",
  },
  {
    key: "flavour_button_3_text_color",
    value: "#2F3E1F",
    description: "Homepage flavour button 3 text color",
    category: "display",
  },
  {
    key: "flavour_button_4_text",
    value: "Low-calorie",
    description: "Homepage flavour button 4 text",
    category: "display",
  },
  {
    key: "flavour_button_4_bg_color",
    value: "#CFEFE8",
    description: "Homepage flavour button 4 background color",
    category: "display",
  },
  {
    key: "flavour_button_4_text_color",
    value: "#1F4D46",
    description: "Homepage flavour button 4 text color",
    category: "display",
  },
];

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
      enabled: true,
      message:
        "High traffic — availability may vary. Your order will be processed once confirmed.",
    },
    description: "Show high traffic notice on checkout page",
    category: "checkout",
  },
  {
    key: "paymentGatewayEnabled",
    value: true,
    description: "Enable or disable online payment gateway availability",
    category: "payment",
  },
  {
    key: "defaultPaymentProvider",
    value: "PHONEPE",
    description: "Default online payment provider shown at checkout",
    category: "payment",
  },
  {
    key: "maintenanceMode",
    value: false,
    description: "Put site in maintenance mode",
    category: "general",
  },
  {
    key: "headerSettings",
    value: {
      headerBackgroundColor: "#fffbf5",
    },
    description: "Header appearance settings",
    category: "display",
  },
  ...DEFAULT_FLAVOUR_BUTTON_SETTINGS,
  {
    key: "showOfferPopup",
    value: true,
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
  {
    key: "popupSettings",
    value: {
      title: "Limited Time Offer",
      description: "Discover our latest products and exclusive offers.",
      imageUrl: "",
      redirectType: "custom",
      redirectValue: "",
      startDate: new Date(),
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isActive: false,
      showOncePerSession: false,
      backgroundColor: "#f7f1ef",
      buttonText: "Shop Now",
      couponCode: "",
    },
    description: "Homepage popup configuration",
    category: "display",
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
      enabled: true,
      taxRate: 5, // Centralized GST rate
      taxName: "GST",
      taxIncludedInPrice: true, // Prices are GST-inclusive across the storefront
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
      stackableCoupons: true, // Allow multiple coupons
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
      email: "healthyonegram.com",
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
