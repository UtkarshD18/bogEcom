import mongoose from "mongoose";
import ProductModel from "../models/product.model.js";
import WishlistModel from "../models/wishlist.model.js";
import { checkExclusiveAccess } from "../middlewares/membershipGuard.js";

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const getAvailableQuantity = (product, variantId = null) => {
  if (!product) return 0;
  if (product.track_inventory === false || product.trackInventory === false) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (variantId && product.hasVariants && product.variants?.length) {
    const variant = product.variants.id
      ? product.variants.id(variantId)
      : product.variants.find((v) => String(v?._id || "") === String(variantId));
    const variantStock = Number(variant?.stock_quantity ?? variant?.stock ?? 0);
    const variantReserved = Number(variant?.reserved_quantity ?? 0);
    return Math.max(variantStock - variantReserved, 0);
  }

  const stock = Number(product.stock_quantity ?? product.stock ?? 0);
  const reserved = Number(product.reserved_quantity ?? 0);
  return Math.max(stock - reserved, 0);
};

const MAX_MOVE_TO_CART_QTY = 100;

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(String(value || "").trim());

const normalizeVariantId = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return String(value).trim();
};

const isSameVariant = (left, right) =>
  String(normalizeVariantId(left) || "") === String(normalizeVariantId(right) || "");

const normalizeQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
};

const canUserAccessExclusiveProducts = async (userId) => {
  if (!userId) return false;
  return checkExclusiveAccess(userId);
};

const WISHLIST_PRODUCT_SELECT =
  "name price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory isActive rating brand isExclusive hasVariants variants";

const resolveWishlistSnapshot = ({ product, variantId, variantName, quantity }) => {
  const normalizedVariantId = normalizeVariantId(variantId);
  if (normalizedVariantId && !isValidObjectId(normalizedVariantId)) {
    return { errorMessage: "Invalid variant ID" };
  }

  let resolvedPrice = Number(product?.price ?? 0);
  let resolvedOriginalPrice = Number(
    product?.originalPrice ?? product?.price ?? 0,
  );
  let resolvedVariantName = String(variantName || "").trim().slice(0, 120);
  let availableStock = getAvailableQuantity(product, null);

  if (normalizedVariantId) {
    if (!product?.hasVariants || !Array.isArray(product?.variants)) {
      return { errorMessage: "Selected variant is not available" };
    }

    const resolvedVariant = product.variants.id
      ? product.variants.id(normalizedVariantId)
      : product.variants.find(
          (variant) => String(variant?._id || "") === normalizedVariantId,
        );

    if (!resolvedVariant) {
      return { errorMessage: "Selected variant is not available" };
    }

    resolvedPrice = Number(resolvedVariant.price ?? product.price ?? 0);
    resolvedOriginalPrice = Number(
      resolvedVariant.originalPrice ??
        product.originalPrice ??
        resolvedPrice,
    );
    if (!resolvedVariantName) {
      resolvedVariantName = String(resolvedVariant.name || "").trim().slice(0, 120);
    }
    availableStock = getAvailableQuantity(product, normalizedVariantId);
  }

  const normalizedQty = normalizeQuantity(quantity ?? 1);
  if (
    !Number.isInteger(normalizedQty) ||
    normalizedQty < 1 ||
    normalizedQty > MAX_MOVE_TO_CART_QTY
  ) {
    return {
      errorMessage: `Quantity must be an integer between 1 and ${MAX_MOVE_TO_CART_QTY}`,
    };
  }

  if (Number.isFinite(availableStock) && availableStock < normalizedQty) {
    return {
      errorMessage: `Only ${availableStock} items available`,
    };
  }

  return {
    variantId: normalizedVariantId,
    variantName: resolvedVariantName,
    quantity: normalizedQty,
    priceSnapshot: round2(Math.max(resolvedPrice, 0)),
    originalPriceSnapshot: round2(
      Math.max(
        resolvedOriginalPrice > 0 ? resolvedOriginalPrice : resolvedPrice,
        0,
      ),
    ),
  };
};

