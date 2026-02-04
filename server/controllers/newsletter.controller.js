import admin from "firebase-admin";
import { sendEmail } from "../config/emailService.js";
import { isFirebaseReady } from "../config/firebaseAdmin.js";
import Newsletter from "../models/newsletter.model.js";

/**
 * Generate welcome email HTML template
 * @param {string} email - Subscriber email
 * @returns {string} - HTML email template
 */
const getWelcomeEmailTemplate = (email) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BuyOneGram Family!</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f5f0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #c1591c 0%, #e07830 100%); padding: 40px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
        🥜 Welcome to BuyOneGram!
      </h1>
      <p style="color: #fff8f0; margin: 10px 0 0; font-size: 16px;">
        Your journey to healthy, delicious peanut butter starts here
      </p>
    </div>
    
    <!-- Main Content -->
    <div style="padding: 40px 30px;">
      <h2 style="color: #333333; margin: 0 0 20px; font-size: 22px;">
        Hello, Peanut Butter Lover! 👋
      </h2>
      
      <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Thank you for joining the <strong style="color: #c1591c;">BuyOneGram Family!</strong> We're thrilled to have you on board.
      </p>
      
      <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        As a valued subscriber, you'll be the first to know about:
      </p>
      
      <ul style="color: #555555; font-size: 15px; line-height: 1.8; padding-left: 20px; margin: 0 0 25px;">
        <li>🎉 <strong>Exclusive discounts</strong> and special offers</li>
        <li>🆕 <strong>New product launches</strong> and flavors</li>
        <li>📖 <strong>Healthy recipes</strong> and nutrition tips</li>
        <li>🎁 <strong>Member-only deals</strong> and early access</li>
      </ul>
      
      <div style="background-color: #fff8f0; border-left: 4px solid #c1591c; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #333333; font-size: 15px; margin: 0; font-style: italic;">
          "At BuyOneGram, we believe in delivering the purest, most delicious peanut butter made with love and care. Every jar is a promise of quality!"
        </p>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://buyonegram.com/products" style="display: inline-block; background: linear-gradient(135deg, #c1591c 0%, #e07830 100%); color: #ffffff; text-decoration: none; padding: 14px 35px; font-size: 16px; font-weight: 600; border-radius: 30px; box-shadow: 0 4px 15px rgba(193, 89, 28, 0.3);">
          Explore Our Products
        </a>
      </div>
      
      <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 25px 0 0;">
        With warm wishes and nutty vibes,<br>
        <strong style="color: #c1591c;">The BuyOneGram Team</strong> 🥜
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #2c2c2c; padding: 30px; text-align: center;">
      <p style="color: #aaaaaa; font-size: 13px; margin: 0 0 10px;">
        © ${new Date().getFullYear()} BuyOneGram. All rights reserved.
      </p>
      <p style="color: #888888; font-size: 12px; margin: 0;">
        You're receiving this email because you subscribed at ${email}
      </p>
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
    const subject = "🎉 Welcome to the BuyOneGram Family!";
    const text = `Welcome to BuyOneGram! Thank you for subscribing to our newsletter. You'll now receive updates about exclusive discounts, new products, and healthy recipes. Visit us at https://buyonegram.com`;
    const html = getWelcomeEmailTemplate(email);

    const result = await sendEmail(email, subject, text, html);

    if (result.success) {
      console.log(`✓ Welcome email sent to: ${email}`);
    } else {
      console.error(
        `✗ Failed to send welcome email to ${email}:`,
        result.error,
      );
    }

    return result;
  } catch (error) {
    console.error("Welcome email error:", error.message);
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
      console.log("Firebase not configured, skipping Firestore save");
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

    console.log(`✓ Subscriber saved to Firebase: ${subscriberData.email}`);
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

      // Send welcome back email
      sendWelcomeEmail(normalizedEmail);

      return res.status(200).json({
        success: true,
        message: "Welcome back! You've been resubscribed to our newsletter.",
      });
    }

    // Create new subscriber in MongoDB
    const newSubscriber = await Newsletter.create({
      email: normalizedEmail,
      source,
    });

    // Also save to Firebase Firestore
    await saveToFirebase({
      email: normalizedEmail,
      source,
    });

    // Send welcome email to new subscriber
    sendWelcomeEmail(normalizedEmail);

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
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
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
