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
  const [userId, setUserId] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check login status
  useEffect(() => {
    const checkAuth = () => {
      const token = cookies.get("accessToken");
      const storedUser = localStorage.getItem("user");

      if (token && storedUser) {
        try {
          const user = JSON.parse(storedUser);
          setUserId(user._id || user.id);
          setIsLoggedIn(true);
        } catch {
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false);
        setUserId(null);
      }
    };

    checkAuth();

    // Listen for auth changes
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  const { foregroundMessage, clearForegroundMessage, isRegistered } =
    useNotifications({
      userId,
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
