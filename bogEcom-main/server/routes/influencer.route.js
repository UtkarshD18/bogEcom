import { Router } from "express";
import {
  createInfluencer,
  deleteInfluencer,
  getAllInfluencers,
  getInfluencerById,
  getInfluencerStats,
  payCommission,
  updateInfluencer,
  validateInfluencerCode,
} from "../controllers/influencer.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const influencerRouter = Router();

// ==================== PUBLIC ROUTES ====================

/**
 * Validate referral code
 * @route GET /api/influencers/validate?code=INFLUENCER_CODE
 * @access Public
 */
influencerRouter.get("/validate", validateInfluencerCode);

// ==================== ADMIN ROUTES ====================

/**
 * Get all influencers (with pagination and filters)
 * @route GET /api/influencers/admin/all
 * @access Admin
 */
influencerRouter.get("/admin/all", auth, admin, getAllInfluencers);

/**
 * Get single influencer
 * @route GET /api/influencers/admin/:id
 * @access Admin
 */
influencerRouter.get("/admin/:id", auth, admin, getInfluencerById);

/**
 * Get influencer statistics
 * @route GET /api/influencers/admin/:id/stats
 * @access Admin
 */
influencerRouter.get("/admin/:id/stats", auth, admin, getInfluencerStats);

/**
 * Create new influencer
 * @route POST /api/influencers/admin
 * @access Admin
 */
influencerRouter.post("/admin", auth, admin, createInfluencer);

/**
 * Update influencer
 * @route PATCH /api/influencers/admin/:id
 * @access Admin
 */
influencerRouter.patch("/admin/:id", auth, admin, updateInfluencer);

/**
 * Delete/deactivate influencer
 * @route DELETE /api/influencers/admin/:id
 * @access Admin
 */
influencerRouter.delete("/admin/:id", auth, admin, deleteInfluencer);

/**
 * Mark commission as paid
 * @route POST /api/influencers/admin/:id/pay-commission
 * @access Admin
 */
influencerRouter.post("/admin/:id/pay-commission", auth, admin, payCommission);

export default influencerRouter;
