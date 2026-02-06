import { Router } from "express";
import {
  createInfluencer,
  deleteInfluencer,
  getAllInfluencers,
  getInfluencerById,
  getInfluencerStats,
  getInfluencerPortalStats,
  payCommission,
  updateInfluencer,
  validateInfluencerCode,
  loginInfluencer,
  getInfluencerPortalStatsAuth,
  refreshInfluencerToken,
} from "../controllers/influencer.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import influencerAuth from "../middlewares/influencerAuth.js";

const influencerRouter = Router();

// ==================== PUBLIC ROUTES ====================

/**
 * Validate referral code
 * @route GET /api/influencers/validate?code=INFLUENCER_CODE
 * @access Public
 */
influencerRouter.get("/validate", validateInfluencerCode);

/**
 * Influencer login (issue token)
 * @route POST /api/influencers/login
 * @access Public
 */
influencerRouter.post("/login", loginInfluencer);
influencerRouter.post("/refresh-token", refreshInfluencerToken);

/**
 * Collaborator portal stats
 * @route GET /api/influencers/portal?code=CODE&email=EMAIL
 * @access Public (code + email verification)
 */
influencerRouter.get("/portal", getInfluencerPortalStats);

/**
 * Collaborator portal stats (token-based)
 * @route GET /api/influencers/portal/me
 * @access Influencer (token)
 */
influencerRouter.get("/portal/me", influencerAuth, getInfluencerPortalStatsAuth);

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
 * Update influencer (legacy PUT support)
 * @route PUT /api/influencers/admin/:id
 * @access Admin
 */
influencerRouter.put("/admin/:id", auth, admin, updateInfluencer);

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
