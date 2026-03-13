import CartModel from "../models/cart.model.js";
import mongoose from "mongoose";
import ProductModel from "../models/product.model.js";
import ComboModel from "../models/combo.model.js";
import { checkExclusiveAccess } from "../middlewares/membershipGuard.js";
import {
  buildComboOrderSnapshot,
  computeComboAvailability,
  evaluateComboEligibility,
} from "../services/combos/combo.service.js";

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

const canUserAccessExclusiveProducts = async (userId) => {
  if (!userId) return false;
  return checkExclusiveAccess(userId);
};

const normalizeItemType = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "combo" ? "combo" : "product";
};

const resolveItemTypeFromRequest = (req) =>
  normalizeItemType(req.body?.itemType || req.query?.itemType || "");

const isComboCartItem = (item) =>
  item?.itemType === "combo" || Boolean(item?.combo || item?.comboSnapshot?.comboId);

const normalizeComboId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw;
};

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
    const hasExclusiveAccess = await canUserAccessExclusiveProducts(userId);

    let cart;
    if (userId) {
      cart = await CartModel.findOne({ user: userId }).populate({
        path: "items.product",
        select:
          "name brand price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory isActive demandStatus hasVariants variants isExclusive",
      }).populate({
        path: "items.combo",
        select:
          "name slug comboPrice originalTotal totalSavings comboType isActive isVisible startDate endDate stockMode stockQuantity reservedQuantity items",
      });
    } else if (sessionId) {
      cart = await CartModel.findOne({ sessionId }).populate({
        path: "items.product",
        select:
          "name brand price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory isActive demandStatus hasVariants variants isExclusive",
      }).populate({
        path: "items.combo",
        select:
          "name slug comboPrice originalTotal totalSavings comboType isActive isVisible startDate endDate stockMode stockQuantity reservedQuantity items",
      });
    }

    if (!cart) {
      return res.status(200).json({
        error: false,
        success: true,
        data: { items: [], subtotal: 0, itemCount: 0 },
      });
    }

    // Filter out unavailable products and refresh current prices.
    // Important: keep variant cart lines on the selected variant price, not base product price.
    const validItems = [];
    for (const item of cart.items) {
      if (isComboCartItem(item)) {
        const combo = item.combo;
        if (!combo) {
          continue;
        }

        const eligibility = evaluateComboEligibility(combo);
        if (!eligibility.eligible) {
          continue;
        }

        const comboPrice = Number(combo.comboPrice || 0);
        const comboOriginal = Number(combo.originalTotal || 0);
        if (Number(item.price ?? 0) !== comboPrice) {
          item.price = comboPrice;
        }
        if (Number(item.originalPrice ?? 0) !== comboOriginal) {
          item.originalPrice = comboOriginal;
        }

        const snapshot = buildComboOrderSnapshot(combo, item.quantity || 1);
        if (snapshot) {
          item.comboSnapshot = snapshot;
        }

        validItems.push(item);
        continue;
      }

      if (
        item.product &&
        item.product.isActive &&
        (hasExclusiveAccess || item.product.isExclusive !== true)
      ) {
        let nextPrice = Number(item.product.price ?? 0);
        let nextOriginalPrice = Number(item.product.originalPrice ?? 0);
        let nextVariantName = String(item.variantName || "").trim();

        const selectedVariantId = normalizeVariantId(item.variant);
        if (
          selectedVariantId &&
          item.product.hasVariants &&
          Array.isArray(item.product.variants)
        ) {
          const variant = item.product.variants.id
            ? item.product.variants.id(selectedVariantId)
            : item.product.variants.find(
                (v) => String(v?._id) === String(selectedVariantId),
              );

          // Variant was removed/invalid, so this cart line is no longer valid.
          if (!variant) {
            continue;
          }

          nextPrice = Number(variant.price ?? item.product.price ?? 0);
          nextOriginalPrice = Number(
            variant.originalPrice ?? item.product.originalPrice ?? nextPrice,
          );
          if (variant.name) {
            nextVariantName = String(variant.name).trim().slice(0, 120);
          }
        }

        if (Number(item.price ?? 0) !== nextPrice) {
          item.price = nextPrice;
        }
        if (Number(item.originalPrice ?? 0) !== nextOriginalPrice) {
          item.originalPrice = nextOriginalPrice;
        }
        if (String(item.variantName || "").trim() !== nextVariantName) {
          item.variantName = nextVariantName;
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
    const itemType = resolveItemTypeFromRequest(req);
    const productId = String(req.body?.productId || "").trim();
    const variantId = normalizeVariantId(req.body?.variantId);
    const variantName = String(req.body?.variantName || "").trim().slice(0, 120);
    const quantity = normalizeQuantity(req.body?.quantity ?? 1);

    if (itemType === "combo" || req.body?.comboId) {
      const comboId = normalizeComboId(req.body?.comboId || req.body?.id || productId);
      if (!comboId || !isValidObjectId(comboId)) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Valid combo ID is required",
        });
      }

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_ITEM_QTY) {
        return res.status(400).json({
          error: true,
          success: false,
          message: `Quantity must be an integer between 1 and ${MAX_CART_ITEM_QTY}`,
        });
      }

      const combo = await ComboModel.findById(comboId).lean();
      if (!combo) {
        return res.status(404).json({
          error: true,
          success: false,
          message: "Combo not found or unavailable",
        });
      }

      const eligibility = evaluateComboEligibility(combo);
      if (!eligibility.eligible) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Combo is not available",
        });
      }

      if (combo.maxPerOrder && quantity > combo.maxPerOrder) {
        return res.status(400).json({
          error: true,
          success: false,
          message: `Combo quantity cannot exceed ${combo.maxPerOrder}`,
        });
      }

      const availability = await computeComboAvailability(combo);
      if (availability.available < quantity) {
        return res.status(400).json({
          error: true,
          success: false,
          message: `Only ${availability.available} combos available`,
        });
      }

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

      const existingIndex = cart.items.findIndex(
        (item) =>
          isComboCartItem(item) && String(item.combo || "") === String(comboId),
      );

      if (existingIndex >= 0) {
        const newQuantity = cart.items[existingIndex].quantity + quantity;
        if (newQuantity > availability.available) {
          return res.status(400).json({
            error: true,
            success: false,
            message: `Cannot add more. Only ${availability.available} combos available`,
          });
        }
        cart.items[existingIndex].quantity = newQuantity;
        cart.items[existingIndex].price = Number(combo.comboPrice || 0);
        cart.items[existingIndex].originalPrice = Number(combo.originalTotal || 0);
        cart.items[existingIndex].comboSnapshot = buildComboOrderSnapshot(combo, newQuantity);
      } else {
        cart.items.push({
          itemType: "combo",
          combo: comboId,
          quantity,
          price: Number(combo.comboPrice || 0),
          originalPrice: Number(combo.originalTotal || 0),
          comboSnapshot: buildComboOrderSnapshot(combo, quantity),
        });
      }

      await cart.save();

      await cart.populate({
        path: "items.product",
        select:
          "name brand price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory demandStatus hasVariants variants isExclusive",
      });
      await cart.populate({
        path: "items.combo",
        select:
          "name slug comboPrice originalTotal totalSavings comboType isActive isVisible startDate endDate stockMode stockQuantity reservedQuantity items",
      });

      return res.status(200).json({
        error: false,
        success: true,
        message: "Added combo to cart",
        data: {
          items: cart.items,
          subtotal: cart.subtotal,
          itemCount: cart.itemCount,
        },
      });
    }

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

    if (product.isExclusive) {
      if (!userId) {
        return res.status(403).json({
          error: true,
          success: false,
          message:
            "Login with an active membership to add exclusive products.",
        });
      }

      const hasExclusiveAccess = await canUserAccessExclusiveProducts(userId);
      if (!hasExclusiveAccess) {
        return res.status(403).json({
          error: true,
          success: false,
          message: "Active membership required for exclusive products.",
        });
      }
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
        "name brand price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory demandStatus hasVariants variants isExclusive",
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
    const itemType = resolveItemTypeFromRequest(req);
    const productId = String(req.body?.productId || "").trim();
    const quantity = normalizeQuantity(req.body?.quantity);
    const variantId = normalizeVariantId(req.body?.variantId);

    if (itemType === "combo" || req.body?.comboId) {
      const comboId = normalizeComboId(req.body?.comboId || req.body?.id || productId);
      if (!comboId || !isValidObjectId(comboId)) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Invalid combo ID",
        });
      }

      if (quantity === null || quantity > MAX_CART_ITEM_QTY) {
        return res.status(400).json({
          error: true,
          success: false,
          message: `Quantity must be between 0 and ${MAX_CART_ITEM_QTY}`,
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

      const itemIndex = cart.items.findIndex(
        (item) =>
          isComboCartItem(item) && String(item.combo || "") === String(comboId),
      );

      if (itemIndex === -1) {
        return res.status(404).json({
          error: true,
          success: false,
          message: "Combo not in cart",
        });
      }

      if (quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        const combo = await ComboModel.findById(comboId).lean();
        if (!combo) {
          return res.status(404).json({
            error: true,
            success: false,
            message: "Combo not found or unavailable",
          });
        }

        const eligibility = evaluateComboEligibility(combo);
        if (!eligibility.eligible) {
          return res.status(400).json({
            error: true,
            success: false,
            message: "Combo is not available",
          });
        }

        const availability = await computeComboAvailability(combo);
        if (availability.available < quantity) {
          return res.status(400).json({
            error: true,
            success: false,
            message: `Only ${availability.available} combos available`,
          });
        }

        cart.items[itemIndex].quantity = quantity;
        cart.items[itemIndex].price = Number(combo.comboPrice || 0);
        cart.items[itemIndex].originalPrice = Number(combo.originalTotal || 0);
        cart.items[itemIndex].comboSnapshot = buildComboOrderSnapshot(combo, quantity);
      }

      await cart.save();

      await cart.populate({
        path: "items.product",
        select:
          "name brand price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory demandStatus hasVariants variants isExclusive",
      });
      await cart.populate({
        path: "items.combo",
        select:
          "name slug comboPrice originalTotal totalSavings comboType isActive isVisible startDate endDate stockMode stockQuantity reservedQuantity items",
      });

      return res.status(200).json({
        error: false,
        success: true,
        message: "Cart updated",
        data: {
          items: cart.items,
          subtotal: cart.subtotal,
          itemCount: cart.itemCount,
        },
      });
    }

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

      if (product.isExclusive) {
        if (!userId) {
          return res.status(403).json({
            error: true,
            success: false,
            message:
              "Login with an active membership to buy exclusive products.",
          });
        }

        const hasExclusiveAccess = await canUserAccessExclusiveProducts(userId);
        if (!hasExclusiveAccess) {
          return res.status(403).json({
            error: true,
            success: false,
            message: "Active membership required for exclusive products.",
          });
        }
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
        "name brand price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory demandStatus hasVariants variants isExclusive",
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
    const itemType = normalizeItemType(req.query?.itemType || req.body?.itemType || "");
    const productId = String(req.params?.productId || "").trim();
    const variantId = normalizeVariantId(req.query?.variantId);
    const comboId = normalizeComboId(req.query?.comboId || productId);

    if (itemType === "combo" || req.query?.comboId) {
      if (!comboId || !isValidObjectId(comboId)) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Invalid combo ID",
        });
      }
    } else {
      if (!productId || !isValidObjectId(productId)) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Invalid product ID",
        });
      }
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

    if (itemType === "combo" || req.query?.comboId) {
      cart.items = cart.items.filter((item) => {
        if (!isComboCartItem(item)) return true;
        const itemComboId = String(item.combo || item.comboSnapshot?.comboId || "");
        return itemComboId !== comboId;
      });
    } else {
      cart.items = cart.items.filter((item) => {
        if (isComboCartItem(item)) return true;
        const itemProductId = String(item.product?._id || item.product || "");
        return !(itemProductId === productId && isSameVariant(item.variant, variantId));
      });
    }

    await cart.save();

    // Populate product data before returning
    await cart.populate({
      path: "items.product",
      select:
        "name brand price originalPrice images thumbnail stock stock_quantity reserved_quantity track_inventory trackInventory demandStatus hasVariants variants isExclusive",
    });
    await cart.populate({
      path: "items.combo",
      select:
        "name slug comboPrice originalTotal totalSavings comboType isActive isVisible startDate endDate stockMode stockQuantity reservedQuantity items",
    });

    res.status(200).json({
      error: false,
      success: true,
      message:
        itemType === "combo" || req.query?.comboId
          ? "Combo removed from cart"
          : "Item removed from cart",
      data: {
        items: cart.items,
        subtotal: cart.subtotal,
        itemCount: cart.itemCount,
        totalSavings: cart.totalSavings,
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
    const hasExclusiveAccess = await canUserAccessExclusiveProducts(userId);

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
      const guestProductItems = guestCart.items.filter((item) => !isComboCartItem(item));
      const guestComboItems = guestCart.items.filter((item) => isComboCartItem(item));

      const productIds = [
        ...new Set(
          guestProductItems
            .map((item) => String(item.product || ""))
            .filter(Boolean),
        ),
      ];
      const comboIds = [
        ...new Set(
          guestComboItems
            .map((item) => String(item.combo || item.comboSnapshot?.comboId || ""))
            .filter(Boolean),
        ),
      ];

      const [products, combos] = await Promise.all([
        productIds.length
          ? ProductModel.find({ _id: { $in: productIds } }).lean()
          : [],
        comboIds.length ? ComboModel.find({ _id: { $in: comboIds } }).lean() : [],
      ]);

      const productMap = new Map(products.map((product) => [String(product._id), product]));
      const comboMap = new Map(combos.map((combo) => [String(combo._id), combo]));

      // Merge items
      for (const guestItem of guestProductItems) {
        const productId = String(guestItem.product || "");
        const product = productMap.get(productId);
        if (!product || !product.isActive) {
          continue;
        }
        if (product.isExclusive && !hasExclusiveAccess) {
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

      for (const guestItem of guestComboItems) {
        const comboId = String(guestItem.combo || guestItem.comboSnapshot?.comboId || "");
        const combo = comboMap.get(comboId);
        if (!combo) continue;

        const eligibility = evaluateComboEligibility(combo);
        if (!eligibility.eligible) continue;

        const requestedQty = Math.max(normalizeQuantity(guestItem.quantity) || 0, 0);
        if (requestedQty <= 0) continue;

        const availability = await computeComboAvailability(combo);
        const maxPerOrder = combo.maxPerOrder ? Math.max(Number(combo.maxPerOrder), 1) : MAX_CART_ITEM_QTY;
        const maxAllowed = Math.min(
          Number.isFinite(availability.available) ? availability.available : MAX_CART_ITEM_QTY,
          maxPerOrder,
          MAX_CART_ITEM_QTY,
        );

        if (maxAllowed <= 0) continue;

        const existingIndex = userCart.items.findIndex(
          (item) =>
            isComboCartItem(item) &&
            String(item.combo || item.comboSnapshot?.comboId || "") === comboId,
        );

        if (existingIndex >= 0) {
          const currentQty = Number(userCart.items[existingIndex].quantity || 0);
          const mergedQuantity = Math.min(currentQty + requestedQty, maxAllowed);
          if (mergedQuantity <= 0) continue;
          userCart.items[existingIndex].quantity = mergedQuantity;
          userCart.items[existingIndex].price = Number(combo.comboPrice || 0);
          userCart.items[existingIndex].originalPrice = Number(combo.originalTotal || 0);
          userCart.items[existingIndex].comboSnapshot = buildComboOrderSnapshot(
            combo,
            mergedQuantity,
          );
        } else {
          const safeQuantity = Math.min(requestedQty, maxAllowed);
          if (safeQuantity <= 0) continue;

          userCart.items.push({
            itemType: "combo",
            combo: comboId,
            quantity: safeQuantity,
            price: Number(combo.comboPrice || 0),
            originalPrice: Number(combo.originalTotal || 0),
            comboSnapshot: buildComboOrderSnapshot(combo, safeQuantity),
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
