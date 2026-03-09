"use client";

import { firebaseApp } from "@/firebase";
import { API_BASE_URL } from "@/utils/api";
import { deleteToken, getMessaging, getToken, onMessage } from "firebase/messaging";
import { useCallback, useEffect, useRef, useState } from "react";
import cookies from "js-cookie";

const API_URL = API_BASE_URL;
// Public VAPID key fallback for environments where env injection is missed.
const FALLBACK_VAPID_KEY =
  "BL22YBdvb5TkydQ5LsnePfUgLQsf61THj-Ja72oli6FMb1U7lh-GYJJ__gjIvf8nZjAJ7s8aBQzq1ahFBxpSTi8";
const ENABLE_PUSH_IN_DEV =
  String(process.env.NEXT_PUBLIC_ENABLE_PUSH_IN_DEV || "")
    .trim()
    .toLowerCase() === "true";

/**
 * useNotifications Hook
 *
 * Manages push notification permissions and FCM token registration.
 *
 * PRIVACY:
 * - Guest users: Only receive offer notifications
 * - Logged-in users: Receive offer + order update notifications
 * - Permission is requested only after user interaction
 *
 * @param {Object} options
 * @param {String} options.userId - User ID (null for guests)
 * @param {String} options.userType - "guest" or "user"
 */
