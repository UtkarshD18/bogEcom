import mongoose from "mongoose";
import { getMessaging, isFirebaseReady } from "../config/firebaseAdmin.js";
import NotificationTokenModel from "../models/notificationToken.model.js";
import UserModel from "../models/user.model.js";

const isProduction = process.env.NODE_ENV === "production";
// Debug-only logging to keep production output clean
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

const INVALID_FCM_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

const getFrontendBaseUrl = () => {
  const raw = process.env.CLIENT_URL || process.env.ADMIN_URL || "";
  const first = String(raw).split(",")[0].trim();
  return first.replace(/\/+$/, "");
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
    const { token, platform } = req.body;

    const resolvedUserId = req.user || null;
    const resolvedUserType = resolvedUserId ? "user" : "guest";

    // Validate token
    if (!token || typeof token !== "string" || token.length < 50) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid FCM token",
      });
    }

    // Validate resolved userId if present
    if (resolvedUserId && !mongoose.Types.ObjectId.isValid(resolvedUserId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid authenticated userId",
      });
    }

    // Upsert token (update if exists, create if not)
    const tokenDoc = await NotificationTokenModel.findOneAndUpdate(
      { token },
      {
        token,
        userType: resolvedUserType,
        userId: resolvedUserId,
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

    let allowedUserTokens = userTokens;
    if (allowedUserTokens.length > 0) {
      const userIds = [
        ...new Set(allowedUserTokens.map((t) => String(t.userId || ""))),
      ].filter(Boolean);

      if (userIds.length > 0) {
        const usersWithPushEnabled = await UserModel.find({
          _id: { $in: userIds },
          "notificationSettings.pushNotifications": { $ne: false },
        }).select("_id");

        const allowedUserIdSet = new Set(
          usersWithPushEnabled.map((u) => String(u._id)),
        );
        allowedUserTokens = allowedUserTokens.filter((t) =>
          allowedUserIdSet.has(String(t.userId)),
        );
      }
    }

    const allTokens = [...guestTokens, ...allowedUserTokens].map((t) => t.token);

    if (allTokens.length === 0) {
      debugLog("No tokens to send offer notification to");
      return { success: true, sent: 0, reason: "no_tokens" };
    }

    // Format notification
    const discountText =
      coupon.discountType === "percentage"
        ? `${coupon.discountValue}% OFF`
        : `₹${coupon.discountValue} OFF`;

    const customTitle = String(options.title || "").trim();
    const customBody = String(options.body || "").trim();

    const notification = {
      title: customTitle || `🎉 New Offer: ${discountText}`,
      body:
        customBody ||
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
    const successfulTokens = [];
    const failedTokenDetails = [];
    const failureCodes = {};

    for (let i = 0; i < allTokens.length; i += batchSize) {
      const batch = allTokens.slice(i, i + batchSize);

      try {
        const response = await messaging.sendEachForMulticast({
          tokens: batch,
          notification,
          data,
          webpush: {
            fcmOptions: {
              link: getFrontendBaseUrl(),
            },
          },
        });

        successCount += response.successCount;
        failureCount += response.failureCount;

        // Track per-token success/failure
        response.responses.forEach((resp, idx) => {
          const token = batch[idx];
          if (!token) return;

          if (resp.success) {
            successfulTokens.push(token);
            return;
          }

          const code = resp.error?.code || "unknown";
          failureCodes[code] = (failureCodes[code] || 0) + 1;
          failedTokenDetails.push({ token, code });
        });
      } catch (batchError) {
        console.error("Batch send error:", batchError.message);
        // A batch-level error usually indicates a config/credential issue.
        return {
          success: false,
          reason: batchError.code || batchError.message || "batch_send_error",
        };
      }
    }

    // Keep token health in sync (never fail the send result because of a DB write)
    await Promise.allSettled([
      ...successfulTokens.map((t) =>
        NotificationTokenModel.markTokenSuccess(t).catch(() => {}),
      ),
      ...failedTokenDetails.map(({ token, code }) => {
        if (INVALID_FCM_TOKEN_CODES.has(code)) {
          return NotificationTokenModel.updateOne(
            { token },
            {
              $set: {
                isActive: false,
                failureCount: 5,
                lastUsedAt: new Date(),
              },
            },
          ).catch(() => {});
        }

        return NotificationTokenModel.markTokenFailed(token).catch(() => {});
      }),
    ]);

    debugLog(
      `Offer notification sent: ${successCount} success, ${failureCount} failed`,
    );

    return {
      success: true,
      sent: successCount,
      failed: failureCount,
      totalTokens: allTokens.length,
      failureCodes,
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
    const user = await UserModel.findById(userId).select("notificationSettings");
    const pushNotificationsEnabled =
      user?.notificationSettings?.pushNotifications !== false;
    const orderUpdatesEnabled = user?.notificationSettings?.orderUpdates !== false;

    if (!pushNotificationsEnabled || !orderUpdatesEnabled) {
      debugLog(`User ${userId} has disabled order update notifications`);
      return { success: true, sent: 0, reason: "disabled_by_user_settings" };
    }

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
      pending_payment: "Your order is pending payment",
      accepted: "Your order has been accepted",
      in_warehouse: "Your order is in the warehouse",
      confirmed: "Your order has been confirmed",
      shipped: "Your order is on the way",
      out_for_delivery: "Your order is out for delivery",
      delivered: "Your order has been delivered",
      cancelled: "Your order has been cancelled",
      rto: "Your order is returning to origin",
      rto_completed: "Return to origin completed",
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
          link: `${getFrontendBaseUrl()}/orders/${order._id}`,
        },
      },
    });

    const failureCodes = {};
    await Promise.allSettled(
      response.responses.map((resp, idx) => {
        const token = tokens[idx];
        if (!token) return Promise.resolve();

        if (resp.success) {
          return NotificationTokenModel.markTokenSuccess(token).catch(() => {});
        }

        const code = resp.error?.code || "unknown";
        failureCodes[code] = (failureCodes[code] || 0) + 1;

        if (INVALID_FCM_TOKEN_CODES.has(code)) {
          return NotificationTokenModel.updateOne(
            { token },
            {
              $set: {
                isActive: false,
                failureCount: 5,
                lastUsedAt: new Date(),
              },
            },
          ).catch(() => {});
        }

        return NotificationTokenModel.markTokenFailed(token).catch(() => {});
      }),
    );

    debugLog(
      `Order notification sent to user ${userId}: ${response.successCount} success, ${response.failureCount} failed`,
    );

    return {
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      failureCodes,
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
        firebaseReady: isFirebaseReady(),
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
      title,
      body,
    });

    if (result.success && (result.reason === "no_tokens" || result.totalTokens === 0)) {
      return res.status(409).json({
        error: true,
        success: false,
        message:
          "No active notification tokens found. Open the client site and enable Push Notifications, then try again.",
        data: result,
      });
    }

    if (!result.success) {
      const reason = result.reason || "unknown_error";
      const baseMessage =
        reason === "firebase_not_ready" || reason === "messaging_not_available"
          ? "Push notifications are not configured on the server. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in server/.env and restart the server."
          : "Failed to send offer notification";

      const message =
        baseMessage +
        (reason &&
        reason !== "firebase_not_ready" &&
        reason !== "messaging_not_available"
          ? ` (${reason})`
          : "");

      return res.status(503).json({
        error: true,
        success: false,
        message,
        data: result,
      });
    }

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
