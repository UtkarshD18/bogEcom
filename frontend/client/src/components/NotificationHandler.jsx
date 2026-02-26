"use client";

import { useNotifications } from "@/hooks/useNotifications";
import cookies from "js-cookie";
import { useEffect, useState } from "react";
import NotificationToast from "./NotificationToast";

/**
 * NotificationHandler Component
 *
 * Global handler for foreground push notifications.
 * Displays toast for incoming notifications.
 *
 * Place this in the main layout to handle notifications app-wide.
 */
const NotificationHandler = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const AUTO_PROMPT_KEY = "push_prompt_last_shown_at";
  const AUTO_PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

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

  // Only render toast if registered
  if (!isRegistered || !foregroundMessage) return null;

  return (
    <NotificationToast
      message={foregroundMessage}
      onDismiss={clearForegroundMessage}
      duration={6000}
    />
  );
};

export default NotificationHandler;
