import express from "express";
import auth from "../middlewares/auth.js";
import admin from "../middlewares/admin.js";
import {
  getAdminAnalyticsCharts,
  getAdminAnalyticsOverview,
  getAdminUserActivity,
  getBehaviorAnalyticsEngagement,
  getBehaviorAnalyticsOverview,
  getBehaviorAnalyticsPerformance,
  getBehaviorSessions,
  getBehaviorAnalyticsUserActivity,
  getBehaviorProductJourney,
  getBehaviorTimeline,
} from "../controllers/adminAnalytics.controller.js";

const router = express.Router();

// Legacy analytics endpoints (kept for backward compatibility)
router.get("/overview", auth, admin, getAdminAnalyticsOverview);
router.get("/charts", auth, admin, getAdminAnalyticsCharts);
router.get("/users/:userId", auth, admin, getAdminUserActivity);
router.get("/users", auth, admin, getAdminUserActivity);

// Behavior analytics endpoints
router.get("/behavior/overview", auth, admin, getBehaviorAnalyticsOverview);
router.get("/behavior/engagement", auth, admin, getBehaviorAnalyticsEngagement);
router.get("/behavior/performance", auth, admin, getBehaviorAnalyticsPerformance);
router.get("/behavior/sessions", auth, admin, getBehaviorSessions);
router.get("/behavior/user-activity", auth, admin, getBehaviorAnalyticsUserActivity);
router.get("/behavior/product-journey", auth, admin, getBehaviorProductJourney);
router.get("/behavior/timeline", auth, admin, getBehaviorTimeline);

export default router;
