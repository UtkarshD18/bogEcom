import mongoose from "mongoose";

const membershipUserSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    expiryDate: {
      type: Date,
      required: true,
      index: true,
    },
    pointsBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    isManuallyExtended: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

membershipUserSchema.index({ status: 1, expiryDate: 1 });
membershipUserSchema.index({ createdAt: -1 });

const MembershipUserModel = mongoose.model(
  "MembershipUser",
  membershipUserSchema,
);

export default MembershipUserModel;
