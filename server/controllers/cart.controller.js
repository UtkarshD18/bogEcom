import CartModel from "../models/cart.model.js";
import mongoose from "mongoose";
import ProductModel from "../models/product.model.js";

const getAvailableQuantity = (product, variantId = null) => {
  if (!product) return 0;
  if (product.track_inventory === false || product.trackInventory === false) {
    return Number.MAX_SAFE_INTEGER;
  }
  if (variantId && product.hasVariants && product.variants?.length) {
    const variant = product.variants.id
      ? product.variants.id(variantId)
      : product.variants.find((v) => String(v._id) === String(variantId));
    const variantStock = Number(variant?.stock_quantity ?? variant?.stock ?? 0);
    const variantReserved = Number(variant?.reserved_quantity ?? 0);
    return Math.max(variantStock - variantReserved, 0);
  }
  const stock = Number(product.stock_quantity ?? product.stock ?? 0);
  const reserved = Number(product.reserved_quantity ?? 0);
  return Math.max(stock - reserved, 0);
};

const MAX_CART_ITEM_QTY = 100;

const normalizeSessionId = (value) =>
  String(value || "")
    .trim()
    .slice(0, 128);

const normalizeQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
};

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(String(value || "").trim());

const getActorIdentifiers = (req) => ({
  userId: req.user || null,
  sessionId: normalizeSessionId(req.headers["x-session-id"] || req.cookies.sessionId),
});

const normalizeVariantId = (variantId) => {
  if (variantId === undefined || variantId === null || variantId === "") {
    return null;
  }
  return String(variantId).trim();
};

const isSameVariant = (itemVariant, targetVariant) =>
  String(itemVariant || "") === String(targetVariant || "");

/**
 * Cart Controller
 *
 * Cart operations for users and guests
 */

/**
 * Get user's cart
 * @route GET /api/cart
 */
export const getCart = async (req, res) => {
  try {
    const { userId, sessionId } = getActorIdentifiers(req);

    let cart;
    if (userId) {
      cart = await CartModel.findOne({ user: userId }).populate({
        path: "items.product",
        select:
          "name brand price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory isActive demandStatus variants",
      });
    } else if (sessionId) {
      cart = await CartModel.findOne({ sessionId }).populate({
        path: "items.product",
        select:
          "name brand price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory isActive demandStatus variants",
      });
    }

    if (!cart) {
      return res.status(200).json({
        error: false,
        success: true,
        data: { items: [], subtotal: 0, itemCount: 0 },
      });
    }

    // Filter out unavailable products and update prices
    const validItems = [];
    for (const item of cart.items) {
      if (item.product && item.product.isActive) {
        // Update price if changed
        if (item.price !== item.product.price) {
          item.price = item.product.price;
          item.originalPrice = item.product.originalPrice;
        }
        validItems.push(item);
      }
    }

    if (validItems.length !== cart.items.length) {
      cart.items = validItems;
      await cart.save();
    }

    res.status(200).json({
      error: false,
      success: true,
      data: {
        _id: cart._id,
        items: cart.items,
        subtotal: cart.subtotal,
        itemCount: cart.itemCount,
        totalSavings: cart.totalSavings,
        couponCode: cart.couponCode,
        couponDiscount: cart.couponDiscount,
      },
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch cart",
    });
  }
};

/**
 * Add item to cart
 * @route POST /api/cart/add
 */
