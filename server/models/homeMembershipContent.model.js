import mongoose from "mongoose";

/**
 * HomeMembershipContent Schema
 * Stores the Home page membership section content - fully editable by admin
 * Separate from MembershipPage (the dedicated /membership landing page)
 */
const homeMembershipContentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "Join Our Buy One Gram Club",
    },
    subtitle: {
      type: String,
      default:
        "Unlock premium benefits, exclusive savings, and prioritize your health journey with us.",
    },
    benefits: [
      {
        emoji: { type: String, default: "💰" },
        title: { type: String, default: "Save ₹2000+" },
        description: { type: String, default: "Annually with discounts" },
      },
    ],
    checkItems: [
      {
        text: { type: String, default: "" },
      },
    ],
    ctaButtonText: {
      type: String,
      default: "Explore Plans",
    },
    ctaButtonLink: {
      type: String,
      default: "/membership",
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

homeMembershipContentSchema.statics.getDefaultContent = function () {
  return {
    title: "Join Our Buy One Gram Club",
    subtitle:
      "Unlock premium benefits, exclusive savings, and prioritize your health journey with us.",
    benefits: [
      {
        emoji: "💰",
        title: "Save ₹2000+",
        description: "Annually with discounts",
      },
      {
        emoji: "📦",
        title: "Free Shipping",
        description: "On all your orders",
      },
      {
        emoji: "🎧",
        title: "24/7 Support",
        description: "Dedicated member hotline",
      },
      {
        emoji: "🚀",
        title: "Early Access",
        description: "To new product launches",
      },
    ],
    checkItems: [
      { text: "15% discount on all orders" },
      { text: "Free shipping on every purchase" },
      { text: "Exclusive member-only products" },
      { text: "Priority customer support" },
      { text: "Monthly wellness tips & guides" },
    ],
    ctaButtonText: "Explore Plans",
    ctaButtonLink: "/membership",
  };
};

const HomeMembershipContentModel = mongoose.model(
  "HomeMembershipContent",
  homeMembershipContentSchema,
);

export default HomeMembershipContentModel;
