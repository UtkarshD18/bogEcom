import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import { logger } from "../utils/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EMAIL_TEMPLATES_DIR = path.resolve(__dirname, "../emails");

const DEFAULT_SMTP_HOST = "smtp.gmail.com";
const DEFAULT_SMTP_PORT = 587;
const DEFAULT_SMTP_SECURE = false;
const DEFAULT_EMAIL_RETRY_COUNT = 2;
const DEFAULT_EMAIL_RETRY_DELAY_MS = 700;

let transporter = null;
let currentFingerprint = "";
let verified = false;
let verifyPromise = null;

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.max(Number(ms || 0), 0));
  });

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sanitizeTemplateData = (data = {}) => {
  const out = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    out[key] = escapeHtml(value);
  });
  return out;
};

const getEmailConfig = () => {
  const host = String(process.env.SMTP_HOST || DEFAULT_SMTP_HOST).trim();
  const port = toInt(process.env.SMTP_PORT, DEFAULT_SMTP_PORT);
  const secure = toBool(process.env.SMTP_SECURE, DEFAULT_SMTP_SECURE);
  const user = String(process.env.SMTP_USER || process.env.EMAIL || "").trim();
  const pass = String(
    process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || "",
  ).trim();
  const fromName = String(
    process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || "BuyOneGram",
  ).trim();
  const fromAddress = String(
    process.env.EMAIL_FROM_ADDRESS ||
      process.env.SMTP_FROM ||
      process.env.EMAIL ||
      user ||
      "",
  ).trim();
  const retryCount = Math.max(
    toInt(process.env.EMAIL_RETRY_COUNT, DEFAULT_EMAIL_RETRY_COUNT),
    0,
  );
  const retryDelayMs = Math.max(
    toInt(process.env.EMAIL_RETRY_DELAY_MS, DEFAULT_EMAIL_RETRY_DELAY_MS),
    0,
  );

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromName,
    fromAddress,
    retryCount,
    retryDelayMs,
  };
};

const configFingerprint = (config) =>
  [
    config.host,
    config.port,
    config.secure ? "secure" : "insecure",
    config.user,
    config.fromAddress,
  ].join("|");

const ensureTransporter = () => {
  const config = getEmailConfig();

  if (!config.user || !config.pass) {
    return {
      ok: false,
      config,
      reason:
        "SMTP user/password missing. Set SMTP_USER and SMTP_PASS in server environment.",
    };
  }

  const fingerprint = configFingerprint(config);
  if (transporter && currentFingerprint === fingerprint) {
    return { ok: true, config };
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
  });
  verified = false;
  verifyPromise = null;
  currentFingerprint = fingerprint;

  logger.info("EmailService", "SMTP transporter initialized", {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
  });

  return { ok: true, config };
};

const verifyTransporter = async () => {
  if (!transporter) return false;
  if (verified) return true;

  if (!verifyPromise) {
    verifyPromise = transporter
      .verify()
      .then(() => {
        verified = true;
        logger.info("EmailService", "SMTP connected and authenticated");
        return true;
      })
      .catch((error) => {
        verified = false;
        logger.error("EmailService", "SMTP verification failed", {
          error: error?.message || String(error),
        });
        return false;
      })
      .finally(() => {
        verifyPromise = null;
      });
  }

  return verifyPromise;
};

const buildFromHeader = (config) => {
  if (!config.fromAddress) return undefined;
  if (!config.fromName) return config.fromAddress;
  return `${config.fromName} <${config.fromAddress}>`;
};

export const initializeEmailService = async () => {
  const { ok, reason, config } = ensureTransporter();
  if (!ok) {
    logger.warn("EmailService", "SMTP disabled", {
      reason,
    });
    return { success: false, reason };
  }

  const isValid = await verifyTransporter();
  if (!isValid) {
    return {
      success: false,
      reason:
        "SMTP authentication failed. Check SMTP_USER/SMTP_PASS, port, and Gmail app password.",
      config: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
      },
    };
  }

  return {
    success: true,
    config: {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      fromAddress: config.fromAddress,
    },
  };
};

export const renderEmailTemplate = async (templateFile, data = {}) => {
  const filePath = path.resolve(EMAIL_TEMPLATES_DIR, templateFile);
  const raw = await fs.readFile(filePath, "utf8");
  const safeData = sanitizeTemplateData(data);
  return raw.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) =>
    key in safeData ? String(safeData[key]) : "",
  );
};

export const sendEmail = async ({
  to,
  subject,
  html = "",
  text = "",
  context = "general",
  from = null,
}) => {
  const { ok, reason, config } = ensureTransporter();
  if (!ok || !transporter) {
    logger.error("EmailService", "Email send skipped", {
      context,
      to,
      subject,
      reason,
    });
    return { success: false, error: reason || "SMTP not configured" };
  }

  const canSend = await verifyTransporter();
  if (!canSend) {
    return { success: false, error: "SMTP verification failed" };
  }

  const attempts = Math.max(config.retryCount + 1, 1);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const info = await transporter.sendMail({
        from: from || buildFromHeader(config),
        to,
        subject,
        text,
        html,
      });
      logger.info("EmailService", "Email sent", {
        context,
        to,
        subject,
        attempt,
        messageId: info?.messageId,
      });
      return { success: true, messageId: info?.messageId };
    } catch (error) {
      lastError = error;
      logger.warn("EmailService", "Email send failed attempt", {
        context,
        to,
        subject,
        attempt,
        attempts,
        error: error?.message || String(error),
      });
      if (attempt < attempts) {
        await wait(config.retryDelayMs * attempt);
      }
    }
  }

  logger.error("EmailService", "Email send failed after retries", {
    context,
    to,
    subject,
    attempts,
    error: lastError?.message || String(lastError),
  });
  return { success: false, error: lastError?.message || "Email send failed" };
};

export const sendTemplatedEmail = async ({
  to,
  subject,
  templateFile,
  templateData = {},
  text = "",
  context = "templated",
  from = null,
}) => {
  try {
    const html = await renderEmailTemplate(templateFile, templateData);
    return sendEmail({
      to,
      subject,
      html,
      text,
      context,
      from,
    });
  } catch (error) {
    logger.error("EmailService", "Template render failed", {
      context,
      templateFile,
      error: error?.message || String(error),
    });
    return { success: false, error: "Failed to render email template" };
  }
};