export const useNotifications = (options = {}) => {
  const { userId = null, userType = "guest" } = options;

  const [permission, setPermission] = useState("default");
  const [token, setToken] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState(null);
  const [foregroundMessage, setForegroundMessage] = useState(null);

  const messagingRef = useRef(null);
  const lastRegisterKeyRef = useRef(null);
  const isLocalhostRef = useRef(false);

  const getAuthToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    return (
      cookies.get("accessToken") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token")
    );
  }, []);

  const getSessionId = useCallback(() => {
    if (typeof window === "undefined") return null;

    let sessionId = localStorage.getItem("cartSessionId");
    if (!sessionId) {
      sessionId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem("cartSessionId", sessionId);
    }

    if (sessionId) {
      document.cookie = `sessionId=${encodeURIComponent(sessionId)}; path=/; max-age=31536000; samesite=lax`;
    }

    return sessionId;
  }, []);

  const registerTokenWithBackend = useCallback(
    async (fcmToken) => {
      const headers = {
        "Content-Type": "application/json",
      };

      const authToken = getAuthToken();
      const sessionId = getSessionId();
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      if (sessionId) {
        headers["X-Session-Id"] = sessionId;
      }

      const response = await fetch(`${API_URL}/api/notifications/register`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          token: fcmToken,
          platform: "web",
          sessionId,
        }),
      });

      if (!response.ok) {
        let serverMessage = "Failed to register token with backend";
        try {
          const data = await response.json();
          serverMessage = data?.message || data?.error || serverMessage;
        } catch {
          // ignore
        }
        throw new Error(serverMessage);
      }

      return true;
    },
    [getAuthToken, getSessionId],
  );

  const getFirebasePublicConfig = useCallback(() => {
    const appOptions = firebaseApp?.options || {};
    return {
      apiKey:
        appOptions.apiKey || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
      authDomain:
        appOptions.authDomain ||
        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
        "",
      projectId:
        appOptions.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
      storageBucket:
        appOptions.storageBucket ||
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        "",
      messagingSenderId:
        appOptions.messagingSenderId ||
        process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
        "",
      appId: appOptions.appId || process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
    };
  }, []);

  const buildServiceWorkerUrl = useCallback(() => {
    if (typeof window === "undefined") return "/firebase-messaging-sw.js";
    const url = new URL("/firebase-messaging-sw.js", window.location.origin);
    const swConfig = getFirebasePublicConfig();

    Object.entries(swConfig).forEach(([key, value]) => {
      const cleaned = String(value || "").trim();
      if (cleaned) url.searchParams.set(key, cleaned);
    });

    return url.toString();
  }, [getFirebasePublicConfig]);

  const normalizePushErrorMessage = useCallback((err) => {
    const raw = String(err?.message || err || "Push registration failed");
    const lowered = raw.toLowerCase();

    if (lowered.includes("permission")) {
      return "Notification permission is blocked. Allow notifications in browser settings and try again.";
    }

    if (
      lowered.includes("push service error") ||
      lowered.includes("token-subscribe-failed")
    ) {
      return "Registration failed - push service error. Please refresh once and try again.";
    }

    if (lowered.includes("failed-service-worker-registration")) {
      return "Push service worker registration failed. Please refresh and try again.";
    }

    return raw;
  }, []);

  const isExpectedPushRegistrationFailure = useCallback((err) => {
    const raw = String(err?.message || err || "").toLowerCase();
    return (
      raw.includes("push service error") ||
      raw.includes("token-subscribe-failed") ||
      raw.includes("failed-service-worker-registration") ||
      raw.includes("messaging/permission-blocked") ||
      raw.includes("registration failed")
    );
  }, []);

  const shouldDisablePushInCurrentRuntime = useCallback(() => {
    if (typeof window === "undefined") return false;
    const host = String(window.location.hostname || "").toLowerCase();
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    isLocalhostRef.current = isLocalhost;

    if (process.env.NODE_ENV === "production") {
      return false;
    }

    return isLocalhost && !ENABLE_PUSH_IN_DEV;
  }, []);

  // Check if notifications are supported
  useEffect(() => {
    const checkSupport = async () => {
      if (typeof window === "undefined") return;

      if (shouldDisablePushInCurrentRuntime()) {
        setIsSupported(false);
        setPermission("default");
        return;
      }

      const supported =
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;

      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);
      }
    };

    checkSupport();
  }, [shouldDisablePushInCurrentRuntime]);

  // Ensure every visitor gets a stable guest session ID from first load.
  useEffect(() => {
    if (typeof window === "undefined") return;
    getSessionId();
  }, [getSessionId]);

  // Initialize messaging and set up foreground listener
  useEffect(() => {
    if (!isSupported || permission !== "granted" || !firebaseApp) return;

    const initMessaging = async () => {
      try {
        const messaging = getMessaging(firebaseApp);
        messagingRef.current = messaging;

        // Listen for foreground messages
        const unsubscribe = onMessage(messaging, (payload) => {
          console.log("Foreground message received:", payload);
          const nextMessage = {
            title: payload.notification?.title || payload.data?.title || "Notification",
            body: payload.notification?.body || payload.data?.body || "",
            data: payload.data,
            timestamp: Date.now(),
          };

          // Show native browser notification in foreground so users see a real popup.
          if (typeof window !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification(nextMessage.title, {
                body: nextMessage.body,
                icon: "/logo.png",
                badge: "/logo.png",
                tag: nextMessage.data?.notificationId || nextMessage.data?.type || "foreground",
              });
            } catch (nativeError) {
              // Best-effort only; toast fallback still runs.
            }
          }

          setForegroundMessage(nextMessage);
        });

        return () => unsubscribe();
      } catch (err) {
        console.error("Error initializing messaging:", err);
        setError(err.message);
      }
    };

    initMessaging();
  }, [isSupported, permission]);

  // Hydrate token from localStorage when permission already granted
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (permission !== "granted") return;
    if (token) return;

    const storedToken = localStorage.getItem("fcmToken");
    if (storedToken) {
      setToken(storedToken);
    }
  }, [permission, token]);

  // Self-heal token state when permission is granted but local token is missing.
  // This can happen after storage clear / profile reset while browser push subscription still exists.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSupported || permission !== "granted" || !firebaseApp) return;
    if (token || localStorage.getItem("fcmToken")) return;

    let cancelled = false;

    const restoreToken = async () => {
      try {
        const swUrl = buildServiceWorkerUrl();
        const registration = await navigator.serviceWorker.register(swUrl, {
          scope: "/",
        });
        await navigator.serviceWorker.ready;

        const messaging = getMessaging(firebaseApp);
        const tokenOptions = { serviceWorkerRegistration: registration };
        const vapidKey = (
          process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || FALLBACK_VAPID_KEY
        ).trim();
        if (vapidKey) {
          tokenOptions.vapidKey = vapidKey;
        }

        const recoveredToken = await getToken(messaging, tokenOptions);
        if (!recoveredToken || cancelled) return;

        setToken(recoveredToken);
        localStorage.setItem("fcmToken", recoveredToken);
        localStorage.setItem("notificationPermission", "granted");

        await registerTokenWithBackend(recoveredToken);
      } catch (restoreError) {
        if (isExpectedPushRegistrationFailure(restoreError)) {
          console.warn(
            "Push token restore skipped in current environment:",
            restoreError?.message || restoreError,
          );
          return;
        }
        console.error("Error restoring FCM token:", restoreError);
      }
    };

    void restoreToken();

    return () => {
      cancelled = true;
    };
  }, [
    buildServiceWorkerUrl,
    isSupported,
    isExpectedPushRegistrationFailure,
    permission,
    registerTokenWithBackend,
    token,
  ]);

  // Keep backend registration in sync (e.g., login/logout changes)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (permission !== "granted") return;

    const storedToken = token || localStorage.getItem("fcmToken");
    if (!storedToken) return;

    const authToken = getAuthToken();
    const sessionId = getSessionId();
    const registerKey = `${storedToken}|${userType}|${userId || ""}|${
      authToken ? "auth" : "guest"
    }|${sessionId || ""}`;

    if (lastRegisterKeyRef.current === registerKey) return;
    lastRegisterKeyRef.current = registerKey;

    registerTokenWithBackend(storedToken).catch((err) => {
      console.error("Error syncing notification token:", err);
    });
  }, [
    getAuthToken,
    getSessionId,
    permission,
    registerTokenWithBackend,
    token,
    userId,
    userType,
  ]);

  /**
   * Request notification permission and register token
   * Call this only after user interaction (button click, etc.)
   */
  const requestPermission = useCallback(async () => {
    if (shouldDisablePushInCurrentRuntime()) {
      setError(
        "Push notifications are disabled on localhost by default. Set NEXT_PUBLIC_ENABLE_PUSH_IN_DEV=true to test locally.",
      );
      return false;
    }

    if (!isSupported) {
      setError("Notifications not supported in this browser");
      return false;
    }

    if (!firebaseApp) {
      setError("Firebase not initialized. Please refresh and try again.");
      return false;
    }

    if (permission === "denied") {
      setError("Notifications are blocked. Please enable in browser settings.");
      return false;
    }

    setIsRegistering(true);
    setError(null);

    try {
      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        setError("Notification permission denied");
        return false;
      }

      // Register service worker
      const swUrl = buildServiceWorkerUrl();
      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: "/",
      });
      // Keep registration fresh after deploys.
      try {
        await registration.update();
      } catch {
        // Best-effort only.
      }
      await navigator.serviceWorker.ready;
      console.log("Service Worker registered:", registration);

      // Get FCM token
      const messaging = getMessaging(firebaseApp);
      const tokenOptions = {
        serviceWorkerRegistration: registration,
      };
      const vapidKey = (
        process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || FALLBACK_VAPID_KEY
      ).trim();
      if (vapidKey) {
        tokenOptions.vapidKey = vapidKey;
      }

      // If the browser has an old/invalid token, force a fresh one.
      try {
        await deleteToken(messaging);
      } catch (deleteErr) {
        // Best-effort only.
        console.log("FCM deleteToken skipped:", deleteErr?.message || deleteErr);
      }

      const fcmToken = await getToken(messaging, tokenOptions);

      if (!fcmToken) {
        throw new Error("Failed to get FCM token");
      }

      setToken(fcmToken);
      console.log("FCM Token obtained:", fcmToken.substring(0, 20) + "...");

      // Register token with backend
      await registerTokenWithBackend(fcmToken);

      // Store permission state
      localStorage.setItem("notificationPermission", "granted");
      localStorage.setItem("fcmToken", fcmToken);

      return true;
    } catch (err) {
      if (isExpectedPushRegistrationFailure(err)) {
        console.warn("Push registration failed:", err?.message || err);
      } else {
        console.error("Error requesting permission:", err);
      }
      setError(normalizePushErrorMessage(err));
      return false;
    } finally {
      setIsRegistering(false);
    }
  }, [
    buildServiceWorkerUrl,
    isSupported,
    isExpectedPushRegistrationFailure,
    normalizePushErrorMessage,
    permission,
    registerTokenWithBackend,
    shouldDisablePushInCurrentRuntime,
  ]);

  /**
   * Unregister from notifications
   */
  const unregister = useCallback(async () => {
    const storedToken = token || localStorage.getItem("fcmToken");
    const authToken = getAuthToken();
    const sessionId = getSessionId();

    if (!storedToken) return;

    try {
      // Best-effort: revoke the token at Firebase so the next enable generates a fresh token.
      if (firebaseApp) {
        try {
          const messaging = getMessaging(firebaseApp);
          await deleteToken(messaging);
        } catch (deleteErr) {
          console.log(
            "FCM deleteToken during unregister skipped:",
            deleteErr?.message || deleteErr,
          );
        }
      }

      const headers = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      if (sessionId) {
        headers["X-Session-Id"] = sessionId;
      }

      await fetch(`${API_URL}/api/notifications/unregister`, {
        method: "DELETE",
        headers,
        credentials: "include",
        body: JSON.stringify({ token: storedToken, sessionId }),
      });

      localStorage.removeItem("fcmToken");
      localStorage.removeItem("notificationPermission");
      setToken(null);
    } catch (err) {
      console.error("Error unregistering:", err);
    }
  }, [getAuthToken, getSessionId, token]);

  /**
   * Check if already registered
   */
  const isRegistered = useCallback(() => {
    return (
      permission === "granted" && (token || localStorage.getItem("fcmToken"))
    );
  }, [permission, token]);

  /**
   * Clear foreground message (for toast dismissal)
   */
  const clearForegroundMessage = useCallback(() => {
    setForegroundMessage(null);
  }, []);

  return {
    permission,
    token,
    isSupported,
    isRegistering,
    error,
    foregroundMessage,
    requestPermission,
    unregister,
    isRegistered: isRegistered(),
    clearForegroundMessage,
  };
};

export default useNotifications;
