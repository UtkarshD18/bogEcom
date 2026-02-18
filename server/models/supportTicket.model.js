import mongoose from "mongoose";
import { randomBytes } from "crypto";

const SUPPORT_STATUS = ["OPEN", "IN_PROGRESS", "RESOLVED"];

const generateTicketId = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
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
  },
  { timestamps: true },
);

supportTicketSchema.pre("validate", function assignTicketId() {
  if (!this.ticketId) {
    this.ticketId = generateTicketId();
  }
});

// Query-performance indexes for admin dashboards and user ticket history.
supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ userId: 1, createdAt: -1 });
supportTicketSchema.index({ createdAt: -1 });

const SupportTicketModel = mongoose.model("supportTicket", supportTicketSchema);

export default SupportTicketModel;
