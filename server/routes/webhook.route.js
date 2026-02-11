import express from "express";
import { handleExpressbeesWebhook } from "../controllers/expressbeesWebhook.controller.js";

const router = express.Router();

const verifyExpressbeesSecret = (req, res, next) => {
  const secret = process.env.XPRESSBEES_WEBHOOK_SECRET;
  if (!secret) return next();

  const headerSecret =
    req.headers["x-webhook-secret"] ||
    req.headers["x-expressbees-secret"] ||
    null;

  if (!headerSecret || String(headerSecret).trim() !== String(secret).trim()) {
    return res.status(401).json({
      error: true,
      success: false,
      message: "Unauthorized webhook",
    });
  }

  return next();
};

// If Expressbees cannot send headers, enforce an IP allowlist at the edge (WAF/NGINX).
router.post("/expressbees", verifyExpressbeesSecret, handleExpressbeesWebhook);

export default router;
