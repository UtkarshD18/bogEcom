"use client";

import { useNotifications } from "@/hooks/useNotifications";
import { API_BASE_URL } from "@/utils/api";
import cookies from "js-cookie";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import NotificationToast from "./NotificationToast";

const normalizeBaseUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const resolveSocketUrl = () => {
  const explicitApiUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_API_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const fallbackApiUrl = normalizeBaseUrl(API_BASE_URL);
  const base = explicitApiUrl || fallbackApiUrl;
  return base.replace(/\/api$/i, "");
};

const SOCKET_URL = resolveSocketUrl();
const API_ROOT = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL
  : `${API_BASE_URL}/api`;
const LIVE_FEED_URL = `${API_ROOT}/notifications/offers/live-feed`;
const MAX_DEDUPED_NOTIFICATION_IDS = 100;
const AUTO_PROMPT_KEY = "push_prompt_last_shown_at";
const AUTO_PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * NotificationHandler Component
 *
 * Global handler for push + live in-app offer notifications.
 * Displays toast for incoming notifications across the app.
 *
 * Place this in the main layout to handle notifications app-wide.
 */
const NotificationHandler = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeMessage, setActiveMessage] = useState(null);
  const seenNotificationIdsRef = useRef(new Set());
  const lastSeenOfferTimestampRef = useRef(0);

  const rememberNotification = useCallback((notificationId) => {
    if (!notificationId) return false;
    const seen = seenNotificationIdsRef.current;
    if (seen.has(notificationId)) return true;

    seen.add(notificationId);
    if (seen.size > MAX_DEDUPED_NOTIFICATION_IDS) {
      const oldest = seen.values().next().value;
      if (oldest) {
        seen.delete(oldest);
      }
    }
    return false;
  }, []);

  // Check login status
  useEffect(() => {
    const checkAuth = () => {
      const token =
        cookies.get("accessToken") ||
        (typeof window !== "undefined"
          ? localStorage.getItem("accessToken") ||
            localStorage.getItem("token")
          : null);
      setIsLoggedIn(!!token);
    };

    checkAuth();

    // Listen for auth changes
    window.addEventListener("loginSuccess", checkAuth);
    window.addEventListener("storage", checkAuth);
    window.addEventListener("focus", checkAuth);
    return () => {
      window.removeEventListener("loginSuccess", checkAuth);
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("focus", checkAuth);
    };
  }, []);

  const {
    foregroundMessage,
    clearForegroundMessage,
    isRegistered,
    isSupported,
    permission,
    requestPermission,
  } =
    useNotifications({
      userType: isLoggedIn ? "user" : "guest",
    });

  // Auto-show browser permission prompt after the first user interaction.
  // Browsers block silent prompts, so this keeps it compliant.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSupported) return;
    if (isRegistered) return;
    if (permission !== "default") return;

    const lastShownRaw = localStorage.getItem(AUTO_PROMPT_KEY);
    const lastShown = Number(lastShownRaw || 0);
    const recentlyPrompted =
      Number.isFinite(lastShown) &&
      lastShown > 0 &&
      Date.now() - lastShown < AUTO_PROMPT_COOLDOWN_MS;

    if (recentlyPrompted) return;

    let prompted = false;

    const triggerPrompt = async () => {
      if (prompted) return;
      prompted = true;
      localStorage.setItem(AUTO_PROMPT_KEY, String(Date.now()));
      await requestPermission();
    };

    const onFirstInteraction = () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
      void triggerPrompt();
    };

    window.addEventListener("pointerdown", onFirstInteraction, { once: true });
    window.addEventListener("keydown", onFirstInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
  }, [isSupported, isRegistered, permission, requestPermission]);

  useEffect(() => {
    const notificationId =
      foregroundMessage?.data?.notificationId ||
      foregroundMessage?.data?.type ||
      null;
    if (!notificationId) return;
    rememberNotification(notificationId);
  }, [foregroundMessage, rememberNotification]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      timeout: 8000,
    });

    const handleLiveOffer = (payload) => {
      const liveData =
        payload?.data && typeof payload.data === "object" ? payload.data : {};
      const notificationId =
        payload?.notificationId || liveData.notificationId || null;

      if (rememberNotification(notificationId)) return;

      const title = String(payload?.title || liveData.title || "New Offer");
      const body = String(payload?.body || liveData.body || "");
      const normalizedMessage = {
        title,
        body,
        data: {
          ...liveData,
          notificationId: notificationId || `offer-live:${Date.now()}`,
        },
        timestamp: Date.now(),
      };

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(title, {
            body,
            icon: "/logo.png",
            badge: "/logo.png",
            tag:
              normalizedMessage.data?.notificationId ||
              normalizedMessage.data?.type ||
              "offer_live",
          });
        } catch {
          // Best-effort only; toast fallback still runs.
        }
      }

      setActiveMessage(normalizedMessage);
    };

    socket.on("offer:live", handleLiveOffer);

    return () => {
      socket.off("offer:live", handleLiveOffer);
      socket.disconnect();
    };
  }, [rememberNotification]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let pollInterval = null;
    let isDisposed = false;

    const pollLiveFeed = async () => {
      const since = Number(lastSeenOfferTimestampRef.current || 0);
      const query = `?since=${since}&limit=10`;

      try {
        const response = await fetch(`${LIVE_FEED_URL}${query}`, {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) return;

        const payload = await response.json();
        const offers = Array.isArray(payload?.data?.offers) ? payload.data.offers : [];

        for (const offer of offers) {
          if (isDisposed) return;
          const liveData =
            offer?.data && typeof offer.data === "object" ? offer.data : {};
          const notificationId =
            offer?.notificationId || liveData.notificationId || null;
          const offerTimestamp =
            Number(offer?.sentAtMs || Date.parse(offer?.sentAt || "") || 0) || 0;

          if (offerTimestamp > lastSeenOfferTimestampRef.current) {
            lastSeenOfferTimestampRef.current = offerTimestamp;
          }

          if (rememberNotification(notificationId)) {
            continue;
          }

          const title = String(offer?.title || liveData.title || "New Offer");
          const body = String(offer?.body || liveData.body || "");
          const normalizedMessage = {
            title,
            body,
            data: {
              ...liveData,
              notificationId: notificationId || `offer-feed:${Date.now()}`,
            },
            timestamp: Date.now(),
          };

          setActiveMessage(normalizedMessage);
        }
      } catch {
        // Best-effort polling fallback only.
      }
    };

    void pollLiveFeed();
    pollInterval = window.setInterval(pollLiveFeed, 10000);

    return () => {
      isDisposed = true;
      if (pollInterval) {
        window.clearInterval(pollInterval);
      }
    };
  }, [rememberNotification]);

  const handleDismiss = useCallback(() => {
    clearForegroundMessage();
    setActiveMessage(null);
  }, [clearForegroundMessage]);

  const messageToDisplay = activeMessage || foregroundMessage;
  if (!messageToDisplay) return null;

  return (
    <NotificationToast
      message={messageToDisplay}
      onDismiss={handleDismiss}
      duration={6000}
    />
  );
};

export default NotificationHandler;
