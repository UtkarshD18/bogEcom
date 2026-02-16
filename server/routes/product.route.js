import express from "express";
import {
  bulkUpdateProducts,
  createProduct,
  deleteProduct,
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
router.get("/", getProducts);

// Get featured products
router.get("/featured", getFeaturedProducts);

// Get single product by ID or slug
router.get("/:id", getProductById);

// Get related products
router.get("/:id/related", getRelatedProducts);

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
