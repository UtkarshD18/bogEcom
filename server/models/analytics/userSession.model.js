import mongoose from "mongoose";
import { getModel } from "./_modelFactory.js";

const { Schema } = mongoose;

export const userSessionSchema = new Schema(
  {
    sessionId: { type: String, required: true, trim: true, maxlength: 128 },
    userId: { type: String, default: null, trim: true, maxlength: 128 },
    ipAddress: { type: String, default: "unknown", trim: true, maxlength: 128 },
    userAgent: { type: String, default: "unknown", trim: true, maxlength: 2048 },
    deviceType: { type: String, default: "desktop", trim: true, maxlength: 64 },
    browser: { type: String, default: "Other", trim: true, maxlength: 128 },
    location: {
      country: { type: String, default: "unknown", trim: true, maxlength: 128 },
      city: { type: String, default: "unknown", trim: true, maxlength: 128 },
    },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    totalActiveTime: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    pageViews: { type: Number, default: 0, min: 0 },
    eventCount: { type: Number, default: 0, min: 0 },
    maxScrollDepth: { type: Number, default: 0, min: 0 },
  },
  {
    collection: "sessions",
    timestamps: true,
    minimize: false,
  },
);

userSessionSchema.index({ sessionId: 1 }, { unique: true });
userSessionSchema.index({ userId: 1 });
userSessionSchema.index({ startedAt: -1 });

export const getUserSessionModel = (connection) =>
  getModel({
    connection,
    name: "AnalyticsUserSession",
    schema: userSessionSchema,
    collection: "sessions",
  });
