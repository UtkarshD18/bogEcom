import express from "express";
import {
  createSetting,
  deleteSetting,
  getAllSettings,
  getPublicSettings,
  getSettingByKey,
  updateSetting,
} from "../controllers/settings.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/**
 * Settings Routes
 * Public routes for fetching settings
 * Admin routes for managing settings
 */

// ==================== PUBLIC ROUTES ====================

// Get all public settings
router.get("/public", getPublicSettings);

// Get specific setting by key
router.get("/public/:key", getSettingByKey);

// ==================== ADMIN ROUTES ====================

// Get all settings (admin)
router.get("/admin/all", auth, admin, getAllSettings);

// Create new setting
router.post("/admin/create", auth, admin, createSetting);

// Update setting
router.put("/admin/:key", auth, admin, updateSetting);

// Delete setting
router.delete("/admin/:key", auth, admin, deleteSetting);

export default router;
