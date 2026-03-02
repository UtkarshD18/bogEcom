import express from "express";
import authOptional from "../middlewares/authOptional.js";
import {
  getTrackingSession,
  trackUserActivity,
  updateTrackingConsent,
} from "../controllers/analytics.controller.js";

const router = express.Router();

router.post("/track", authOptional, trackUserActivity);
router.post("/track/consent", updateTrackingConsent);
router.get("/track/session", authOptional, getTrackingSession);

export default router;