export const addToCart = async (req, res) => {
  try {
    const { userId, sessionId } = getActorIdentifiers(req);
    const productId = String(req.body?.productId || "").trim();
    const variantId = normalizeVariantId(req.body?.variantId);
    const variantName = String(req.body?.variantName || "").trim().slice(0, 120);
    const quantity = normalizeQuantity(req.body?.quantity ?? 1);

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Valid product ID is required",
      });
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_ITEM_QTY) {
      return res.status(400).json({
        error: true,
        success: false,
        message: `Quantity must be an integer between 1 and ${MAX_CART_ITEM_QTY}`,
      });
    }

    if (variantId && !isValidObjectId(variantId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid variant ID",
      });
    }

    // Get product details
    const product = await ProductModel.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found or unavailable",
      });
    }

    // Check stock
    let availableStock = getAvailableQuantity(product, variantId);
    let price = product.price;
    let originalPrice = product.originalPrice;

    if (variantId && product.hasVariants) {
      const variant = product.variants.id(variantId);
      if (!variant) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Selected variant is not available",
        });
      }

      const variantStock = Number(variant.stock_quantity ?? variant.stock ?? 0);
      const variantReserved = Number(variant.reserved_quantity ?? 0);
      availableStock = Math.max(variantStock - variantReserved, 0);
      price = variant.price;
      originalPrice = variant.originalPrice || product.originalPrice;
    }

    if (Number.isFinite(availableStock) && availableStock < quantity) {
      return res.status(400).json({
        error: true,
        success: false,
        message: `Only ${availableStock} items available`,
      });
    }

    // Find or create cart
    let cart;
    if (userId) {
      cart = await CartModel.findOne({ user: userId });
      if (!cart) {
        cart = new CartModel({ user: userId, items: [] });
      }
    } else if (sessionId) {
      cart = await CartModel.findOne({ sessionId });
      if (!cart) {
        cart = new CartModel({ sessionId, items: [] });
      }
    } else {
      return res.status(400).json({
        error: true,
        success: false,
        message: "User or session ID required",
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.product.toString() === productId &&
        isSameVariant(item.variant, variantId),
    );

    if (existingItemIndex >= 0) {
      // Update quantity
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (newQuantity > availableStock) {
        return res.status(400).json({
          error: true,
          success: false,
          message: `Cannot add more. Only ${availableStock} items available`,
        });
      }
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        variant: variantId || null,
        variantName: variantName || "",
        price,
        originalPrice: originalPrice || 0,
      });
    }

    await cart.save();

    // Populate and return
    await cart.populate({
      path: "items.product",
      select:
        "name brand price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory demandStatus variants",
    });

    res.status(200).json({
      error: false,
      success: true,
      message: "Added to cart",
      data: {
        items: cart.items,
        subtotal: cart.subtotal,
        itemCount: cart.itemCount,
      },
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to add to cart",
    });
  }
};

/**
 * Update cart item quantity
 * @route PUT /api/cart/update
 */
export const updateCartItem = async (req, res) => {
  try {
    const { userId, sessionId } = getActorIdentifiers(req);
    const productId = String(req.body?.productId || "").trim();
    const quantity = normalizeQuantity(req.body?.quantity);
    const variantId = normalizeVariantId(req.body?.variantId);

    if (!productId || quantity === null) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Product ID and quantity are required",
      });
    }

    if (!isValidObjectId(productId)) {
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

    if (quantity < 0 || quantity > MAX_CART_ITEM_QTY) {
      return res.status(400).json({
        error: true,
        success: false,
        message: `Quantity must be between 0 and ${MAX_CART_ITEM_QTY}`,
      });
    }

    // Find cart
    let cart;
    if (userId) {
      cart = await CartModel.findOne({ user: userId });
    } else if (sessionId) {
      cart = await CartModel.findOne({ sessionId });
    }

    if (!cart) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Cart not found",
      });
    }

    // Find item
    const itemIndex = cart.items.findIndex(
      (item) =>
        item.product.toString() === productId &&
        isSameVariant(item.variant, variantId),
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Item not in cart",
      });
    }

    if (quantity <= 0) {
      // Remove item
      cart.items.splice(itemIndex, 1);
    } else {
      // Check stock
      const product = await ProductModel.findById(productId);
      if (!product || !product.isActive) {
        return res.status(404).json({
          error: true,
          success: false,
          message: "Product not found or unavailable",
        });
      }
      let availableStock = getAvailableQuantity(product, variantId);

      if (variantId && product.hasVariants) {
        const variant = product.variants.id(variantId);
        if (!variant) {
          return res.status(400).json({
            error: true,
            success: false,
            message: "Selected variant is not available",
          });
        }
        const variantStock = Number(variant.stock_quantity ?? variant.stock ?? 0);
        const variantReserved = Number(variant.reserved_quantity ?? 0);
        availableStock = Math.max(variantStock - variantReserved, 0);
      }

      if (Number.isFinite(availableStock) && quantity > availableStock) {
        return res.status(400).json({
          error: true,
          success: false,
          message: `Only ${availableStock} items available`,
        });
      }

      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();

    await cart.populate({
      path: "items.product",
      select:
        "name brand price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory demandStatus variants",
    });

    res.status(200).json({
      error: false,
      success: true,
      message: "Cart updated",
      data: {
        items: cart.items,
        subtotal: cart.subtotal,
        itemCount: cart.itemCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update cart",
    });
  }
};

/**
 * Remove item from cart
 * @route DELETE /api/cart/remove/:productId
 */
