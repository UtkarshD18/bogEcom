import admin from "firebase-admin";
import { sendEmail, sendTemplatedEmail } from "../config/emailService.js";
import { isFirebaseReady } from "../config/firebaseAdmin.js";
import Newsletter from "../models/newsletter.model.js";
import SettingsModel from "../models/settings.model.js";
import { logger } from "../utils/errorHandler.js";

const isProduction = process.env.NODE_ENV === "production";
// Debug-only logging to keep production output clean
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

const ALLOWED_SOURCES = new Set([
  "footer",
  "popup",
  "checkout",
  "blogs",
  "other",
]);

const normalizeSource = (source) => {
  const value = String(source || "").trim().toLowerCase();
  return ALLOWED_SOURCES.has(value) ? value : "other";
};

const getPublicSiteUrl = () => {
  const raw =
    process.env.CLIENT_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://healthyonegram.com";
  const first = String(raw).split(",")[0].trim();
  return first.replace(/\/+$/, "");
};

const NEWSLETTER_CAMPAIGN_TEMPLATE_KEY = "newsletterCampaignTemplate";
const NEWSLETTER_CAMPAIGN_DEFAULTS = Object.freeze({
  subject: "HealthyOneGram Updates",
  // Allow HTML templates to be managed via admin; keep a safe fallback.
  html: "",
  text: "",
});

const normalizeTemplateString = (value, maxLen) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!Number.isFinite(maxLen) || maxLen <= 0) return raw;
  return raw.slice(0, maxLen);
};

const buildCampaignHtmlFallback = ({ subject, text }) => {
  const siteUrl = getPublicSiteUrl();
  const safeSubject = normalizeTemplateString(subject, 180) || "Newsletter";
  const safeText = normalizeTemplateString(text, 20000);

  const body =
    safeText
      ? safeText
          .split(/\r?\n/)
          .map((line) => line.replace(/</g, "&lt;").replace(/>/g, "&gt;"))
          .join("<br/>")
      : "Updates from HealthyOneGram.";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;font-family:Segoe UI,Arial,sans-serif;background:#f9f5f0;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#c1591c 0%,#e07830 100%);padding:28px 20px;text-align:center;color:#fff;">
      <h1 style="margin:0;font-size:22px;line-height:1.3;">${safeSubject}</h1>
    </div>
    <div style="padding:24px 20px;color:#333;line-height:1.6;font-size:14px;">
      ${body}
      <div style="margin-top:18px;">
        <a href="${siteUrl}" style="display:inline-block;background:#c1591c;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;">Visit HealthyOneGram</a>
      </div>
      <p style="margin:18px 0 0;color:#666;font-size:12px;">
        If you don't want these emails, you can unsubscribe by replying "unsubscribe".
      </p>
    </div>
    <div style="background:#2c2c2c;padding:16px 20px;color:#aaa;font-size:12px;">
      <p style="margin:0;">&copy; ${new Date().getFullYear()} HealthyOneGram. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
};

const broadcastEnabled = () =>
  String(process.env.NEWSLETTER_BROADCAST_ENABLED || "")
    .trim()
    .toLowerCase() === "true";

const resolveBroadcastLimits = () => {
  const maxPerRun = Number.parseInt(
    String(process.env.NEWSLETTER_BROADCAST_MAX_PER_RUN || "200"),
    10,
  );
  const batchSize = Number.parseInt(
    String(process.env.NEWSLETTER_BROADCAST_BATCH_SIZE || "25"),
    10,
  );
  const delayMs = Number.parseInt(
    String(process.env.NEWSLETTER_BROADCAST_BATCH_DELAY_MS || "250"),
    10,
  );

  return {
    maxPerRun: Number.isFinite(maxPerRun) && maxPerRun > 0 ? maxPerRun : 200,
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 25,
    delayMs: Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 250,
  };
};

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(Number(ms || 0), 0)));

/**
 * Generate welcome email HTML template
 * @param {string} email - Subscriber email
 * @returns {string} - HTML email template
 */
