import mongoose from "mongoose";
import ProductModel from "../models/product.model.js";
import WishlistModel from "../models/wishlist.model.js";

const getAvailableQuantity = (product) => {
  if (!product) return 0;
  if (product.track_inventory === false || product.trackInventory === false) {
    return Number.MAX_SAFE_INTEGER;
  }
  const stock = Number(product.stock_quantity ?? product.stock ?? 0);
  const reserved = Number(product.reserved_quantity ?? 0);
  return Math.max(stock - reserved, 0);
};

const MAX_MOVE_TO_CART_QTY = 100;

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(String(value || "").trim());

const normalizeQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
};

/**
 * Wishlist Controller
 *
 * Wishlist operations for authenticated users
 */

/**
 * Get user's wishlist
 * @route GET /api/wishlist
 */
export const getWishlist = async (req, res) => {
  try {
    const userId = req.user;

    let wishlist = await WishlistModel.findOne({ user: userId }).populate({
      path: "items.product",
      select:
        "name price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory isActive rating brand",
    });

    if (!wishlist) {
      return res.status(200).json({
        error: false,
        success: true,
        data: { items: [], itemCount: 0 },
      });
    }

    // Filter out unavailable products
    const validItems = wishlist.items.filter(
      (item) => item.product && item.product.isActive,
    );

    if (validItems.length !== wishlist.items.length) {
      wishlist.items = validItems;
      await wishlist.save();
    }

    res.status(200).json({
      error: false,
      success: true,
      data: {
        _id: wishlist._id,
        items: wishlist.items,
        itemCount: wishlist.itemCount,
      },
    });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch wishlist",
    });
  }
};

/**
 * Add item to wishlist
 * @route POST /api/wishlist/add
 */
export const addToWishlist = async (req, res) => {
  try {
    const userId = req.user;
    const productId = String(req.body?.productId || "").trim();
    const notifyOnSale = Boolean(req.body?.notifyOnSale ?? true);
    const notifyOnStock = Boolean(req.body?.notifyOnStock ?? true);

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Valid product ID is required",
      });
    }

    // Verify product exists
    const product = await ProductModel.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found or unavailable",
      });
    }

    // Find or create wishlist
    let wishlist = await WishlistModel.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new WishlistModel({ user: userId, items: [] });
    }

    // Check if already in wishlist
    const existingItem = wishlist.items.find(
      (item) => item.product.toString() === productId,
    );

    if (existingItem) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Product already in wishlist",
      });
    }

    // Add to wishlist
    wishlist.items.push({
      product: productId,
      notifyOnSale,
      notifyOnStock,
    });

    await wishlist.save();
    await wishlist.populate({
      path: "items.product",
      select:
        "name price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory isActive rating brand",
    });

    res.status(200).json({
      error: false,
      success: true,
      message: "Added to wishlist",
      data: {
        items: wishlist.items,
        itemCount: wishlist.itemCount,
      },
    });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to add to wishlist",
    });
  }
};

/**
 * Remove item from wishlist
 * @route DELETE /api/wishlist/remove/:productId
 */
export const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user;
    const productId = String(req.params?.productId || "").trim();

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid product ID",
      });
    }

    const wishlist = await WishlistModel.findOne({ user: userId });
    if (!wishlist) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Wishlist not found",
      });
    }

    const initialLength = wishlist.items.length;
    wishlist.items = wishlist.items.filter(
      (item) => item.product.toString() !== productId,
    );

    if (wishlist.items.length === initialLength) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not in wishlist",
      });
    }

    await wishlist.save();
    await wishlist.populate({
      path: "items.product",
      select:
        "name price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory isActive rating brand",
    });

    res.status(200).json({
      error: false,
      success: true,
      message: "Removed from wishlist",
      data: {
        items: wishlist.items,
        itemCount: wishlist.itemCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to remove from wishlist",
    });
  }
};

/**
 * Toggle wishlist item
 * @route POST /api/wishlist/toggle
 */
