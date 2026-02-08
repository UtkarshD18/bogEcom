import mongoose from "mongoose";

/**
 * MembershipPage Schema
 * Stores the Membership landing page content - fully editable by admin
 */
const membershipPageSchema = new mongoose.Schema(
  {
    theme: {
      style: {
        type: String,
        default: "mint",
      },
    },
    hero: {
      badge: {
        type: String,
        default: "Premium Membership",
      },
      title: {
        type: String,
        default: "Buy One Gram Club",
      },
      titleHighlight: {
        type: String,
        default: "Premium",
      },
      description: {
        type: String,
        default:
          "Join our exclusive community and unlock premium benefits designed for your wellness journey.",
      },
      note: {
        type: String,
        default: "Limited member slots refreshed monthly",
      },
    },
    benefits: {
      title: {
        type: String,
        default: "Unlock Exclusive Benefits",
      },
      subtitle: {
        type: String,
        default:
          "Start earning rewards today and take your health journey to the next level with premium perks.",
      },
      items: [
        {
          icon: { type: String, default: "⭐" },
          title: { type: String, default: "Earn Points" },
          description: {
            type: String,
            default:
              "Get 1 point for every ₹1 spent. Redeem points for discounts and exclusive products.",
          },
        },
      ],
    },
    pricing: {
      title: {
        type: String,
        default: "Simple, honest pricing",
      },
      subtitle: {
        type: String,
        default: "One plan. All benefits. Cancel anytime.",
      },
      ctaText: {
        type: String,
        default: "Join Membership",
      },
      note: {
        type: String,
        default: "Instant access after checkout.",
      },
    },
    cta: {
      title: {
        type: String,
        default: "Ready to upgrade your daily nutrition?",
      },
      description: {
        type: String,
        default:
          "Members get early access, exclusive drops, and a smoother checkout experience.",
      },
      buttonText: {
        type: String,
        default: "Explore Plans",
      },
      buttonLink: {
        type: String,
        default: "/membership",
      },
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

membershipPageSchema.statics.getDefaultContent = function () {
  return {
    theme: { style: "mint" },
    hero: {
      badge: "Premium Membership",
      title: "Buy One Gram Club",
      titleHighlight: "Premium",
      description:
        "Join our exclusive community and unlock premium benefits designed for your wellness journey.",
      note: "Limited member slots refreshed monthly",
    },
    benefits: {
      title: "Unlock Exclusive Benefits",
      subtitle:
        "Start earning rewards today and take your health journey to the next level with premium perks.",
      items: [
        {
          icon: "⭐",
          title: "Earn Points",
          description:
            "Get 1 point for every ₹1 spent. Redeem points for discounts and exclusive products.",
        },
        {
          icon: "🚀",
          title: "Early Access",
          description:
            "Be the first to try our latest products before they're available to the public.",
        },
        {
          icon: "💎",
          title: "Special Discounts",
          description:
            "Enjoy exclusive pricing and promotions available only to our members.",
        },
        {
          icon: "🚚",
          title: "Free Shipping",
          description:
            "Enjoy free shipping on all orders above ₹500. No hidden charges.",
        },
        {
          icon: "🎁",
          title: "Birthday Gifts",
          description:
            "Receive special birthday surprises and exclusive member-only offers monthly.",
        },
        {
          icon: "🛡️",
          title: "VIP Support",
          description:
            "Get priority customer support and personalized recommendations.",
        },
      ],
    },
    pricing: {
      title: "Simple, honest pricing",
      subtitle: "One plan. All benefits. Cancel anytime.",
      ctaText: "Join Membership",
      note: "Instant access after checkout.",
    },
    cta: {
      title: "Ready to upgrade your daily nutrition?",
      description:
        "Members get early access, exclusive drops, and a smoother checkout experience.",
      buttonText: "Explore Plans",
      buttonLink: "/membership",
    },
  };
};

const MembershipPageModel = mongoose.model(
  "MembershipPage",
  membershipPageSchema,
);

export default MembershipPageModel;
