"use client";

import { firebaseApp } from "@/firebase";
import { deleteToken, getMessaging, getToken, onMessage } from "firebase/messaging";
import { useCallback, useEffect, useRef, useState } from "react";
import cookies from "js-cookie";

const API_URL = (
  process.env.NEXT_PUBLIC_APP_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

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

  const getAuthToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    return (
      cookies.get("accessToken") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token")
    );
  }, []);

  const registerTokenWithBackend = useCallback(
    async (fcmToken) => {
      const headers = {
        "Content-Type": "application/json",
      };

      const authToken = getAuthToken();
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_URL}/api/notifications/register`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          token: fcmToken,
          userType,
          userId: userType === "user" ? userId : null,
          platform: "web",
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
    [getAuthToken, userId, userType],
  );

  // Check if notifications are supported
  useEffect(() => {
    const checkSupport = async () => {
      if (typeof window === "undefined") return;

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
  }, []);

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
          setForegroundMessage({
            title: payload.notification?.title,
            body: payload.notification?.body,
            data: payload.data,
            timestamp: Date.now(),
          });
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

  // Keep backend registration in sync (e.g., login/logout changes)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (permission !== "granted") return;

    const storedToken = token || localStorage.getItem("fcmToken");
    if (!storedToken) return;

    const authToken = getAuthToken();
    const registerKey = `${storedToken}|${userType}|${userId || ""}|${
      authToken ? "auth" : "guest"
    }`;

    if (lastRegisterKeyRef.current === registerKey) return;
    lastRegisterKeyRef.current = registerKey;

    registerTokenWithBackend(storedToken).catch((err) => {
      console.error("Error syncing notification token:", err);
    });
  }, [getAuthToken, permission, registerTokenWithBackend, token, userId, userType]);

  /**
   * Request notification permission and register token
   * Call this only after user interaction (button click, etc.)
   */
  const requestPermission = useCallback(async () => {
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
      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
      );
      console.log("Service Worker registered:", registration);

      // Get FCM token
      const messaging = getMessaging(firebaseApp);
      const tokenOptions = {
        serviceWorkerRegistration: registration,
      };
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
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
      console.error("Error requesting permission:", err);
      setError(err.message);
      return false;
    } finally {
      setIsRegistering(false);
    }
  }, [isSupported, permission, registerTokenWithBackend]);

  /**
   * Unregister from notifications
   */
  const unregister = useCallback(async () => {
    const storedToken = token || localStorage.getItem("fcmToken");

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

      await fetch(`${API_URL}/api/notifications/unregister`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: storedToken }),
      });

      localStorage.removeItem("fcmToken");
      localStorage.removeItem("notificationPermission");
      setToken(null);
    } catch (err) {
      console.error("Error unregistering:", err);
    }
  }, [token]);

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
