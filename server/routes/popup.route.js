import express from "express";
import {
  getActivePopup,
  getAdminPopupSettings,
  updateAdminPopupSettings,
} from "../controllers/popup.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

// Public endpoint for storefront popup consumption
router.get("/popup/active", getActivePopup);

// Admin endpoints for popup management
router.get("/admin/popup", auth, admin, getAdminPopupSettings);
router.put("/admin/popup", auth, admin, updateAdminPopupSettings);

export default router;

