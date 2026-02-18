import mongoose from "mongoose";
const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
    },
    password: {
      type: String,
      required: function () {
        return !this.signUpWithGoogle; // Password not required for initial Google signup
      },
      default: null,
    },
    hasBackupPassword: {
      type: Boolean,
      default: false, // Tracks if Google user has set a backup password
    },
    avatar: {
      type: String,
      default: "",
    },
    mobile: {
      type: Number,
      default: null,
    },
    gstNumber: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    verifyEmail: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      sparse: true, // Allows multiple null values but unique non-null values
      default: null,
    },
    provider: {
      type: String,
      enum: ["local", "google", "mixed"], // Added 'mixed' for users with both
      default: "local",
    },
    accessToken: {
      type: String,
      default: "",
    },
    refreshToken: {
      type: String,
      default: "",
    },
    last_login_date: {
      type: Date,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "Suspended"],
      default: "active",
    },
    address_details: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "address",
      },
    ],
    orderHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "order",
      },
    ],
    otp: {
      type: String,
    },
    otpExpires: {
      type: Date,
    },
    role: {
      type: String,
      enum: ["User", "Admin"],
      default: "User",
    },
    signUpWithGoogle: {
      type: Boolean,
      default: false,
    },
    // Membership fields
    isMember: {
      type: Boolean,
      default: false,
    },
    is_member: {
      type: Boolean,
      default: false,
    },
    membershipPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MembershipPlan",
      default: null,
    },
    membership_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MembershipUser",
      default: null,
    },
    membershipExpiry: {
      type: Date,
      default: null,
    },
    membershipPaymentId: {
      type: String,
      default: null,
    },
    coinBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Notification Settings
    notificationSettings: {
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      orderUpdates: { type: Boolean, default: true },
      promotionalEmails: { type: Boolean, default: true },
    },
    // Appearance Settings
    preferences: {
      darkMode: { type: Boolean, default: false },
      language: { type: String, default: "en" },
    },
  },
  { timestamps: true },
);
const UserModel = mongoose.model("User", userSchema);
export default UserModel;
