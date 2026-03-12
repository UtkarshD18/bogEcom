import OrderModel from "../models/order.model.js";
import UserModel from "../models/user.model.js";
import { sendTemplatedEmail } from "../config/emailService.js";
import { logger } from "../utils/errorHandler.js";

const DEFAULT_DELAY_DAYS = 3;
const DEFAULT_POLL_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_BATCH_LIMIT = 50;
const DEFAULT_RETRY_GAP_HOURS = 12;
const MAX_FAILURES = 3;

let feedbackTimer = null;

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const normalizeBaseUrl = (value) =>
  String(value || "")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");

const getFrontendBaseUrl = () =>
  normalizeBaseUrl(process.env.CLIENT_URL) ||
  normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
  normalizeBaseUrl(process.env.FRONTEND_URL) ||
  "https://healthyonegram.com";

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

const resolveDisplayOrderId = (order) => {
  const rawDisplay = String(order?.displayOrderId || "").trim();
  if (rawDisplay) return rawDisplay;
  const fallback = String(order?._id || "").trim().slice(-8).toUpperCase();
  return fallback ? `BOG-${fallback}` : "N/A";
};

const resolveDeliveredAt = (order) => {
  if (order?.deliveryDate) return new Date(order.deliveryDate);
  const timeline = Array.isArray(order?.statusTimeline) ? order.statusTimeline : [];
  const delivered = timeline.find(
    (entry) => String(entry?.status || "").toLowerCase() === "delivered",
  );
  const completed = timeline.find(
    (entry) => String(entry?.status || "").toLowerCase() === "completed",
  );
  const entry = delivered || completed;
  if (entry?.timestamp) return new Date(entry.timestamp);
  return null;
};

const resolveOrderRecipient = async (order) => {
  const fallbackName =
    String(
      order?.billingDetails?.fullName ||
        order?.guestDetails?.fullName ||
        order?.user?.name ||
        "Customer",
    ).trim() || "Customer";
  const directEmail = String(
    order?.billingDetails?.email ||
      order?.guestDetails?.email ||
      order?.user?.email ||
      "",
  )
    .trim()
    .toLowerCase();

  if (directEmail) {
    return { email: directEmail, name: fallbackName, user: order?.user || null };
  }

  const userId = order?.user?._id || order?.user || null;
  if (!userId) {
    return { email: "", name: fallbackName, user: null };
  }

  try {
    const user = await UserModel.findById(userId)
      .select("email name notificationSettings")
      .lean();
    const resolvedEmail = String(user?.email || "").trim().toLowerCase();
    const resolvedName =
      String(user?.name || fallbackName || "Customer").trim() || "Customer";
    return { email: resolvedEmail, name: resolvedName, user };
  } catch {
    return { email: "", name: fallbackName, user: null };
  }
};

const shouldSendFeedbackEmail = ({ order, now, delayMs, retryGapMs }) => {
  if (!order) return false;
  if (order.feedbackEmailSentAt) return false;
  if ((order.feedbackEmailFailureCount || 0) >= MAX_FAILURES) return false;

  const lastAttempt = order.feedbackEmailLastAttemptAt
    ? new Date(order.feedbackEmailLastAttemptAt).getTime()
    : 0;
  if (lastAttempt && now - lastAttempt < retryGapMs) return false;

  const deliveredAt = resolveDeliveredAt(order);
  if (!deliveredAt) return false;
  return now - deliveredAt.getTime() >= delayMs;
};

