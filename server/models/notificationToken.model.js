import mongoose from "mongoose";

/**
 * NotificationToken Model
 *
 * Stores FCM tokens for push notifications.
 * Supports both guest and logged-in users.
 *
 * PRIVACY RULES:
 * - Guest tokens (userId = null) receive ONLY offer notifications
 * - User tokens (userId set) receive offer + order update notifications
 * - Tokens are deduplicated by token string
 */
const notificationTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: [true, "FCM token is required"],
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    userType: {
      type: String,
      enum: ["guest", "user"],
      required: true,
      default: "guest",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    platform: {
      type: String,
      enum: ["web", "android", "ios"],
      default: "web",
    },
    origin: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Compound indexes for efficient queries
notificationTokenSchema.index({ userType: 1, isActive: 1 });
notificationTokenSchema.index({ userId: 1, isActive: 1 });
notificationTokenSchema.index({ lastUsedAt: 1 });

// Pre-save middleware to update lastUsedAt
notificationTokenSchema.pre("save", function () {
  this.lastUsedAt = new Date();
});

// Static method to get all active guest tokens
notificationTokenSchema.statics.getGuestTokens = function (options = {}) {
  const origins = Array.isArray(options?.origins)
    ? options.origins.filter(Boolean)
    : [];
  const query = {
    userType: "guest",
    isActive: true,
    failureCount: { $lt: 5 }, // Exclude tokens with too many failures
  };

  if (origins.length > 0) {
    query.origin = { $in: origins };
  }

  return this.find(query).select("token origin");
};

// Static method to get all active user tokens
notificationTokenSchema.statics.getUserTokens = function (options = {}) {
  const origins = Array.isArray(options?.origins)
    ? options.origins.filter(Boolean)
    : [];
  const query = {
    userType: "user",
    isActive: true,
    failureCount: { $lt: 5 },
  };

  if (origins.length > 0) {
    query.origin = { $in: origins };
  }

  return this.find(query).select("token userId origin");
};

// Static method to get tokens for a specific user
notificationTokenSchema.statics.getTokensByUserId = function (userId, options = {}) {
  const origins = Array.isArray(options?.origins)
    ? options.origins.filter(Boolean)
    : [];
  const query = {
    userId: userId,
    isActive: true,
    failureCount: { $lt: 5 },
  };

  if (origins.length > 0) {
    query.origin = { $in: origins };
  }

  return this.find(query).select("token origin");
};

// Static method to mark token as failed
notificationTokenSchema.statics.markTokenFailed = async function (token) {
  const doc = await this.findOne({ token });
  if (doc) {
    doc.failureCount += 1;
    if (doc.failureCount >= 5) {
      doc.isActive = false;
    }
    await doc.save();
  }
};

// Static method to reset failure count on successful send
notificationTokenSchema.statics.markTokenSuccess = async function (token) {
  await this.updateOne({ token }, { failureCount: 0, lastUsedAt: new Date() });
};

const NotificationTokenModel = mongoose.model(
  "NotificationToken",
  notificationTokenSchema,
);

export default NotificationTokenModel;
