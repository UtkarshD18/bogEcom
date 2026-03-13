import mongoose from "mongoose";

/**
 * Cart Model
 *
 * Persistent cart storage for logged-in users.
 * Supports guest carts with session ID.
 */
const cartItemSchema = new mongoose.Schema({
  itemType: {
    type: String,
    enum: ["product", "combo"],
    default: "product",
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: function () {
      return this.itemType !== "combo";
    },
  },
  combo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Combo",
    default: null,
  },
  comboSnapshot: {
    comboId: { type: String, default: "" },
    comboName: { type: String, default: "" },
    comboSlug: { type: String, default: "" },
    comboType: { type: String, default: "" },
    comboPrice: { type: Number, default: 0 },
    originalPrice: { type: Number, default: 0 },
    savings: { type: Number, default: 0 },
    items: {
      type: [
        {
          productId: { type: String, default: "" },
          productTitle: { type: String, default: "" },
          variantId: { type: String, default: "" },
          variantName: { type: String, default: "" },
          quantity: { type: Number, default: 1 },
          price: { type: Number, default: 0 },
          originalPrice: { type: Number, default: 0 },
          image: { type: String, default: "" },
        },
      ],
      default: [],
    },
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, "Quantity must be at least 1"],
    default: 1,
  },
  variant: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  variantName: {
    type: String,
    default: "",
  },
  price: {
    type: Number,
    required: true,
  },
  originalPrice: {
    type: Number,
    default: 0,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sessionId: {
      type: String,
      default: null,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
    couponCode: {
      type: String,
      default: null,
    },
    couponDiscount: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days for guests
      index: { expireAfterSeconds: 0 }, // TTL index
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual for subtotal
cartSchema.virtual("subtotal").get(function () {
  return this.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
});

// Virtual for item count
cartSchema.virtual("itemCount").get(function () {
  return this.items.reduce((count, item) => count + item.quantity, 0);
});

// Virtual for total savings
cartSchema.virtual("totalSavings").get(function () {
  return this.items.reduce((savings, item) => {
    if (item.originalPrice > item.price) {
      return savings + (item.originalPrice - item.price) * item.quantity;
    }
    return savings;
  }, 0);
});

// Remove expiry for logged-in users
cartSchema.pre("save", async function () {
  if (this.user) {
    this.expiresAt = null;
    this.sessionId = null;
  }
});

cartSchema.index({ user: 1 }, { sparse: true });
cartSchema.index({ sessionId: 1 }, { sparse: true });

const CartModel = mongoose.model("Cart", cartSchema);
export default CartModel;
