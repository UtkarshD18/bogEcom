import mongoose from "mongoose";

export const COMBO_TYPES = [
  "fixed_bundle",
  "mix_match",
  "dynamic",
  "frequently_bought_together",
  "admin_curated",
  "ai_suggested",
];

export const COMBO_TAGS = [
  "best_seller",
  "featured",
  "high_demand",
  "members_exclusive",
  "trending",
  "recommended",
  "festival_deal",
  "limited_offer",
  "clearance_bundle",
  "high_conversion",
];

export const COMBO_PRICING_TYPES = [
  "fixed_price",
  "percent_discount",
  "fixed_discount",
];

export const COMBO_STATUSES = ["draft", "active", "disabled", "scheduled"];

const comboItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    productTitle: {
      type: String,
      default: "",
      trim: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    variantName: {
      type: String,
      default: "",
      trim: true,
    },
    variantSku: {
      type: String,
      default: "",
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    quantityRequired: {
      type: Number,
      default: 1,
      min: 1,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    originalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    image: {
      type: String,
      default: "",
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
  },
  { _id: false },
);

const comboSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Combo name is required"],
      trim: true,
      maxLength: 200,
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
      maxLength: 5000,
    },
    shortDescription: {
      type: String,
      default: "",
      maxLength: 500,
    },
    brand: {
      type: String,
      default: "",
      trim: true,
      maxLength: 120,
    },
    category: {
      type: String,
      default: "",
      trim: true,
      maxLength: 120,
      index: true,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    image: {
      type: String,
      default: "",
    },
    thumbnail: {
      type: String,
      default: "",
    },
    comboImages: {
      type: [String],
      default: [],
      validate: {
        validator: function (value) {
          return Array.isArray(value) ? value.length <= 10 : true;
        },
        message: "Cannot have more than 10 combo images",
      },
    },
    comboThumbnail: {
      type: String,
      default: "",
    },
    sku: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      index: true,
    },
    items: {
      type: [comboItemSchema],
      default: [],
    },
    pricing: {
      type: {
        type: String,
        enum: COMBO_PRICING_TYPES,
        default: "fixed_price",
      },
      value: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    originalTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    comboPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    originalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSavings: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    comboType: {
      type: String,
      enum: COMBO_TYPES,
      default: "fixed_bundle",
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      enum: COMBO_TAGS,
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isVisible: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isBestSeller: {
      type: Boolean,
      default: false,
      index: true,
    },
    isExclusive: {
      type: Boolean,
      default: false,
      index: true,
    },
    demandStatus: {
      type: String,
      enum: ["NORMAL", "HIGH"],
      default: "NORMAL",
      index: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    adminStarRating: {
      type: Number,
      default: function () {
        return typeof this.rating === "number" ? this.rating : 0;
      },
      min: 0,
      max: 5,
    },
    startDate: {
      type: Date,
      default: null,
      index: true,
    },
    endDate: {
      type: Date,
      default: null,
      index: true,
    },
    geoTargets: {
      type: [
        {
          country: { type: String, default: "" },
          state: { type: String, default: "" },
          city: { type: String, default: "" },
          pincode: { type: String, default: "" },
        },
      ],
      default: [],
    },
    stockMode: {
      type: String,
      enum: ["auto", "manual"],
      default: "auto",
      index: true,
    },
    stockQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    minOrderQuantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    maxPerOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    source: {
      type: String,
      enum: ["admin", "ai"],
      default: "admin",
      index: true,
    },
    status: {
      type: String,
      enum: COMBO_STATUSES,
      default: "draft",
      index: true,
    },
    segmentTargets: {
      segments: {
        type: [String],
        default: [],
      },
      categories: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "Category",
        default: [],
      },
    },
    aiScore: {
      type: Number,
      default: 0,
    },
    generatedFrom: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

comboSchema.pre("validate", function () {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name);
  }

  const normalizedImages = Array.isArray(this.comboImages)
    ? this.comboImages.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 10)
    : [];
  this.comboImages = normalizedImages;

  const resolvedThumbnail =
    String(this.comboThumbnail || this.thumbnail || normalizedImages[0] || "").trim();
  this.comboThumbnail = resolvedThumbnail;
  this.thumbnail = resolvedThumbnail;

  const resolvedImage = String(this.image || normalizedImages[0] || resolvedThumbnail || "").trim();
  this.image = resolvedImage;

  this.price = Number(this.comboPrice || 0);
  this.originalPrice = Number(this.originalTotal || this.originalPrice || 0);
  this.reviewCount = Math.max(Number(this.reviewCount || 0), 0);

  if (
    this.isModified("adminStarRating") &&
    typeof this.adminStarRating === "number"
  ) {
    this.rating = this.adminStarRating;
  } else if (this.isModified("rating") && typeof this.rating === "number") {
    this.adminStarRating = this.rating;
  }

  if (Array.isArray(this.items)) {
    this.items = this.items.map((item) => {
      const normalizedQuantity = Math.max(Number(item?.quantity || item?.quantityRequired || 1), 1);
      const normalizedVariantSku = String(item?.variantSku || "").trim().toUpperCase();
      return {
        ...item,
        quantity: normalizedQuantity,
        quantityRequired: normalizedQuantity,
        variantSku: normalizedVariantSku,
      };
    });
  }
});

comboSchema.index({ comboType: 1, priority: -1 });
comboSchema.index({ "items.productId": 1 });
comboSchema.index({ startDate: 1, endDate: 1, isActive: 1, isVisible: 1 });
comboSchema.index({ status: 1, source: 1 });

const ComboModel = mongoose.model("Combo", comboSchema);

export default ComboModel;
export { comboItemSchema };
