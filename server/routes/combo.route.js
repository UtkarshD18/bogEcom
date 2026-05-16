import express from "express";
import auth from "../middlewares/auth.js";
import admin from "../middlewares/admin.js";
import optionalAuth from "../middlewares/optionalAuth.js";
import {
  createCombo,
  deleteCombo,
  duplicateCombo,
  generateComboSuggestions,
  getComboDrafts,
  updateComboDraft,
  approveComboDraft,
  rejectComboDraft,
  publishComboDraft,
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
import createPublicResponseCacheMiddleware, {
  getPublicResponseCacheTtlSeconds,
} from "../middlewares/publicResponseCache.js";

const router = express.Router();
const COMBO_CACHE_TTL_SECONDS = getPublicResponseCacheTtlSeconds(
  "PERF_RESPONSE_CACHE_COMBOS_TTL_SECONDS",
  60,
);
const comboCache = createPublicResponseCacheMiddleware({
  namespaces: ["combos", "products"],
  ttlSeconds: COMBO_CACHE_TTL_SECONDS,
});

// Admin
router.get("/admin/all", auth, admin, getAdminCombos);
router.post("/admin/create", auth, admin, createCombo);
router.put("/admin/:id", auth, admin, updateCombo);
router.delete("/admin/:id", auth, admin, deleteCombo);
router.post("/admin/:id/duplicate", auth, admin, duplicateCombo);
router.patch("/admin/:id/toggle", auth, admin, toggleCombo);
router.post("/admin/suggestions", auth, admin, generateComboSuggestions);
router.get("/admin/drafts", auth, admin, getComboDrafts);
router.put("/admin/drafts/:id", auth, admin, updateComboDraft);
router.patch("/admin/drafts/:id/approve", auth, admin, approveComboDraft);
router.patch("/admin/drafts/:id/reject", auth, admin, rejectComboDraft);
router.patch("/admin/drafts/:id/publish", auth, admin, publishComboDraft);
router.get("/admin/analytics", auth, admin, getComboAnalyticsDashboard);
router.get("/admin/analytics/orders", auth, admin, getComboOrderInsights);

// Public
router.get("/", comboCache, optionalAuth, getCombos);
router.get("/sections", comboCache, optionalAuth, getComboSections);
router.post("/cart-upsell", optionalAuth, getCartUpsells);
router.get("/slug/:slug", comboCache, optionalAuth, getComboBySlug);
router.get("/:id", comboCache, optionalAuth, getComboById);

export default router;
