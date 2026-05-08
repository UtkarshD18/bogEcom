import { sendTemplatedEmail } from "../config/emailService.js";
import EmailLogModel from "../models/emailLog.model.js";
import OrderModel from "../models/order.model.js";
import SettingsModel from "../models/settings.model.js";
import UserModel from "../models/user.model.js";
import { runWithBackgroundJobLease } from "../utils/backgroundJobLease.js";
import { logger } from "../utils/errorHandler.js";

const EMAIL_AUTOMATION_SETTINGS_KEY = "emailAutomationSettings";

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  feedbackEnabled: true,
  retentionEnabled: true,
  feedbackDelayDays: 7,
  retentionDelayDays: 30,
  pollIntervalMinutes: 30,
  maxEmailsPerRun: 100,
  retryGapHours: 12,
  sendHourIST: 10,
  retentionCouponCode: "WELCOME10",
  retentionDiscountText: "Get 10% OFF on your next order",
});

let automationTimer = null;

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const normalizeSettings = (raw = {}) => ({
  enabled: toBool(raw.enabled, DEFAULT_SETTINGS.enabled),
  feedbackEnabled: toBool(
    raw.feedbackEnabled,
    DEFAULT_SETTINGS.feedbackEnabled,
  ),
  retentionEnabled: toBool(
    raw.retentionEnabled,
    DEFAULT_SETTINGS.retentionEnabled,
  ),
  feedbackDelayDays: Math.max(
    toInt(raw.feedbackDelayDays, DEFAULT_SETTINGS.feedbackDelayDays),
    1,
  ),
  retentionDelayDays: Math.max(
    toInt(raw.retentionDelayDays, DEFAULT_SETTINGS.retentionDelayDays),
    1,
  ),
  pollIntervalMinutes: Math.max(
    toInt(raw.pollIntervalMinutes, DEFAULT_SETTINGS.pollIntervalMinutes),
    5,
  ),
  maxEmailsPerRun: Math.max(
    toInt(raw.maxEmailsPerRun, DEFAULT_SETTINGS.maxEmailsPerRun),
    10,
  ),
  retryGapHours: Math.max(
    toInt(raw.retryGapHours, DEFAULT_SETTINGS.retryGapHours),
    1,
  ),
  sendHourIST: Math.min(
    Math.max(toInt(raw.sendHourIST, DEFAULT_SETTINGS.sendHourIST), 0),
    23,
  ),
  retentionCouponCode:
    String(
      raw.retentionCouponCode || DEFAULT_SETTINGS.retentionCouponCode,
    ).trim() || DEFAULT_SETTINGS.retentionCouponCode,
  retentionDiscountText:
    String(
      raw.retentionDiscountText || DEFAULT_SETTINGS.retentionDiscountText,
    ).trim() || DEFAULT_SETTINGS.retentionDiscountText,
});

const getSiteUrl = () =>
  String(
    process.env.CLIENT_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.FRONTEND_URL ||
      "https://healthyonegram.com",
  )
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");

const getSupportEmail = () =>
  String(
    process.env.SUPPORT_ADMIN_EMAIL ||
      process.env.SUPPORT_EMAIL ||
      process.env.EMAIL_FROM_ADDRESS ||
      process.env.SMTP_USER ||
      "support@healthyonegram.com",
  )
    .trim()
    .toLowerCase();

const getSupportContactUrl = () => `${getSiteUrl()}/contact`;

