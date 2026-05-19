import mongoose from "mongoose";
import { getLowStockSummaryUpdate } from "../utils/lowStockSummary.js";

/**
 * Product Model
 *
 * Production-ready product schema with support for:
 * - Multiple images
 * - Variants (size, color, etc.)
 * - Inventory management
 * - Reviews and ratings
 * - SEO optimization
 * - Variant-driven pricing
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
    type: String, // e.g., "250g", "500g", "1 Kg"
    required: true,
  },
  sku: {
    type: String,
    required: true,
  },
  hsnCode: {
    type: String,
    default: "",
    trim: true,
    set: (value) =>
      String(value || "")
        .replace(/\D/g, "")
        .slice(0, 6),
  },
  price: {
    type: Number,
    required: true,
  },
  originalPrice: {
    type: Number,
  },
  weight: {
    type: Number, // in grams (e.g. 500, 1000)
    default: 0,
  },
  weightInGrams: {
    type: Number,
    min: [50, "Weight too small (possible typo like 5g instead of 500g)"],
  },
  label: {
    type: String,
    default: "",
    trim: true,
  },
  unit: {
    type: String,
    default: "g", // g, kg, ml, L, pcs
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  stock: {
    type: Number,
    default: 0,
  },
  stock_quantity: {
    type: Number,
    default: function () {
      return typeof this.stock === "number" ? this.stock : 0;
    },
    min: [0, "Stock cannot be negative"],
  },
  reserved_quantity: {
    type: Number,
    default: 0,
    min: [0, "Reserved stock cannot be negative"],
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
    productStory: {
      type: String,
      default: "",
      maxLength: [5000, "Product story cannot exceed 5000 characters"],
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
    videos: {
      type: [String],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 3;
        },
        message: "Cannot have more than 3 product videos",
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
    hsnCode: {
      type: String,
      default: "",
      trim: true,
      set: (value) =>
        String(value || "")
          .replace(/\D/g, "")
          .slice(0, 6),
    },
    barcode: {
      type: String,
      default: "",
    },
    hsnCode: {
      type: String,
      default: "",
      trim: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    stock_quantity: {
      type: Number,
      default: function () {
        return typeof this.stock === "number" ? this.stock : 0;
      },
      min: [0, "Stock cannot be negative"],
    },
    reserved_quantity: {
      type: Number,
      default: 0,
      min: [0, "Reserved stock cannot be negative"],
    },
    availableStock: {
      type: Number,
      default: null,
    },
    isLowStock: {
      type: Boolean,
      default: false,
    },
    lowStockUpdatedAt: {
      type: Date,
      default: null,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
    low_stock_threshold: {
      type: Number,
      default: function () {
        return typeof this.lowStockThreshold === "number"
          ? this.lowStockThreshold
          : 5;
      },
    },
    trackInventory: {
      type: Boolean,
      default: true,
    },
    track_inventory: {
      type: Boolean,
      default: function () {
        return typeof this.trackInventory === "boolean"
          ? this.trackInventory
          : true;
      },
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

    // Demand Status (Admin-controlled, shown to customers instead of stock)
    demandStatus: {
      type: String,
      enum: ["NORMAL", "HIGH"],
      default: "NORMAL",
      index: true,
    },

    // Status flags
    isActive: {
      type: Boolean,
      default: true,
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
    isExclusive: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Reviews
    reviews: {
      type: [reviewSchema],
      default: [],
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
    productPage: {
      type: mongoose.Schema.Types.Mixed,
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
  if (this.track_inventory === false || this.trackInventory === false) {
    return true;
  }
  if (this.hasVariants && this.variants.length > 0) {
    return this.variants.some((v) => {
      const variantStock = Number(v?.stock_quantity ?? v?.stock ?? 0);
      const variantReserved = Number(v?.reserved_quantity ?? 0);
      return variantStock - variantReserved > 0;
    });
  }
  const stock = Number(this.stock_quantity ?? this.stock ?? 0);
  const reserved = Number(this.reserved_quantity ?? 0);
  return stock - reserved > 0;
});

productSchema.virtual("available_quantity").get(function () {
  if (this.track_inventory === false || this.trackInventory === false) {
    return Number.MAX_SAFE_INTEGER;
  }
  if (this.hasVariants && this.variants.length > 0) {
    return this.variants.reduce((sum, variant) => {
      const variantStock = Number(
        variant?.stock_quantity ?? variant?.stock ?? 0,
      );
      const variantReserved = Number(variant?.reserved_quantity ?? 0);
      return sum + Math.max(variantStock - variantReserved, 0);
    }, 0);
  }
  const stock = Number(this.stock_quantity ?? this.stock ?? 0);
  const reserved = Number(this.reserved_quantity ?? 0);
  return Math.max(stock - reserved, 0);
});

// Virtual for calculated discount percentage
productSchema.virtual("discountPercentage").get(function () {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(
      ((this.originalPrice - this.price) / this.originalPrice) * 100,
    );
  }
  return 0;
});

// Virtual for main image
productSchema.virtual("image").get(function () {
  return this.thumbnail || this.images[0] || "/product_placeholder.png";
});

// Pre-validate middleware – runs BEFORE Mongoose checks `required` etc.
// Slug and SKU must be generated here so that validation passes.
productSchema.pre("validate", function () {
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
});

// Pre-save middleware
productSchema.pre("save", async function () {
  // Keep sale flag derived from pricing. Discount percentages are computed at read time.
  if (this.originalPrice && this.originalPrice > this.price) {
    this.isOnSale = true;
  } else {
    this.isOnSale = false;
  }

  // Set thumbnail if not provided
  if (!this.thumbnail && this.images.length > 0) {
    this.thumbnail = this.images[0];
  }

  if (this.stock_quantity == null) {
    this.stock_quantity = typeof this.stock === "number" ? this.stock : 0;
  }
  if (this.stock == null) {
    this.stock =
      typeof this.stock_quantity === "number" ? this.stock_quantity : 0;
  }
  if (this.reserved_quantity == null) {
    this.reserved_quantity = 0;
  }
  if (this.low_stock_threshold == null) {
    this.low_stock_threshold =
      typeof this.lowStockThreshold === "number" ? this.lowStockThreshold : 5;
  }
  if (this.lowStockThreshold == null) {
    this.lowStockThreshold =
      typeof this.low_stock_threshold === "number"
        ? this.low_stock_threshold
        : 10;
  }
  if (this.track_inventory == null) {
    this.track_inventory =
      typeof this.trackInventory === "boolean" ? this.trackInventory : true;
  }
  if (this.trackInventory == null) {
    this.trackInventory =
      typeof this.track_inventory === "boolean" ? this.track_inventory : true;
  }

  if (Array.isArray(this.variants) && this.variants.length > 0) {
    let hasDefault = false;
    for (const variant of this.variants) {
      if (variant.stock_quantity == null) {
        variant.stock_quantity =
          typeof variant.stock === "number" ? variant.stock : 0;
      }
      if (variant.stock == null) {
        variant.stock =
          typeof variant.stock_quantity === "number"
            ? variant.stock_quantity
            : 0;
      }
      if (variant.reserved_quantity == null) {
        variant.reserved_quantity = 0;
      }
      if (variant.isDefault) hasDefault = true;
    }
    // Ensure at least one default variant
    if (!hasDefault && this.variants.length > 0) {
      this.variants[0].isDefault = true;
    }

    // Sync parent stock = sum of variant stocks when variants are enabled
    if (this.hasVariants) {
      const totalVariantStock = this.variants.reduce(
        (sum, v) => sum + Number(v.stock_quantity ?? v.stock ?? 0),
        0,
      );
      const totalVariantReserved = this.variants.reduce(
        (sum, v) => sum + Number(v.reserved_quantity ?? 0),
        0,
      );
      this.stock = totalVariantStock;
      this.stock_quantity = totalVariantStock;
      this.reserved_quantity = totalVariantReserved;
    }
  }

  const lowStockSummaryUpdate = getLowStockSummaryUpdate(this);
  if (lowStockSummaryUpdate?.summary) {
    this.availableStock = lowStockSummaryUpdate.summary.availableStock;
    this.isLowStock = lowStockSummaryUpdate.summary.isLowStock;
    this.lowStockUpdatedAt =
      lowStockSummaryUpdate.update?.$set?.lowStockUpdatedAt || new Date();
  }
});

// Text search index
productSchema.index({
  name: "text",
  description: "text",
  brand: "text",
  tags: "text",
});

// Compound indexes for common queries
productSchema.index({ category: 1, isActive: 1, price: 1 });
productSchema.index({ isActive: 1, updatedAt: -1 });
productSchema.index({ isActive: 1, sku: 1, updatedAt: -1 });
productSchema.index({ isActive: 1, slug: 1, updatedAt: -1 });
productSchema.index({ isActive: 1, tags: 1, updatedAt: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ soldCount: -1 });
productSchema.index({ stock_quantity: 1, reserved_quantity: 1 });
productSchema.index({ track_inventory: 1 });
productSchema.index({ isLowStock: 1 });

const ProductModel = mongoose.model("Product", productSchema);
export default ProductModel;
