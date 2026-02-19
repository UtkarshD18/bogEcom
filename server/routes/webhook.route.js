import express from "express";
import { handleExpressbeesWebhook } from "../controllers/expressbeesWebhook.controller.js";
import { verifyExpressbeesWebhookAuth } from "../utils/expressbeesWebhookSignature.js";

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

  const verification = verifyExpressbeesWebhookAuth({
    headers: req.headers,
    rawBody: req.rawBody,
    body: req.body,
    secret: configuredSecret,
  });

  if (!verification.ok) {
    return res.status(401).json({
      error: true,
      success: false,
      message: "Unauthorized webhook",
    });
  }

  req.expressbeesAuthMode = verification.mode || "unknown";

  return next();
};

// If Expressbees cannot send headers, enforce an IP allowlist at the edge (WAF/NGINX).
router.post("/expressbees", verifyExpressbeesSecret, handleExpressbeesWebhook);

export default router;
