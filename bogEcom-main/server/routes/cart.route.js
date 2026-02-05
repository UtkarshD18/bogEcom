import express from "express";
import {
  addToCart,
  clearCart,
  getCart,
  mergeCart,
  removeFromCart,
  updateCartItem,
} from "../controllers/cart.controller.js";
import auth from "../middlewares/auth.js";
import optionalAuth from "../middlewares/optionalAuth.js";

const router = express.Router();

/**
 * Cart Routes
 *
 * Supports both authenticated users and guests (via session ID)
 */

// Get cart (works for both auth users and guests with session ID)
router.get("/", optionalAuth, getCart);

// Add to cart
router.post("/add", optionalAuth, addToCart);

// Update cart item quantity
router.put("/update", optionalAuth, updateCartItem);

// Remove from cart
router.delete("/remove/:productId", optionalAuth, removeFromCart);

// Clear cart
router.delete("/clear", optionalAuth, clearCart);

// Merge guest cart with user cart (after login)
router.post("/merge", auth, mergeCart);

export default router;
