import express from "express";
import {
  createBlog,
  deleteBlog,
  getAllBlogs,
  getAllBlogsAdmin,
  getBlogById,
  getBlogBySlug,
  incrementBlogViewCountBestEffort,
  updateBlog,
} from "../controllers/blog.controller.js";
import {
  getBlogPageAdmin,
  getBlogPageContent,
  updateBlogPage,
} from "../controllers/blogPage.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import createPublicResponseCacheMiddleware, {
  getPublicResponseCacheTtlSeconds,
} from "../middlewares/publicResponseCache.js";

const router = express.Router();
const BLOG_CACHE_TTL_SECONDS = getPublicResponseCacheTtlSeconds(
  "PERF_RESPONSE_CACHE_CONTENT_TTL_SECONDS",
  180,
);
const blogCache = createPublicResponseCacheMiddleware({
  namespaces: ["blogs"],
  ttlSeconds: BLOG_CACHE_TTL_SECONDS,
});
const blogDetailCache = createPublicResponseCacheMiddleware({
  namespaces: ["blogs"],
  ttlSeconds: BLOG_CACHE_TTL_SECONDS,
  onHit: (req) => incrementBlogViewCountBestEffort(req.params.slug),
});

/**
 * Blogs Landing Page Config (Theme/Layout) - must be above `/:slug`
 */
router.get("/page/public", blogCache, getBlogPageContent);
router.get("/page/admin", auth, admin, getBlogPageAdmin);
router.put("/page/admin", auth, admin, updateBlogPage);

/**
 * Admin Routes (must come first!)
 */
// Get all blogs including drafts
router.get("/admin/all", auth, admin, getAllBlogsAdmin);

// Get single blog by ID (for editing)
router.get("/admin/:id", auth, admin, getBlogById);

// Create blog
router.post("/", auth, admin, createBlog);

// Update blog
router.put("/:id", auth, admin, updateBlog);

// Delete blog
router.delete("/:id", auth, admin, deleteBlog);

/**
 * Public Routes
 */
// Get all published blogs
router.get("/", blogCache, getAllBlogs);

// Get single blog by slug
router.get("/:slug", blogDetailCache, getBlogBySlug);

export default router;
