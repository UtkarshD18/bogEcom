import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { sendEmail, sendTemplatedEmail } from "../config/emailService.js";
import { supportUploadConfig } from "../middlewares/supportUpload.js";
import { UPLOAD_ROOT } from "../middlewares/upload.js";
import OrderModel from "../models/order.model.js";
import SupportTicketModel from "../models/supportTicket.model.js";
import UserModel from "../models/user.model.js";
import { logger } from "../utils/errorHandler.js";

const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"];
const TICKET_STATUS_SET = new Set(TICKET_STATUSES);

const sendSuccess = (res, message, data = {}, statusCode = 200) =>
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });

const sendError = (res, message, statusCode = 400, data = {}) =>
  res.status(statusCode).json({
    success: false,
    message,
    data,
  });

const escapeRegExp = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sanitizeText = (value, { maxLength = 5000, allowNewLines = false } = {}) => {
  if (typeof value !== "string") return "";

  const normalized = value
    .replace(/\u0000/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();

  const controlCharRegex = allowNewLines ? /[\u0001-\u0008\u000B-\u001F\u007F]/g : /[\u0001-\u001F\u007F]/g;
  const stripped = normalized.replace(controlCharRegex, "");
  return stripped.slice(0, maxLength);
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeEmail = (value) =>
  sanitizeText(value, { maxLength: 120 }).toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPhone = (phone) => /^[0-9+\-() ]{7,20}$/.test(phone);

const normalizeFiles = (req, fieldName) =>
  Array.isArray(req.files?.[fieldName]) ? req.files[fieldName] : [];

const cleanupUploadedFiles = async (files = []) => {
  await Promise.all(
    files.map(async (file) => {
      const targetPath = typeof file === "string" ? file : file?.path;
      if (!targetPath) return;
      try {
        await fs.unlink(targetPath);
      } catch {
        // Ignore cleanup failures to avoid masking the primary error.
      }
    }),
  );
};

const toPublicFileUrl = (req, filePath) => {
  const relativePath = path
    .relative(UPLOAD_ROOT, filePath)
    .split(path.sep)
    .join("/");
  return `${req.protocol}://${req.get("host")}/uploads/${relativePath}`;
};

const normalizeStatus = (status) => String(status || "").trim().toUpperCase();

const coercePagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const buildDateRangeFilter = ({ date, dateFrom, dateTo }) => {
  const filter = {};

  if (date) {
    const parsed = new Date(String(date));
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Invalid date filter." };
    }
    const start = new Date(parsed);
    start.setHours(0, 0, 0, 0);
    const end = new Date(parsed);
    end.setHours(23, 59, 59, 999);
    filter.$gte = start;
    filter.$lte = end;
    return { filter };
  }

  if (dateFrom) {
    const parsed = new Date(String(dateFrom));
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Invalid dateFrom filter." };
    }
    parsed.setHours(0, 0, 0, 0);
    filter.$gte = parsed;
  }

  if (dateTo) {
    const parsed = new Date(String(dateTo));
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Invalid dateTo filter." };
    }
    parsed.setHours(23, 59, 59, 999);
    filter.$lte = parsed;
  }

  return { filter };
};

