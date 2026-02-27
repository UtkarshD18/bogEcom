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

const normalizeEnvString = (value) => {
  let normalized = String(value || "").trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
};

const isGmailHost = (host) => {
  const normalizedHost = String(host || "").trim().toLowerCase();
  return (
    normalizedHost === "smtp.gmail.com" ||
    normalizedHost.endsWith(".gmail.com")
  );
};

const normalizeSmtpPassword = (value, host) => {
  const normalized = normalizeEnvString(value);
  if (!normalized) return "";
  if (!isGmailHost(host)) return normalized;

  // Gmail app passwords are shown in grouped blocks; spaces should be ignored.
  return normalized.replace(/\s+/g, "");
};

const dedupeAuthCandidates = (candidates = []) => {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const user = String(candidate?.user || "").trim();
    const pass = String(candidate?.pass || "").trim();
    const source = String(candidate?.source || "").trim() || "UNKNOWN";
    if (!user || !pass) return false;
    const key = `${user}::${pass}`;
    if (seen.has(key)) return false;
    seen.add(key);
    candidate.user = user;
    candidate.pass = pass;
    candidate.source = source;
    return true;
  });
};

const buildTransporter = (config, auth) =>
  nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: auth.user,
      pass: auth.pass,
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
  });

const getEmailConfig = () => {
  const host = normalizeEnvString(process.env.SMTP_HOST || DEFAULT_SMTP_HOST);
  const port = toInt(process.env.SMTP_PORT, DEFAULT_SMTP_PORT);
  const secure = toBool(process.env.SMTP_SECURE, DEFAULT_SMTP_SECURE);
  const smtpUser = normalizeEnvString(process.env.SMTP_USER || "");
  const smtpPass = normalizeSmtpPassword(process.env.SMTP_PASS || "", host);
  const legacyUser = normalizeEnvString(process.env.EMAIL || "");
  const legacyPass = normalizeSmtpPassword(
    process.env.EMAIL_PASSWORD || "",
    host,
  );

  const authCandidates = dedupeAuthCandidates([
    { user: smtpUser, pass: smtpPass, source: "SMTP" },
    { user: legacyUser, pass: legacyPass, source: "EMAIL" },
  ]);
  const selectedAuth = authCandidates[0] || { user: "", pass: "", source: "" };

  const user = selectedAuth.user;
  const pass = selectedAuth.pass;
  const fromName = normalizeEnvString(
    process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || "BuyOneGram",
  );
  const fromAddress = normalizeEnvString(
      process.env.EMAIL_FROM_ADDRESS ||
      process.env.SMTP_FROM ||
      process.env.EMAIL ||
      user ||
      "",
  );
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
    authCandidates,
    activeAuthSource: selectedAuth.source,
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
    ...((config.authCandidates || []).map(
      (candidate) => `${candidate.source}:${candidate.user}`,
    )),
    config.fromAddress,
  ].join("|");

const ensureTransporter = () => {
  const config = getEmailConfig();

  if (!config.user || !config.pass || !config.authCandidates?.length) {
    return {
      ok: false,
      config,
      reason:
        "Email credentials missing. Set SMTP_USER/SMTP_PASS or EMAIL/EMAIL_PASSWORD in server environment.",
    };
  }

  const fingerprint = configFingerprint(config);
  if (transporter && currentFingerprint === fingerprint) {
    return { ok: true, config };
  }

  const selectedAuth = config.authCandidates[0];
  transporter = buildTransporter(config, selectedAuth);
  config.user = selectedAuth.user;
  config.pass = selectedAuth.pass;
  config.activeAuthSource = selectedAuth.source;
  verified = false;
  verifyPromise = null;
  currentFingerprint = fingerprint;

  logger.info("EmailService", "SMTP transporter initialized", {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    authSource: config.activeAuthSource,
  });

  return { ok: true, config };
};

const verifyTransporter = async (config = {}) => {
  if (!transporter) return false;
  if (verified) return true;

  if (!verifyPromise) {
    verifyPromise = (async () => {
      const tryVerifyCurrentTransport = async () => {
        try {
          await transporter.verify();
          verified = true;
          logger.info("EmailService", "SMTP connected and authenticated", {
            user: config.user || "",
            authSource: config.activeAuthSource || "",
          });
          return true;
        } catch (error) {
          verified = false;
          logger.error("EmailService", "SMTP verification failed", {
            error: error?.message || String(error),
            user: config.user || "",
            authSource: config.activeAuthSource || "",
          });
          return false;
        }
      };

      let isValid = await tryVerifyCurrentTransport();
      if (isValid) {
        return true;
      }

      const authCandidates = Array.isArray(config.authCandidates)
        ? config.authCandidates
        : [];
      if (authCandidates.length <= 1) {
        return false;
      }

      for (const candidate of authCandidates) {
        if (candidate.user === config.user && candidate.pass === config.pass) {
          continue;
        }

        logger.warn("EmailService", "Retrying SMTP verify with fallback credentials", {
          previousUser: config.user || "",
          previousSource: config.activeAuthSource || "",
          fallbackUser: candidate.user,
          fallbackSource: candidate.source,
        });

        transporter = buildTransporter(config, candidate);
        config.user = candidate.user;
        config.pass = candidate.pass;
        config.activeAuthSource = candidate.source;

        isValid = await tryVerifyCurrentTransport();
        if (isValid) {
          return true;
        }
      }

      return false;
    })().finally(() => {
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

  const isValid = await verifyTransporter(config);
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

  const canSend = await verifyTransporter(config);
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

