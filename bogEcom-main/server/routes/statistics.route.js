import express from "express";
import {
  getCategoryPerformance,
  getCustomerMetrics,
  getDashboardStats,
  getOrderStatus,
  getPaymentMethods,
  getSalesTrend,
  getTopProducts,
  getUserGrowth,
} from "../controllers/statistics.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/**
 * Statistics Routes (Admin Only)
 *
 * All routes require authentication and admin privileges
 * Real-time data for admin dashboard analytics
 */

// Dashboard overview
router.get("/dashboard", auth, admin, getDashboardStats);

// Sales trends (line chart)
router.get("/sales-trend", auth, admin, getSalesTrend);

// Top selling products (bar chart)
router.get("/top-products", auth, admin, getTopProducts);

// Order status breakdown (pie/donut chart)
router.get("/order-status", auth, admin, getOrderStatus);

// Category performance (bar chart)
router.get("/category-performance", auth, admin, getCategoryPerformance);

// User growth over time (line chart)
router.get("/user-growth", auth, admin, getUserGrowth);

// Customer metrics and analysis
router.get("/customer-metrics", auth, admin, getCustomerMetrics);

// Payment method breakdown (pie chart)
router.get("/payment-methods", auth, admin, getPaymentMethods);

export default router;
