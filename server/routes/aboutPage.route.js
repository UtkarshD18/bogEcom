import express from "express";
import {
  getAboutPageAdmin,
  getAboutPageContent,
  resetAboutPage,
  updateAboutPage,
} from "../controllers/aboutPage.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import createPublicResponseCacheMiddleware, {
  getPublicResponseCacheTtlSeconds,
} from "../middlewares/publicResponseCache.js";

const router = express.Router();
const ABOUT_CACHE_TTL_SECONDS = getPublicResponseCacheTtlSeconds(
  "PERF_RESPONSE_CACHE_CONTENT_TTL_SECONDS",
  180,
);
const aboutCache = createPublicResponseCacheMiddleware({
  namespaces: ["about"],
  ttlSeconds: ABOUT_CACHE_TTL_SECONDS,
});

/**
 * About Page Routes
 * Public route for fetching about content
 * Admin routes for managing about page
 */

// ==================== PUBLIC ROUTES ====================

// Get about page content (public)
router.get("/public", aboutCache, getAboutPageContent);

// ==================== ADMIN ROUTES ====================

// Get about page for admin editing
router.get("/admin", auth, admin, getAboutPageAdmin);

// Update about page
router.put("/admin", auth, admin, updateAboutPage);

// Reset about page to defaults
router.post("/admin/reset", auth, admin, resetAboutPage);

export default router;
