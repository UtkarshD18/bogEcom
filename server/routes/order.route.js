import express from "express";
import {
  createOrder,
  createTestOrder,
  downloadOrderInvoice,
  getAllOrders,
  getDashboardStats,
  getOrderById,
  getOrderStats,
  getPaymentGatewayStatus,
  getUserOrderById,
  getUserOrders,
  handlePhonePeWebhook,
  saveOrderForLater,
  updateOrderStatus,
} from "../controllers/order.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import optionalAuth from "../middlewares/optionalAuth.js";
import {
  validateCreateOrderRequest,
  validateSaveOrderRequest,
  validateUpdateOrderStatusRequest,
  validateGetOrderRequest,
  validatePaginationQuery,
} from "../middlewares/orderValidation.js";

const router = express.Router();

/**
 * Order Routes
 *
 * Admin routes for managing orders
 * User routes for creating and viewing orders
 * Payment integration (PhonePe)
 *
 * Route Structure:
 * - Public routes: Payment status, webhooks
 * - Authenticated user routes: Create order, view orders
 * - Admin routes: View all orders, update status, statistics
 */

// ==================== WEBHOOKS (Public) ====================

// PhonePe webhook (signature verified server-side)
router.post("/webhook/phonepe", handlePhonePeWebhook);

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

// Get user's orders
router.get("/user/my-orders", auth, getUserOrders);

// Alias for authenticated user orders
router.get("/my-orders", auth, getUserOrders);

// Get user's single order (with ownership check)
router.get(
  "/user/order/:orderId",
  auth,
  validateGetOrderRequest,
  getUserOrderById
);

// Download invoice (user own order or admin any order)
router.get("/:orderId/invoice", auth, downloadOrderInvoice);

// ==================== TEST ROUTES (Development Only) ====================

// Create test order (for testing without payment gateway)
if (process.env.NODE_ENV !== "production") {
  router.post("/test/create", createTestOrder);
}

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

// Get single order (admin or order owner)
router.get(
  "/:id",
  auth,
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

// Admin status update via PATCH (Zod validated)

export default router;
