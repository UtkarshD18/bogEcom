import express from "express";
import {
  createOrder,
  createTestOrder,
  getAllOrders,
  getDashboardStats,
  getOrderById,
  getOrderStats,
  getPaymentGatewayStatus,
  getUserOrderById,
  getUserOrders,
  handlePhonePeWebhook,
  handleRazorpayWebhook,
  saveOrderForLater,
  updateOrderStatus,
  verifyPayment,
} from "../controllers/order.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import optionalAuth from "../middlewares/optionalAuth.js";
import {
  validateCreateOrderRequest,
  validateSaveOrderRequest,
  validateUpdateOrderStatusRequest,
  validateVerifyPaymentRequest,
  validateGetOrderRequest,
  validatePaginationQuery,
} from "../middlewares/orderValidation.js";

const router = express.Router();

/**
 * Order Routes
 *
 * Admin routes for managing orders
 * User routes for creating and viewing orders
 * Payment integration (PhonePe/Razorpay)
 *
 * Route Structure:
 * - Public routes: Payment status, webhooks
 * - Authenticated user routes: Create order, view orders
 * - Admin routes: View all orders, update status, statistics
 */

// ==================== WEBHOOKS (Public) ====================

// PhonePe webhook (signature verified server-side)
router.post("/webhook/phonepe", handlePhonePeWebhook);

// Razorpay webhook (signature verified server-side)
router.post("/webhook/razorpay", handleRazorpayWebhook);

// ==================== PUBLIC ROUTES ====================

// Check payment gateway status
router.get("/payment-status", getPaymentGatewayStatus);

// ==================== USER ROUTES ====================

// Create order (Checkout) - with validation
router.post(
  "/",
  optionalAuth,
  validateCreateOrderRequest,
  createOrder
);

// Save order for later - with validation
router.post(
  "/save-for-later",
  optionalAuth,
  validateSaveOrderRequest,
  saveOrderForLater
);

// Verify payment - with validation
router.post(
  "/verify-payment",
  optionalAuth,
  validateVerifyPaymentRequest,
  verifyPayment
);

// Get user's orders
router.get("/user/my-orders", optionalAuth, getUserOrders);

// Get user's single order (with ownership check)
router.get(
  "/user/order/:orderId",
  auth,
  validateGetOrderRequest,
  getUserOrderById
);

// ==================== TEST ROUTES (Development Only) ====================

// Create test order (for testing without payment gateway)
router.post("/test/create", createTestOrder);

// ==================== ADMIN ROUTES ====================

// Get all orders (admin)
router.get(
  "/admin/all",
  auth,
  admin,
  validatePaginationQuery,
  getAllOrders
);

// Get order statistics
router.get("/admin/stats", auth, admin, getOrderStats);

// Get dashboard statistics
router.get("/admin/dashboard-stats", auth, admin, getDashboardStats);

// Get single order
router.get(
  "/:id",
  auth,
  admin,
  validateGetOrderRequest,
  getOrderById
);

// Update order status
router.put(
  "/:id/status",
  auth,
  admin,
  validateUpdateOrderStatusRequest,
  updateOrderStatus
);

export default router;
