import CartModel from "../models/cart.model.js";
import ProductModel from "../models/product.model.js";

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
    const userId = req.user;
    const sessionId = req.headers["x-session-id"] || req.cookies.sessionId;

    let cart;
    if (userId) {
      cart = await CartModel.findOne({ user: userId }).populate({
        path: "items.product",
        select: "name price originalPrice images thumbnail stock isActive",
      });
    } else if (sessionId) {
      cart = await CartModel.findOne({ sessionId }).populate({
        path: "items.product",
        select: "name price originalPrice images thumbnail stock isActive",
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
    const userId = req.user;
    const sessionId = req.headers["x-session-id"] || req.cookies.sessionId;
    const { productId, quantity = 1, variantId, variantName } = req.body;

    if (!productId) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Product ID is required",
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
    let availableStock = product.stock;
    let price = product.price;
    let originalPrice = product.originalPrice;

    if (variantId && product.hasVariants) {
      const variant = product.variants.id(variantId);
      if (variant) {
        availableStock = variant.stock;
        price = variant.price;
        originalPrice = variant.originalPrice || product.originalPrice;
      }
    }

    if (availableStock < quantity) {
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
        (!variantId || item.variant?.toString() === variantId),
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
      select: "name price originalPrice images thumbnail stock",
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
    const userId = req.user;
    const sessionId = req.headers["x-session-id"] || req.cookies.sessionId;
    const { productId, quantity, variantId } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Product ID and quantity are required",
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
        (!variantId || item.variant?.toString() === variantId),
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
      let availableStock = product.stock;

      if (variantId && product.hasVariants) {
        const variant = product.variants.id(variantId);
        if (variant) availableStock = variant.stock;
      }

      if (quantity > availableStock) {
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
      select: "name price originalPrice images thumbnail stock",
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
    const userId = req.user;
    const sessionId = req.headers["x-session-id"] || req.cookies.sessionId;
    const { productId } = req.params;
    const { variantId } = req.query;

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
          item.product.toString() === productId &&
          (!variantId || item.variant?.toString() === variantId)
        ),
    );

    await cart.save();

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
    const userId = req.user;
    const sessionId = req.headers["x-session-id"] || req.cookies.sessionId;

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
    const { sessionId } = req.body;

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
      // Merge items
      for (const guestItem of guestCart.items) {
        const existingIndex = userCart.items.findIndex(
          (item) =>
            item.product.toString() === guestItem.product.toString() &&
            item.variant?.toString() === guestItem.variant?.toString(),
        );

        if (existingIndex >= 0) {
          userCart.items[existingIndex].quantity += guestItem.quantity;
        } else {
          userCart.items.push(guestItem);
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
