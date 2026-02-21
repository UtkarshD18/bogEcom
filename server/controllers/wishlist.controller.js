import mongoose from "mongoose";
import ProductModel from "../models/product.model.js";
import WishlistModel from "../models/wishlist.model.js";
import { checkExclusiveAccess } from "../middlewares/membershipGuard.js";

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

const normalizePrice = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Number(fallback) > 0 ? Number(fallback) : 0;
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

const buildWishlistItemPayload = ({
  product,
  quantity,
  variantId,
  variantName = "",
}) => {
  const safeQuantity = normalizeQuantity(quantity ?? 1);
  if (!Number.isInteger(safeQuantity) || safeQuantity < 1 || safeQuantity > MAX_MOVE_TO_CART_QTY) {
    return {
      error: `Quantity must be an integer between 1 and ${MAX_MOVE_TO_CART_QTY}`,
    };
  }

  const requestedVariantId = String(variantId || "").trim();
  const requestedVariantName = String(variantName || "").trim();
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  let selectedVariant = null;
  if (requestedVariantId) {
    if (!isValidObjectId(requestedVariantId)) {
      return { error: "Valid variant ID is required" };
    }

    selectedVariant =
      variants.find((variant) => String(variant?._id || "") === requestedVariantId) || null;
    if (!selectedVariant) {
      return { error: "Selected variant not found for this product" };
    }
  }

  const effectivePrice = normalizePrice(
    selectedVariant?.price ?? product?.price ?? 0,
    0,
  );
  const effectiveOriginalPrice = normalizePrice(
    selectedVariant?.originalPrice ?? product?.originalPrice ?? 0,
    0,
  );

  return {
    quantity: safeQuantity,
    variant: selectedVariant?._id || null,
    variantName: selectedVariant?.name
      ? String(selectedVariant.name)
      : requestedVariantName,
    price: effectivePrice,
    originalPrice: effectiveOriginalPrice,
  };
};

const canUserAccessExclusiveProducts = async (userId) => {
  if (!userId) return false;
  return checkExclusiveAccess(userId);
};

const WISHLIST_PRODUCT_SELECT =
  "name price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory isActive rating brand isExclusive hasVariants variants._id variants.name variants.price variants.originalPrice variants.isDefault";

