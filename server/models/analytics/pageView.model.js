import mongoose from "mongoose";
import { getModel } from "./_modelFactory.js";

const { Schema } = mongoose;

export const pageViewSchema = new Schema(
  {
    eventId: { type: String, required: true, trim: true, maxlength: 128 },
    pageViewId: { type: String, default: null, trim: true, maxlength: 128 },
    sessionId: { type: String, required: true, trim: true, maxlength: 128 },
    userId: { type: String, default: null, trim: true, maxlength: 128 },
    pageUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    path: { type: String, default: null, trim: true, maxlength: 1024 },
    title: { type: String, default: null, trim: true, maxlength: 256 },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    durationMs: { type: Number, default: 0, min: 0 },
    activeTimeMs: { type: Number, default: 0, min: 0 },
    maxScrollDepth: { type: Number, default: 0, min: 0 },
    reason: { type: String, default: null, trim: true, maxlength: 64 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: "page_views",
    timestamps: true,
    minimize: false,
  },
);

pageViewSchema.index({ eventId: 1 }, { unique: true });
pageViewSchema.index({ sessionId: 1, startedAt: -1 });
pageViewSchema.index({ pageUrl: 1, startedAt: -1 });
pageViewSchema.index({ userId: 1, startedAt: -1 });

export const getPageViewModel = (connection) =>
  getModel({
    connection,
    name: "AnalyticsPageView",
    schema: pageViewSchema,
    collection: "page_views",
  });
