"use client";

import { useEffect, useRef, useState } from "react";
import { disconnectAdminSocket, getAdminSocket } from "@/utils/realtime";

export const useAdminRealtime = ({
  token,
  onOrderUpdate,
  onAnalyticsBatch,
} = {}) => {
  const [status, setStatus] = useState("disconnected");
  const handlersRef = useRef({ onOrderUpdate, onAnalyticsBatch });

  useEffect(() => {
    handlersRef.current = { onOrderUpdate, onAnalyticsBatch };
  }, [onOrderUpdate, onAnalyticsBatch]);

  useEffect(() => {
    if (!token) {
      disconnectAdminSocket();
      setStatus("disconnected");
      return undefined;
    }

    const socket = getAdminSocket(token);
    if (!socket) return undefined;

    const handleConnect = () => setStatus("connected");
    const handleDisconnect = () => setStatus("disconnected");
    const handleReconnectAttempt = () => setStatus("reconnecting");
    const handleError = () => setStatus("disconnected");

    const handleOrderUpdate = (payload) => {
      handlersRef.current.onOrderUpdate?.(payload);
    };
    const handleAnalyticsBatch = (payload) => {
      handlersRef.current.onAnalyticsBatch?.(payload);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleError);
    socket.on("reconnect_attempt", handleReconnectAttempt);

    socket.on("order:update", handleOrderUpdate);
    socket.on("order.updated", handleOrderUpdate);
    socket.on("analytics:batch", handleAnalyticsBatch);
    socket.on("analytics:event", handleAnalyticsBatch);

    setStatus(socket.connected ? "connected" : "connecting");

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleError);
      socket.off("reconnect_attempt", handleReconnectAttempt);
      socket.off("order:update", handleOrderUpdate);
      socket.off("order.updated", handleOrderUpdate);
      socket.off("analytics:batch", handleAnalyticsBatch);
      socket.off("analytics:event", handleAnalyticsBatch);
    };
  }, [token]);

  return { status };
};

export default useAdminRealtime;
