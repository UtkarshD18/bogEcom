import mongoose from "mongoose";

/**
 * Category Model
 *
 * Production-ready category schema with support for:
 * - Nested categories (parent-child relationship)
 * - SEO-friendly slugs
 * - Image support
 * - Sorting and visibility control
 */
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxLength: [100, "Category name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      maxLength: [500, "Description cannot exceed 500 characters"],
    },
    image: {
      type: String,
      default: "",
    },
    icon: {
      type: String,
      default: "",
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    level: {
      type: Number,
      default: 0, // 0 = root, 1 = subcategory, 2 = sub-subcategory
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    productCount: {
      type: Number,
      default: 0,
    },
    // SEO Fields
    metaTitle: {
      type: String,
      default: "",
      maxLength: [70, "Meta title cannot exceed 70 characters"],
    },
    metaDescription: {
      type: String,
      default: "",
      maxLength: [160, "Meta description cannot exceed 160 characters"],
    },
    metaKeywords: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual for subcategories
categorySchema.virtual("subcategories", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentCategory",
});

// Pre-save middleware to generate slug
categorySchema.pre("save", async function () {
  if (this.isModified("name") && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
});

// Indexes for better query performance
categorySchema.index({ name: "text", description: "text" });
categorySchema.index({ parentCategory: 1, isActive: 1 });
categorySchema.index({ sortOrder: 1 });

const CategoryModel = mongoose.model("Category", categorySchema);
export default CategoryModel;
