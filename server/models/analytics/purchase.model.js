import mongoose from "mongoose";
import { getModel } from "./_modelFactory.js";

const { Schema } = mongoose;

export const purchaseSchema = new Schema(
  {
    eventId: { type: String, required: true, trim: true, maxlength: 128 },
    sessionId: { type: String, required: true, trim: true, maxlength: 128 },
    userId: { type: String, default: null, trim: true, maxlength: 128 },
    timestamp: { type: Date, required: true },
    orderId: { type: String, default: null, trim: true, maxlength: 128 },
    amount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "INR", trim: true, maxlength: 12 },
    paymentMethod: { type: String, default: "unknown", trim: true, maxlength: 64 },
    products: { type: [Schema.Types.Mixed], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: "purchases",
    timestamps: true,
    minimize: false,
  },
);

purchaseSchema.index({ eventId: 1 }, { unique: true });
purchaseSchema.index({ orderId: 1 }, { sparse: true });
purchaseSchema.index({ userId: 1, timestamp: -1 });
purchaseSchema.index({ sessionId: 1, timestamp: -1 });
purchaseSchema.index({ timestamp: -1 });

export const getPurchaseModel = (connection) =>
  getModel({
    connection,
    name: "AnalyticsPurchase",
    schema: purchaseSchema,
    collection: "purchases",
  });