const buildTicketSummary = (ticket) => {
  const order = ticket.orderId && typeof ticket.orderId === "object" ? ticket.orderId : null;

  return {
    id: ticket._id,
    ticketId: ticket.ticketId,
    userId: ticket.userId?._id || ticket.userId || null,
    name: ticket.name,
    email: ticket.email,
    phone: ticket.phone,
    orderId: order?._id || ticket.orderId || null,
    orderDate: order?.createdAt || null,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
};

const SUPPORT_STORE_URL =
  String(process.env.CLIENT_URL || "https://buyonegram.com").trim() ||
  "https://buyonegram.com";
const SUPPORT_ADMIN_EMAIL = String(
  process.env.SUPPORT_ADMIN_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    process.env.EMAIL_FROM_ADDRESS ||
    process.env.SMTP_USER ||
    process.env.EMAIL ||
    "",
).trim();
const ADMIN_PANEL_URL = String(process.env.ADMIN_URL || SUPPORT_STORE_URL)
  .split(",")[0]
  .trim()
  .replace(/\/+$/, "");

const sendSupportEmail = async ({ to, subject, text, html, context = "support" }) => {
  const result = await sendEmail({
    to,
    subject,
    text,
    html,
    context,
  });
  if (!result?.success) {
    logger.error("support.sendSupportEmail", "Email send failed", {
      context,
      to,
      subject,
      error: result?.error || "Unknown error",
    });
    return false;
  }
  return true;
};

const formatTicketDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";

  return parsed.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildSupportEmailLayout = ({
  title,
  subtitle,
  greeting,
  intro,
  details = [],
  highlight,
  ctaLabel,
  ctaUrl,
  closingLine,
}) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f9f5f0;">
    <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
      <div style="background:linear-gradient(135deg,#c1591c 0%,#e07830 100%);padding:36px 30px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;">${title}</h1>
        <p style="color:#fff8f0;margin:10px 0 0;font-size:16px;">${subtitle}</p>
      </div>
      <div style="padding:36px 30px;">
        <h2 style="color:#333333;margin:0 0 16px;font-size:22px;">${greeting}</h2>
        <p style="color:#555555;font-size:16px;line-height:1.6;margin:0 0 16px;">${intro}</p>
        <ul style="color:#555555;font-size:15px;line-height:1.8;padding-left:20px;margin:0 0 22px;">
          ${details.map((item) => `<li>${item}</li>`).join("")}
        </ul>
        <div style="background-color:#fff8f0;border-left:4px solid #c1591c;padding:16px;margin:22px 0;border-radius:0 8px 8px 0;">
          <p style="color:#333333;font-size:15px;margin:0;">${highlight}</p>
        </div>
        <div style="text-align:center;margin:28px 0;">
          <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#c1591c 0%,#e07830 100%);color:#ffffff;text-decoration:none;padding:12px 30px;font-size:16px;font-weight:600;border-radius:30px;">
            ${ctaLabel}
          </a>
        </div>
        <p style="color:#555555;font-size:16px;line-height:1.6;margin:20px 0 0;">
          ${closingLine}<br/>
          <strong style="color:#c1591c;">BuyOneGram Customer Care</strong>
        </p>
      </div>
      <div style="background-color:#2c2c2c;padding:24px;text-align:center;">
        <p style="color:#aaaaaa;font-size:13px;margin:0 0 8px;">&copy; ${new Date().getFullYear()} BuyOneGram. All rights reserved.</p>
        <p style="color:#888888;font-size:12px;margin:0;">This is a service email for your support request.</p>
      </div>
    </div>
  </body>
  </html>
`;

const sendTicketRegistrationEmail = async (ticket) => {
  if (!ticket?.email) return false;

  const safeName = escapeHtml(ticket.name || "Customer");
  const safeTicketId = escapeHtml(ticket.ticketId || "");
  const safeStatus = escapeHtml(ticket.status || "OPEN");
  const safeSubject = escapeHtml(ticket.subject || "Support Request");
  const safeOrderId = ticket.orderId ? escapeHtml(String(ticket.orderId)) : "Not linked";
  const createdAt = formatTicketDate(ticket.createdAt);

  const html = buildSupportEmailLayout({
    title: "Support Ticket Generated Successfully",
    subtitle: "Your request has been registered with BuyOneGram Customer Care",
    greeting: `Hello, ${safeName}!`,
    intro:
      "Thank you for contacting us. Your support ticket has been generated successfully and registered with our customer care team.",
    details: [
      `<strong>Ticket ID:</strong> ${safeTicketId}`,
      `<strong>Status:</strong> ${safeStatus}`,
      `<strong>Subject:</strong> ${safeSubject}`,
      `<strong>Order:</strong> ${safeOrderId}`,
      `<strong>Created At:</strong> ${escapeHtml(createdAt)}`,
    ],
    highlight:
      "Please keep your Ticket ID for tracking. You will also receive email notifications for every status update on this ticket.",
    ctaLabel: "Visit BuyOneGram",
    ctaUrl: SUPPORT_STORE_URL,
    closingLine: "We are here to help and will get back to you as soon as possible.",
  });

  const text = [
    `Hi ${ticket.name || "Customer"},`,
    "Your support request has been registered successfully.",
    `Ticket ID: ${ticket.ticketId}`,
    `Status: ${ticket.status}`,
    `Subject: ${ticket.subject || "Support Request"}`,
    `Order: ${ticket.orderId ? String(ticket.orderId) : "Not linked"}`,
    `Created At: ${createdAt}`,
    "You will receive ticket status updates by email.",
    "BuyOneGram Customer Care",
  ].join("\n");

  return sendSupportEmail({
    to: ticket.email,
    subject: `Support Ticket Generated Successfully - ${ticket.ticketId}`,
    text,
    html,
    context: "support.ticket.created",
  });
};

const sendAdminTicketNotificationEmail = async (ticket) => {
  if (!SUPPORT_ADMIN_EMAIL) return false;

  const createdAt = formatTicketDate(ticket.createdAt);
  const payload = {
    ticket_id: ticket.ticketId || "N/A",
    status: ticket.status || "OPEN",
    name: ticket.name || "N/A",
    email: ticket.email || "N/A",
    phone: ticket.phone || "N/A",
    subject: ticket.subject || "Support Request",
    message: ticket.message || "N/A",
    order_id: ticket.orderId ? String(ticket.orderId) : "Not linked",
    created_at: createdAt,
    admin_panel_url: `${ADMIN_PANEL_URL}/support`,
    year: String(new Date().getFullYear()),
  };

  const text = [
    "New support ticket received",
    `Ticket ID: ${payload.ticket_id}`,
    `Status: ${payload.status}`,
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone}`,
    `Order: ${payload.order_id}`,
    `Subject: ${payload.subject}`,
    `Message: ${payload.message}`,
  ].join("\n");

  const result = await sendTemplatedEmail({
    to: SUPPORT_ADMIN_EMAIL,
    subject: `New support ticket: ${payload.ticket_id}`,
    templateFile: "contactAdmin.html",
    templateData: payload,
    text,
    context: "support.ticket.admin-notify",
  });

  if (!result?.success) {
    logger.error("support.sendAdminTicketNotificationEmail", "Failed to send admin alert", {
      ticketId: payload.ticket_id,
      error: result?.error || "Unknown error",
    });
    return false;
  }

  return true;
};

