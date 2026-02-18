import mongoose from "mongoose";

const coinTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    coins: {
      type: Number,
      required: true,
      min: 0,
    },
    // Remaining balance from this earning transaction (for FIFO redemption).
    remainingCoins: {
      type: Number,
      default: 0,
      min: 0,
    },
    type: {
      type: String,
      enum: ["earn", "redeem", "expire", "bonus"],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["order", "membership", "admin", "system"],
      default: "system",
      index: true,
    },
    referenceId: {
      type: String,
      default: null,
      index: true,
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

coinTransactionSchema.index({ user: 1, createdAt: -1 });
coinTransactionSchema.index({ user: 1, type: 1, source: 1, referenceId: 1 });

const CoinTransactionModel = mongoose.model(
  "CoinTransaction",
  coinTransactionSchema,
);

export default CoinTransactionModel;
