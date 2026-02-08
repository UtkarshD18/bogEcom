import express from "express";
import {
  createBlog,
  deleteBlog,
  getAllBlogs,
  getAllBlogsAdmin,
  getBlogById,
  getBlogBySlug,
  updateBlog,
} from "../controllers/blog.controller.js";
import {
  getBlogPageAdmin,
  getBlogPageContent,
  updateBlogPage,
} from "../controllers/blogPage.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/**
 * Blogs Landing Page Config (Theme/Layout) - must be above `/:slug`
 */
router.get("/page/public", getBlogPageContent);
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
router.get("/", getAllBlogs);

// Get single blog by slug
router.get("/:slug", getBlogBySlug);

export default router;
