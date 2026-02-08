import express from "express";
import {
  getMembershipPageAdmin,
  getMembershipPageContent,
  resetMembershipPage,
  updateMembershipPage,
} from "../controllers/membershipPage.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

// Public - Get membership page content
router.get("/public", getMembershipPageContent);

// Admin - Membership page content
router.get("/admin", auth, admin, getMembershipPageAdmin);
router.put("/admin", auth, admin, updateMembershipPage);
router.post("/admin/reset", auth, admin, resetMembershipPage);

export default router;
