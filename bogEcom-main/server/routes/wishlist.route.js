import express from "express";
import {
  addToWishlist,
  checkWishlist,
  clearWishlist,
  getWishlist,
  moveToCart,
  removeFromWishlist,
  toggleWishlist,
} from "../controllers/wishlist.controller.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/**
 * Wishlist Routes
 *
 * All routes require authentication
 */

// Get wishlist
router.get("/", auth, getWishlist);

// Add to wishlist
router.post("/add", auth, addToWishlist);

// Toggle wishlist (add/remove)
router.post("/toggle", auth, toggleWishlist);

// Check if product is in wishlist
router.get("/check/:productId", auth, checkWishlist);

// Remove from wishlist
router.delete("/remove/:productId", auth, removeFromWishlist);

// Clear wishlist
router.delete("/clear", auth, clearWishlist);

// Move item from wishlist to cart
router.post("/move-to-cart", auth, moveToCart);

export default router;