const formatWishlistItems = (items = []) =>
  (items || []).map((item) => {
    const rawItem =
      typeof item?.toObject === "function" ? item.toObject() : item || {};
    const productDoc =
      rawItem?.product && typeof rawItem.product === "object" ? rawItem.product : null;
    const productId = String(productDoc?._id || rawItem?.product || "");

    return {
      _id: rawItem?._id,
      product: productId,
      productData: productDoc || rawItem?.productData || null,
      variantId: normalizeVariantId(rawItem?.variantId),
      variantName: String(rawItem?.variantName || "").trim(),
      quantity: Math.max(Number(rawItem?.quantity || 1), 1),
      priceSnapshot: round2(Number(rawItem?.priceSnapshot || 0)),
      originalPriceSnapshot: round2(Number(rawItem?.originalPriceSnapshot || 0)),
      addedAt: rawItem?.addedAt,
    };
  });

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
    const hasExclusiveAccess = await canUserAccessExclusiveProducts(userId);

    let wishlist = await WishlistModel.findOne({ user: userId }).populate({
      path: "items.product",
      select: WISHLIST_PRODUCT_SELECT,
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
      (item) =>
        item.product &&
        item.product.isActive &&
        (hasExclusiveAccess || item.product.isExclusive !== true),
    );

    if (validItems.length !== wishlist.items.length) {
      wishlist.items = validItems;
      await wishlist.save();
    }

    const formattedItems = formatWishlistItems(wishlist.items);

    res.status(200).json({
      error: false,
      success: true,
      data: {
        _id: wishlist._id,
        items: formattedItems,
        itemCount: formattedItems.length,
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
    const requestedVariantId = normalizeVariantId(req.body?.variantId);
    const requestedVariantName = String(req.body?.variantName || "").trim();
    const requestedQuantity = req.body?.quantity ?? 1;

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Valid product ID is required",
      });
    }

    if (requestedVariantId && !isValidObjectId(requestedVariantId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid variant ID",
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

    if (product.isExclusive) {
      const hasExclusiveAccess = await canUserAccessExclusiveProducts(userId);
      if (!hasExclusiveAccess) {
        return res.status(403).json({
          error: true,
          success: false,
          message: "Active membership required for exclusive products.",
        });
      }
    }

    // Find or create wishlist
    let wishlist = await WishlistModel.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new WishlistModel({ user: userId, items: [] });
    }

    // Filter out any items with null/missing product references
    const validItems = wishlist.items.filter((item) => item.product);
    if (validItems.length !== wishlist.items.length) {
      wishlist.items = validItems;
    }

    // Check if already in wishlist
    const existingItem = wishlist.items.find(
      (item) =>
        String(item.product) === productId &&
        normalizeVariantId(item?.variantId) === requestedVariantId,
    );

    if (existingItem) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Product already in wishlist",
      });
    }

    const snapshot = resolveWishlistSnapshot({
      product,
      variantId: requestedVariantId,
      variantName: requestedVariantName,
      quantity: requestedQuantity,
    });
    if (snapshot?.errorMessage) {
      return res.status(400).json({
        error: true,
        success: false,
        message: snapshot.errorMessage,
      });
    }

    // Add to wishlist
    wishlist.items.push({
      product: productId,
      variantId: snapshot.variantId,
      variantName: snapshot.variantName,
      quantity: snapshot.quantity,
      priceSnapshot: snapshot.priceSnapshot,
      originalPriceSnapshot: snapshot.originalPriceSnapshot,
    });

    await wishlist.save();
    await wishlist.populate({
      path: "items.product",
      select: WISHLIST_PRODUCT_SELECT,
    });

    const formattedItems = formatWishlistItems(wishlist.items);

    res.status(200).json({
      error: false,
      success: true,
      data: {
        items: formattedItems,
        itemCount: formattedItems.length,
      },
    });
  } catch (error) {
    console.error("Error adding to wishlist:", error?.message || error);
    res.status(500).json({
      error: true,
      success: false,
      message: process.env.NODE_ENV !== "production"
        ? `Failed to add to wishlist: ${error?.message || "Unknown error"}`
        : "Failed to add to wishlist",
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
    const variantId = normalizeVariantId(req.query?.variantId);

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid product ID",
      });
    }

    if (variantId && !isValidObjectId(variantId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid variant ID",
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
      (item) => {
        if (!item.product) return false;
        const isProductMatch = String(item.product) === productId;
        if (!isProductMatch) return true;
        if (!variantId) return false;
        return normalizeVariantId(item?.variantId) !== variantId;
      },
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
      select: WISHLIST_PRODUCT_SELECT,
    });

    const formattedItems = formatWishlistItems(wishlist.items);

    return res.status(200).json({
      error: false,
      success: true,
      data: {
        items: formattedItems,
        itemCount: formattedItems.length,
      },
    });
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    return res.status(500).json({
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
    const requestedVariantId = normalizeVariantId(req.body?.variantId);
    const requestedVariantName = String(req.body?.variantName || "").trim();
    const requestedQuantity = req.body?.quantity ?? 1;

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Valid product ID is required",
      });
    }

    if (requestedVariantId && !isValidObjectId(requestedVariantId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid variant ID",
      });
    }

    const product = await ProductModel.findById(productId)
      .select(WISHLIST_PRODUCT_SELECT);
    if (!product || !product.isActive) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found or unavailable",
      });
    }

    if (product.isExclusive) {
      const hasExclusiveAccess = await canUserAccessExclusiveProducts(userId);
      if (!hasExclusiveAccess) {
        return res.status(403).json({
          error: true,
          success: false,
          message: "Active membership required for exclusive products.",
        });
      }
    }

    let wishlist = await WishlistModel.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new WishlistModel({ user: userId, items: [] });
    }

    // Filter out any items with null/missing product references
    wishlist.items = wishlist.items.filter((item) => item.product);

    const existingIndex = wishlist.items.findIndex(
      (item) =>
        String(item.product) === productId &&
        normalizeVariantId(item?.variantId) === requestedVariantId,
    );

    let isWishlisted;
    if (existingIndex >= 0) {
      // Remove from wishlist
      wishlist.items.splice(existingIndex, 1);
      isWishlisted = false;
    } else {
      const snapshot = resolveWishlistSnapshot({
        product,
        variantId: requestedVariantId,
        variantName: requestedVariantName,
        quantity: requestedQuantity,
      });
      if (snapshot?.errorMessage) {
        return res.status(400).json({
          error: true,
          success: false,
          message: snapshot.errorMessage,
        });
      }

      // Add to wishlist
      wishlist.items.push({
        product: productId,
        variantId: snapshot.variantId,
        variantName: snapshot.variantName,
        quantity: snapshot.quantity,
        priceSnapshot: snapshot.priceSnapshot,
        originalPriceSnapshot: snapshot.originalPriceSnapshot,
      });
      isWishlisted = true;
    }

    await wishlist.save();
    await wishlist.populate({
      path: "items.product",
      select: WISHLIST_PRODUCT_SELECT,
    });

    const formattedItems = formatWishlistItems(wishlist.items);

    res.status(200).json({
      error: false,
      success: true,
      message: isWishlisted ? "Added to wishlist" : "Removed from wishlist",
      data: {
        items: formattedItems,
        isWishlisted,
        itemCount: formattedItems.length,
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
    const variantId = normalizeVariantId(req.query?.variantId);

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid product ID",
      });
    }

    if (variantId && !isValidObjectId(variantId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid variant ID",
      });
    }

    const wishlist = await WishlistModel.findOne({ user: userId });

    const isWishlisted =
      wishlist?.items.some((item) => {
        if (!item?.product || String(item.product) !== productId) return false;
        if (!variantId) return true;
        return normalizeVariantId(item?.variantId) === variantId;
      }) ||
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
    const requestedVariantId = normalizeVariantId(req.body?.variantId);
    const requestedQuantity = req.body?.quantity;

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Valid product ID is required",
      });
    }

    if (requestedVariantId && !isValidObjectId(requestedVariantId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid variant ID",
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
      (item) => {
        if (!item?.product || String(item.product) !== productId) return false;
        if (!requestedVariantId) return true;
        return isSameVariant(item?.variantId, requestedVariantId);
      },
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not in wishlist",
      });
    }

    const wishlistItem = wishlist.items[itemIndex];
    const selectedVariantId = normalizeVariantId(wishlistItem?.variantId);
    const quantity = normalizeQuantity(requestedQuantity ?? wishlistItem?.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_MOVE_TO_CART_QTY) {
      return res.status(400).json({
        error: true,
        success: false,
        message: `Quantity must be an integer between 1 and ${MAX_MOVE_TO_CART_QTY}`,
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

    if (product.isExclusive) {
      const hasExclusiveAccess = await canUserAccessExclusiveProducts(userId);
      if (!hasExclusiveAccess) {
        return res.status(403).json({
          error: true,
          success: false,
          message: "Active membership required for exclusive products.",
        });
      }
    }

    const availableStock = getAvailableQuantity(product, selectedVariantId);
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
      (item) =>
        item.product &&
        String(item.product) === productId &&
        isSameVariant(item?.variant, selectedVariantId),
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
      let resolvedPrice = Number(wishlistItem?.priceSnapshot || 0);
      let resolvedOriginalPrice = Number(wishlistItem?.originalPriceSnapshot || 0);
      let resolvedVariantName = String(wishlistItem?.variantName || "").trim().slice(0, 120);

      if (selectedVariantId && Array.isArray(product?.variants)) {
        const variant = product.variants.id
          ? product.variants.id(selectedVariantId)
          : product.variants.find(
              (entry) => String(entry?._id || "") === selectedVariantId,
            );
        if (variant) {
          resolvedPrice = Number(variant.price ?? resolvedPrice ?? product.price ?? 0);
          resolvedOriginalPrice = Number(
            variant.originalPrice ??
              resolvedOriginalPrice ??
              product.originalPrice ??
              resolvedPrice,
          );
          if (!resolvedVariantName) {
            resolvedVariantName = String(variant.name || "").trim().slice(0, 120);
          }
        }
      } else {
        resolvedPrice = Number(resolvedPrice || product.price || 0);
        resolvedOriginalPrice = Number(
          resolvedOriginalPrice || product.originalPrice || resolvedPrice || 0,
        );
      }

      cart.items.push({
        product: productId,
        quantity,
        price: round2(Math.max(resolvedPrice, 0)),
        originalPrice: round2(Math.max(resolvedOriginalPrice, 0)),
        variant: selectedVariantId,
        variantName: resolvedVariantName,
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

