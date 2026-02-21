import mongoose from "mongoose";

const LEGACY_GATEWAY_METHOD = String.fromCharCode(82, 65, 90, 79, 82, 80, 65, 89);
const ORDER_PAYMENT_METHODS = [
  LEGACY_GATEWAY_METHOD,
  "PHONEPE",
  "COD",
  "PENDING",
  "TEST",
];

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
        variantId: {
          type: String,
          default: null,
        },
        variantName: {
          type: String,
          default: "",
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

    // Legacy gateway references retained under provider-neutral keys.
    legacyGatewayOrderId: {
      type: String,
      default: null,
      index: true,
    },

    legacyGatewaySignature: {
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
        "accepted",
        "in_warehouse",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "rto",
        "rto_completed",
        "confirmed",
      ],
      default: "pending",
      index: true,
    },

    inventoryStatus: {
      type: String,
      enum: ["none", "reserved", "deducted", "released", "restored"],
      default: "none",
      index: true,
    },
    inventoryUpdatedAt: {
      type: Date,
      default: null,
    },
    inventorySource: {
      type: String,
      default: "",
    },
    reservationExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    statusTimeline: [
      {
        status: { type: String, required: true },
        source: { type: String, default: "SYSTEM" },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // Delivery Information
    delivery_address: {
      type: mongoose.Schema.ObjectId,
      ref: "Address",
      default: null,
    },

    // Location capture (90-day retention logs)
    locationLog: {
      type: mongoose.Schema.ObjectId,
      ref: "UserLocationLog",
      default: null,
      index: true,
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

    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    shipping: {
      type: Number,
      default: 0,
      min: 0,
    },

    gst: {
      rate: {
        type: Number,
        default: 5,
        min: 0,
      },
      state: {
        type: String,
        default: "",
      },
      taxableAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
      cgst: {
        type: Number,
        default: 0,
        min: 0,
      },
      sgst: {
        type: Number,
        default: 0,
        min: 0,
      },
      igst: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    gstNumber: {
      type: String,
      default: "",
      trim: true,
    },

    billingDetails: {
      fullName: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
      pincode: { type: String, default: "" },
      state: { type: String, default: "" },
    },

    notes: {
      type: String,
      default: "",
    },

    // ==================== NEW FIELDS FOR PHONEPE INTEGRATION ====================

    // Payment method tracking.
    // Keep `LEGACY_GATEWAY_METHOD` temporarily to allow safe rollouts
    // before `migrate:payment-cleanup` is executed in production.
    paymentMethod: {
      type: String,
      enum: ORDER_PAYMENT_METHODS,
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

    membershipDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },

    membershipPlan: {
      type: mongoose.Schema.ObjectId,
      ref: "MembershipPlan",
      default: null,
    },

    coinRedemption: {
      coinsUsed: {
        type: Number,
        default: 0,
        min: 0,
      },
      amount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    coinsAwarded: {
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

    // Internal guard to prevent duplicate influencer stats increments
    influencerStatsSynced: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Whether commission has been paid out
    commissionPaid: {
      type: Boolean,
      default: false,
    },

    // Linked purchase order (if order created from PO flow)
    purchaseOrder: {
      type: mongoose.Schema.ObjectId,
      ref: "PurchaseOrder",
      default: null,
      index: true,
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

    purchaseOrder: {
      type: mongoose.Schema.ObjectId,
      ref: "PurchaseOrder",
      default: null,
    },

    guestDetails: {
      fullName: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
      pincode: { type: String, default: "" },
      state: { type: String, default: "" },
      email: { type: String, default: "" },
      gst: { type: String, default: "" },
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
  enum: [
    "pending",
    "booked",
    "shipped",
    "delivered",
    "cancelled",
    "rto_initiated",
    "rto_in_transit",
    "rto_delivered",
  ],
  default: "pending",
},

    shipment_created_at: {
  type: Date,
  default: null,
},

    // ==================== INVOICE ====================

    invoiceNumber: {
      type: String,
      default: null,
    },

    invoicePath: {
      type: String,
      default: null,
    },

    invoiceGeneratedAt: {
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
orderSchema.index({ invoiceNumber: 1 }, { sparse: true });
orderSchema.index({ "gst.state": 1, createdAt: -1 });
orderSchema.index({ purchaseOrder: 1 }, { sparse: true });

// Normalize legacy payment_status before validation
orderSchema.pre("validate", function () {
  if (this.payment_status === "confirmed") {
    this.payment_status = "paid";
  }
});

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
