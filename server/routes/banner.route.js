import express from "express";
import {
  createBanner,
  deleteBanner,
  getAllBanners,
  getBannerById,
  getBanners,
  trackBannerClick,
  updateBanner,
} from "../controllers/banner.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import createPublicResponseCacheMiddleware, {
  getPublicResponseCacheTtlSeconds,
} from "../middlewares/publicResponseCache.js";

const router = express.Router();
const BANNER_CACHE_TTL_SECONDS = getPublicResponseCacheTtlSeconds(
  "PERF_RESPONSE_CACHE_BANNERS_TTL_SECONDS",
  120,
);
const bannerCache = createPublicResponseCacheMiddleware({
  namespaces: ["banners"],
  ttlSeconds: BANNER_CACHE_TTL_SECONDS,
});

/**
 * Banner Routes
 *
 * Public routes for viewing banners
 * Admin routes for CRUD operations
 */

// ==================== PUBLIC ROUTES ====================

// Get active banners
router.get("/", bannerCache, getBanners);

// Get single banner
router.get("/:id", bannerCache, getBannerById);

// Track banner click
router.post("/:id/click", trackBannerClick);

// ==================== ADMIN ROUTES ====================

// Get all banners (including inactive)
router.get("/admin/all", auth, admin, getAllBanners);

// Create banner
router.post("/", auth, admin, createBanner);

// Update banner
router.put("/:id", auth, admin, updateBanner);

// Delete banner
router.delete("/:id", auth, admin, deleteBanner);

export default router;
