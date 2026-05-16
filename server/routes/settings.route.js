import express from "express";
import {
  createSetting,
  deleteSetting,
  getAllSettings,
  getHeaderSettings,
  getMaintenanceStatus,
  getPublicSettings,
  getSettingByKey,
  updateHeaderSettings,
  updateSetting,
} from "../controllers/settings.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import createPublicResponseCacheMiddleware, {
  getPublicResponseCacheTtlSeconds,
} from "../middlewares/publicResponseCache.js";
import requireAdminPermission from "../middlewares/requireAdminPermission.js";

const router = express.Router();
const SETTINGS_CACHE_TTL_SECONDS = getPublicResponseCacheTtlSeconds(
  "PERF_RESPONSE_CACHE_SETTINGS_TTL_SECONDS",
  90,
);
const MAINTENANCE_STATUS_CACHE_TTL_SECONDS = getPublicResponseCacheTtlSeconds(
  "PERF_RESPONSE_CACHE_MAINTENANCE_STATUS_TTL_SECONDS",
  30,
);
const settingsCache = createPublicResponseCacheMiddleware({
  namespaces: ["settings"],
  ttlSeconds: SETTINGS_CACHE_TTL_SECONDS,
});
const maintenanceStatusCache = createPublicResponseCacheMiddleware({
  namespaces: ["settings"],
  ttlSeconds: MAINTENANCE_STATUS_CACHE_TTL_SECONDS,
});

/**
 * Settings Routes
 * Public routes for fetching settings
 * Admin routes for managing settings
 */

// ==================== PUBLIC ROUTES ====================

// Header appearance settings
router.get("/header", settingsCache, getHeaderSettings);

// Computed maintenance status
router.get("/maintenance-status", maintenanceStatusCache, getMaintenanceStatus);

// Get all public settings
router.get("/public", settingsCache, getPublicSettings);

// Get specific setting by key
router.get("/public/:key", settingsCache, getSettingByKey);

// ==================== ADMIN ROUTES ====================

// Get all settings (admin)
router.get(
  "/admin/all",
  auth,
  admin,
  requireAdminPermission("manage_settings"),
  getAllSettings,
);

// Create new setting
router.post(
  "/admin/create",
  auth,
  admin,
  requireAdminPermission("manage_settings"),
  createSetting,
);

// Update setting
router.put(
  "/admin/:key",
  auth,
  admin,
  requireAdminPermission("manage_settings"),
  updateSetting,
);

// Update header appearance setting
router.put(
  "/header",
  auth,
  admin,
  requireAdminPermission("manage_settings"),
  updateHeaderSettings,
);

// Delete setting
router.delete(
  "/admin/:key",
  auth,
  admin,
  requireAdminPermission("manage_settings"),
  deleteSetting,
);

export default router;
