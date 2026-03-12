import { io } from "socket.io-client";
import { API_BASE_URL } from "@/utils/api";

const SOCKET_URL = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL;

const SOCKET_TRANSPORTS = ["polling"];

let socketInstance = null;
let activeToken = null;

const createSocket = () =>
  io(SOCKET_URL, {
    autoConnect: false,
    transports: SOCKET_TRANSPORTS,
    withCredentials: true,
  });

export const getAdminSocket = (token) => {
  if (typeof window === "undefined") return null;

  if (!socketInstance) {
    socketInstance = createSocket();
  }

  const resolvedToken = typeof token === "string" ? token : null;
  if (resolvedToken && resolvedToken !== activeToken) {
    activeToken = resolvedToken;
    socketInstance.auth = { token: resolvedToken };
    if (socketInstance.connected) {
      socketInstance.disconnect();
    }
  }

  if (resolvedToken && !socketInstance.connected && !socketInstance.connecting) {
    socketInstance.connect();
  }

  return socketInstance;
};

export const disconnectAdminSocket = () => {
  if (!socketInstance) return;
  socketInstance.disconnect();
};
