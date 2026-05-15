import { API_BASE_URL } from "@/utils/api";
import { io } from "socket.io-client";

const SOCKET_TRANSPORTS = ["websocket", "polling"];
const LOCAL_SOCKET_FALLBACK = "http://localhost:8000";
const HEALTHY_ONE_GRAM_SOCKET_FALLBACK = "https://healthyonegram.com";

const sanitizeBaseUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "");

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const stripApiSuffix = (value) => {
  const baseUrl = sanitizeBaseUrl(value);
  return baseUrl.endsWith("/api") ? baseUrl.slice(0, -4) : baseUrl;
};

const normalizeSocketBaseUrl = (value) => {
  const normalizedBaseUrl = stripApiSuffix(value);

  try {
    const parsed = new URL(normalizedBaseUrl);
    const hostname = String(parsed.hostname || "").toLowerCase();
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

    // Local backend defaults to port 8000. Prefer that for sockets so a stale
    // 8001 override in frontend env does not keep live updates offline.
    if (isLocalhost && parsed.port && parsed.port !== "8000") {
      parsed.port = "8000";
      return parsed.toString().replace(/\/+$/, "");
    }

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return normalizedBaseUrl;
  }
};

const resolveSocketBaseUrls = () => {
  const candidates = [];
  const pushCandidate = (value) => {
    const normalized = normalizeSocketBaseUrl(value);
    if (!isHttpUrl(normalized) || candidates.includes(normalized)) return;
    candidates.push(normalized);
  };

  pushCandidate(API_BASE_URL);
  pushCandidate(process.env.NEXT_PUBLIC_APP_API_URL);
  pushCandidate(process.env.NEXT_PUBLIC_API_URL);

  if (typeof window !== "undefined") {
    pushCandidate(window.location.origin);

    const hostname = String(window.location.hostname || "").toLowerCase();
    const looksLikeAdminHost =
      hostname.startsWith("admin-dot-") ||
      hostname.startsWith("admin.") ||
      hostname.endsWith(".healthyonegram.com");

    if (looksLikeAdminHost) {
      pushCandidate(HEALTHY_ONE_GRAM_SOCKET_FALLBACK);
    }
  }

  if (candidates.length === 0) {
    pushCandidate(LOCAL_SOCKET_FALLBACK);
  }

  return candidates;
};

let socketInstance = null;
let activeToken = null;
let socketBaseUrls = [];
let socketUrlIndex = 0;

const createSocket = (socketUrl) =>
  io(socketUrl, {
    autoConnect: false,
    transports: SOCKET_TRANSPORTS,
    withCredentials: true,
    timeout: 8000,
    reconnection: true,
  });

const createManagedSocket = () => {
  socketBaseUrls = resolveSocketBaseUrls();
  socketUrlIndex = 0;
  const socket = createSocket(socketBaseUrls[socketUrlIndex]);

  socket.on("connect_error", () => {
    if (socketBaseUrls.length <= 1) return;
    socketUrlIndex = (socketUrlIndex + 1) % socketBaseUrls.length;
    socket.io.uri = socketBaseUrls[socketUrlIndex];
  });

  return socket;
};

export const getAdminSocket = (token) => {
  if (typeof window === "undefined") return null;

  if (!socketInstance) {
    socketInstance = createManagedSocket();
  }

  const resolvedToken = typeof token === "string" ? token : null;
  if (resolvedToken && resolvedToken !== activeToken) {
    activeToken = resolvedToken;
    socketInstance.auth = { token: resolvedToken };
    if (socketInstance.connected) {
      socketInstance.disconnect();
    }
  }

  if (resolvedToken && !socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
};

export const disconnectAdminSocket = () => {
  if (!socketInstance) return;
  socketInstance.disconnect();
};
