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
import createPublicResponseCacheMiddleware, {
  getPublicResponseCacheTtlSeconds,
} from "../middlewares/publicResponseCache.js";

const router = express.Router();
const POLICY_CACHE_TTL_SECONDS = getPublicResponseCacheTtlSeconds(
  "PERF_RESPONSE_CACHE_CONTENT_TTL_SECONDS",
  180,
);
const policyCache = createPublicResponseCacheMiddleware({
  namespaces: ["policies"],
  ttlSeconds: POLICY_CACHE_TTL_SECONDS,
});

// Public routes
router.get("/public", policyCache, getActivePolicies);
router.get("/public/:slug", policyCache, getPolicyBySlug);

// Admin routes
router.get("/admin/all", auth, admin, getAllPoliciesAdmin);
router.post("/admin", auth, admin, createPolicy);
router.put("/admin/:id", auth, admin, updatePolicy);
router.patch("/admin/:id/toggle", auth, admin, togglePolicyStatus);
router.delete("/admin/:id", auth, admin, deletePolicy);

export default router;
