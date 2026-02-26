import mongoose from "mongoose";

const liveOfferEventSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      default: "offer",
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    audience: {
      type: String,
      enum: ["all", "guest"],
      default: "all",
      index: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    source: {
      type: String,
      default: "socket",
      trim: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true,
      expires: 60 * 60 * 24, // 24h TTL; enough for fallback polling/debug.
    },
    sentAtMs: {
      type: Number,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

liveOfferEventSchema.index({ sentAtMs: 1, audience: 1 });

const LiveOfferEventModel = mongoose.model("LiveOfferEvent", liveOfferEventSchema);

export default LiveOfferEventModel;
