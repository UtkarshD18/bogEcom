import mongoose from "mongoose";
import { getMessaging, isFirebaseReady } from "../config/firebaseAdmin.js";
import NotificationTokenModel from "../models/notificationToken.model.js";

const isProduction = process.env.NODE_ENV === "production";
// Debug-only logging to keep production output clean
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

/**
 * Notification Controller
 *
 * Handles:
 * 1. Token registration (guests + users)
 * 2. Offer notifications (to all tokens)
 * 3. Order update notifications (to user tokens only)
 *
 * SECURITY:
 * - Guests only receive offer notifications
 * - Order notifications require logged-in user ownership
 * - All FCM sends happen server-side only
 */

// ==================== TOKEN MANAGEMENT ====================

/**
 * Register notification token
 * @route POST /api/notifications/register
 * @body { token, userType, userId? }
 */
export const registerToken = async (req, res) => {
  try {
    const { token, userType, userId, platform } = req.body;

    // Validate token
    if (!token || typeof token !== "string" || token.length < 50) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid FCM token",
      });
    }

    // Validate userType
    if (!userType || !["guest", "user"].includes(userType)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "userType must be 'guest' or 'user'",
      });
    }

    // If user type, require userId
    if (userType === "user") {
      if (!userId) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "userId is required for user tokens",
        });
      }

      // Validate userId format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Invalid userId format",
        });
      }
    }

    // Upsert token (update if exists, create if not)
    const tokenDoc = await NotificationTokenModel.findOneAndUpdate(
      { token },
      {
        token,
        userType,
        userId: userType === "user" ? userId : null,
        platform: platform || "web",
        isActive: true,
        failureCount: 0,
        lastUsedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    res.status(200).json({
      error: false,
      success: true,
      message: "Token registered successfully",
      data: {
        id: tokenDoc._id,
        userType: tokenDoc.userType,
      },
    });
  } catch (error) {
    // Handle duplicate key error gracefully
    if (error.code === 11000) {
      return res.status(200).json({
        error: false,
        success: true,
        message: "Token already registered",
      });
    }

    console.error("Error registering token:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to register notification token",
    });
  }
};

/**
 * Unregister notification token
 * @route DELETE /api/notifications/unregister
 * @body { token }
 */
export const unregisterToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Token is required",
      });
    }

    await NotificationTokenModel.findOneAndUpdate(
      { token },
      { isActive: false },
    );

    res.status(200).json({
      error: false,
      success: true,
      message: "Token unregistered successfully",
    });
  } catch (error) {
    console.error("Error unregistering token:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to unregister token",
    });
  }
};

// ==================== INTERNAL NOTIFICATION FUNCTIONS ====================

/**
 * Send offer notification to all tokens (guests + users)
 * INTERNAL FUNCTION - Not exposed via API
 *
 * @param {Object} coupon - The coupon object
 * @param {Object} options - Additional options
 * @returns {Object} - Result with success/failure counts
 */
export const sendOfferNotification = async (coupon, options = {}) => {
  if (!isFirebaseReady()) {
    debugLog("Firebase not ready, skipping offer notification");
    return { success: false, reason: "firebase_not_ready" };
  }

  const messaging = getMessaging();
  if (!messaging) {
    return { success: false, reason: "messaging_not_available" };
  }

  try {
    // Get all active tokens (both guests and users for offers)
    const [guestTokens, userTokens] = await Promise.all([
      NotificationTokenModel.getGuestTokens(),
      options.includeUsers !== false
        ? NotificationTokenModel.getUserTokens()
        : Promise.resolve([]),
    ]);

    const allTokens = [...guestTokens, ...userTokens].map((t) => t.token);

    if (allTokens.length === 0) {
      debugLog("No tokens to send offer notification to");
      return { success: true, sent: 0, reason: "no_tokens" };
    }

    // Format notification
    const discountText =
      coupon.discountType === "percentage"
        ? `${coupon.discountValue}% OFF`
        : `₹${coupon.discountValue} OFF`;

    const notification = {
      title: `🎉 New Offer: ${discountText}`,
      body:
        coupon.description ||
        `Use code ${coupon.code} to get ${discountText} on your order!`,
    };

    const data = {
      type: "offer",
      couponCode: coupon.code,
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      expiresAt: coupon.endDate?.toISOString() || "",
      url: "/",
    };

    // Send in batches of 500 (FCM limit)
    const batchSize = 500;
    let successCount = 0;
    let failureCount = 0;
    const failedTokens = [];

    for (let i = 0; i < allTokens.length; i += batchSize) {
      const batch = allTokens.slice(i, i + batchSize);

      try {
        const response = await messaging.sendEachForMulticast({
          tokens: batch,
          notification,
          data,
          webpush: {
            fcmOptions: {
              link: process.env.FRONTEND_URL || "http://localhost:3000",
            },
          },
        });

        successCount += response.successCount;
        failureCount += response.failureCount;

        // Track failed tokens
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(batch[idx]);
          }
        });
      } catch (batchError) {
        console.error("Batch send error:", batchError.message);
        failureCount += batch.length;
      }
    }

    // Mark failed tokens
    for (const failedToken of failedTokens) {
      await NotificationTokenModel.markTokenFailed(failedToken);
    }

    debugLog(
      `Offer notification sent: ${successCount} success, ${failureCount} failed`,
    );

    return {
      success: true,
      sent: successCount,
      failed: failureCount,
      totalTokens: allTokens.length,
    };
  } catch (error) {
    console.error("Error sending offer notification:", error);
    return { success: false, reason: error.message };
  }
};

