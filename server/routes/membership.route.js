import express from "express";
import {
  activatePlan,
  createMembershipOrder,
  createPlan,
  deletePlan,
  getActivePlan,
  getAllPlans,
  getMembershipStats,
  getMembershipStatus,
  handleMembershipPhonePeCallback,
  updatePlan,
  verifyMembershipPayment,
} from "../controllers/membership.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import { paymentLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

/**
 * Membership Routes
 */

// Public - Get active membership plan
router.get("/active", getActivePlan);

// Public - Payment provider callback target (server-to-server)
router.post("/webhook/phonepe", handleMembershipPhonePeCallback);

// User - Get own membership status (requires login)
router.get("/status", auth, getMembershipStatus);

// User - Create membership order (initiates payment)
router.post("/create-order", paymentLimiter, auth, createMembershipOrder);

// User - Verify payment and activate membership
router.post("/verify-payment", paymentLimiter, auth, verifyMembershipPayment);

// Admin - Get all plans
router.get("/admin/plans", auth, admin, getAllPlans);

// Admin - Create new plan
router.post("/admin/plans", auth, admin, createPlan);

// Admin - Update plan
router.put("/admin/plans/:id", auth, admin, updatePlan);

// Admin - Delete plan
router.delete("/admin/plans/:id", auth, admin, deletePlan);

// Admin - Activate a plan
router.put("/admin/plans/:id/activate", auth, admin, activatePlan);

// Admin - Get membership statistics
router.get("/admin/stats", auth, admin, getMembershipStats);

export default router;
