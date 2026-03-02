import express from "express";
import authOptional from "../middlewares/authOptional.js";
import {
  getTrackingSession,
  trackUserActivity,
  updateTrackingConsent,
} from "../controllers/analytics.controller.js";

const router = express.Router();

router.get("/session", authOptional, getTrackingSession);
router.post("/track", authOptional, trackUserActivity);
router.post("/consent", updateTrackingConsent);

export default router;
