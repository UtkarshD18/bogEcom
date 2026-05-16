import express from "express";
import {
  createSlide,
  deleteSlide,
  getAllSlides,
  getHomeSlides,
  getSlideById,
  reorderSlides,
  updateSlide,
} from "../controllers/homeSlide.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import createPublicResponseCacheMiddleware, {
  getPublicResponseCacheTtlSeconds,
} from "../middlewares/publicResponseCache.js";

const router = express.Router();
const HOME_SLIDE_CACHE_TTL_SECONDS = getPublicResponseCacheTtlSeconds(
  "PERF_RESPONSE_CACHE_HOME_SLIDES_TTL_SECONDS",
  120,
);
const homeSlideCache = createPublicResponseCacheMiddleware({
  namespaces: ["home-slides"],
  ttlSeconds: HOME_SLIDE_CACHE_TTL_SECONDS,
});

/**
 * Home Slide Routes
 *
 * Public routes for viewing slides
 * Admin routes for CRUD operations
 */

// ==================== PUBLIC ROUTES ====================

// Get active slides
router.get("/", homeSlideCache, getHomeSlides);

// Get single slide
router.get("/:id", homeSlideCache, getSlideById);

// ==================== ADMIN ROUTES ====================

// Get all slides (including inactive)
router.get("/admin/all", auth, admin, getAllSlides);

// Create slide
router.post("/", auth, admin, createSlide);

// Update slide
router.put("/:id", auth, admin, updateSlide);

// Delete slide
router.delete("/:id", auth, admin, deleteSlide);

// Reorder slides
router.patch("/reorder", auth, admin, reorderSlides);

export default router;