const getUnsubscribeUrl = (email) => {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(
    String(email || "")
      .trim()
      .toLowerCase(),
  )}`;
};

const getOrderDeliveryDate = (order) => {
  if (order?.deliveryDate) return new Date(order.deliveryDate);
  if (order?.delivery_date) return new Date(order.delivery_date);

  const timeline = Array.isArray(order?.statusTimeline)
    ? order.statusTimeline
    : [];
  const deliveredTimeline = timeline.find(
    (item) =>
      String(item?.status || "")
        .trim()
        .toLowerCase() === "delivered",
  );
  return deliveredTimeline?.timestamp
    ? new Date(deliveredTimeline.timestamp)
    : null;
};

const resolveDisplayOrderNumber = (order) => {
  const fromOrder = String(
    order?.orderNumber || order?.displayOrderId || "",
  ).trim();
  if (fromOrder) return fromOrder;
  const id = String(order?._id || "").trim();
  return id ? id.slice(-8).toUpperCase() : "N/A";
};

const resolveOrderItemsText = (order) => {
  const products = Array.isArray(order?.products) ? order.products : [];
  if (!products.length) return "No items";
  return products
    .map((item) => {
      const qty = Number(item?.quantity || 0);
      const unit = Number(item?.price || 0).toFixed(2);
      const title = String(item?.productTitle || item?.name || "Item").trim();
      return `${title} (x${qty}) - INR ${unit}`;
    })
    .join("\n");
};

const resolveOrderRecipient = async (order) => {
  const directEmail = String(
    order?.billingDetails?.email ||
      order?.guestDetails?.email ||
      order?.deliveryAddressSnapshot?.email ||
      "",
  )
    .trim()
    .toLowerCase();
  const directName =
    String(
      order?.billingDetails?.fullName ||
        order?.guestDetails?.fullName ||
        order?.deliveryAddressSnapshot?.order_name ||
        "Customer",
    ).trim() || "Customer";

  if (directEmail) {
    const linkedUser = order?.user
      ? await UserModel.findById(order.user)
          .select("_id email name email_opt_out notificationSettings")
          .lean()
      : null;
    return {
      email: directEmail,
      name: linkedUser?.name || directName,
      user: linkedUser,
    };
  }

  if (!order?.user) {
    return { email: "", name: directName, user: null };
  }

  const user = await UserModel.findById(order.user)
    .select("_id email name email_opt_out notificationSettings")
    .lean();
  return {
    email: String(user?.email || "")
      .trim()
      .toLowerCase(),
    name: String(user?.name || directName).trim() || "Customer",
    user,
  };
};

const appendUnsubscribeFooter = (html, email) => {
  const unsubscribeUrl = getUnsubscribeUrl(email);
  const footer = `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">To stop marketing emails, <a href="${unsubscribeUrl}">unsubscribe here</a>.</div>`;
  return `${String(html || "")}${footer}`;
};

const isWithinSendHourWindowIST = (sendHourIST) => {
  const now = new Date();
  const istHour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(now),
  );

  return istHour === Number(sendHourIST);
};

export const getEmailAutomationSettings = async () => {
  const setting = await SettingsModel.findOne({
    key: EMAIL_AUTOMATION_SETTINGS_KEY,
    isActive: true,
  })
    .select("value updatedAt updatedBy")
    .lean();

  const value = normalizeSettings(setting?.value || {});
  return {
    key: EMAIL_AUTOMATION_SETTINGS_KEY,
    value,
    updatedAt: setting?.updatedAt || null,
    updatedBy: setting?.updatedBy || null,
  };
};

