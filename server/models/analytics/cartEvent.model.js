import mongoose from "mongoose";
import { getModel } from "./_modelFactory.js";

const { Schema } = mongoose;

export const cartEventSchema = new Schema(
  {
    eventId: { type: String, required: true, trim: true, maxlength: 128 },
    eventType: { type: String, required: true, trim: true, maxlength: 64 },
    sessionId: { type: String, required: true, trim: true, maxlength: 128 },
    userId: { type: String, default: null, trim: true, maxlength: 128 },
    timestamp: { type: Date, required: true },
    productId: { type: String, default: null, trim: true, maxlength: 128 },
    productName: { type: String, default: null, trim: true, maxlength: 256 },
    quantity: { type: Number, default: 0, min: 0 },
    cartValue: { type: Number, default: 0, min: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: "cart_events",
    timestamps: true,
    minimize: false,
  },
);

cartEventSchema.index({ eventId: 1 }, { unique: true });
cartEventSchema.index({ eventType: 1, timestamp: -1 });
cartEventSchema.index({ productId: 1, timestamp: -1 });
cartEventSchema.index({ sessionId: 1, timestamp: -1 });
cartEventSchema.index({ userId: 1, timestamp: -1 });

export const getCartEventModel = (connection) =>
  getModel({
    connection,
    name: "AnalyticsCartEvent",
    schema: cartEventSchema,
    collection: "cart_events",
  });
