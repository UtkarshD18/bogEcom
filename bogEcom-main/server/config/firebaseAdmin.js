/**
 * Firebase Admin SDK Configuration
 *
 * Used for sending push notifications via FCM from the backend.
 * NEVER expose service account credentials to the client.
 *
 * Required environment variables:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_PRIVATE_KEY (base64 encoded or raw with \n escaped)
 * - FIREBASE_CLIENT_EMAIL
 */

import admin from "firebase-admin";

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 * Call this once at server startup
 */
export const initializeFirebaseAdmin = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Check if credentials are configured
  if (!projectId || !clientEmail || !privateKey) {
    console.log(
      "⚠ Firebase Admin SDK not configured (missing credentials). Push notifications disabled.",
    );
    return null;
  }

  try {
    // Handle private key formats
    // If base64 encoded
    if (privateKey.startsWith("LS0t")) {
      privateKey = Buffer.from(privateKey, "base64").toString("utf8");
    }
    // Replace escaped newlines
    privateKey = privateKey.replace(/\\n/g, "\n");

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    console.log("✓ Firebase Admin SDK initialized");
    return firebaseApp;
  } catch (error) {
    console.error("✗ Failed to initialize Firebase Admin SDK:", error.message);
    return null;
  }
};

/**
 * Get Firebase Messaging instance
 * Returns null if not configured
 */
export const getMessaging = () => {
  if (!firebaseApp) {
    initializeFirebaseAdmin();
  }

  if (!firebaseApp) {
    return null;
  }

  return admin.messaging();
};

/**
 * Check if Firebase Admin is ready
 */
export const isFirebaseReady = () => {
  return firebaseApp !== null;
};

/**
 * Get Firestore instance
 * Returns null if not configured
 */
export const getFirestore = () => {
  if (!firebaseApp) {
    initializeFirebaseAdmin();
  }

  if (!firebaseApp) {
    return null;
  }

  return admin.firestore();
};

export default {
  initializeFirebaseAdmin,
  getMessaging,
  isFirebaseReady,
  getFirestore,
};