export const updateEmailAutomationSettings = async ({ adminId, payload }) => {
  const normalized = normalizeSettings(payload || {});

  const saved = await SettingsModel.findOneAndUpdate(
    { key: EMAIL_AUTOMATION_SETTINGS_KEY },
    {
      $set: {
        key: EMAIL_AUTOMATION_SETTINGS_KEY,
        value: normalized,
        category: "notification",
        description: "Email automation scheduler settings",
        isActive: true,
        updatedBy: adminId || null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  restartEmailAutomationJob();

  return {
    value: normalized,
    updatedAt: saved?.updatedAt || null,
    updatedBy: saved?.updatedBy || null,
  };
};

export const createEmailLog = async (payload = {}) => {
  try {
    return await EmailLogModel.create(payload);
  } catch (error) {
    logger.warn("emailAutomation", "Failed to create email log", {
      error: error?.message || String(error),
      payload,
    });
    return null;
  }
};

const markEmailLogSent = async (emailLogId, result = {}) => {
  if (!emailLogId) return;
  await EmailLogModel.updateOne(
    { _id: emailLogId },
    {
      $set: {
        status: "sent",
        sent_at: new Date(),
        provider_message_id: String(result?.messageId || "").trim(),
      },
    },
  );
};

const markEmailLogFailed = async (emailLogId, errorMessage) => {
  if (!emailLogId) return;
  await EmailLogModel.updateOne(
    { _id: emailLogId },
    {
      $set: {
        status: "failed",
        error_message: String(errorMessage || "Send failed").slice(0, 1000),
      },
    },
  );
};

const markEmailLogSkipped = async (emailLogId, reason) => {
  if (!emailLogId) return;
  await EmailLogModel.updateOne(
    { _id: emailLogId },
    {
      $set: {
        status: "skipped",
        error_message: String(reason || "Skipped").slice(0, 1000),
      },
    },
  );
};

const isPromotionalBlocked = (user) => {
  if (!user) return false;
  if (user.email_opt_out === true) return true;
  if (user?.notificationSettings?.promotionalEmails === false) return true;
  if (user?.notificationSettings?.emailNotifications === false) return true;
  return false;
};

const processFeedbackEmail = async ({ order, settings }) => {
  const { email, name, user } = await resolveOrderRecipient(order);
  const emailLog = await createEmailLog({
    user_id: user?._id || null,
    order_id: order?._id || null,
    to_email: email || "unknown@unknown.invalid",
    email_type: "feedback_7d",
    template_type: "orderFeedbackRequest.html",
    subject: "How was your experience?",
    status: "queued",
    metadata: {
      orderNumber: resolveDisplayOrderNumber(order),
    },
  });

  if (!email) {
    await markEmailLogSkipped(emailLog?._id, "Missing recipient email");
    return { success: false, reason: "missing_email" };
  }

  if (isPromotionalBlocked(user)) {
    await markEmailLogSkipped(
      emailLog?._id,
      "User opted out of promotional emails",
    );
    return { success: false, reason: "opted_out" };
  }

  const siteUrl = getSiteUrl();
  const orderId = String(order?._id || "").trim();
  const feedbackUrl = `${siteUrl}/orders/${encodeURIComponent(orderId)}?feedback=true`;

  const result = await sendTemplatedEmail({
    to: email,
    subject: "How was your experience?",
    templateFile: "orderFeedbackRequest.html",
    templateData: {
      customer_name: name,
      order_number: resolveDisplayOrderNumber(order),
      order_date: order?.deliveryDate
        ? new Date(order.deliveryDate).toLocaleDateString("en-IN")
        : "recently",
      feedback_url: feedbackUrl,
      delay_days: String(settings.feedbackDelayDays),
      site_url: siteUrl,
      support_contact: getSupportEmail(),
      support_url: getSupportContactUrl(),
      unsubscribe_url: getUnsubscribeUrl(email),
      year: String(new Date().getFullYear()),
    },
    text: [
      `Hi ${name},`,
      `How was your experience for order ${resolveDisplayOrderNumber(order)}?`,
      `Give feedback: ${feedbackUrl}`,
      `Unsubscribe: ${getUnsubscribeUrl(email)}`,
    ].join("\n"),
    context: "email.automation.feedback",
  });

  if (result?.success) {
    await markEmailLogSent(emailLog?._id, result);
    return { success: true };
  }

  await markEmailLogFailed(emailLog?._id, result?.error || "send_failed");
  return { success: false, reason: result?.error || "send_failed" };
};

const processRetentionEmail = async ({ order, settings }) => {
  const { email, name, user } = await resolveOrderRecipient(order);
  const emailLog = await createEmailLog({
    user_id: user?._id || null,
    order_id: order?._id || null,
    to_email: email || "unknown@unknown.invalid",
    email_type: "retention_30d",
    template_type: "promotionalOffer.html",
    subject: "We Miss You! Here's Something Special 🎁",
    status: "queued",
    metadata: {
      orderNumber: resolveDisplayOrderNumber(order),
    },
  });

  if (!email) {
    await markEmailLogSkipped(emailLog?._id, "Missing recipient email");
    return { success: false, reason: "missing_email" };
  }

  if (isPromotionalBlocked(user)) {
    await markEmailLogSkipped(
      emailLog?._id,
      "User opted out of promotional emails",
    );
    return { success: false, reason: "opted_out" };
  }

  const siteUrl = getSiteUrl();
  const products = Array.isArray(order?.products) ? order.products : [];
  const recommendationText = products.length
    ? products
        .slice(0, 3)
        .map((item) => String(item?.productTitle || "Product").trim())
        .filter(Boolean)
        .join(", ")
    : "our latest healthy picks";

  const bodyHtml = appendUnsubscribeFooter(
    `
      <p>Hi ${name},</p>
      <p>We miss you! Use coupon <strong>${settings.retentionCouponCode}</strong> and enjoy ${settings.retentionDiscountText}.</p>
      <p>Recommended for you: ${recommendationText}</p>
      <p><a href="${siteUrl}/products" style="background:#c1591c;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Shop Now</a></p>
    `,
    email,
  );

  const result = await sendTemplatedEmail({
    to: email,
    subject: "We Miss You! Here's Something Special 🎁",
    templateFile: "promotionalOffer.html",
    templateData: {
      customer_name: name,
      offer_title: "We Miss You!",
      offer_subtitle: settings.retentionDiscountText,
      coupon_code: settings.retentionCouponCode,
      cta_url: `${siteUrl}/products`,
      cta_label: "Shop Now",
      support_contact: getSupportEmail(),
      support_url: getSupportContactUrl(),
      unsubscribe_url: getUnsubscribeUrl(email),
      year: String(new Date().getFullYear()),
      email_body_html: bodyHtml,
    },
    text: [
      `Hi ${name},`,
      `We miss you! Coupon: ${settings.retentionCouponCode}`,
      `Shop now: ${siteUrl}/products`,
      `Unsubscribe: ${getUnsubscribeUrl(email)}`,
    ].join("\n"),
    context: "email.automation.retention",
  });

  if (result?.success) {
    await markEmailLogSent(emailLog?._id, result);
    return { success: true };
  }

  await markEmailLogFailed(emailLog?._id, result?.error || "send_failed");
  return { success: false, reason: result?.error || "send_failed" };
};

const shouldRunEmailNow = (lastAttemptAt, retryGapMs) => {
  if (!lastAttemptAt) return true;
  return Date.now() - new Date(lastAttemptAt).getTime() >= retryGapMs;
};

const fetchEligibleOrders = async ({ settings, now }) => {
  const feedbackThreshold = new Date(
    now.getTime() - settings.feedbackDelayDays * 24 * 60 * 60 * 1000,
  );
  const retentionThreshold = new Date(
    now.getTime() - settings.retentionDelayDays * 24 * 60 * 60 * 1000,
  );

  const [feedbackCandidates, retentionCandidates] = await Promise.all([
    settings.feedbackEnabled
      ? OrderModel.find({
          order_status: { $in: ["delivered", "completed"] },
          $or: [
            { deliveryDate: { $lte: feedbackThreshold } },
            { delivery_date: { $lte: feedbackThreshold } },
          ],
          feedbackEmailSentAt: null,
          feedbackEmailFailureCount: { $lt: 3 },
        })
          .sort({ deliveryDate: 1, createdAt: 1 })
          .limit(settings.maxEmailsPerRun)
          .lean()
      : [],
    settings.retentionEnabled
      ? OrderModel.find({
          order_status: { $in: ["delivered", "completed"] },
          $or: [
            { deliveryDate: { $lte: retentionThreshold } },
            { delivery_date: { $lte: retentionThreshold } },
          ],
          retentionEmailSentAt: null,
          retentionEmailFailureCount: { $lt: 3 },
        })
          .sort({ deliveryDate: 1, createdAt: 1 })
          .limit(settings.maxEmailsPerRun)
          .lean()
      : [],
  ]);

  return { feedbackCandidates, retentionCandidates };
};

export const processEmailAutomationQueue = async () => {
  const settingsRecord = await getEmailAutomationSettings();
  const settings = settingsRecord.value;
  if (!settings.enabled) return;

  if (!isWithinSendHourWindowIST(settings.sendHourIST)) return;

  const now = new Date();
  const retryGapMs = settings.retryGapHours * 60 * 60 * 1000;
  const { feedbackCandidates, retentionCandidates } = await fetchEligibleOrders(
    {
      settings,
      now,
    },
  );

  for (const order of feedbackCandidates) {
    if (!shouldRunEmailNow(order?.feedbackEmailLastAttemptAt, retryGapMs)) {
      continue;
    }

    await OrderModel.updateOne(
      { _id: order._id },
      { $set: { feedbackEmailLastAttemptAt: new Date() } },
    );

    const result = await processFeedbackEmail({ order, settings });
    if (result.success) {
      await OrderModel.updateOne(
        { _id: order._id },
        {
          $set: { feedbackEmailSentAt: new Date() },
        },
      );
    } else if (result.reason !== "opted_out") {
      await OrderModel.updateOne(
        { _id: order._id },
        { $inc: { feedbackEmailFailureCount: 1 } },
      );
    }
  }

  for (const order of retentionCandidates) {
    if (!shouldRunEmailNow(order?.retentionEmailLastAttemptAt, retryGapMs)) {
      continue;
    }

    await OrderModel.updateOne(
      { _id: order._id },
      { $set: { retentionEmailLastAttemptAt: new Date() } },
    );

    const result = await processRetentionEmail({ order, settings });
    if (result.success) {
      await OrderModel.updateOne(
        { _id: order._id },
        {
          $set: { retentionEmailSentAt: new Date() },
        },
      );
    } else if (result.reason !== "opted_out") {
      await OrderModel.updateOne(
        { _id: order._id },
        { $inc: { retentionEmailFailureCount: 1 } },
      );
    }
  }
};

export const startEmailAutomationJob = async () => {
  if (automationTimer) return;
  const settingsRecord = await getEmailAutomationSettings();
  const intervalMs = settingsRecord.value.pollIntervalMinutes * 60 * 1000;
  const runScheduledJob = () =>
    runWithBackgroundJobLease({
      jobKey: "email-automation",
      intervalMs,
      task: processEmailAutomationQueue,
    }).catch((error) => {
      logger.error("emailAutomation", "Lease coordination failed", {
        error: error?.message || String(error),
      });
    });

  automationTimer = setInterval(runScheduledJob, intervalMs);

  runScheduledJob().catch((error) => {
    logger.error("emailAutomation", "Initial queue execution failed", {
      error: error?.message || String(error),
    });
  });

  logger.info("emailAutomation", "Email automation scheduler started", {
    intervalMs,
  });
};

export const stopEmailAutomationJob = () => {
  if (!automationTimer) return;
  clearInterval(automationTimer);
  automationTimer = null;
};

export const restartEmailAutomationJob = () => {
  stopEmailAutomationJob();
  startEmailAutomationJob().catch((error) => {
    logger.error("emailAutomation", "Failed to restart scheduler", {
      error: error?.message || String(error),
    });
  });
};

export const getEmailLogSummary = async ({ days = 30 } = {}) => {
  const since = new Date(Date.now() - Math.max(days, 1) * 24 * 60 * 60 * 1000);

  const [totals, typeBreakdown] = await Promise.all([
    EmailLogModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          sent: {
            $sum: {
              $cond: [{ $eq: ["$status", "sent"] }, 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ["$status", "failed"] }, 1, 0],
            },
          },
          skipped: {
            $sum: {
              $cond: [{ $eq: ["$status", "skipped"] }, 1, 0],
            },
          },
        },
      },
    ]),
    EmailLogModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$email_type",
          total: { $sum: 1 },
          sent: {
            $sum: {
              $cond: [{ $eq: ["$status", "sent"] }, 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ["$status", "failed"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { total: -1 } },
    ]),
  ]);

  return {
    totals: totals?.[0] || { sent: 0, failed: 0, skipped: 0 },
    byType: typeBreakdown,
  };
};
