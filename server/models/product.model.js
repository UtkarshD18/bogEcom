import mongoose from "mongoose";

/**
 * Product Model
 *
 * Production-ready product schema with support for:
 * - Multiple images
 * - Variants (size, color, etc.)
 * - Inventory management
 * - Reviews and ratings
 * - SEO optimization
 * - Discounts and pricing
 */

// Review sub-schema
const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      default: "",
      maxLength: 100,
    },
    comment: {
      type: String,
      required: true,
      maxLength: 1000,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
    images: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

// Variant sub-schema for product variations
const variantSchema = new mongoose.Schema({
  name: {
    type: String, // e.g., "250g", "500g", "Red", "Blue"
    required: true,
  },
  sku: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  originalPrice: {
    type: Number,
  },
  stock: {
    type: Number,
    default: 0,
  },
  image: {
    type: String,
    default: "",
  },
  attributes: {
    type: Map,
    of: String, // { "size": "500g", "color": "red" }
    default: {},
  },
});

// Main Product Schema
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxLength: [200, "Product name cannot exceed 200 characters"],
      index: true,
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
      maxLength: [5000, "Description cannot exceed 5000 characters"],
    },
    shortDescription: {
      type: String,
      default: "",
      maxLength: [500, "Short description cannot exceed 500 characters"],
    },
    brand: {
      type: String,
      default: "Buy One Gram",
      trim: true,
      index: true,
    },

    // Pricing
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    originalPrice: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Images
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 10;
        },
        message: "Cannot have more than 10 images",
      },
    },
    thumbnail: {
      type: String,
      default: "",
    },

    // Categories
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Product category is required"],
      index: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    // Inventory
    sku: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    barcode: {
      type: String,
      default: "",
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
    trackInventory: {
      type: Boolean,
      default: true,
    },

    // Variants
    hasVariants: {
      type: Boolean,
      default: false,
    },
    variants: {
      type: [variantSchema],
      default: [],
    },
    variantType: {
      type: String, // "size", "color", "weight", etc.
      default: "",
    },

    // Physical attributes
    weight: {
      type: Number, // in grams
      default: 0,
    },
    dimensions: {
      length: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
    unit: {
      type: String,
      default: "piece", // piece, kg, g, ml, l, etc.
    },

    // Status flags
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isNewArrival: {
      type: Boolean,
      default: false,
    },
    isBestSeller: {
      type: Boolean,
      default: false,
    },
    isOnSale: {
      type: Boolean,
      default: false,
    },

    // Reviews
    reviews: {
      type: [reviewSchema],
      default: [],
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    numReviews: {
      type: Number,
      default: 0,
    },

    // Tags for search
    tags: {
      type: [String],
      default: [],
      index: true,
    },

    // SEO
    metaTitle: {
      type: String,
      default: "",
      maxLength: 70,
    },
    metaDescription: {
      type: String,
      default: "",
      maxLength: 160,
    },
    metaKeywords: {
      type: [String],
      default: [],
    },

    // Analytics
    viewCount: {
      type: Number,
      default: 0,
    },
    soldCount: {
      type: Number,
      default: 0,
    },

    // Additional info
    specifications: {
      type: Map,
      of: String,
      default: {},
    },
    ingredients: {
      type: String,
      default: "",
    },
    nutritionalInfo: {
      type: Map,
      of: String,
      default: {},
    },

    // Shipping
    freeShipping: {
      type: Boolean,
      default: false,
    },
    shippingCost: {
      type: Number,
      default: 0,
    },

    // Dates
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    saleStartDate: {
      type: Date,
      default: null,
    },
    saleEndDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual for in-stock status
productSchema.virtual("inStock").get(function () {
  if (this.hasVariants && this.variants.length > 0) {
    return this.variants.some((v) => v.stock > 0);
  }
  return this.stock > 0;
});

// Virtual for calculated discount percentage
productSchema.virtual("discountPercentage").get(function () {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(
      ((this.originalPrice - this.price) / this.originalPrice) * 100,
    );
  }
  return this.discount || 0;
});

// Virtual for main image
productSchema.virtual("image").get(function () {
  return this.thumbnail || this.images[0] || "/product_placeholder.png";
});

// Pre-save middleware
productSchema.pre("save", async function () {
  // Generate slug from name
  if (this.isModified("name") && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  // Auto-generate SKU if not provided
  if (!this.sku) {
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.sku = `BOG-${randomPart}`;
  }

  // Calculate discount if original price exists
  if (this.originalPrice && this.originalPrice > this.price) {
    this.discount = Math.round(
      ((this.originalPrice - this.price) / this.originalPrice) * 100,
    );
    this.isOnSale = true;
  }

  // Set thumbnail if not provided
  if (!this.thumbnail && this.images.length > 0) {
    this.thumbnail = this.images[0];
  }
});

// Calculate average rating
productSchema.methods.calculateAverageRating = function () {
  if (this.reviews.length === 0) {
    this.rating = 0;
    this.numReviews = 0;
  } else {
    const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    this.rating = Math.round((sum / this.reviews.length) * 10) / 10;
    this.numReviews = this.reviews.length;
  }
  return this.save();
};

// Text search index
productSchema.index({
  name: "text",
  description: "text",
  brand: "text",
  tags: "text",
});

// Compound indexes for common queries
productSchema.index({ category: 1, isActive: 1, price: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ soldCount: -1 });
productSchema.index({ rating: -1 });

const ProductModel = mongoose.model("Product", productSchema);
export default ProductModel;
