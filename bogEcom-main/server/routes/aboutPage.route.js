import express from "express";
import {
  getAboutPageAdmin,
  getAboutPageContent,
  resetAboutPage,
  updateAboutPage,
} from "../controllers/aboutPage.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/**
 * About Page Routes
 * Public route for fetching about content
 * Admin routes for managing about page
 */

// ==================== PUBLIC ROUTES ====================

// Get about page content (public)
router.get("/public", getAboutPageContent);

// ==================== ADMIN ROUTES ====================

// Get about page for admin editing
router.get("/admin", auth, admin, getAboutPageAdmin);

// Update about page
router.put("/admin", auth, admin, updateAboutPage);

// Reset about page to defaults
router.post("/admin/reset", auth, admin, resetAboutPage);

export default router;
