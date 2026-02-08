import express from "express";
import {
  getCancellationPolicy,
  getCancellationPolicyAdmin,
  updateCancellationPolicy,
} from "../controllers/cancellationPolicy.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const cancellationPolicyRoutes = express.Router();

// Public route - Get cancellation policy
cancellationPolicyRoutes.get("/", getCancellationPolicy);

// Admin routes - Protected
cancellationPolicyRoutes.get(
  "/admin",
  auth,
  admin,
  getCancellationPolicyAdmin,
);

cancellationPolicyRoutes.put(
  "/admin",
  auth,
  admin,
  updateCancellationPolicy,
);

export default cancellationPolicyRoutes;
