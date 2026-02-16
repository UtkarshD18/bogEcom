import express from "express";
import {
  getHomeMembershipContent,
  getHomeMembershipContentAdmin,
  resetHomeMembershipContent,
  updateHomeMembershipContent,
} from "../controllers/homeMembershipContent.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

// Public - Get home membership content
router.get("/public", getHomeMembershipContent);

// Admin - Home membership content
router.get("/admin", auth, admin, getHomeMembershipContentAdmin);
router.put("/admin", auth, admin, updateHomeMembershipContent);
router.post("/admin/reset", auth, admin, resetHomeMembershipContent);

export default router;
