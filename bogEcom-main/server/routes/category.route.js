import express from "express";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  getCategoryTree,
  reorderCategories,
  updateCategory,
} from "../controllers/category.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/**
 * Category Routes
 *
 * Public routes for viewing categories
 * Admin routes for CRUD operations
 */

// ==================== PUBLIC ROUTES ====================

// Get all categories
router.get("/", getCategories);

// Get category tree (hierarchical)
router.get("/tree", getCategoryTree);

// Get single category by ID or slug
router.get("/:id", getCategoryById);

// ==================== ADMIN ROUTES ====================

// Create category
router.post("/", auth, admin, createCategory);

// Update category
router.put("/:id", auth, admin, updateCategory);

// Delete category
router.delete("/:id", auth, admin, deleteCategory);

// Reorder categories
router.patch("/reorder", auth, admin, reorderCategories);

export default router;
