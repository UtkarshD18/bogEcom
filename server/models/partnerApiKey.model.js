import mongoose from "mongoose";

const partnerApiKeySchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
      index: true,
    },
    keyPrefix: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    keyHash: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    lastUsedIp: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

partnerApiKeySchema.index({ partnerId: 1, status: 1 });

export default mongoose.model("PartnerApiKey", partnerApiKeySchema);
