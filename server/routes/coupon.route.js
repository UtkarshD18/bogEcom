import express from "express";
import {
  createCoupon,
  deleteCoupon,
  getAllCoupons,
  updateCoupon,
  validateCoupon,
} from "../controllers/coupon.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import optionalAuth from "../middlewares/optionalAuth.js";

const router = express.Router();

/**
 * Coupon Routes
 *
 * Public routes for coupon validation
 * Admin routes for CRUD operations
 */

// ==================== PUBLIC ROUTES ====================

// Validate coupon and calculate discount
router.post("/validate", optionalAuth, validateCoupon);

// ==================== ADMIN ROUTES ====================

// Get all coupons
router.get("/admin/all", auth, admin, getAllCoupons);

// Create coupon
router.post("/admin/create", auth, admin, createCoupon);

// Update coupon
router.put("/admin/:id", auth, admin, updateCoupon);

// Delete coupon
router.delete("/admin/:id", auth, admin, deleteCoupon);

export default router;
