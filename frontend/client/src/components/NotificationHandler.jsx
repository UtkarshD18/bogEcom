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

  // Check login status
  useEffect(() => {
    const checkAuth = () => {
      const token = cookies.get("accessToken");
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

  const { foregroundMessage, clearForegroundMessage, isRegistered } =
    useNotifications({
      userType: isLoggedIn ? "user" : "guest",
    });

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
