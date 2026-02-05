import mongoose from "mongoose";

/**
 * Coupon Model
 *
 * For discount coupons and promotional codes.
 */
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null, // No limit if null
    },
    usageLimit: {
      type: Number,
      default: null, // Unlimited if null
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1,
    },
    applicableCategories: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Category",
      default: [], // Empty = all categories
    },
    applicableProducts: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Product",
      default: [], // Empty = all products
    },
    excludedProducts: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Product",
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, "Coupon end date is required"],
    },
    usedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "order",
        },
      },
    ],
  },
  { timestamps: true },
);

// Virtual to check if coupon is valid
couponSchema.virtual("isValid").get(function () {
  const now = new Date();
  if (!this.isActive) return false;
  if (now < this.startDate) return false;
  if (now > this.endDate) return false;
  if (this.usageLimit && this.usageCount >= this.usageLimit) return false;
  return true;
});

// Method to check if user can use coupon
couponSchema.methods.canUserUse = function (userId) {
  const userUsage = this.usedBy.filter(
    (u) => u.user.toString() === userId.toString(),
  ).length;
  return userUsage < this.perUserLimit;
};

// Method to calculate discount
couponSchema.methods.calculateDiscount = function (orderAmount) {
  if (orderAmount < this.minOrderAmount) {
    return 0;
  }

  let discount = 0;
  if (this.discountType === "percentage") {
    discount = (orderAmount * this.discountValue) / 100;
    if (this.maxDiscountAmount) {
      discount = Math.min(discount, this.maxDiscountAmount);
    }
  } else {
    discount = this.discountValue;
  }

  return Math.min(discount, orderAmount);
};

couponSchema.index({ code: 1, isActive: 1 });
couponSchema.index({ endDate: 1 });

const CouponModel = mongoose.model("Coupon", couponSchema);
export default CouponModel;