const formatWishlistItems = (items = []) =>
  (items || []).map((item) => {
    const rawItem =
      typeof item?.toObject === "function" ? item.toObject() : item || {};
    const productDoc =
      rawItem?.product && typeof rawItem.product === "object" ? rawItem.product : null;
    const productId = String(productDoc?._id || rawItem?.product || "");
    const variants = Array.isArray(productDoc?.variants) ? productDoc.variants : [];
    const defaultVariant =
      variants.find((variant) => variant?.isDefault) || variants[0] || null;
    const quantity = normalizeQuantity(rawItem?.quantity ?? rawItem?.productData?.quantity ?? 1);
    const safeQuantity =
      Number.isInteger(quantity) && quantity > 0 && quantity <= MAX_MOVE_TO_CART_QTY
        ? quantity
        : 1;
    const requestedVariantId =
      rawItem?.variant != null
        ? String(rawItem.variant)
        : String(
            rawItem?.productData?.variantId ||
              rawItem?.productData?.selectedVariant?._id ||
              "",
          );
    const matchedVariant =
      requestedVariantId &&
      variants.find((variant) => String(variant?._id || "") === requestedVariantId);
    const resolvedVariant = matchedVariant || (!requestedVariantId ? defaultVariant : null);
    const variantId = requestedVariantId || String(resolvedVariant?._id || "");
    const variantName = String(
      rawItem?.variantName ||
        rawItem?.productData?.variantName ||
        rawItem?.productData?.selectedVariant?.name ||
        resolvedVariant?.name ||
        "",
    ).trim();
    const effectivePrice = normalizePrice(
      rawItem?.price,
      resolvedVariant?.price ?? productDoc?.price ?? rawItem?.productData?.price ?? 0,
    );
    const effectiveOriginalPrice = normalizePrice(
      rawItem?.originalPrice,
      resolvedVariant?.originalPrice ??
      productDoc?.originalPrice ??
        rawItem?.productData?.originalPrice ??
        rawItem?.productData?.oldPrice ??
        0,
    );
    const rawProductData = productDoc || rawItem?.productData || null;
    let productData = rawProductData;

    if (rawProductData && typeof rawProductData === "object") {
      const cloned =
        typeof rawProductData?.toObject === "function"
          ? rawProductData.toObject()
          : { ...rawProductData };

      cloned.price = effectivePrice;
      cloned.originalPrice = effectiveOriginalPrice;
      cloned.quantity = safeQuantity;

      if (variantId) {
        cloned.variantId = variantId;
        cloned.variantName = variantName;
        const selectedVariant =
          cloned?.selectedVariant && typeof cloned.selectedVariant === "object"
            ? cloned.selectedVariant
            : {};
        cloned.selectedVariant = {
          ...selectedVariant,
          _id: variantId,
          name: variantName || selectedVariant?.name || "",
          price: effectivePrice,
          originalPrice: effectiveOriginalPrice,
        };
      }

      productData = cloned;
    }

    return {
      _id: rawItem?._id,
      product: productId,
      productData,
      addedAt: rawItem?.addedAt,
      quantity: safeQuantity,
      variant: variantId || null,
      variantName,
      price: effectivePrice,
      originalPrice: effectiveOriginalPrice,
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
    const requestedQuantity = normalizeQuantity(req.body?.quantity ?? 1);
    const requestedVariantId = String(req.body?.variantId || "").trim();
    const requestedVariantName = String(req.body?.variantName || "").trim();

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
      (item) => String(item.product) === productId,
    );

    if (existingItem) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Product already in wishlist",
      });
    }

    const wishlistItemPayload = buildWishlistItemPayload({
      product,
      quantity: requestedQuantity,
      variantId: requestedVariantId,
      variantName: requestedVariantName,
    });
    if (wishlistItemPayload?.error) {
      return res.status(400).json({
        error: true,
        success: false,
        message: wishlistItemPayload.error,
      });
    }

    // Add to wishlist
    wishlist.items.push({
      product: productId,
      ...wishlistItemPayload,
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
      (item) => item.product && String(item.product) !== productId,
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
    const requestedQuantity = normalizeQuantity(req.body?.quantity ?? 1);
    const requestedVariantId = String(req.body?.variantId || "").trim();
    const requestedVariantName = String(req.body?.variantName || "").trim();

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Valid product ID is required",
      });
    }

    const product = await ProductModel.findById(productId)
      .select(
        "_id isActive isExclusive price originalPrice variants._id variants.name variants.price variants.originalPrice",
      )
      .lean();
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

    const existingWishlist = await WishlistModel.findOne({ user: userId }).select(
      "items.product",
    );
    const isCurrentlyWishlisted = Boolean(
      existingWishlist?.items?.some(
        (item) => item.product && String(item.product) === productId,
      ),
    );

    if (isCurrentlyWishlisted) {
      await WishlistModel.updateOne(
        { user: userId },
        { $pull: { items: { product: productId } } },
      );
    } else {
      const wishlistItemPayload = buildWishlistItemPayload({
        product,
        quantity: requestedQuantity,
        variantId: requestedVariantId,
        variantName: requestedVariantName,
      });
      if (wishlistItemPayload?.error) {
        return res.status(400).json({
          error: true,
          success: false,
          message: wishlistItemPayload.error,
        });
      }

      try {
        await WishlistModel.updateOne(
          { user: userId, "items.product": { $ne: productId } },
          {
            $setOnInsert: { user: userId },
            $push: { items: { product: productId, ...wishlistItemPayload } },
          },
          { upsert: true },
        );
      } catch (updateError) {
        // Concurrent requests can race on the unique user index during upsert.
        // In that case, proceed by reading the latest persisted wishlist.
        if (updateError?.code !== 11000) {
          throw updateError;
        }
      }
    }

    const hasExclusiveAccess = await canUserAccessExclusiveProducts(userId);
    let wishlist = await WishlistModel.findOne({ user: userId }).populate({
      path: "items.product",
      select: WISHLIST_PRODUCT_SELECT,
    });

    if (!wishlist) {
      return res.status(200).json({
        error: false,
        success: true,
        message: "Wishlist updated",
        data: {
          items: [],
          isWishlisted: false,
          itemCount: 0,
        },
      });
    }

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
    const isWishlisted = formattedItems.some(
      (item) => String(item.product) === productId,
    );

    return res.status(200).json({
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
    console.error("Error toggling wishlist:", error);
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
      wishlist?.items.some((item) => item.product && String(item.product) === productId) ||
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
      (item) => item.product && String(item.product) === productId,
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
      (item) => item.product && String(item.product) === productId,
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