const sendTicketUpdateEmail = async (ticket) => {
  if (!ticket?.email) return false;

  const customerName = ticket.name || "Customer";
  const ticketId = ticket.ticketId || "N/A";
  const status = ticket.status || "OPEN";
  const reply = String(ticket.adminReply || "").trim();
  const safeReply = reply || "No additional reply was shared yet.";
  const updatedAt = formatTicketDate(ticket.updatedAt);

  const text = [
    `Hi ${customerName},`,
    `Your support request ${ticketId} has been updated.`,
    `Status: ${status}`,
    `Updated At: ${updatedAt}`,
    `Admin Reply: ${safeReply}`,
    "Thanks,",
    "BuyOneGram Customer Care",
  ].join("\n");

  const templatedResult = await sendTemplatedEmail({
    to: ticket.email,
    subject: `Support Ticket Update - ${ticketId}`,
    templateFile: "adminReply.html",
    templateData: {
      customer_name: customerName,
      ticket_id: ticketId,
      status,
      updated_at: updatedAt,
      admin_reply: safeReply,
      support_url: `${SUPPORT_STORE_URL}/customer-care`,
      year: String(new Date().getFullYear()),
    },
    text,
    context: "support.ticket.updated",
  });

  if (templatedResult?.success) {
    return true;
  }

  logger.warn("support.sendTicketUpdateEmail", "Template email failed, falling back to inline HTML", {
    ticketId,
    error: templatedResult?.error || "Unknown error",
  });

  const fallbackHtml = buildSupportEmailLayout({
    title: "Support Ticket Status Update",
    subtitle: "Your customer care ticket has a new status update",
    greeting: `Hello, ${escapeHtml(customerName)}!`,
    intro: `Your support request <strong>${escapeHtml(ticketId)}</strong> has been updated by our team.`,
    details: [
      `<strong>Ticket ID:</strong> ${escapeHtml(ticketId)}`,
      `<strong>Status:</strong> ${escapeHtml(status)}`,
      `<strong>Updated At:</strong> ${escapeHtml(updatedAt)}`,
      `<strong>Admin Reply:</strong><br/>${escapeHtml(safeReply).replace(/\n/g, "<br/>")}`,
    ],
    highlight: escapeHtml(safeReply),
    ctaLabel: "Visit BuyOneGram",
    ctaUrl: SUPPORT_STORE_URL,
    closingLine: "Thank you for your patience.",
  });

  return sendSupportEmail({
    to: ticket.email,
    subject: `Support Ticket Update - ${ticketId}`,
    text,
    html: fallbackHtml,
    context: "support.ticket.updated.fallback",
  });
};

