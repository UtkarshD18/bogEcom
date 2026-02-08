import express from "express";
import {
  getOrderLocationLogsAdmin,
  getUserLocationLogsAdmin,
} from "../controllers/userLocationLog.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

// Admin-only: include raw latitude/longitude (support/analytics use).
router.get("/admin/order/:orderId", auth, admin, getOrderLocationLogsAdmin);
router.get("/admin/user/:userId", auth, admin, getUserLocationLogsAdmin);

export default router;

