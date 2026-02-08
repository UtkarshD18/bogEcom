import mongoose from "mongoose";

/**
 * BlogPage Schema
 * Stores the Blogs landing page configuration (theme/layout/visibility) - editable by admin
 */
const blogPageSchema = new mongoose.Schema(
  {
    theme: {
      style: {
        type: String,
        default: "mint",
      },
      layout: {
        type: String,
        default: "magazine",
      },
    },
    sections: {
      hero: { type: Boolean, default: true },
      featured: { type: Boolean, default: true },
      grid: { type: Boolean, default: true },
      newsletter: { type: Boolean, default: true },
    },
    hero: {
      badge: {
        type: String,
        default: "Health & Wellness Insights",
      },
      title: {
        type: String,
        default: "The Journal",
      },
      description: {
        type: String,
        default:
          "Expert insights on nutrition, wellness, and the science behind healthy living. No fluff, just evidence-backed guidance.",
      },
    },
    newsletter: {
      title: {
        type: String,
        default: "Don't Miss Our Latest Articles",
      },
      description: {
        type: String,
        default:
          "Subscribe to get weekly insights, wellness tips, and exclusive health recommendations delivered to your inbox.",
      },
      inputPlaceholder: {
        type: String,
        default: "Enter your email address",
      },
      buttonText: {
        type: String,
        default: "Subscribe",
      },
      note: {
        type: String,
        default: "We respect your privacy. Unsubscribe at any time.",
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

blogPageSchema.statics.getDefaultContent = function () {
  return {
    theme: { style: "mint", layout: "magazine" },
    sections: {
      hero: true,
      featured: true,
      grid: true,
      newsletter: true,
    },
    hero: {
      badge: "Health & Wellness Insights",
      title: "The Journal",
      description:
        "Expert insights on nutrition, wellness, and the science behind healthy living. No fluff, just evidence-backed guidance.",
    },
    newsletter: {
      title: "Don't Miss Our Latest Articles",
      description:
        "Subscribe to get weekly insights, wellness tips, and exclusive health recommendations delivered to your inbox.",
      inputPlaceholder: "Enter your email address",
      buttonText: "Subscribe",
      note: "We respect your privacy. Unsubscribe at any time.",
    },
  };
};

const BlogPageModel = mongoose.model("BlogPage", blogPageSchema);

export default BlogPageModel;

