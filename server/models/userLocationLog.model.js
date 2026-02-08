import mongoose from "mongoose";

/**
 * UserLocationLog
 *
 * Stores Google Maps derived location data with 90-day retention.
 * This is stored separately from addresses/orders to support analytics/support needs
 * while keeping exposure minimal in normal APIs.
 */
const userLocationLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.ObjectId,
      ref: "order",
      default: null,
      index: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    formattedAddress: {
      type: String,
      default: "",
      trim: true,
    },
    street: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    pincode: {
      type: String,
      default: "",
      trim: true,
    },
    country: {
      type: String,
      default: "India",
      trim: true,
    },
    source: {
      type: String,
      enum: ["manual", "google_maps"],
      default: "manual",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

userLocationLogSchema.index({ orderId: 1, createdAt: -1 });
userLocationLogSchema.index({ userId: 1, createdAt: -1 });
userLocationLogSchema.index({ expiresAt: 1, isArchived: 1 });

const UserLocationLogModel = mongoose.model(
  "UserLocationLog",
  userLocationLogSchema,
);

export default UserLocationLogModel;

