import express from "express";
import {
  createOrder,
  createTestOrder,
  getAllOrders,
  getDashboardStats,
  getOrderById,
  getOrderStats,
  getUserOrders,
  handleRazorpayWebhook,
  updateOrderStatus,
  verifyPayment,
} from "../controllers/order.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import optionalAuth from "../middlewares/optionalAuth.js";

const router = express.Router();

/**
 * Order Routes
 *
 * Admin routes for managing orders
 * User routes for creating and viewing orders
 */

// ==================== WEBHOOKS ====================

// Razorpay webhook (must be before other routes)
router.post("/webhook/razorpay", handleRazorpayWebhook);

// ==================== USER ROUTES ====================

// Create order (checkout)
router.post("/", optionalAuth, createOrder);

// Verify payment
router.post("/verify-payment", optionalAuth, verifyPayment);

// Get user's orders
router.get("/user/my-orders", optionalAuth, getUserOrders);

// ==================== TEST ROUTES (Development Only) ====================

// Create test order (for testing without Razorpay)
router.post("/test/create", createTestOrder);

// ==================== ADMIN ROUTES ====================

// Get all orders (admin)
router.get("/admin/all", auth, admin, getAllOrders);

// Get order statistics
router.get("/admin/stats", auth, admin, getOrderStats);

// Get dashboard statistics
router.get("/admin/dashboard-stats", auth, admin, getDashboardStats);

// Get single order
router.get("/:id", auth, admin, getOrderById);

// Update order status
router.put("/:id/status", auth, admin, updateOrderStatus);

export default router;
