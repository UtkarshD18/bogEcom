import express from "express";
import {
  getNotificationStats,
  manualSendOffer,
  registerToken,
  unregisterToken,
} from "../controllers/notification.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import authOptional from "../middlewares/authOptional.js";

const router = express.Router();

/**
 * Notification Routes
 *
 * PUBLIC:
 * - POST /register - Register FCM token (guests + users)
 * - DELETE /unregister - Unregister token
 *
 * ADMIN:
 * - GET /admin/stats - Get notification stats
 * - POST /admin/send-offer - Manual offer notification
 */

// ==================== PUBLIC ROUTES ====================

// Register notification token
router.post("/register", authOptional, registerToken);

// Unregister notification token
router.delete("/unregister", unregisterToken);

// ==================== ADMIN ROUTES ====================

// Get notification stats
router.get("/admin/stats", auth, admin, getNotificationStats);

// Manual send offer notification
router.post("/admin/send-offer", auth, admin, manualSendOffer);

export default router;
