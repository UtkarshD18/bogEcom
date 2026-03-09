import mongoose from "mongoose";
import { getModel } from "./_modelFactory.js";

const { Schema } = mongoose;

export const productEventSchema = new Schema(
  {
    eventId: { type: String, required: true, trim: true, maxlength: 128 },
    eventType: { type: String, required: true, trim: true, maxlength: 64 },
    sessionId: { type: String, required: true, trim: true, maxlength: 128 },
    userId: { type: String, default: null, trim: true, maxlength: 128 },
    timestamp: { type: Date, required: true },
    pageUrl: { type: String, default: "", trim: true, maxlength: 2048 },
    productId: { type: String, default: null, trim: true, maxlength: 128 },
    productName: { type: String, default: null, trim: true, maxlength: 256 },
    hoverTarget: { type: String, default: null, trim: true, maxlength: 80 },
    hoverDurationMs: { type: Number, default: 0, min: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: "product_events",
    timestamps: true,
    minimize: false,
  },
);

productEventSchema.index({ eventId: 1 }, { unique: true });
productEventSchema.index({ productId: 1, timestamp: -1 });
productEventSchema.index({ sessionId: 1, timestamp: -1 });
productEventSchema.index({ userId: 1, timestamp: -1 });
productEventSchema.index({ eventType: 1, timestamp: -1 });

export const getProductEventModel = (connection) =>
  getModel({
    connection,
    name: "AnalyticsProductEvent",
    schema: productEventSchema,
    collection: "product_events",
  });
