import mongoose from "mongoose";

const comboDraftItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
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
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: false },
);

const comboDraftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
      trim: true,
      maxLength: 200,
      index: true,
    },
    pairKey: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    productsIncluded: {
      type: [comboDraftItemSchema],
      default: [],
    },
    itemsSnapshot: {
      type: Array,
      default: [],
    },
    originalTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    suggestedPrice: {
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
    pricingType: {
      type: String,
      default: "percent_discount",
    },
    pricingValue: {
      type: Number,
      default: 0,
    },
    aiScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["draft", "approved", "rejected"],
      default: "draft",
      index: true,
    },
    generatedFrom: {
      type: String,
      default: "order_history",
    },
    source: {
      type: String,
      default: "ai",
    },
    comboId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Combo",
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

comboDraftSchema.index({ aiScore: -1, updatedAt: -1 });

const ComboDraftModel = mongoose.model(
  "ComboDraft",
  comboDraftSchema,
  "combo_drafts",
);

export default ComboDraftModel;
