import mongoose from "mongoose";
import { getModel } from "./_modelFactory.js";

const { Schema } = mongoose;

export const sectionViewSchema = new Schema(
  {
    eventId: { type: String, required: true, trim: true, maxlength: 128 },
    sessionId: { type: String, required: true, trim: true, maxlength: 128 },
    userId: { type: String, default: null, trim: true, maxlength: 128 },
    pageUrl: { type: String, default: "", trim: true, maxlength: 2048 },
    sectionName: { type: String, required: true, trim: true, maxlength: 128 },
    sectionKey: { type: String, default: null, trim: true, maxlength: 180 },
    pageViewId: { type: String, default: null, trim: true, maxlength: 128 },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    durationMs: { type: Number, default: 0, min: 0 },
    reason: { type: String, default: null, trim: true, maxlength: 64 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: "section_views",
    timestamps: true,
    minimize: false,
  },
);

sectionViewSchema.index({ eventId: 1 }, { unique: true });
sectionViewSchema.index({ sessionId: 1, sectionName: 1, startedAt: -1 });
sectionViewSchema.index({ userId: 1, sectionName: 1, startedAt: -1 });
sectionViewSchema.index({ sectionName: 1, startedAt: -1 });

export const getSectionViewModel = (connection) =>
  getModel({
    connection,
    name: "AnalyticsSectionView",
    schema: sectionViewSchema,
    collection: "section_views",
  });
