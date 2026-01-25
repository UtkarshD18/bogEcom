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
      default: null, // Razorpay Payment ID
      // Note: index is defined in compound indexes below
    },

    razorpayOrderId: {
      type: String,
      default: null, // Razorpay Order ID for reference
      index: true,
    },

    razorpaySignature: {
      type: String,
      default: null, // Signature for verification
    },

    // Status Tracking
    payment_status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
      index: true,
    },

    order_status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },

    // Delivery Information
    delivery_address: {
      type: mongoose.Schema.ObjectId,
      ref: "address",
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
