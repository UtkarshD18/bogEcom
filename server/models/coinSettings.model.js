import mongoose from "mongoose";

const coinSettingsSchema = new mongoose.Schema(
  {
    coinsPerRupee: {
      type: Number,
      required: true,
      default: 0.05,
      min: 0,
    },
    redeemRate: {
      type: Number,
      required: true,
      default: 0.1,
      min: 0,
    },
    maxRedeemPercentage: {
      type: Number,
      required: true,
      default: 20,
      min: 0,
      max: 100,
    },
    expiryDays: {
      type: Number,
      required: true,
      default: 365,
      min: 1,
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

coinSettingsSchema.index({ isDefault: 1 }, { unique: true });

const CoinSettingsModel = mongoose.model("CoinSettings", coinSettingsSchema);

export default CoinSettingsModel;
