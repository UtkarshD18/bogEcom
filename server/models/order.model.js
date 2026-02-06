import mongoose from "mongoose";

/**
 * Order Schema
 * Stores all order information including payment details
 * Used for checkout flow and order tracking
 */
const orderSchema = new mongoose.Schema(
  {
    // User Reference
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null, // Allow guest checkout
    },

    // Products in Order
    products: [
      {
        productId: {
          type: String,
          required: true,
        },
        productTitle: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        image: {
          type: String,
          default: "",
        },
        subTotal: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    // Payment Information
    paymentId: {
      type: String,
      default: null, // Payment identifier (PhonePe transaction ID)
      // Note: index is defined in compound indexes below
    },

    // Legacy Razorpay fields (kept for historical data)
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },

    razorpaySignature: {
      type: String,
      default: null,
    },

    // PhonePe identifiers
    phonepeMerchantTransactionId: {
      type: String,
      default: null,
      index: true,
    },

    phonepeTransactionId: {
      type: String,
      default: null,
      index: true,
    },

    // Status Tracking
    payment_status: {
      type: String,
      enum: ["pending", "paid", "failed", "unavailable"],
      default: "pending",
      index: true,
    },

    order_status: {
      type: String,
      enum: [
        "pending",
        "pending_payment",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    // Delivery Information
    delivery_address: {
      type: mongoose.Schema.ObjectId,
      ref: "Address",
      default: null,
    },

    // Financial Information
    totalAmt: {
      type: Number,
      required: true,
      min: 0,
    },

    // Optional Fields
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    tax: {
      type: Number,
      default: 0,
      min: 0,
    },

    shipping: {
      type: Number,
      default: 0,
      min: 0,
    },

    notes: {
      type: String,
      default: "",
    },

    // ==================== NEW FIELDS FOR PHONEPE INTEGRATION ====================

    // Payment method tracking
    paymentMethod: {
      type: String,
      enum: ["RAZORPAY", "PHONEPE", "COD", "PENDING"],
      default: "PENDING",
    },

    // Coupon/Discount tracking
    couponCode: {
      type: String,
      default: null,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    finalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Affiliate/Referral tracking
    affiliateCode: {
      type: String,
      default: null,
    },

    affiliateSource: {
      type: String,
      enum: ["influencer", "campaign", "referral", "organic", null],
      default: null,
    },

    // ==================== INFLUENCER TRACKING ====================

    // Reference to influencer who referred this order
    influencerId: {
      type: mongoose.Schema.ObjectId,
      ref: "Influencer",
      default: null,
      index: true,
    },

    // Influencer code used (denormalized for historical tracking)
    influencerCode: {
      type: String,
      default: null,
    },

    // Discount applied from influencer referral
    influencerDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Commission owed to influencer for this order
    influencerCommission: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Whether commission has been paid out
    commissionPaid: {
      type: Boolean,
      default: false,
    },

    // Original price before any discounts
    originalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==================== END INFLUENCER TRACKING ====================

    // Saved order flag (for pending payment orders)
    isSavedOrder: {
      type: Boolean,
      default: false,
    },

    // ==================== SHIPPING (XPRESSBEES) ====================

shipping_provider: {
  type: String,
  enum: ["XPRESSBEES", null],
  default: null,
},

awb_number: {
  type: String,
  default: null,
  index: true,
},

shipping_label: {
  type: String,
  default: null, // PDF URL from courier
},

shipping_manifest: {
  type: String,
  default: null, // Manifest PDF URL
},

shipment_status: {
  type: String,
  enum: ["pending", "booked", "shipped", "delivered", "cancelled"],
  default: "pending",
},

shipment_created_at: {
  type: Date,
  default: null,
},

    // ==================== END NEW FIELDS ====================

    // Metadata
    failureReason: {
      type: String,
      default: null, // Reason if payment failed
    },

    lastUpdatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null, // Admin who last updated order
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  },
);

// Index for common queries
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ payment_status: 1, order_status: 1 });
orderSchema.index({ paymentId: 1 });

// Pre-save hook for validation
orderSchema.pre("save", async function () {
  // Ensure totalAmt is always a number
  if (typeof this.totalAmt !== "number" || this.totalAmt < 0) {
    throw new Error("Total amount must be a non-negative number");
  }

  // Ensure products array is not empty on save
  if (!this.products || this.products.length === 0) {
    throw new Error("Order must have at least one product");
  }
});

const OrderModel = mongoose.model("order", orderSchema);

export default OrderModel;
