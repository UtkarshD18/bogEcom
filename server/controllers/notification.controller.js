import mongoose from "mongoose";
import { getMessaging, isFirebaseReady } from "../config/firebaseAdmin.js";
import LiveOfferEventModel from "../models/liveOfferEvent.model.js";
import NotificationTokenModel from "../models/notificationToken.model.js";
import UserModel from "../models/user.model.js";
import { sendTemplatedEmail } from "../config/emailService.js";
import { emitLiveOfferNotification } from "../realtime/offerEvents.js";
import { getIO } from "../realtime/socket.js";

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
  "messaging/mismatched-credential",
  "messaging/invalid-argument",
]);

const normalizeBaseUrl = (value) =>
  String(value || "")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");

const isLocalhostBaseUrl = (value) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(
    normalizeBaseUrl(value),
  );

const getFrontendBaseUrl = () => {
  const candidate =
    normalizeBaseUrl(process.env.CLIENT_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeBaseUrl(process.env.FRONTEND_URL) ||
    normalizeBaseUrl(process.env.ADMIN_URL);

  if (isProduction && isLocalhostBaseUrl(candidate)) {
    return "https://healthyonegram.com";
  }

  return candidate || "https://healthyonegram.com";
};

const getSupportContactEmail = () =>
  String(
    process.env.SUPPORT_ADMIN_EMAIL ||
      process.env.SUPPORT_EMAIL ||
      process.env.EMAIL_FROM_ADDRESS ||
      process.env.SMTP_USER ||
      "",
  )
    .trim()
    .toLowerCase();

const normalizeNotificationTargetPath = (value, fallbackPath = "/products") => {
  const raw = String(value || "").trim();
  if (!raw) return fallbackPath;

  if (/^javascript:/i.test(raw)) {
    return fallbackPath;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
};

const resolveAbsoluteTargetUrl = (frontendBaseUrl, targetPathOrUrl) => {
  const target = normalizeNotificationTargetPath(targetPathOrUrl, "/products");
  if (/^https?:\/\//i.test(target)) return target;

  return `${frontendBaseUrl}${target.startsWith("/") ? "" : "/"}${target}`;
};

const normalizeSessionId = (value) =>
  String(value || "")
    .trim()
    .slice(0, 128);

const resolveSessionIdFromRequest = (req) => {
  const rawHeader = req.headers?.["x-session-id"];
  const headerSessionId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  return normalizeSessionId(
    req.body?.sessionId || headerSessionId || req.cookies?.sessionId,
  );
};

const LIVE_OFFER_RETENTION_MS = 30 * 60 * 1000;
const LIVE_OFFER_DB_RETENTION_MS = 24 * 60 * 60 * 1000;
const LIVE_OFFER_CACHE_LIMIT = 100;
const liveOfferFeed = [];

const pruneLiveOfferFeed = () => {
  const cutoff = Date.now() - LIVE_OFFER_RETENTION_MS;
  while (
    liveOfferFeed.length > 0 &&
    Number(liveOfferFeed[0]?.sentAtMs || 0) < cutoff
  ) {
    liveOfferFeed.shift();
  }
  if (liveOfferFeed.length > LIVE_OFFER_CACHE_LIMIT) {
    liveOfferFeed.splice(0, liveOfferFeed.length - LIVE_OFFER_CACHE_LIMIT);
  }
};

const cacheLiveOffer = async (payload) => {
  const sentAtMs = Number(payload?.sentAtMs || Date.now()) || Date.now();
  const notificationId = String(payload?.notificationId || "").trim();
  if (!notificationId) return;

  const normalizedPayload = {
    ...payload,
    notificationId,
    sentAtMs,
    sentAt: payload?.sentAt || new Date(sentAtMs).toISOString(),
  };

  // Fast local fallback for same-instance delivery.
  liveOfferFeed.push(normalizedPayload);
  pruneLiveOfferFeed();

  // Shared persistence so multi-instance deployments can poll the same feed.
  try {
    await LiveOfferEventModel.findOneAndUpdate(
      { notificationId },
      {
        $set: {
          notificationId,
          type: String(normalizedPayload.type || "offer"),
          title: String(normalizedPayload.title || ""),
          body: String(normalizedPayload.body || ""),
          audience: normalizedPayload.audience === "guest" ? "guest" : "all",
          data:
            normalizedPayload.data &&
            typeof normalizedPayload.data === "object"
              ? normalizedPayload.data
              : {},
          source: String(normalizedPayload.source || "socket"),
          sentAt: new Date(sentAtMs),
          sentAtMs,
        },
      },
      {
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  } catch (persistError) {
    console.error("Failed to persist live offer event:", persistError);
  }

  const oldCutoff = Date.now() - LIVE_OFFER_DB_RETENTION_MS;
  void LiveOfferEventModel.deleteMany({
    sentAtMs: { $lt: oldCutoff },
  }).catch(() => {});
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
    const sessionId = resolveSessionIdFromRequest(req) || null;
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

    if (!resolvedUserId && !sessionId) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Session ID is required for guest notification registration",
      });
    }

    const updatePayload = {
      token,
      userType: resolvedUserType,
      userId: resolvedUserId,
      sessionId,
      platform: platform || "web",
      isActive: true,
      failureCount: 0,
      lastUsedAt: new Date(),
    };

    // Upsert token (update if exists, create if not)
    const tokenDoc = await NotificationTokenModel.findOneAndUpdate(
      { token },
      { $set: updatePayload },
      { upsert: true, new: true },
    );

    // Promote all guest tokens from the same browser session once user logs in.
    if (resolvedUserId && sessionId) {
      await NotificationTokenModel.updateMany(
        {
          sessionId,
          userType: "guest",
        },
        {
          $set: {
            userType: "user",
            userId: resolvedUserId,
            isActive: true,
            failureCount: 0,
            lastUsedAt: new Date(),
          },
        },
      );
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Token registered successfully",
      data: {
        id: tokenDoc._id,
        userType: tokenDoc.userType,
        sessionId: tokenDoc.sessionId,
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
    const sessionId = resolveSessionIdFromRequest(req) || null;
    const resolvedUserId = req.user || null;

    if (!token) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Token is required",
      });
    }

    const scopedFilters = [];
    if (resolvedUserId && mongoose.Types.ObjectId.isValid(resolvedUserId)) {
      scopedFilters.push({ userId: resolvedUserId });
    }
    if (sessionId) {
      scopedFilters.push({ sessionId });
    }

    const query =
      scopedFilters.length > 0
        ? { token, $or: scopedFilters }
        : { token };

    await NotificationTokenModel.findOneAndUpdate(query, {
      isActive: false,
      lastUsedAt: new Date(),
    });

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
  const includeUsers = options.includeUsers !== false;
  const targetPath = normalizeNotificationTargetPath(options.targetUrl, "/products");
  const couponCode = String(coupon?.code || "")
    .trim()
    .toUpperCase();
  const discountType = String(coupon?.discountType || "percentage")
    .trim()
    .toLowerCase();
  const discountValue = Number(coupon?.discountValue || 0);
  const discountText =
    discountType === "percentage"
      ? `${discountValue}% OFF`
      : `INR ${discountValue} OFF`;

  const customTitle = String(options.title || "").trim();
  const customBody = String(options.body || "").trim();

  const notification = {
    title: customTitle || (couponCode ? `New Offer: ${discountText}` : "New Offer"),
    body:
      customBody ||
      String(coupon?.description || "").trim() ||
      (couponCode
        ? `Use code ${couponCode} to get ${discountText} on your order!`
        : "Discover our latest offers and products."),
  };

  const data = {
    type: "offer",
    ...(couponCode ? { couponCode } : {}),
    discountType,
    discountValue: String(discountValue),
    expiresAt: coupon?.endDate?.toISOString() || "",
    url: targetPath,
    notificationId: `offer:${couponCode || "GEN"}:${Date.now()}`,
    title: notification.title,
    body: notification.body,
  };

  const livePayload = {
    type: "offer",
    title: notification.title,
    body: notification.body,
    notificationId: data.notificationId,
    data,
    source: "socket",
    audience: includeUsers ? "all" : "guest",
    sentAt: new Date().toISOString(),
    sentAtMs: Date.now(),
  };

  await cacheLiveOffer(livePayload);

  const liveDelivery = emitLiveOfferNotification(livePayload, { includeUsers });

  const liveSummary = {
    liveDelivered: liveDelivery.delivered || 0,
    liveGuestDelivered: liveDelivery.guestDelivered || 0,
    liveUserDelivered: liveDelivery.userDelivered || 0,
  };

  const messaging = getMessaging();
  if (!messaging) {
    const reason = isFirebaseReady()
      ? "messaging_not_available"
      : "firebase_not_ready";
    debugLog("Firebase messaging unavailable, skipping offer notification");
    return {
      success: false,
      reason,
      sent: 0,
      failed: 0,
      totalTokens: 0,
      failureCodes: {},
      ...liveSummary,
    };
  }

  try {
    // Get all active tokens (both guests and users for offers)
    const [guestTokens, userTokens] = await Promise.all([
      NotificationTokenModel.getGuestTokens(),
      includeUsers ? NotificationTokenModel.getUserTokens() : Promise.resolve([]),
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
      return {
        success: true,
        sent: 0,
        failed: 0,
        totalTokens: 0,
        failureCodes: {},
        reason: "no_tokens",
        ...liveSummary,
      };
    }

    const frontendBaseUrl = getFrontendBaseUrl();
    const targetUrl = resolveAbsoluteTargetUrl(frontendBaseUrl, data.url);

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
            headers: {
              Urgency: "high",
            },
            notification: {
              title: notification.title,
              body: notification.body,
              icon: `${frontendBaseUrl}/logo.png`,
              badge: `${frontendBaseUrl}/logo.png`,
              tag: data.notificationId || data.type || "offer",
            },
            fcmOptions: {
              link: targetUrl,
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
          sent: successCount,
          failed: failureCount,
          totalTokens: allTokens.length,
          failureCodes,
          ...liveSummary,
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
      ...liveSummary,
    };
  } catch (error) {
    console.error("Error sending offer notification:", error);
    return {
      success: false,
      reason: error.message,
      sent: 0,
      failed: 0,
      totalTokens: 0,
      failureCodes: {},
      ...liveSummary,
    };
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
  const messaging = getMessaging();
  if (!messaging) {
    const reason = isFirebaseReady()
      ? "messaging_not_available"
      : "firebase_not_ready";
    debugLog("Firebase messaging unavailable, skipping order notification");
    return { success: false, reason };
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
      notificationId: `order:${order._id}:${newStatus}:${Date.now()}`,
      title: notification.title,
      body: notification.body,
    };
    const frontendBaseUrl = getFrontendBaseUrl();
    const targetUrl = `${frontendBaseUrl}/orders/${order._id}`;

    // Send to all user tokens
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification,
      data,
      webpush: {
        headers: {
          Urgency: "high",
        },
        notification: {
          title: notification.title,
          body: notification.body,
          icon: `${frontendBaseUrl}/logo.png`,
          badge: `${frontendBaseUrl}/logo.png`,
          tag: data.notificationId || "order_update",
          requireInteraction: true,
        },
        fcmOptions: {
          link: targetUrl,
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

    const io = getIO();
    const liveGuestConnections = Number(
      io?.sockets?.adapter?.rooms?.get("audience:guest")?.size || 0,
    );
    const liveUserConnections = Number(
      io?.sockets?.adapter?.rooms?.get("audience:user")?.size || 0,
    );
    const liveAllConnections = Number(
      io?.sockets?.adapter?.rooms?.get("audience:all")?.size || 0,
    );

    res.status(200).json({
      error: false,
      success: true,
      data: {
        firebaseReady: isFirebaseReady(),
        guestTokens: guestCount,
        userTokens: userCount,
        inactiveTokens: inactiveCount,
        totalActive: guestCount + userCount,
        liveGuestConnections,
        liveUserConnections,
        liveAllConnections,
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
 * Public live-offer feed fallback for browsers that miss socket delivery.
 * @route GET /api/notifications/offers/live-feed?since=<timestamp>&limit=<n>
 */
export const getLiveOfferFeed = async (req, res) => {
  try {
    const sinceRaw = Number(req.query?.since || 0);
    const since = Number.isFinite(sinceRaw) && sinceRaw > 0 ? sinceRaw : 0;

    const limitRaw = Number(req.query?.limit || 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.floor(limitRaw), 1), 20)
      : 10;

    const isAuthenticated = Boolean(req.user);
    const audienceFilter = isAuthenticated
      ? { audience: "all" }
      : { audience: { $in: ["all", "guest"] } };

    let offers = [];

    try {
      offers = await LiveOfferEventModel.find({
        sentAtMs: { $gt: since },
        ...audienceFilter,
      })
        .sort({ sentAtMs: 1 })
        .limit(limit)
        .lean();
    } catch (dbError) {
      // Fallback for transient DB issues: serve in-memory recent events.
      pruneLiveOfferFeed();
      offers = liveOfferFeed
        .filter((offer) => {
          const sentAtMs = Number(offer?.sentAtMs || 0);
          if (!sentAtMs || sentAtMs <= since) return false;
          if (offer?.audience === "guest" && isAuthenticated) return false;
          return true;
        })
        .slice(-limit);
    }

    return res.status(200).json({
      error: false,
      success: true,
      data: {
        offers,
        serverTime: Date.now(),
      },
    });
  } catch (error) {
    console.error("Error getting live offer feed:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to get live offer feed",
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

    const normalizedCouponCode = String(data?.couponCode || "")
      .trim()
      .toUpperCase();

    // Create a pseudo-coupon object for notification content (coupon is optional)
    const pseudoCoupon = {
      code: normalizedCouponCode,
      discountType: "percentage",
      discountValue: data?.discountValue || 10,
      description: body,
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    const result = await sendOfferNotification(pseudoCoupon, {
      includeUsers: includeUsers !== false,
      title,
      body,
      targetUrl: data?.url || "/products",
    });

    const liveDelivered = Number(result.liveDelivered || 0);
    const noPushTokens =
      result.success && (result.reason === "no_tokens" || result.totalTokens === 0);

    if (noPushTokens && liveDelivered === 0) {
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
      const pushConfigMissing =
        reason === "firebase_not_ready" || reason === "messaging_not_available";
      const baseMessage = pushConfigMissing
        ? "Push notifications are not configured on the server. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in server/.env and restart the server."
        : "Failed to send offer notification";

      if (liveDelivered > 0) {
        return res.status(200).json({
          error: false,
          success: true,
          message: `${baseMessage} Live in-app alert delivered to ${liveDelivered} active visitor${liveDelivered === 1 ? "" : "s"}.`,
          data: result,
        });
      }

      const message =
        baseMessage +
        (reason && !pushConfigMissing ? ` (${reason})` : "");

      return res.status(503).json({
        error: true,
        success: false,
        message,
        data: result,
      });
    }

    const successMessage = noPushTokens
      ? `Offer notification delivered to ${liveDelivered} live visitor${liveDelivered === 1 ? "" : "s"} (push tokens unavailable).`
      : "Offer notification sent";

    res.status(200).json({
      error: false,
      success: true,
      message: successMessage,
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

/**
 * Send promotional email to opted-in users (Admin)
 * @route POST /api/notifications/admin/send-promotional-email
 * @body { subject, headline, message, couponCode?, discountText?, ctaLabel?, ctaUrl?, validUntil? }
 */
export const manualSendPromotionalEmail = async (req, res) => {
  try {
    const rawSubject = String(req.body?.subject || "").trim();
    const rawHeadline = String(req.body?.headline || "").trim();
    const rawMessage = String(req.body?.message || "").trim();
    const rawCoupon = String(req.body?.couponCode || "").trim().toUpperCase();
    const rawDiscountText = String(req.body?.discountText || "").trim();
    const rawCtaLabel = String(req.body?.ctaLabel || "").trim();
    const rawCtaUrl = String(req.body?.ctaUrl || "").trim();
    const rawValidUntil = String(req.body?.validUntil || "").trim();

    if (!rawSubject || !rawMessage) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Subject and message are required",
      });
    }

    const frontendBaseUrl = getFrontendBaseUrl();
    const defaultCtaUrl = `${frontendBaseUrl}/products`;
    const ctaUrl = rawCtaUrl
      ? resolveAbsoluteTargetUrl(frontendBaseUrl, rawCtaUrl)
      : defaultCtaUrl;
    const ctaLabel = rawCtaLabel || "Shop now";
    const headline = rawHeadline || rawSubject;
    const supportContact = getSupportContactEmail();
    const supportUrl = supportContact ? `mailto:${supportContact}` : frontendBaseUrl;
    const offerDetails = [rawDiscountText, rawCoupon ? `Use code ${rawCoupon}` : ""]
      .filter(Boolean)
      .join(" • ");
    const couponLine = rawCoupon ? `Coupon code: ${rawCoupon}` : "";
    const discountLine = rawDiscountText ? `Discount: ${rawDiscountText}` : "";
    const validUntilLine = rawValidUntil ? `Valid until: ${rawValidUntil}` : "";

    const recipients = await UserModel.find({
      email: { $exists: true, $ne: "" },
      "notificationSettings.promotionalEmails": { $ne: false },
    })
      .select("email name")
      .lean();

    if (!recipients.length) {
      return res.status(409).json({
        error: true,
        success: false,
        message: "No opted-in users with email addresses found.",
        data: { sent: 0, failed: 0, total: 0 },
      });
    }

    const batchSize = 50;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((user) =>
          sendTemplatedEmail({
            to: String(user?.email || "").trim().toLowerCase(),
            subject: rawSubject,
            templateFile: "promotionalOffer.html",
            templateData: {
              customer_name: String(user?.name || "Customer").trim(),
              headline,
              message: rawMessage,
              offer_details: offerDetails,
              coupon_code: couponLine,
              discount_text: discountLine,
              cta_label: ctaLabel,
              cta_url: ctaUrl,
              valid_until: validUntilLine,
              site_url: frontendBaseUrl,
              support_contact: supportContact || "support",
              support_url: supportUrl,
              year: String(new Date().getFullYear()),
            },
            text: [
              headline,
              rawMessage,
              offerDetails ? `Offer: ${offerDetails}` : "",
              validUntilLine || "",
              `Shop: ${ctaUrl}`,
              supportContact ? `Support: ${supportContact}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            context: "promotional.email",
          }),
        ),
      );

      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value?.success) {
          sent += 1;
        } else {
          failed += 1;
        }
      });
    }

    return res.status(200).json({
      error: false,
      success: true,
      message: `Promotional email sent to ${sent} users${failed ? ` (${failed} failed)` : ""}.`,
      data: {
        sent,
        failed,
        total: recipients.length,
      },
    });
  } catch (error) {
    console.error("Error sending promotional email:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to send promotional email",
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