export const toggleWishlist = async (req, res) => {
  try {
    const userId = req.user;
    const productId = String(req.body?.productId || "").trim();

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Valid product ID is required",
      });
    }

    const product = await ProductModel.findById(productId)
      .select("_id isActive")
      .lean();
    if (!product || !product.isActive) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found or unavailable",
      });
    }

    let wishlist = await WishlistModel.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new WishlistModel({ user: userId, items: [] });
    }

    const existingIndex = wishlist.items.findIndex(
      (item) => item.product.toString() === productId,
    );

    let isWishlisted;
    if (existingIndex >= 0) {
      // Remove from wishlist
      wishlist.items.splice(existingIndex, 1);
      isWishlisted = false;
    } else {
      // Add to wishlist
      wishlist.items.push({ product: productId });
      isWishlisted = true;
    }

    await wishlist.save();
    await wishlist.populate({
      path: "items.product",
      select:
        "name price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory isActive rating brand",
    });

    res.status(200).json({
      error: false,
      success: true,
      message: isWishlisted ? "Added to wishlist" : "Removed from wishlist",
      data: {
        items: wishlist.items,
        isWishlisted,
        itemCount: wishlist.itemCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to toggle wishlist",
    });
  }
};

/**
 * Check if product is in wishlist
 * @route GET /api/wishlist/check/:productId
 */
export const checkWishlist = async (req, res) => {
  try {
    const userId = req.user;
    const productId = String(req.params?.productId || "").trim();

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid product ID",
      });
    }

    const wishlist = await WishlistModel.findOne({ user: userId });

    const isWishlisted =
      wishlist?.items.some((item) => item.product.toString() === productId) ||
      false;

    res.status(200).json({
      error: false,
      success: true,
      data: { isWishlisted },
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to check wishlist",
    });
  }
};

/**
 * Clear wishlist
 * @route DELETE /api/wishlist/clear
 */
export const clearWishlist = async (req, res) => {
  try {
    const userId = req.user;

    const wishlist = await WishlistModel.findOne({ user: userId });
    if (wishlist) {
      wishlist.items = [];
      await wishlist.save();
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Wishlist cleared",
      data: { items: [], itemCount: 0 },
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to clear wishlist",
    });
  }
};

/**
 * Move item from wishlist to cart
 * @route POST /api/wishlist/move-to-cart
 */
export const moveToCart = async (req, res) => {
  try {
    const userId = req.user;
    const productId = String(req.body?.productId || "").trim();
    const quantity = normalizeQuantity(req.body?.quantity ?? 1);

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Valid product ID is required",
      });
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_MOVE_TO_CART_QTY) {
      return res.status(400).json({
        error: true,
        success: false,
        message: `Quantity must be an integer between 1 and ${MAX_MOVE_TO_CART_QTY}`,
      });
    }

    // Import cart controller
    const CartModel = (await import("../models/cart.model.js")).default;

    // Get wishlist
    const wishlist = await WishlistModel.findOne({ user: userId });
    if (!wishlist) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Wishlist not found",
      });
    }

    // Find item in wishlist
    const itemIndex = wishlist.items.findIndex(
      (item) => item.product.toString() === productId,
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not in wishlist",
      });
    }

    // Get product
    const product = await ProductModel.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not available",
      });
    }

    const availableStock = getAvailableQuantity(product);
    if (Number.isFinite(availableStock) && availableStock < quantity) {
      return res.status(400).json({
        error: true,
        success: false,
        message: `Only ${availableStock} items available`,
      });
    }

    // Add to cart
    let cart = await CartModel.findOne({ user: userId });
    if (!cart) {
      cart = new CartModel({ user: userId, items: [] });
    }

    const cartItemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId,
    );

    if (cartItemIndex >= 0) {
      const mergedQuantity = Math.min(
        Number(cart.items[cartItemIndex].quantity || 0) + quantity,
        MAX_MOVE_TO_CART_QTY,
      );
      if (Number.isFinite(availableStock) && mergedQuantity > availableStock) {
        return res.status(400).json({
          error: true,
          success: false,
          message: `Only ${availableStock} items available`,
        });
      }
      cart.items[cartItemIndex].quantity = mergedQuantity;
    } else {
      cart.items.push({
        product: productId,
        quantity,
        price: product.price,
        originalPrice: product.originalPrice || 0,
      });
    }

    // Remove from wishlist
    wishlist.items.splice(itemIndex, 1);

    await Promise.all([cart.save(), wishlist.save()]);

    res.status(200).json({
      error: false,
      success: true,
      message: "Moved to cart",
      data: {
        wishlistCount: wishlist.itemCount,
        cartCount: cart.itemCount,
      },
    });
  } catch (error) {
    console.error("Error moving to cart:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to move to cart",
    });
  }
};

export default {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  checkWishlist,
  clearWishlist,
  moveToCart,
};
