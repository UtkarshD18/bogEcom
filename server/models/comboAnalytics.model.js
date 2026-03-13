import mongoose from "mongoose";

const comboAnalyticsSchema = new mongoose.Schema(
  {
    comboId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Combo",
      required: true,
      index: true,
    },
    rangeStart: {
      type: Date,
      default: null,
      index: true,
    },
    rangeEnd: {
      type: Date,
      default: null,
      index: true,
    },
    bucket: {
      type: String,
      default: "",
      index: true,
    },
    impressions: {
      type: Number,
      default: 0,
      min: 0,
    },
    clicks: {
      type: Number,
      default: 0,
      min: 0,
    },
    addToCart: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchases: {
      type: Number,
      default: 0,
      min: 0,
    },
    revenue: {
      type: Number,
      default: 0,
      min: 0,
    },
    conversionRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    aovImpact: {
      type: Number,
      default: 0,
    },
    lastUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

comboAnalyticsSchema.index({ comboId: 1, bucket: 1 }, { unique: false });
comboAnalyticsSchema.index({ rangeStart: 1, rangeEnd: 1 });

const ComboAnalyticsModel = mongoose.model("ComboAnalytics", comboAnalyticsSchema);

export default ComboAnalyticsModel;
