import crypto from "node:crypto";
import Partner from "../models/partner.model.js";
import PartnerApiKey from "../models/partnerApiKey.model.js";

const hashApiKey = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const extractApiKey = (req) => {
  const authHeader = String(req.headers?.authorization || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  const keyHeader = String(req.headers?.["x-api-key"] || "").trim();
  if (keyHeader) return keyHeader;

  return "";
};

const hasScope = (partner, requiredScope) => {
  const scopes = Array.isArray(partner?.scopes) ? partner.scopes : [];
  return scopes.includes("*") || scopes.includes(requiredScope);
};

export const requirePartnerScope = (scope) => (req, res, next) => {
  if (!hasScope(req.partner, scope)) {
    return res.status(403).json({
      success: false,
      error: {
        code: "INSUFFICIENT_SCOPE",
        message: `Required scope missing: ${scope}`,
        details: null,
      },
      meta: {
        requestId: req.requestId || "",
      },
    });
  }

  return next();
};

export const partnerApiAuth = async (req, res, next) => {
  try {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Missing API key",
          details: null,
        },
      });
    }

    const keyPrefix = String(apiKey).split(".")[0]?.trim();
    if (!keyPrefix || !keyPrefix.startsWith("hogp_")) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid API key format",
          details: null,
        },
      });
    }

    const keyRecord = await PartnerApiKey.findOne({
      keyPrefix,
      status: "active",
    }).lean();

    if (!keyRecord) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "API key not found",
          details: null,
        },
      });
    }

    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      return res.status(401).json({
        success: false,
        error: {
          code: "KEY_EXPIRED",
          message: "API key expired",
          details: null,
        },
      });
    }

    const incomingHash = hashApiKey(apiKey);
    if (incomingHash !== keyRecord.keyHash) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid API key",
          details: null,
        },
      });
    }

    const partner = await Partner.findById(keyRecord.partnerId).lean();
    if (!partner || partner.status !== "active") {
      return res.status(403).json({
        success: false,
        error: {
          code: "PARTNER_INACTIVE",
          message: "Partner is inactive",
          details: null,
        },
      });
    }

    req.partner = partner;
    req.partnerKey = keyRecord;

    PartnerApiKey.updateOne(
      { _id: keyRecord._id },
      {
        $set: {
          lastUsedAt: new Date(),
          lastUsedIp: String(req.ip || req.socket?.remoteAddress || ""),
        },
      },
    ).catch(() => null);

    return next();
  } catch (error) {
    console.error("partnerApiAuth error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: "AUTH_FAILED",
        message: "Partner authentication failed",
        details: null,
      },
    });
  }
};

export default partnerApiAuth;
