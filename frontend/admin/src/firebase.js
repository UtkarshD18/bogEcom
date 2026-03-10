import { initializeApp } from "firebase/app";

const resolveFirebaseAuthDomain = () => {
  const configuredAuthDomain = String(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  ).trim();

  if (typeof window !== "undefined") {
    const host = String(window.location.hostname || "").trim().toLowerCase();
    if (host === "healthyonegram.com" || host === "www.healthyonegram.com") {
      return "healthyonegram.com";
    }
  }

  return configuredAuthDomain;
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: resolveFirebaseAuthDomain(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

console.log("Firebase Config Loaded:", {
  apiKey: firebaseConfig.apiKey ? "✓ Present" : "✗ Missing",
  authDomain: firebaseConfig.authDomain ? "✓ Present" : "✗ Missing",
  projectId: firebaseConfig.projectId ? "✓ Present" : "✗ Missing",
  appId: firebaseConfig.appId ? "✓ Present" : "✗ Missing",
});

export const firebaseApp = initializeApp(firebaseConfig);
