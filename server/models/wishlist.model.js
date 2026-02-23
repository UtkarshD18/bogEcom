import mongoose from "mongoose";

/**
 * Wishlist Model
 *
 * For user wishlists/favorites.
 */
const wishlistItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
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
    default: 1,
    min: 1,
  },
  priceSnapshot: {
    type: Number,
    default: 0,
    min: 0,
  },
  originalPriceSnapshot: {
    type: Number,
    default: 0,
    min: 0,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
  notifyOnSale: {
    type: Boolean,
    default: true,
  },
  notifyOnStock: {
    type: Boolean,
    default: true,
  },
});

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    items: {
      type: [wishlistItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual for item count
wishlistSchema.virtual("itemCount").get(function () {
  return this.items.length;
});

wishlistSchema.pre("save", function () {
  const seen = new Set();
  const deduped = [];
  for (const item of this.items || []) {
    const productKey = String(item.product || "");
    if (!productKey) continue;

    const variantKey = String(item.variantId || "").trim();
    const dedupeKey = `${productKey}::${variantKey}`;
    if (seen.has(dedupeKey)) continue; // silently skip duplicates
    seen.add(dedupeKey);

    const safeQuantity = Math.max(Number(item.quantity || 1), 1);
    item.quantity = safeQuantity;
    deduped.push(item);
  }
  this.items = deduped;
});

wishlistSchema.index({ user: 1, "items.product": 1 });

const WishlistModel = mongoose.model("Wishlist", wishlistSchema);
export default WishlistModel;