/**
 * Send order update notification to specific user
 * INTERNAL FUNCTION - Not exposed via API
 *
 * @param {Object} order - The order object (with user populated)
 * @param {String} newStatus - The new order status
 * @returns {Object} - Result with success/failure counts
 */
export const sendOrderUpdateNotification = async (order, newStatus) => {
  if (!isFirebaseReady()) {
    debugLog("Firebase not ready, skipping order notification");
    return { success: false, reason: "firebase_not_ready" };
  }

  const messaging = getMessaging();
  if (!messaging) {
    return { success: false, reason: "messaging_not_available" };
  }

  // Must have a user ID - guests don't get order notifications
  const userId = order.user?._id || order.user;
  if (!userId) {
    debugLog("No user ID for order notification");
    return { success: false, reason: "no_user_id" };
  }

  try {
    // Get tokens for this specific user
    const userTokens = await NotificationTokenModel.getTokensByUserId(userId);

    if (userTokens.length === 0) {
      debugLog(`No tokens for user ${userId}`);
      return { success: true, sent: 0, reason: "no_tokens" };
    }

    const tokens = userTokens.map((t) => t.token);

    // Format status for display
    const statusMessages = {
      pending: "Your order is being processed",
      confirmed: "Your order has been confirmed! 🎉",
      shipped: "Your order is on the way! 🚚",
      delivered: "Your order has been delivered! ✅",
      cancelled: "Your order has been cancelled",
    };

    const notification = {
      title: `Order Update: #${order._id.toString().slice(-8).toUpperCase()}`,
      body: statusMessages[newStatus] || `Order status updated to ${newStatus}`,
    };

    const data = {
      type: "order_update",
      orderId: order._id.toString(),
      orderStatus: newStatus,
      url: `/orders/${order._id}`,
    };

    // Send to all user tokens
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification,
      data,
      webpush: {
        fcmOptions: {
          link: `${process.env.FRONTEND_URL || "http://localhost:3000"}/orders/${order._id}`,
        },
      },
    });

    // Mark failed tokens
    response.responses.forEach(async (resp, idx) => {
      if (!resp.success) {
        await NotificationTokenModel.markTokenFailed(tokens[idx]);
      } else {
        await NotificationTokenModel.markTokenSuccess(tokens[idx]);
      }
    });

    debugLog(
      `Order notification sent to user ${userId}: ${response.successCount} success, ${response.failureCount} failed`,
    );

    return {
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    console.error("Error sending order notification:", error);
    return { success: false, reason: error.message };
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get notification stats (Admin)
 * @route GET /api/notifications/admin/stats
 */
export const getNotificationStats = async (req, res) => {
  try {
    const [guestCount, userCount, inactiveCount] = await Promise.all([
      NotificationTokenModel.countDocuments({
        userType: "guest",
        isActive: true,
      }),
      NotificationTokenModel.countDocuments({
        userType: "user",
        isActive: true,
      }),
      NotificationTokenModel.countDocuments({ isActive: false }),
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: {
        guestTokens: guestCount,
        userTokens: userCount,
        inactiveTokens: inactiveCount,
        totalActive: guestCount + userCount,
      },
    });
  } catch (error) {
    console.error("Error getting notification stats:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to get notification stats",
    });
  }
};

/**
 * Manually trigger offer notification (Admin)
 * For testing or manual campaigns
 * @route POST /api/notifications/admin/send-offer
 * @body { title, body, data?, includeUsers? }
 */
export const manualSendOffer = async (req, res) => {
  try {
    const { title, body, data, includeUsers } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Title and body are required",
      });
    }

    // Create a pseudo-coupon object for the notification
    const pseudoCoupon = {
      code: data?.couponCode || "SPECIAL",
      discountType: "percentage",
      discountValue: data?.discountValue || 10,
      description: body,
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    const result = await sendOfferNotification(pseudoCoupon, {
      includeUsers: includeUsers !== false,
    });

    res.status(200).json({
      error: false,
      success: true,
      message: "Offer notification sent",
      data: result,
    });
  } catch (error) {
    console.error("Error sending manual offer:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to send offer notification",
    });
  }
};

// ==================== RATE LIMITING FOR NOTIFICATIONS ====================

// Track recent notifications to prevent spam
const recentNotifications = new Map();
const NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes

/**
 * Check if notification should be throttled
 * @param {String} key - Unique key for the notification type
 * @returns {Boolean} - True if should throttle
 */
export const shouldThrottleNotification = (key) => {
  const lastSent = recentNotifications.get(key);
  if (lastSent && Date.now() - lastSent < NOTIFICATION_COOLDOWN) {
    return true;
  }
  recentNotifications.set(key, Date.now());
  return false;
};

/**
 * Clear old entries from rate limit map (call periodically)
 */
export const cleanupRateLimitMap = () => {
  const now = Date.now();
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp > NOTIFICATION_COOLDOWN * 2) {
      recentNotifications.delete(key);
    }
  }
};

// Cleanup every 10 minutes
setInterval(cleanupRateLimitMap, 10 * 60 * 1000);
