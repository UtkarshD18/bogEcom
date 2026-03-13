import express from "express";
import auth from "../middlewares/auth.js";
import admin from "../middlewares/admin.js";
import optionalAuth from "../middlewares/optionalAuth.js";
import {
  createCombo,
  deleteCombo,
  duplicateCombo,
  generateComboSuggestions,
  getAdminCombos,
  getCartUpsells,
  getComboAnalyticsDashboard,
  getComboById,
  getComboBySlug,
  getCombos,
  getComboSections,
  getComboOrderInsights,
  toggleCombo,
  updateCombo,
} from "../controllers/combo.controller.js";

const router = express.Router();

// Public
router.get("/", optionalAuth, getCombos);
router.get("/sections", optionalAuth, getComboSections);
router.post("/cart-upsell", optionalAuth, getCartUpsells);
router.get("/slug/:slug", optionalAuth, getComboBySlug);
router.get("/:id", optionalAuth, getComboById);

// Admin
router.get("/admin/all", auth, admin, getAdminCombos);
router.post("/admin/create", auth, admin, createCombo);
router.put("/admin/:id", auth, admin, updateCombo);
router.delete("/admin/:id", auth, admin, deleteCombo);
router.post("/admin/:id/duplicate", auth, admin, duplicateCombo);
router.patch("/admin/:id/toggle", auth, admin, toggleCombo);
router.post("/admin/suggestions", auth, admin, generateComboSuggestions);
router.get("/admin/analytics", auth, admin, getComboAnalyticsDashboard);
router.get("/admin/analytics/orders", auth, admin, getComboOrderInsights);

export default router;