const getWelcomeEmailTemplate = (email) => {
  const siteUrl = getPublicSiteUrl();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to HealthyOneGram Family</title>
</head>
<body style="margin:0;padding:0;font-family:Segoe UI,Arial,sans-serif;background:#f9f5f0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#c1591c 0%,#e07830 100%);padding:32px 24px;text-align:center;color:#fff;">
      <h1 style="margin:0;font-size:26px;">Welcome to HealthyOneGram</h1>
      <p style="margin:10px 0 0;font-size:15px;">Your healthy shopping journey starts here.</p>
    </div>

    <div style="padding:28px 24px;color:#444;line-height:1.6;">
      <p>Thank you for subscribing with <strong>${email}</strong>.</p>
      <p>You will receive product updates, special offers, and healthy recipes.</p>
      <p><a href="${siteUrl}/products" style="display:inline-block;background:#c1591c;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;">Explore Products</a></p>
      <p style="margin-top:18px;">Regards,<br><strong>HealthyOneGram Team</strong></p>
    </div>

    <div style="background:#2c2c2c;padding:20px 24px;color:#aaa;font-size:12px;">
      <p style="margin:0;">&copy; ${new Date().getFullYear()} HealthyOneGram. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Send welcome email to new subscriber
 * @param {string} email - Subscriber email
 */
const sendWelcomeEmail = async (email) => {
  try {
    const siteUrl = getPublicSiteUrl();
    const subject = "Welcome to the HealthyOneGram Family!";
    const text = `Welcome to HealthyOneGram! Thank you for subscribing to our newsletter. You'll now receive updates about exclusive discounts, new products, and healthy recipes. Visit us at ${siteUrl}`;

    const templateResult = await sendTemplatedEmail({
      to: email,
      subject,
      templateFile: "newsletterConfirmation.html",
      templateData: {
        subscriber_email: email,
        site_url: siteUrl,
        products_url: `${siteUrl}/products`,
        year: String(new Date().getFullYear()),
      },
      text,
      context: "newsletter.welcome",
    });

    const result =
      templateResult?.success
        ? templateResult
        : await sendEmail({
            to: email,
            subject,
            text,
            html: getWelcomeEmailTemplate(email),
            context: "newsletter.welcome.fallback",
          });

    if (result.success) {
      debugLog(`Welcome email sent to: ${email}`);
    } else {
      logger.error("newsletter.sendWelcomeEmail", "Failed to send welcome email", {
        email,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logger.error("newsletter.sendWelcomeEmail", "Unexpected email error", {
      email,
      error: error?.message || String(error),
    });
    return { success: false, error: error.message };
  }
};

/**
 * Save subscriber to Firebase Firestore
 * @param {Object} subscriberData - Subscriber data to save
 * @returns {Promise<boolean>} - Success status
 */
const saveToFirebase = async (subscriberData) => {
  try {
    if (!isFirebaseReady()) {
      debugLog("Firebase not configured, skipping Firestore save");
      return false;
    }

    const db = admin.firestore();
    const subscribersRef = db.collection("newsletter_subscribers");

    // Use email as document ID for easy lookup
    const docId = subscriberData.email.replace(/[.@]/g, "_");

    await subscribersRef.doc(docId).set(
      {
        email: subscriberData.email,
        source: subscriberData.source || "footer",
        isActive: true,
        subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    debugLog(`Subscriber saved to Firebase: ${subscriberData.email}`);
    return true;
  } catch (error) {
    console.error("Firebase save error:", error.message);
    return false;
  }
};

/**
 * Update subscriber status in Firebase Firestore
 * @param {string} email - Subscriber email
 * @param {boolean} isActive - Active status
 */
const updateFirebaseSubscriber = async (email, isActive) => {
  try {
    if (!isFirebaseReady()) return false;

    const db = admin.firestore();
    const docId = email.replace(/[.@]/g, "_");

    await db
      .collection("newsletter_subscribers")
      .doc(docId)
      .update({
        isActive,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(isActive
          ? {}
          : { unsubscribedAt: admin.firestore.FieldValue.serverTimestamp() }),
      });

    return true;
  } catch (error) {
    console.error("Firebase update error:", error.message);
    return false;
  }
};

/**
 * Email validation helper
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Subscribe to newsletter
export const subscribe = async (req, res) => {
  try {
    const { email, source = "footer" } = req.body;
    const normalizedSource = normalizeSource(source || "footer");
    const schemaSources =
      Newsletter?.schema?.path("source")?.enumValues || [];
    const safeSource = schemaSources.includes(normalizedSource)
      ? normalizedSource
      : "other";

    // Validate email presence
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Validate email format
    const normalizedEmail = email.toLowerCase().trim();
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    // Check if email already exists in MongoDB
    const existingSubscriber = await Newsletter.findOne({
      email: normalizedEmail,
    });

    if (existingSubscriber) {
      // If already subscribed and active
      if (existingSubscriber.isActive) {
        return res.status(200).json({
          success: true,
          message: "You're already subscribed to our newsletter!",
          alreadySubscribed: true,
        });
      }

      // If previously unsubscribed, reactivate
      existingSubscriber.isActive = true;
      existingSubscriber.unsubscribedAt = null;
      existingSubscriber.subscribedAt = new Date();
      await existingSubscriber.save();

      // Also update in Firebase
      await updateFirebaseSubscriber(normalizedEmail, true);

      // Send welcome back email (awaited for reliable logging)
      await sendWelcomeEmail(normalizedEmail);

      return res.status(200).json({
        success: true,
        message: "Welcome back! You've been resubscribed to our newsletter.",
      });
    }

    // Create new subscriber in MongoDB
    const newSubscriber = await Newsletter.create({
      email: normalizedEmail,
      source: safeSource,
    });

    // Also save to Firebase Firestore
    await saveToFirebase({
      email: normalizedEmail,
      source: safeSource,
    });

    // Send welcome email to new subscriber (awaited for reliable logging)
    await sendWelcomeEmail(normalizedEmail);

    res.status(201).json({
      success: true,
      message: "Thank you for subscribing to our newsletter!",
      subscriber: {
        email: newSubscriber.email,
        subscribedAt: newSubscriber.subscribedAt,
      },
    });
  } catch (error) {
    console.error("Newsletter subscription error:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(200).json({
        success: true,
        message: "You're already subscribed to our newsletter!",
        alreadySubscribed: true,
      });
    }

    // Handle validation error
    if (error.name === "ValidationError") {
      const errorMessages = Object.values(error.errors || {}).map(
        (err) => err.message,
      );
      const message =
        error.errors?.email?.message ||
        errorMessages[0] ||
        "Invalid subscription details";
      return res.status(400).json({
        success: false,
        message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to subscribe. Please try again later.",
    });
  }
};

// Unsubscribe from newsletter
export const unsubscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const subscriber = await Newsletter.findOne({ email: normalizedEmail });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Email not found in our newsletter list",
      });
    }

    subscriber.isActive = false;
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    // Also update in Firebase
    await updateFirebaseSubscriber(normalizedEmail, false);

    res.status(200).json({
      success: true,
      message: "You have been unsubscribed from our newsletter",
    });
  } catch (error) {
    console.error("Newsletter unsubscribe error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unsubscribe. Please try again later.",
    });
  }
};

// Get all subscribers (Admin only)
export const getAllSubscribers = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = "all" } = req.query;

    const query = {};
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    const subscribers = await Newsletter.find(query)
      .sort({ subscribedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Newsletter.countDocuments(query);
    const activeCount = await Newsletter.countDocuments({ isActive: true });

    res.status(200).json({
      success: true,
      subscribers,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
      stats: {
        total,
        active: activeCount,
        inactive: total - activeCount,
      },
    });
  } catch (error) {
    console.error("Get subscribers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscribers",
    });
  }
};

// Delete subscriber (Admin only)
export const deleteSubscriber = async (req, res) => {
  try {
    const { id } = req.params;

    const subscriber = await Newsletter.findByIdAndDelete(id);

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Subscriber not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Subscriber deleted successfully",
    });
  } catch (error) {
    console.error("Delete subscriber error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete subscriber",
    });
  }
};

// ==================== ADMIN CAMPAIGN APIs ====================

export const getCampaignTemplate = async (_req, res) => {
  try {
    const setting = await SettingsModel.findOne({
      key: NEWSLETTER_CAMPAIGN_TEMPLATE_KEY,
      isActive: true,
    })
      .select("value updatedAt -_id")
      .lean();

    const value = setting?.value && typeof setting.value === "object"
      ? setting.value
      : {};

    return res.status(200).json({
      success: true,
      template: {
        subject: normalizeTemplateString(value.subject, 180) || NEWSLETTER_CAMPAIGN_DEFAULTS.subject,
        html: normalizeTemplateString(value.html, 200000) || "",
        text: normalizeTemplateString(value.text, 20000) || "",
      },
      updatedAt: setting?.updatedAt || null,
    });
  } catch (error) {
    logger.error("newsletter.getCampaignTemplate", "Failed to fetch campaign template", {
      error: error?.message || String(error),
    });
    return res.status(500).json({
      success: false,
      message: "Failed to load newsletter template",
    });
  }
};

export const updateCampaignTemplate = async (req, res) => {
  try {
    const adminId = req.user?.id || req.user || null;
    const subject = normalizeTemplateString(req.body?.subject, 180);
    const html = normalizeTemplateString(req.body?.html, 200000);
    const text = normalizeTemplateString(req.body?.text, 20000);

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Subject is required",
      });
    }

    const setting = await SettingsModel.findOneAndUpdate(
      { key: NEWSLETTER_CAMPAIGN_TEMPLATE_KEY },
      {
        $set: {
          key: NEWSLETTER_CAMPAIGN_TEMPLATE_KEY,
          value: { subject, html, text },
          description: "Admin-managed newsletter campaign template",
          category: "notification",
          isActive: true,
          updatedBy: adminId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Newsletter template saved",
      template: setting?.value || { subject, html, text },
      updatedAt: setting?.updatedAt || null,
    });
  } catch (error) {
    logger.error("newsletter.updateCampaignTemplate", "Failed to save campaign template", {
      error: error?.message || String(error),
    });
    return res.status(500).json({
      success: false,
      message: "Failed to save newsletter template",
    });
  }
};

export const sendCampaign = async (req, res) => {
  try {
    const mode = String(req.body?.mode || "test").trim().toLowerCase();
    const subject = normalizeTemplateString(req.body?.subject, 180);
    const html = normalizeTemplateString(req.body?.html, 200000);
    const text = normalizeTemplateString(req.body?.text, 20000);

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Subject is required",
      });
    }

    const resolvedHtml = html || buildCampaignHtmlFallback({ subject, text });
    const resolvedText =
      text ||
      String(resolvedHtml || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 20000);

    if (mode === "test") {
      const testEmail = String(req.body?.testEmail || "").trim().toLowerCase();
      if (!testEmail || !isValidEmail(testEmail)) {
        return res.status(400).json({
          success: false,
          message: "Valid testEmail is required for test mode",
        });
      }

      const result = await sendEmail({
        to: testEmail,
        subject,
        text: resolvedText,
        html: resolvedHtml,
        context: "newsletter.campaign.test",
      });

      return res.status(result?.success ? 200 : 502).json({
        success: Boolean(result?.success),
        message: result?.success
          ? "Test newsletter sent"
          : "Failed to send test newsletter",
        result,
      });
    }

    if (mode !== "active") {
      return res.status(400).json({
        success: false,
        message: "mode must be 'test' or 'active'",
      });
    }

    if (!broadcastEnabled()) {
      return res.status(403).json({
        success: false,
        message:
          "Newsletter broadcast is disabled. Set NEWSLETTER_BROADCAST_ENABLED=true on the server to enable sending to all subscribers.",
      });
    }

    const confirm = String(req.body?.confirm || "")
      .trim()
      .toLowerCase();
    if (confirm !== "true") {
      return res.status(400).json({
        success: false,
        message: "confirm=true is required to send to all subscribers",
      });
    }

    const limits = resolveBroadcastLimits();
    const requestedLimit = Number.parseInt(String(req.body?.limit || ""), 10);
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, limits.maxPerRun)
        : limits.maxPerRun;

    const cursor = Newsletter.find({ isActive: true })
      .sort({ subscribedAt: -1 })
      .select("email -_id")
      .cursor();

    let attempted = 0;
    let sent = 0;
    const failures = [];

    let batch = [];
    for await (const doc of cursor) {
      const email = String(doc?.email || "").trim().toLowerCase();
      if (!email || !isValidEmail(email)) continue;

      batch.push(email);
      if (batch.length < limits.batchSize) continue;

      for (const address of batch) {
        if (attempted >= limit) break;
        attempted += 1;
        const result = await sendEmail({
          to: address,
          subject,
          text: resolvedText,
          html: resolvedHtml,
          context: "newsletter.campaign.broadcast",
        });
        if (result?.success) {
          sent += 1;
        } else {
          failures.push({ email: address, error: result?.error || "send_failed" });
        }
      }

      batch = [];
      if (attempted >= limit) break;
      if (limits.delayMs) {
        await sleep(limits.delayMs);
      }
    }

    // Flush last partial batch
    if (attempted < limit && batch.length) {
      for (const address of batch) {
        if (attempted >= limit) break;
        attempted += 1;
        const result = await sendEmail({
          to: address,
          subject,
          text: resolvedText,
          html: resolvedHtml,
          context: "newsletter.campaign.broadcast",
        });
        if (result?.success) {
          sent += 1;
        } else {
          failures.push({ email: address, error: result?.error || "send_failed" });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Newsletter broadcast completed",
      summary: {
        attempted,
        sent,
        failed: failures.length,
        limit,
      },
      failures: failures.slice(0, 50),
    });
  } catch (error) {
    logger.error("newsletter.sendCampaign", "Failed to send campaign", {
      error: error?.message || String(error),
    });
    return res.status(500).json({
      success: false,
      message: "Failed to send newsletter campaign",
    });
  }
};
