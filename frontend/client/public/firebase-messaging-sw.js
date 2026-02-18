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

// Service workers can't access process.env directly.
// These placeholders are replaced at deploy time from GitHub secrets.
const firebaseConfig = {
  apiKey: "__NEXT_PUBLIC_FIREBASE_API_KEY__",
  authDomain: "__NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN__",
  projectId: "__NEXT_PUBLIC_FIREBASE_PROJECT_ID__",
  storageBucket: "__NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__NEXT_PUBLIC_FIREBASE_APP_ID__",
};

const isConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && !value.startsWith("__NEXT_PUBLIC_"),
);

if (isConfigured) {
  firebase.initializeApp(firebaseConfig);
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
} else {
  console.warn("[SW] Firebase config not injected. Push notifications disabled.");
}

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
