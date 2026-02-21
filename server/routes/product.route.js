import express from "express";
import {
  bulkUpdateProducts,
  createProduct,
  deleteProduct,
  getExclusiveProducts,
  getFeaturedProducts,
  getProductById,
  getProducts,
  getRelatedProducts,
  updateDemandStatus,
  updateProduct,
  updateStock,
} from "../controllers/product.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import {
  attachMembershipStatus,
  requireActiveMembership,
} from "../middlewares/membershipGuard.js";
import optionalAuth from "../middlewares/optionalAuth.js";

const router = express.Router();

/**
 * Product Routes
 *
 * Public routes for viewing products
 * Protected routes for reviews
 * Admin routes for CRUD operations
 */

// ==================== PUBLIC ROUTES ====================

// Get all products (with filters, pagination, search)
router.get("/", optionalAuth, attachMembershipStatus, getProducts);

// Get featured products
router.get("/featured", optionalAuth, attachMembershipStatus, getFeaturedProducts);

// Get exclusive products (members only)
// Security: auth + membership guard prevents non-members from receiving data.
router.get("/exclusive", auth, requireActiveMembership, getExclusiveProducts);

// Get related products
router.get("/:id/related", optionalAuth, attachMembershipStatus, getRelatedProducts);

// Get single product by ID or slug
router.get("/:id", optionalAuth, attachMembershipStatus, getProductById);

// ==================== ADMIN ROUTES ====================

// Create product (images are uploaded separately via /api/upload and URLs sent in body)
router.post("/", auth, admin, createProduct);

// Update product
router.put("/:id", auth, admin, updateProduct);

// Delete product
router.delete("/:id", auth, admin, deleteProduct);

// Bulk update products
router.patch("/bulk", auth, admin, bulkUpdateProducts);

// Update stock
router.patch("/:id/stock", auth, admin, updateStock);

// Update demand status (High Demand flag)
router.patch("/:id/demand", auth, admin, updateDemandStatus);

export default router;
