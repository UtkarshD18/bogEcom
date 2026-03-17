import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import SettingsModel from "../models/settings.model.js";
import { invalidateEmailTemplateOverrideCache } from "../config/emailService.js";
import { logger } from "../utils/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EMAIL_TEMPLATES_DIR = path.resolve(__dirname, "../emails");

const EMAIL_TEMPLATE_OVERRIDE_PREFIX = "emailTemplateOverride__";

const normalizeTemplateString = (value, maxLen) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!Number.isFinite(maxLen) || maxLen <= 0) return raw;
  return raw.slice(0, maxLen);
};

const isValidTemplateFile = (value) => {
  const name = String(value || "").trim();
  if (!name) return false;
  if (name.includes("/") || name.includes("\\") || name.includes("..")) return false;
  if (!name.toLowerCase().endsWith(".html")) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.html$/.test(name);
};

const buildOverrideKey = (templateFile) =>
  `${EMAIL_TEMPLATE_OVERRIDE_PREFIX}${String(templateFile || "").trim()}`;

const extractPlaceholders = (html) => {
  const raw = String(html || "");
  const keys = new Set();
  const rx =
    /\{\{\{\s*([a-zA-Z0-9_]+)\s*\}\}\}|\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

  let match = null;
  while ((match = rx.exec(raw))) {
    const key = match[1] || match[2] || "";
    if (key) keys.add(key);
  }

  return Array.from(keys).sort();
};

const normalizeOverrideValue = (value) => {
  if (!value || typeof value !== "object") {
    return { enabled: true, subject: "", html: "", text: "" };
  }
  return {
    enabled: value.enabled !== false,
    subject: normalizeTemplateString(value.subject, 180),
    html: normalizeTemplateString(value.html, 400000),
    text: normalizeTemplateString(value.text, 50000),
  };
};

export const listEmailTemplates = async (_req, res) => {
  try {
    const names = await fs.readdir(EMAIL_TEMPLATES_DIR);
    const templateFiles = names
      .filter((name) => isValidTemplateFile(name))
      .sort((a, b) => a.localeCompare(b));

    const overrides = await SettingsModel.find({
      key: { $regex: `^${EMAIL_TEMPLATE_OVERRIDE_PREFIX}` },
    })
      .select("key value isActive updatedAt updatedBy")
      .lean();

    const overrideByTemplate = new Map();
    overrides.forEach((doc) => {
      const key = String(doc?.key || "");
      if (!key.startsWith(EMAIL_TEMPLATE_OVERRIDE_PREFIX)) return;
      const templateFile = key.slice(EMAIL_TEMPLATE_OVERRIDE_PREFIX.length);
      if (!isValidTemplateFile(templateFile)) return;
      const normalized = normalizeOverrideValue(doc?.value);
      overrideByTemplate.set(templateFile, {
        isActive: doc?.isActive !== false,
        enabled: normalized.enabled,
        hasHtml: Boolean(normalized.html),
        hasSubject: Boolean(normalized.subject),
        hasText: Boolean(normalized.text),
        updatedAt: doc?.updatedAt || null,
        updatedBy: doc?.updatedBy || null,
      });
    });

    return res.status(200).json({
      success: true,
      templates: templateFiles.map((templateFile) => ({
        templateFile,
        override: overrideByTemplate.get(templateFile) || null,
      })),
    });
  } catch (error) {
    logger.error("adminEmailTemplates.list", "Failed to list email templates", {
      error: error?.message || String(error),
    });
    return res.status(500).json({
      success: false,
      message: "Failed to list email templates",
    });
  }
};

export const getEmailTemplate = async (req, res) => {
  try {
    const templateFile = String(req.params?.templateFile || "").trim();
    if (!isValidTemplateFile(templateFile)) {
      return res.status(400).json({
        success: false,
        message: "Invalid template file",
      });
    }

    const defaultPath = path.resolve(EMAIL_TEMPLATES_DIR, templateFile);
    const defaultHtml = await fs.readFile(defaultPath, "utf8");

    const setting = await SettingsModel.findOne({
      key: buildOverrideKey(templateFile),
    })
      .select("value isActive updatedAt updatedBy -_id")
      .lean();

    const overrideValue = normalizeOverrideValue(setting?.value);

    return res.status(200).json({
      success: true,
      templateFile,
      placeholders: extractPlaceholders(defaultHtml),
      defaults: {
        html: defaultHtml,
      },
      override: setting
        ? {
            isActive: setting?.isActive !== false,
            enabled: overrideValue.enabled,
            subject: overrideValue.subject,
            html: overrideValue.html,
            text: overrideValue.text,
            updatedAt: setting?.updatedAt || null,
            updatedBy: setting?.updatedBy || null,
          }
        : null,
    });
  } catch (error) {
    logger.error("adminEmailTemplates.get", "Failed to fetch email template", {
      error: error?.message || String(error),
    });
    return res.status(500).json({
      success: false,
      message: "Failed to load email template",
    });
  }
};

export const upsertEmailTemplateOverride = async (req, res) => {
  try {
    const templateFile = String(req.params?.templateFile || "").trim();
    if (!isValidTemplateFile(templateFile)) {
      return res.status(400).json({
        success: false,
        message: "Invalid template file",
      });
    }

    const adminId = req.user?.id || req.user || null;
    const enabled = req.body?.enabled !== false;
    const subject = normalizeTemplateString(req.body?.subject, 180);
    const html = normalizeTemplateString(req.body?.html, 400000);
    const text = normalizeTemplateString(req.body?.text, 50000);

    if (!subject && !html && !text) {
      return res.status(400).json({
        success: false,
        message: "At least one of subject/html/text must be provided",
      });
    }

    const setting = await SettingsModel.findOneAndUpdate(
      { key: buildOverrideKey(templateFile) },
      {
        $set: {
          key: buildOverrideKey(templateFile),
          value: { enabled, subject, html, text },
          description: `Admin override for email template ${templateFile}`,
          category: "notification",
          isActive: true,
          updatedBy: adminId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    invalidateEmailTemplateOverrideCache(templateFile);

    return res.status(200).json({
      success: true,
      message: "Email template override saved",
      override: {
        enabled,
        subject,
        html,
        text,
        updatedAt: setting?.updatedAt || null,
      },
    });
  } catch (error) {
    logger.error("adminEmailTemplates.upsert", "Failed to save email template override", {
      error: error?.message || String(error),
    });
    return res.status(500).json({
      success: false,
      message: "Failed to save email template override",
    });
  }
};

export const deleteEmailTemplateOverride = async (req, res) => {
  try {
    const templateFile = String(req.params?.templateFile || "").trim();
    if (!isValidTemplateFile(templateFile)) {
      return res.status(400).json({
        success: false,
        message: "Invalid template file",
      });
    }

    await SettingsModel.findOneAndDelete({
      key: buildOverrideKey(templateFile),
    });

    invalidateEmailTemplateOverrideCache(templateFile);

    return res.status(200).json({
      success: true,
      message: "Email template override removed",
    });
  } catch (error) {
    logger.error("adminEmailTemplates.delete", "Failed to delete email template override", {
      error: error?.message || String(error),
    });
    return res.status(500).json({
      success: false,
      message: "Failed to delete email template override",
    });
  }
};