export const removeFromCart = async (req, res) => {
  try {
    const { userId, sessionId } = getActorIdentifiers(req);
    const productId = String(req.params?.productId || "").trim();
    const variantId = normalizeVariantId(req.query?.variantId);

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid product ID",
      });
    }

    let cart;
    if (userId) {
      cart = await CartModel.findOne({ user: userId });
    } else if (sessionId) {
      cart = await CartModel.findOne({ sessionId });
    }

    if (!cart) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Cart not found",
      });
    }

    cart.items = cart.items.filter(
      (item) =>
        !(
          (item.product._id || item.product).toString() === productId &&
          isSameVariant(item.variant, variantId)
        ),
    );

    await cart.save();

    // Populate product data before returning
    await cart.populate({
      path: "items.product",
      select: "name brand price originalPrice images thumbnail stock demandStatus",
    });

    res.status(200).json({
      error: false,
      success: true,
      message: "Item removed from cart",
      data: {
        items: cart.items,
        subtotal: cart.subtotal,
        itemCount: cart.itemCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to remove item",
    });
  }
};

/**
 * Clear cart
 * @route DELETE /api/cart/clear
 */
export const clearCart = async (req, res) => {
  try {
    const { userId, sessionId } = getActorIdentifiers(req);

    let cart;
    if (userId) {
      cart = await CartModel.findOne({ user: userId });
    } else if (sessionId) {
      cart = await CartModel.findOne({ sessionId });
    }

    if (cart) {
      cart.items = [];
      cart.couponCode = null;
      cart.couponDiscount = 0;
      await cart.save();
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Cart cleared",
      data: { items: [], subtotal: 0, itemCount: 0 },
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to clear cart",
    });
  }
};

/**
 * Merge guest cart with user cart on login
 * @route POST /api/cart/merge
 */
export const mergeCart = async (req, res) => {
  try {
    const userId = req.user;
    const sessionId = normalizeSessionId(req.body?.sessionId);

    if (!sessionId) {
      return res.status(200).json({
        error: false,
        success: true,
        message: "No guest cart to merge",
      });
    }

    const [guestCart, userCart] = await Promise.all([
      CartModel.findOne({ sessionId }),
      CartModel.findOne({ user: userId }),
    ]);

    if (!guestCart || guestCart.items.length === 0) {
      return res.status(200).json({
        error: false,
        success: true,
        message: "No guest cart to merge",
      });
    }

    if (!userCart) {
      // Transfer guest cart to user
      guestCart.user = userId;
      guestCart.sessionId = null;
      guestCart.expiresAt = null;
      await guestCart.save();
    } else {
      const productIds = [
        ...new Set(guestCart.items.map((item) => String(item.product || "")).filter(Boolean)),
      ];
      const products = await ProductModel.find({ _id: { $in: productIds } }).lean();
      const productMap = new Map(products.map((product) => [String(product._id), product]));

      // Merge items
      for (const guestItem of guestCart.items) {
        const productId = String(guestItem.product || "");
        const product = productMap.get(productId);
        if (!product || !product.isActive) {
          continue;
        }

        const variantId = normalizeVariantId(guestItem.variant);
        const requestedQty = Math.max(normalizeQuantity(guestItem.quantity) || 0, 0);
        if (requestedQty <= 0) {
          continue;
        }

        const availableStock = getAvailableQuantity(product, variantId);
        const maxAllowed = Number.isFinite(availableStock)
          ? Math.min(availableStock, MAX_CART_ITEM_QTY)
          : MAX_CART_ITEM_QTY;

        if (maxAllowed <= 0) {
          continue;
        }

        const existingIndex = userCart.items.findIndex(
          (item) =>
            item.product.toString() === productId &&
            isSameVariant(item.variant, variantId),
        );

        if (existingIndex >= 0) {
          const mergedQuantity = Math.min(
            Number(userCart.items[existingIndex].quantity || 0) + requestedQty,
            maxAllowed,
          );
          userCart.items[existingIndex].quantity = mergedQuantity;
        } else {
          const safeQuantity = Math.min(requestedQty, maxAllowed);
          if (safeQuantity <= 0) continue;

          userCart.items.push({
            product: guestItem.product,
            quantity: safeQuantity,
            variant: variantId || null,
            variantName: String(guestItem.variantName || "").trim().slice(0, 120),
            price: Number(guestItem.price || product.price || 0),
            originalPrice: Number(
              guestItem.originalPrice || product.originalPrice || product.price || 0,
            ),
          });
        }
      }
      await userCart.save();
      await CartModel.findByIdAndDelete(guestCart._id);
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Cart merged successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to merge cart",
    });
  }
};

export default {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  mergeCart,
};
