import crypto from "crypto";
import express from "express";
import { handleExpressbeesWebhook } from "../controllers/expressbeesWebhook.controller.js";

const router = express.Router();

const verifyExpressbeesSecret = (req, res, next) => {
  const configuredSecret = String(process.env.XPRESSBEES_WEBHOOK_SECRET || "").trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (!configuredSecret) {
    if (isProduction) {
      return res.status(503).json({
        error: true,
        success: false,
        message: "Webhook secret not configured",
      });
    }
    return next();
  }

  const headerSecret =
    req.headers["x-webhook-secret"] ||
    req.headers["x-expressbees-secret"] ||
    null;

  if (!headerSecret) {
    return res.status(401).json({
      error: true,
      success: false,
      message: "Unauthorized webhook",
    });
  }

  const providedSecret = String(headerSecret).trim();
  const expectedBuffer = Buffer.from(configuredSecret);
  const providedBuffer = Buffer.from(providedSecret);
  const isMatch =
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  if (!isMatch) {
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
