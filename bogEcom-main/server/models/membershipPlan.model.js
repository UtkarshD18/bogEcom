import mongoose from "mongoose";

/**
 * Membership Plan Model
 *
 * Admin-controlled membership plans with pricing and benefits
 */

const membershipPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: 0,
    },
    originalPrice: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number,
      required: true,
      default: 365, // Days
    },
    durationUnit: {
      type: String,
      enum: ["days", "months", "years"],
      default: "days",
    },
    benefits: {
      type: [String],
      default: [],
    },
    pointsMultiplier: {
      type: Number,
      default: 1, // 1x points, 2x for premium, etc.
    },
    freeShippingThreshold: {
      type: Number,
      default: 500,
    },
    discountPercent: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Ensure only one active plan at a time
membershipPlanSchema.pre("save", async function () {
  if (this.isActive) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { isActive: false },
    );
  }
});

const MembershipPlanModel = mongoose.model(
  "MembershipPlan",
  membershipPlanSchema,
);
export default MembershipPlanModel;
