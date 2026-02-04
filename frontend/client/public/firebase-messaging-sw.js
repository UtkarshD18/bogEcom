/**
 * Firebase Messaging Service Worker
 *
 * Handles background push notifications.
 * Must be in public/ folder for proper registration.
 */

// Import Firebase scripts
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js",
);

// Initialize Firebase with actual config
// Note: Service workers can't access env vars, so config is hardcoded here
firebase.initializeApp({
  apiKey: "AIzaSyAmn-1DB4vmJlAccKvtQsU5ZQkwiKyng9k",
  authDomain: "healthyom.firebaseapp.com",
  projectId: "healthyom",
  storageBucket: "healthyom.firebasestorage.app",
  messagingSenderId: "554753723115",
  appId: "1:554753723115:web:0b9fdb419765d243f9ccae",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background message received:", payload);

  const notificationTitle = payload.notification?.title || "New Notification";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/logo192.png",
    badge: "/logo192.png",
    tag: payload.data?.type || "default",
    data: payload.data || {},
    actions: [
      {
        action: "open",
        title: "View",
      },
    ],
    vibrate: [200, 100, 200],
    requireInteraction: payload.data?.type === "order_update",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(urlToOpen) && "focus" in client) {
            return client.focus();
          }
        }
        // Open new window if none found
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }),
  );
});

// Handle service worker install
self.addEventListener("install", (event) => {
  console.log("[SW] Service Worker installed");
  self.skipWaiting();
});

// Handle service worker activate
self.addEventListener("activate", (event) => {
  console.log("[SW] Service Worker activated");
  event.waitUntil(clients.claim());
});
