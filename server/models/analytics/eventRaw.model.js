import mongoose from "mongoose";
import { getModel } from "./_modelFactory.js";

const { Schema } = mongoose;

const locationSchema = new Schema(
  {
    country: { type: String, default: "unknown", trim: true, maxlength: 128 },
    city: { type: String, default: "unknown", trim: true, maxlength: 128 },
  },
  { _id: false },
);

export const eventRawSchema = new Schema(
  {
    eventId: { type: String, required: true, trim: true, maxlength: 128 },
    eventType: { type: String, required: true, trim: true, maxlength: 64 },
    sessionId: { type: String, required: true, trim: true, maxlength: 128 },
    userId: { type: String, default: null, trim: true, maxlength: 128 },
    timestamp: { type: Date, required: true },
    pageUrl: { type: String, default: "", trim: true, maxlength: 2048 },
    referrer: { type: String, default: "", trim: true, maxlength: 2048 },
    ipAddress: { type: String, default: "unknown", trim: true, maxlength: 128 },
    userAgent: { type: String, default: "unknown", trim: true, maxlength: 2048 },
    deviceType: { type: String, default: "desktop", trim: true, maxlength: 64 },
    browser: { type: String, default: "Other", trim: true, maxlength: 128 },
    location: { type: locationSchema, default: () => ({}) },
    sourceDomain: { type: String, default: "direct", trim: true, maxlength: 256 },
    consent: { type: String, default: "unknown", trim: true, maxlength: 32 },
    source: { type: String, default: "tracking_api", trim: true, maxlength: 64 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date, default: null },
  },
  {
    collection: "events_raw",
    timestamps: true,
    minimize: false,
  },
);

eventRawSchema.index({ eventId: 1 }, { unique: true });
eventRawSchema.index({ sessionId: 1, timestamp: -1 });
eventRawSchema.index({ userId: 1, timestamp: -1 });
eventRawSchema.index({ eventType: 1, timestamp: -1 });
eventRawSchema.index({ timestamp: -1 });
eventRawSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const getEventRawModel = (connection) =>
  getModel({
    connection,
    name: "AnalyticsEventRaw",
    schema: eventRawSchema,
    collection: "events_raw",
  });
