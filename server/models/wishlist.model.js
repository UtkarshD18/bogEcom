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

const WishlistModel = mongoose.model("Wishlist", wishlistSchema);
export default WishlistModel;