const sendFeedbackEmail = async ({ order, delayDays }) => {
  const { email, name, user } = await resolveOrderRecipient(order);
  if (!email) {
    return { success: false, reason: "missing_email" };
  }

  const emailNotificationsEnabled =
    user?.notificationSettings?.emailNotifications !== false;
  if (!emailNotificationsEnabled) {
    return { success: false, reason: "email_notifications_disabled" };
  }

  const siteUrl = getFrontendBaseUrl();
  const supportContact = getSupportContactEmail();
  const supportUrl = supportContact ? `mailto:${supportContact}` : siteUrl;
  const orderId = resolveDisplayOrderId(order);
  const orderDate = order?.createdAt
    ? new Date(order.createdAt).toLocaleDateString("en-IN")
    : "recently";
  const feedbackUrl = order?.user
    ? `${siteUrl}/orders/${encodeURIComponent(String(order._id))}`
    : siteUrl;

  const subject = `How was your order ${orderId}?`;

  const text = [
    `Hi ${name},`,
    `Thanks for shopping with us.`,
    `We delivered order ${orderId} (${orderDate}).`,
    `We would love your feedback.`,
    `Share feedback: ${feedbackUrl}`,
    supportContact ? `Support: ${supportContact}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await sendTemplatedEmail({
    to: email,
    subject,
    templateFile: "orderFeedbackRequest.html",
    templateData: {
      customer_name: name,
      order_number: orderId,
      order_date: orderDate,
      feedback_url: feedbackUrl,
      delay_days: String(delayDays),
      site_url: siteUrl,
      support_contact: supportContact || "support",
      support_url: supportUrl,
      year: String(new Date().getFullYear()),
    },
    text,
    context: "order.feedback",
  });

  return result?.success ? { success: true } : { success: false };
};

export const processOrderFeedbackQueue = async () => {
  const enabled = toBool(process.env.ORDER_FEEDBACK_EMAIL_ENABLED, true);
  if (!enabled) return;

  const delayDays = Math.max(
    toInt(process.env.ORDER_FEEDBACK_DELAY_DAYS, DEFAULT_DELAY_DAYS),
    1,
  );
  const delayMs = delayDays * 24 * 60 * 60 * 1000;
  const retryGapMs =
    Math.max(
      toInt(process.env.ORDER_FEEDBACK_RETRY_GAP_HOURS, DEFAULT_RETRY_GAP_HOURS),
      1,
    ) *
    60 *
    60 *
    1000;
  const batchLimit = Math.max(
    toInt(process.env.ORDER_FEEDBACK_BATCH_LIMIT, DEFAULT_BATCH_LIMIT),
    1,
  );

  const now = Date.now();
  const candidateOrders = await OrderModel.find({
    purchaseOrder: null,
    order_status: { $in: ["delivered", "completed"] },
    feedbackEmailSentAt: null,
    feedbackEmailFailureCount: { $lt: MAX_FAILURES },
  })
    .sort({ deliveryDate: -1 })
    .limit(batchLimit)
    .lean();

  if (!candidateOrders.length) return;

  await Promise.allSettled(
    candidateOrders.map(async (order) => {
      const eligible = shouldSendFeedbackEmail({
        order,
        now,
        delayMs,
        retryGapMs,
      });
      if (!eligible) return;

      const attemptAt = new Date();
      await OrderModel.updateOne(
        { _id: order._id },
        { $set: { feedbackEmailLastAttemptAt: attemptAt } },
      );

      const result = await sendFeedbackEmail({ order, delayDays });
      if (result.success) {
        await OrderModel.updateOne(
          { _id: order._id },
          {
            $set: {
              feedbackEmailSentAt: new Date(),
            },
          },
        );
        logger.info("orderFeedback", "Feedback email sent", {
          orderId: order._id,
        });
      } else {
        await OrderModel.updateOne(
          { _id: order._id },
          { $inc: { feedbackEmailFailureCount: 1 } },
        );
        logger.warn("orderFeedback", "Feedback email failed", {
          orderId: order._id,
          reason: result.reason || "send_failed",
        });
      }
    }),
  );
};

export const startOrderFeedbackJob = () => {
  if (feedbackTimer) return;
  const intervalMs = Math.max(
    toInt(process.env.ORDER_FEEDBACK_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS),
    60 * 1000,
  );

  feedbackTimer = setInterval(processOrderFeedbackQueue, intervalMs);
  processOrderFeedbackQueue().catch((error) =>
    logger.error("orderFeedback", "Initial feedback job failed", {
      error: error?.message || String(error),
    }),
  );
  logger.info("orderFeedback", "Feedback email scheduler started", { intervalMs });
};

export const stopOrderFeedbackJob = () => {
  if (!feedbackTimer) return;
  clearInterval(feedbackTimer);
  feedbackTimer = null;
};
