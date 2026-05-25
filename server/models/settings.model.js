import mongoose from "mongoose";
import { DEFAULT_REVIEW_SETTINGS } from "../constants/reviewSettings.js";

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

const DEFAULT_HOMEPAGE_TRUST_SETTINGS = [
  {
    key: "homepage_trust_1_text",
    value: "100% Natural",
    description: "Homepage trust pill 1 text",
    category: "display",
  },
  {
    key: "homepage_trust_2_text",
    value: "No Palm Oil",
    description: "Homepage trust pill 2 text",
    category: "display",
  },
  {
    key: "homepage_trust_3_text",
    value: "High Protein",
    description: "Homepage trust pill 3 text",
    category: "display",
  },
  {
    key: "homepage_trust_4_text",
    value: "Fast Moving Picks",
    description: "Homepage trust pill 4 text",
    category: "display",
  },
];

const createSeoPageDefaults = ({
  label,
  path,
  metaTitle,
  metaDescription,
  keywords,
  indexable,
  notes,
  heroTitle = "",
  heroSubtitle = "",
  heroImageUrl = "",
  heroImageAlt = "",
  ctaLabel = "Explore Products",
  ctaHref = "/products",
  bodySections = [],
  faqItems = [],
}) => ({
  label,
  path,
  metaTitle,
  metaDescription,
  keywords,
  indexable,
  notes,
  heroTitle,
  heroSubtitle,
  heroImageUrl,
  heroImageAlt,
  ctaLabel,
  ctaHref,
  bodySections,
  faqItems,
});

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
    key: "maintenanceSettings",
    value: {
      maintenanceEnabled: false,
      maintenanceStartTime: null,
      maintenanceEndTime: null,
      maintenanceMessage:
        "We are currently undergoing scheduled maintenance. Please check back soon.",
      showCountdown: true,
    },
    description: "Maintenance mode scheduling and display settings",
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
  ...DEFAULT_HOMEPAGE_TRUST_SETTINGS,
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
    key: "offerCountdownSettings",
    value: {
      enabled: false,
      title: "Limited time offer",
      subtitle: "Fresh deals are live now.",
      couponCode: "",
      discountText: "",
      endsAt: null,
      ctaLabel: "Shop offers",
      ctaHref: "/products",
    },
    description: "Homepage offer countdown strip configuration",
    category: "notification",
  },
  {
    key: "homeSlidePanelSettings",
    value: {
      enabled: true,
      minimizeEnabled: true,
      minimizedLabel: "Show details",
      restoreAfterSeconds: 60,
    },
    description: "Homepage hero slide detail panel behavior",
    category: "display",
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
      orderSeriesPrefix: "H1G",
      orderSeriesPadding: 4,
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
  {
    key: "seoSettings",
    value: {
      pages: [
        createSeoPageDefaults({
          label: "Home",
          path: "/",
          metaTitle: "Buy OneGram - Premium Health Products",
          metaDescription:
            "Shop premium quality peanut butter and healthy food products at Buy OneGram.",
          keywords:
            "peanut butter, healthy food, organic, natural, protein",
          indexable: true,
          notes: "Main homepage SEO entry.",
          heroTitle: "Premium health products for everyday wellness",
          heroSubtitle:
            "Discover healthy pantry staples, better ingredients, and practical nutrition-first choices from Buy OneGram.",
          ctaLabel: "Browse Products",
          ctaHref: "/products",
          bodySections: [
            {
              heading: "Why customers choose Buy OneGram",
              content:
                "We focus on ingredient clarity, satisfying everyday flavor, and products that fit into practical routines. Our catalog is built for repeat use, not one-time trends.",
            },
          ],
        }),
        createSeoPageDefaults({
          label: "Products",
          path: "/products",
          metaTitle: "Healthy Products | Buy OneGram",
          metaDescription:
            "Browse healthy pantry essentials, protein-rich snacks, and wellness products from Buy OneGram.",
          keywords:
            "healthy products, peanut butter, snacks, protein, wellness",
          indexable: true,
          notes: "Catalog landing page.",
          heroTitle: "Healthy pantry essentials built for repeat buying",
          heroSubtitle:
            "Shop a product range designed for simple daily routines, better ingredients, and practical wellness habits.",
          ctaLabel: "Shop the Catalog",
          ctaHref: "/products",
        }),
        createSeoPageDefaults({
          label: "Blogs",
          path: "/blogs",
          metaTitle: "Wellness Blog | Buy OneGram",
          metaDescription:
            "Read nutrition tips, healthy eating guides, and product advice from Buy OneGram.",
          keywords: "health blog, nutrition tips, wellness, healthy eating",
          indexable: true,
          notes: "Content hub for search traffic.",
          heroTitle: "Practical wellness reads and nutrition guidance",
          heroSubtitle:
            "Explore health articles, ingredient explainers, and snack ideas that support daily routines.",
          ctaLabel: "Read Articles",
          ctaHref: "/blogs",
        }),
        createSeoPageDefaults({
          label: "About",
          path: "/about",
          metaTitle: "About Buy OneGram",
          metaDescription:
            "Learn more about Buy OneGram, our story, and the healthy products we build for everyday use.",
          keywords: "about buy onegram, healthy brand, peanut butter store",
          indexable: true,
          notes: "Brand story page.",
          ctaLabel: "Explore Products",
          ctaHref: "/products",
        }),
        createSeoPageDefaults({
          label: "Membership",
          path: "/membership",
          metaTitle: "Membership Benefits | Buy OneGram",
          metaDescription:
            "Unlock premium membership benefits, savings, and rewards with Buy OneGram.",
          keywords:
            "membership benefits, rewards, savings, healthy products",
          indexable: true,
          notes: "Membership landing page.",
          ctaLabel: "View Membership",
          ctaHref: "/membership",
        }),
        createSeoPageDefaults({
          label: "Healthy Peanut Butter Guide",
          path: "/healthy-peanut-butter-guide",
          metaTitle: "Healthy Peanut Butter Guide | Buy OneGram",
          metaDescription:
            "Explore how to choose healthy peanut butter, simple snack ideas, and ingredient tips from Buy OneGram.",
          keywords:
            "healthy peanut butter, snack ideas, ingredient tips, wellness guide",
          indexable: true,
          notes: "SEO guide page.",
          heroTitle: "How to choose healthy peanut butter with confidence",
          heroSubtitle:
            "Use this guide to compare ingredients, understand common labels, and find practical snack ideas for everyday use.",
          ctaLabel: "Explore Peanut Butter",
          ctaHref: "/products",
          faqItems: [
            {
              question: "What ingredients should healthy peanut butter include?",
              answer:
                "The shortest ingredient list is usually the safest starting point. Look for peanuts first, and avoid unnecessary fillers when possible.",
            },
          ],
        }),
        createSeoPageDefaults({
          label: "Login",
          path: "/login",
          metaTitle: "Login | Buy OneGram",
          metaDescription: "Sign in to your Buy OneGram account.",
          keywords: "login, account sign in",
          indexable: false,
          notes: "Usually noindex.",
          ctaLabel: "Go to Login",
          ctaHref: "/login",
        }),
        createSeoPageDefaults({
          label: "Register",
          path: "/register",
          metaTitle: "Register | Buy OneGram",
          metaDescription: "Create your Buy OneGram account.",
          keywords: "register, create account",
          indexable: false,
          notes: "Usually noindex.",
          ctaLabel: "Create Account",
          ctaHref: "/register",
        }),
      ],
      imageAltTexts: [
        {
          label: "Logo",
          target: "/logo.png",
          altText: "Buy OneGram logo",
          titleText: "Buy OneGram",
          notes: "Keep the brand logo alt text short.",
        },
        {
          label: "Homepage banners",
          target: "Homepage hero and promotional sliders",
          altText: "Buy OneGram premium health products banner",
          titleText: "Homepage banner",
          notes: "Use for hero banners and promotional creatives.",
        },
        {
          label: "Product images",
          target: "/product/[id]",
          altText: "Product image",
          titleText: "Product image",
          notes:
            "Prefer descriptive product names in the storefront component.",
        },
        {
          label: "Blog covers",
          target: "/blogs/[slug]",
          altText: "Blog cover image",
          titleText: "Blog image",
          notes: "Pair the blog title with the topic when used dynamically.",
        },
      ],
    },
    description: "SEO page metadata and image alt-text rules",
    category: "general",
  },
  {
    key: "reviewSettings",
    value: {
      ...DEFAULT_REVIEW_SETTINGS,
    },
    description:
      "Storefront review submission and review-action visibility controls",
    category: "display",
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
