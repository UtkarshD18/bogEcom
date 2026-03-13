import mongoose from "mongoose";

const frequentlyBoughtTogetherSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    relatedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    frequencyScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    confidenceScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    pairCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    orderCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

frequentlyBoughtTogetherSchema.index(
  { productId: 1, relatedProductId: 1 },
  { unique: true },
);
frequentlyBoughtTogetherSchema.index({ frequencyScore: -1, confidenceScore: -1 });

const FrequentlyBoughtTogetherModel = mongoose.model(
  "FrequentlyBoughtTogether",
  frequentlyBoughtTogetherSchema,
);

export default FrequentlyBoughtTogetherModel;
