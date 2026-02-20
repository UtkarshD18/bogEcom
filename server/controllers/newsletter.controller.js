import admin from "firebase-admin";
import { sendEmail, sendTemplatedEmail } from "../config/emailService.js";
import { isFirebaseReady } from "../config/firebaseAdmin.js";
import Newsletter from "../models/newsletter.model.js";
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
  <title>Welcome to BuyOneGram Family</title>
</head>
<body style="margin:0;padding:0;font-family:Segoe UI,Arial,sans-serif;background:#f9f5f0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#c1591c 0%,#e07830 100%);padding:32px 24px;text-align:center;color:#fff;">
      <h1 style="margin:0;font-size:26px;">Welcome to BuyOneGram</h1>
      <p style="margin:10px 0 0;font-size:15px;">Your healthy shopping journey starts here.</p>
    </div>

    <div style="padding:28px 24px;color:#444;line-height:1.6;">
      <p>Thank you for subscribing with <strong>${email}</strong>.</p>
      <p>You will receive product updates, special offers, and healthy recipes.</p>
      <p><a href="${siteUrl}/products" style="display:inline-block;background:#c1591c;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;">Explore Products</a></p>
      <p style="margin-top:18px;">Regards,<br><strong>BuyOneGram Team</strong></p>
    </div>

    <div style="background:#2c2c2c;padding:20px 24px;color:#aaa;font-size:12px;">
      <p style="margin:0;">&copy; ${new Date().getFullYear()} BuyOneGram. All rights reserved.</p>
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
    const subject = "Welcome to the BuyOneGram Family!";
    const text = `Welcome to BuyOneGram! Thank you for subscribing to our newsletter. You'll now receive updates about exclusive discounts, new products, and healthy recipes. Visit us at ${siteUrl}`;

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