export const createSupportTicket = async (req, res) => {
  const imageFiles = normalizeFiles(req, "images");
  const videoFiles = normalizeFiles(req, "videos");
  const allFiles = [...imageFiles, ...videoFiles];

  try {
    const userId = req.user || null;
    const user =
      userId && mongoose.Types.ObjectId.isValid(String(userId))
        ? await UserModel.findById(userId).select("name email mobile").lean()
        : null;

    const name = sanitizeText(req.body?.name || user?.name || "", { maxLength: 80 });
    const email = normalizeEmail(req.body?.email || user?.email || "");
    const phone = sanitizeText(req.body?.phone || user?.mobile || "", { maxLength: 25 });
    const subject = sanitizeText(req.body?.subject || "", { maxLength: 160 });
    const message = sanitizeText(req.body?.message || "", {
      maxLength: 5000,
      allowNewLines: true,
    });
    const rawOrderId = sanitizeText(req.body?.orderId || "", { maxLength: 40 });

    const fieldErrors = {};

    if (!name || name.length < 2) {
      fieldErrors.name = "Name must be at least 2 characters.";
    }

    if (!email || !isValidEmail(email)) {
      fieldErrors.email = "Valid email is required.";
    }

    if (phone && !isValidPhone(phone)) {
      fieldErrors.phone = "Phone must be 7 to 20 characters.";
    }

    if (!subject || subject.length < 3) {
      fieldErrors.subject = "Subject must be at least 3 characters.";
    }

    if (!message || message.length < 10) {
      fieldErrors.message = "Message must be at least 10 characters.";
    }

    if (imageFiles.length > supportUploadConfig.MAX_IMAGE_COUNT) {
      fieldErrors.images = `You can upload up to ${supportUploadConfig.MAX_IMAGE_COUNT} images.`;
    }

    if (videoFiles.length > supportUploadConfig.MAX_VIDEO_COUNT) {
      fieldErrors.videos = `You can upload up to ${supportUploadConfig.MAX_VIDEO_COUNT} videos.`;
    }

    let orderId = null;
    if (rawOrderId) {
      if (!mongoose.Types.ObjectId.isValid(rawOrderId)) {
        fieldErrors.orderId = "Invalid order ID.";
      } else if (!userId) {
        fieldErrors.orderId = "Login is required to attach an order.";
      } else {
        const ownedOrder = await OrderModel.findOne({
          _id: rawOrderId,
          user: userId,
        })
          .select("_id")
          .lean();

        if (!ownedOrder) {
          fieldErrors.orderId = "Selected order was not found for this account.";
        } else {
          orderId = ownedOrder._id;
        }
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      await cleanupUploadedFiles(allFiles);
      return sendError(res, "Please correct the highlighted fields.", 400, {
        errors: fieldErrors,
      });
    }

    const images = imageFiles.map((file) => toPublicFileUrl(req, file.path));
    const videos = videoFiles.map((file) => toPublicFileUrl(req, file.path));

    const createdTicket = await SupportTicketModel.create({
      userId: userId || null,
      name,
      email,
      phone,
      orderId,
      subject,
      message,
      images,
      videos,
      status: "OPEN",
    });

    let emailSent = false;
    let adminEmailSent = false;
    try {
      const [userMailResult, adminMailResult] = await Promise.allSettled([
        sendTicketRegistrationEmail(createdTicket),
        sendAdminTicketNotificationEmail(createdTicket),
      ]);

      emailSent =
        userMailResult.status === "fulfilled" && Boolean(userMailResult.value);
      adminEmailSent =
        adminMailResult.status === "fulfilled" &&
        Boolean(adminMailResult.value);

      if (userMailResult.status === "rejected") {
        logger.error(
          "support.createSupportTicket",
          "User confirmation email failed",
          {
            ticketId: createdTicket.ticketId,
            error: userMailResult.reason?.message || String(userMailResult.reason),
          },
        );
      }
      if (adminMailResult.status === "rejected") {
        logger.error(
          "support.createSupportTicket",
          "Admin alert email failed",
          {
            ticketId: createdTicket.ticketId,
            error:
              adminMailResult.reason?.message || String(adminMailResult.reason),
          },
        );
      }
    } catch (emailError) {
      logger.error("support.createSupportTicket", "Ticket email dispatch failed", {
        ticketId: createdTicket.ticketId,
        error: emailError?.message || "Unexpected error",
      });
    }

    return sendSuccess(
      res,
      "Support ticket created successfully.",
      {
        ticketId: createdTicket.ticketId,
        emailNotification: {
          sent: Boolean(emailSent),
          adminAlertSent: Boolean(adminEmailSent),
        },
      },
      201,
    );
  } catch (error) {
    await cleanupUploadedFiles(allFiles);
    console.error("createSupportTicket error:", error?.message || "Unexpected error");
    return sendError(
      res,
      "Unable to create support ticket right now. Please try again.",
      500,
    );
  }
};

export const getMySupportTickets = async (req, res) => {
  try {
    const userId = req.user;
    if (!userId) {
      return sendError(res, "Authentication required.", 401);
    }

    const { page, limit, skip } = coercePagination(req.query);
    const query = { userId };

    const [tickets, total] = await Promise.all([
      SupportTicketModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportTicketModel.countDocuments(query),
    ]);

    return sendSuccess(res, "Support tickets fetched successfully.", {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getMySupportTickets error:", error?.message || "Unexpected error");
    return sendError(res, "Failed to fetch your tickets.", 500);
  }
};

export const getAllSupportTicketsAdmin = async (req, res) => {
  try {
    const { page, limit, skip } = coercePagination(req.query);
    const query = {};

    const status = normalizeStatus(req.query.status);
    if (status) {
      if (!TICKET_STATUS_SET.has(status)) {
        return sendError(res, "Invalid status filter.", 400);
      }
      query.status = status;
    }

    const email = normalizeEmail(req.query.email || "");
    if (email) {
      query.email = { $regex: escapeRegExp(email), $options: "i" };
    }

    const orderId = sanitizeText(req.query.orderId || "", { maxLength: 40 });
    if (orderId) {
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return sendError(res, "Invalid orderId filter.", 400);
      }
      query.orderId = orderId;
    }

    const { error: dateError, filter: createdAtFilter } = buildDateRangeFilter({
      date: req.query.date,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    if (dateError) {
      return sendError(res, dateError, 400);
    }

    if (createdAtFilter && Object.keys(createdAtFilter).length > 0) {
      query.createdAt = createdAtFilter;
    }

    const [tickets, total] = await Promise.all([
      SupportTicketModel.find(query)
        .populate("userId", "_id name email mobile")
        .populate("orderId", "_id createdAt order_status payment_status totalAmt finalAmount")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportTicketModel.countDocuments(query),
    ]);

    return sendSuccess(res, "Support tickets fetched successfully.", {
      tickets: tickets.map(buildTicketSummary),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(
      "getAllSupportTicketsAdmin error:",
      error?.message || "Unexpected error",
    );
    return sendError(res, "Failed to fetch support tickets.", 500);
  }
};

export const getSupportTicketByIdAdmin = async (req, res) => {
  try {
    const ticketId = sanitizeText(req.params.ticketId || "", { maxLength: 40 });
    if (!ticketId) {
      return sendError(res, "ticketId is required.", 400);
    }

    const ticket = await SupportTicketModel.findOne({ ticketId })
      .populate("userId", "_id name email mobile role")
      .populate({
        path: "orderId",
        populate: [
          { path: "delivery_address" },
          { path: "user", select: "_id name email mobile" },
        ],
      })
      .lean();

    if (!ticket) {
      return sendError(res, "Support ticket not found.", 404);
    }

    return sendSuccess(res, "Support ticket fetched successfully.", { ticket });
  } catch (error) {
    console.error(
      "getSupportTicketByIdAdmin error:",
      error?.message || "Unexpected error",
    );
    return sendError(res, "Failed to fetch support ticket.", 500);
  }
};

export const updateSupportTicketAdmin = async (req, res) => {
  try {
    const ticketId = sanitizeText(req.params.ticketId || "", { maxLength: 40 });
    if (!ticketId) {
      return sendError(res, "ticketId is required.", 400);
    }

    const statusInput = req.body?.status;
    const hasReplyField = Object.prototype.hasOwnProperty.call(req.body || {}, "adminReply");
    const adminReply = sanitizeText(req.body?.adminReply || "", {
      maxLength: 5000,
      allowNewLines: true,
    });

    if (!statusInput && !hasReplyField) {
      return sendError(res, "Provide status or adminReply to update.", 400);
    }

    const ticket = await SupportTicketModel.findOne({ ticketId });
    if (!ticket) {
      return sendError(res, "Support ticket not found.", 404);
    }

    if (statusInput) {
      const normalizedStatus = normalizeStatus(statusInput);
      if (!TICKET_STATUS_SET.has(normalizedStatus)) {
        return sendError(
          res,
          `Invalid status. Allowed: ${TICKET_STATUSES.join(", ")}`,
          400,
        );
      }
      ticket.status = normalizedStatus;
    }

    if (hasReplyField) {
      ticket.adminReply = adminReply;
    }

    await ticket.save();

    let emailSent = false;
    try {
      emailSent = await sendTicketUpdateEmail(ticket);
    } catch (emailError) {
      console.error(
        "sendTicketUpdateEmail error:",
        emailError?.message || "Unexpected error",
      );
    }

    return sendSuccess(res, "Support ticket updated successfully.", {
      ticket,
      emailNotification: { sent: Boolean(emailSent) },
    });
  } catch (error) {
    console.error(
      "updateSupportTicketAdmin error:",
      error?.message || "Unexpected error",
    );
    return sendError(res, "Failed to update support ticket.", 500);
  }
};

export const getUnresolvedSupportTicketCount = async (req, res) => {
  try {
    const count = await SupportTicketModel.countDocuments({
      status: "OPEN",
    });

    return sendSuccess(res, "Open ticket count fetched successfully.", {
      count,
    });
  } catch (error) {
    console.error(
      "getUnresolvedSupportTicketCount error:",
      error?.message || "Unexpected error",
    );
    return sendError(res, "Failed to fetch unresolved ticket count.", 500);
  }
};
