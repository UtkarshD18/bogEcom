import mongoose from "mongoose";

const partnerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Partner name is required"],
      trim: true,
      maxlength: 160,
    },
    contactEmail: {
      type: String,
      required: [true, "Partner email is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "paused"],
      default: "active",
      index: true,
    },
    scopes: {
      type: [String],
      default: ["catalog.read", "inventory.read", "price.read"],
    },
    allowedOrigins: {
      type: [String],
      default: [],
    },
    rateLimitPerMinute: {
      type: Number,
      default: 120,
      min: 10,
      max: 5000,
    },
    notes: {
      type: String,
      default: "",
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  },
);

partnerSchema.index({ createdAt: -1 });

export default mongoose.model("Partner", partnerSchema);
