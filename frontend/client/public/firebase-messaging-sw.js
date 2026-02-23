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

    const fallbackUrl = self.location?.origin || "/";
    const resolvedUrl = (() => {
      const incomingUrl = payload?.data?.url || payload?.fcmOptions?.link || "/";
      try {
        return new URL(String(incomingUrl || "/"), fallbackUrl).href;
      } catch {
        return fallbackUrl;
      }
    })();

    const notificationTitle = payload.notification?.title || "New Notification";
    const notificationOptions = {
      body: payload.notification?.body || "",
      icon: "/logo192.png",
      badge: "/logo192.png",
      tag: payload.data?.type || "default",
      data: {
        ...(payload.data || {}),
        url: resolvedUrl,
      },
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

const resolveNotificationUrl = (rawUrl) => {
  const fallback = self.location?.origin || "/";
  const value = String(rawUrl || "").trim();
  if (!value) return fallback;
  try {
    return new URL(value, fallback).href;
  } catch {
    return fallback;
  }
};

const matchesClientTarget = (clientUrl, targetUrl) => {
  try {
    const clientParsed = new URL(clientUrl);
    const targetParsed = new URL(targetUrl);
    return (
      clientParsed.origin === targetParsed.origin &&
      clientParsed.pathname === targetParsed.pathname
    );
  } catch {
    return false;
  }
};

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event);

  event.notification.close();

  const urlToOpen = resolveNotificationUrl(event.notification.data?.url || "/");

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus same page if already open.
        for (const client of windowClients) {
          if ("focus" in client && matchesClientTarget(client.url, urlToOpen)) {
            return client.focus();
          }
        }

        // Otherwise focus any same-origin client before opening a new one.
        for (const client of windowClients) {
          if ("focus" in client) {
            try {
              const parsed = new URL(client.url);
              if (parsed.origin === new URL(urlToOpen).origin) {
                return client.focus().then(() => {
                  if ("navigate" in client) {
                    return client.navigate(urlToOpen);
                  }
                  return undefined;
                });
              }
            } catch {
              // Ignore parse errors and continue.
            }
          }
        }

        // Open new window if none found.
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
