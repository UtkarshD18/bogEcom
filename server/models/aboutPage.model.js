import mongoose from "mongoose";

/**
 * AboutPage Schema
 * Stores the About Us page content - fully editable by admin
 */
const aboutPageSchema = new mongoose.Schema(
  {
    theme: {
      style: {
        type: String,
        default: "mint",
      },
      layout: {
        type: String,
        default: "glass",
      },
    },
    sections: {
      hero: { type: Boolean, default: true },
      standard: { type: Boolean, default: true },
      whyUs: { type: Boolean, default: true },
      values: { type: Boolean, default: true },
      cta: { type: Boolean, default: true },
    },
    // Hero Section
    hero: {
      badge: {
        type: String,
        default: "About Us",
      },
      title: {
        type: String,
        default: "Nutrition without the",
      },
      titleHighlight: {
        type: String,
        default: "noise.",
      },
      description: {
        type: String,
        default:
          "We built Buy One Gram to answer a simple question: Why is it so hard to find peanut butter that is exactly what it says it is? No palm oil, no hidden sugars—just pure, verified nutrition.",
      },
      image: {
        type: String,
        default: "",
      },
    },

    // Our Standard Section
    standard: {
      subtitle: {
        type: String,
        default: "Our Standard",
      },
      title: {
        type: String,
        default: 'The "One Gram" Philosophy.',
      },
      description: {
        type: String,
        default:
          "The peanut butter industry is crowded with misleading labels. We prefer transparency. Buy One Gram was founded to bridge the gap between premium ingredients and everyday nutrition. We source peanuts based on quality, not cost.",
      },
      image: {
        type: String,
        default: "",
      },
      stats: [
        {
          value: { type: String },
          label: { type: String },
        },
      ],
    },

    // Why Us Section
    whyUs: {
      subtitle: {
        type: String,
        default: "Why Choose Us",
      },
      title: {
        type: String,
        default: "What Sets Us Apart",
      },
      features: [
        {
          icon: { type: String },
          title: { type: String },
          description: { type: String },
        },
      ],
    },

    // Values Section
    values: {
      subtitle: {
        type: String,
        default: "Our Values",
      },
      title: {
        type: String,
        default: "What We Stand For",
      },
      items: [
        {
          title: { type: String },
          description: { type: String },
        },
      ],
    },

    // CTA Section
    cta: {
      title: {
        type: String,
        default: "Ready to taste the difference?",
      },
      description: {
        type: String,
        default:
          "Join thousands of health-conscious customers who trust Buy One Gram for their daily nutrition.",
      },
      buttonText: {
        type: String,
        default: "Shop Now",
      },
      buttonLink: {
        type: String,
        default: "/products",
      },
    },

    // Metadata
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

// Static method to get default content
aboutPageSchema.statics.getDefaultContent = function () {
  return {
    theme: { style: "mint", layout: "glass" },
    sections: {
      hero: true,
      standard: true,
      whyUs: true,
      values: true,
      cta: true,
    },
    hero: {
      badge: "About Us",
      title: "Nutrition without the",
      titleHighlight: "noise.",
      description:
        "We built Buy One Gram to answer a simple question: Why is it so hard to find peanut butter that is exactly what it says it is? No palm oil, no hidden sugars—just pure, verified nutrition.",
      image: "",
    },
    standard: {
      subtitle: "Our Standard",
      title: 'The "One Gram" Philosophy.',
      description:
        "The peanut butter industry is crowded with misleading labels. We prefer transparency. Buy One Gram was founded to bridge the gap between premium ingredients and everyday nutrition. We source peanuts based on quality, not cost.",
      image: "",
      stats: [
        { value: "100%", label: "Roasted Peanuts" },
        { value: "0g", label: "Added Sugar" },
        { value: "No", label: "Palm Oil" },
        { value: "Lab", label: "Tested Quality" },
      ],
    },
    whyUs: {
      subtitle: "Why Choose Us",
      title: "What Sets Us Apart",
      features: [
        {
          icon: "🥜",
          title: "Premium Sourcing",
          description: "Hand-selected peanuts from trusted farms",
        },
        {
          icon: "🔬",
          title: "Lab Tested",
          description: "Every batch verified for quality and safety",
        },
        {
          icon: "🌿",
          title: "Clean Ingredients",
          description: "No additives, preservatives, or hidden sugars",
        },
        {
          icon: "📦",
          title: "Fresh Delivery",
          description: "Made fresh and shipped directly to you",
        },
      ],
    },
    values: {
      subtitle: "Our Values",
      title: "What We Stand For",
      items: [
        {
          title: "Transparency",
          description:
            "We believe you deserve to know exactly what's in your food.",
        },
        {
          title: "Quality",
          description: "We never compromise on ingredients or processes.",
        },
        {
          title: "Health",
          description: "Your wellness is at the heart of everything we do.",
        },
      ],
    },
    cta: {
      title: "Ready to taste the difference?",
      description:
        "Join thousands of health-conscious customers who trust Buy One Gram for their daily nutrition.",
      buttonText: "Shop Now",
      buttonLink: "/products",
    },
  };
};

const AboutPageModel = mongoose.model("AboutPage", aboutPageSchema);

export default AboutPageModel;
