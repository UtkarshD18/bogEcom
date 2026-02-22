import mongoose from "mongoose";
import { randomBytes } from "crypto";
import { buildIstTicketTimestampPayload, getIstNow } from "../config/dayjs.js";

const SUPPORT_STATUS = ["OPEN", "IN_PROGRESS", "RESOLVED"];

const generateTicketId = () => {
  const datePart = getIstNow().format("YYYYMMDD");
  const randomPart = randomBytes(3).toString("hex").toUpperCase();
  return `TKT-${datePart}-${randomPart}`;
};

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 25,
    },
    orderId: {
      type: mongoose.Schema.ObjectId,
      ref: "order",
      default: null,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    images: {
      type: [String],
      default: [],
    },
    videos: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: SUPPORT_STATUS,
      default: "OPEN",
      index: true,
    },
    adminReply: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
    created_at: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    updated_at: {
      type: String,
      required: true,
      trim: true,
    },
    created_at_ts: {
      type: Number,
      required: true,
      index: true,
    },
    updated_at_ts: {
      type: Number,
      required: true,
    },
  },
  { timestamps: false },
);

supportTicketSchema.pre("validate", function assignTicketId() {
  if (!this.ticketId) {
    this.ticketId = generateTicketId();
  }

  if (!this.created_at || !Number.isFinite(this.created_at_ts)) {
    const createdSource = this.createdAt || new Date();
    const createdPayload = buildIstTicketTimestampPayload(createdSource);
    this.created_at = createdPayload.formatted;
    this.created_at_ts = createdPayload.unixMs;
  }

  if (!this.updated_at || !Number.isFinite(this.updated_at_ts)) {
    const updatedSource = this.updatedAt || this.createdAt || new Date();
    const updatedPayload = buildIstTicketTimestampPayload(updatedSource);
    this.updated_at = updatedPayload.formatted;
    this.updated_at_ts = updatedPayload.unixMs;
  }
});

supportTicketSchema.pre("save", function syncIstTimestamps() {
  const nowPayload = buildIstTicketTimestampPayload();

  if (!this.created_at || !Number.isFinite(this.created_at_ts)) {
    const createdPayload = this.isNew
      ? nowPayload
      : buildIstTicketTimestampPayload(this.createdAt || new Date());
    this.created_at = createdPayload.formatted;
    this.created_at_ts = createdPayload.unixMs;
  }

  this.updated_at = nowPayload.formatted;
  this.updated_at_ts = nowPayload.unixMs;
});

// Query-performance indexes for admin dashboards and user ticket history.
supportTicketSchema.index({ status: 1, created_at_ts: -1 });
supportTicketSchema.index({ userId: 1, created_at_ts: -1 });
supportTicketSchema.index({ created_at_ts: -1 });

const SupportTicketModel = mongoose.model("supportTicket", supportTicketSchema);

export default SupportTicketModel;
