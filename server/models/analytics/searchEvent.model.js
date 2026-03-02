import mongoose from "mongoose";
import { getModel } from "./_modelFactory.js";

const { Schema } = mongoose;

export const searchEventSchema = new Schema(
  {
    eventId: { type: String, required: true, trim: true, maxlength: 128 },
    sessionId: { type: String, required: true, trim: true, maxlength: 128 },
    userId: { type: String, default: null, trim: true, maxlength: 128 },
    timestamp: { type: Date, required: true },
    keyword: { type: String, default: "", trim: true, maxlength: 256 },
    resultsCount: { type: Number, default: 0, min: 0 },
    pageUrl: { type: String, default: "", trim: true, maxlength: 2048 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: "search_events",
    timestamps: true,
    minimize: false,
  },
);

searchEventSchema.index({ eventId: 1 }, { unique: true });
searchEventSchema.index({ keyword: 1, timestamp: -1 });
searchEventSchema.index({ userId: 1, timestamp: -1 });
searchEventSchema.index({ sessionId: 1, timestamp: -1 });

export const getSearchEventModel = (connection) =>
  getModel({
    connection,
    name: "AnalyticsSearchEvent",
    schema: searchEventSchema,
    collection: "search_events",
  });
