import express from "express";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import {
  createPolicy,
  deletePolicy,
  getActivePolicies,
  getAllPoliciesAdmin,
  getPolicyBySlug,
  togglePolicyStatus,
  updatePolicy,
} from "../controllers/policy.controller.js";

const router = express.Router();

// Public routes
router.get("/public", getActivePolicies);
router.get("/public/:slug", getPolicyBySlug);

// Admin routes
router.get("/admin/all", auth, admin, getAllPoliciesAdmin);
router.post("/admin", auth, admin, createPolicy);
router.put("/admin/:id", auth, admin, updatePolicy);
router.patch("/admin/:id/toggle", auth, admin, togglePolicyStatus);
router.delete("/admin/:id", auth, admin, deletePolicy);

export default router;
