/**
 * Push Notifications Smoke Test (Server-side)
 *
 * Runs:
 * - MongoDB connect
 * - Firebase Admin init
 * - Fetch active tokens
 * - Send a test multicast notification
 *
 * Usage:
 *   node scripts/testPushNotifications.mjs
 *
 * Notes:
 * - Does NOT print full tokens; only masked prefixes/suffixes.
 * - Requires FIREBASE_* Admin creds in `server/.env`
 * - Requires at least 1 active token in `notificationtokens` collection
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDb from "../config/connectDb.js";
import {
  getMessaging,
  initializeFirebaseAdmin,
  isFirebaseReady,
} from "../config/firebaseAdmin.js";
import NotificationTokenModel from "../models/notificationToken.model.js";

dotenv.config();

const maskToken = (token) => {
  if (!token || typeof token !== "string") return "<invalid>";
  if (token.length <= 12) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
};

const main = async () => {
  await connectDb();

  initializeFirebaseAdmin();
  console.log("Firebase ready:", isFirebaseReady() ? "YES" : "NO");

  const messaging = getMessaging();
  if (!messaging) {
    throw new Error("Firebase messaging is not available (check FIREBASE_* env)");
  }

  const tokenDocs = await NotificationTokenModel.find({
    isActive: true,
    failureCount: { $lt: 5 },
  }).select("token userType userId");

  console.log("Active tokens:", tokenDocs.length);
  if (tokenDocs.length === 0) {
    console.log("No tokens found. Enable Push Notifications on the client first.");
    return;
  }

  const tokens = tokenDocs.map((d) => d.token).filter(Boolean);
  console.log(
    "Sample tokens:",
    tokenDocs
      .slice(0, 3)
      .map((d) => `${d.userType}:${maskToken(d.token)}`)
      .join(", "),
  );

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: "Test Notification",
      body: "If you see this, FCM send is working.",
    },
    data: {
      type: "offer",
      url: "/",
    },
  });

  console.log("Send result:", {
    successCount: response.successCount,
    failureCount: response.failureCount,
  });

  const firstFailures = response.responses
    .map((r, idx) => ({
      idx,
      token: maskToken(tokens[idx]),
      code: r.error?.code,
      message: r.error?.message,
    }))
    .filter((r) => r.code)
    .slice(0, 5);

  if (firstFailures.length > 0) {
    console.log("First failures:", firstFailures);
  }
};

main()
  .catch((err) => {
    console.error("Push notification test FAILED:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });
