"use client";

import { readSharedAccessToken } from "@/utils/authSession";
import { disconnectAdminSocket, getAdminSocket } from "@/utils/realtime";
import { useEffect, useRef, useState } from "react";

export const useAdminRealtime = ({
  token,
  onOrderUpdate,
  onAnalyticsBatch,
  onStockUpdate,
} = {}) => {
  const [status, setStatus] = useState("disconnected");
  const handlersRef = useRef({
    onOrderUpdate,
    onAnalyticsBatch,
    onStockUpdate,
  });

  useEffect(() => {
    handlersRef.current = { onOrderUpdate, onAnalyticsBatch, onStockUpdate };
  }, [onOrderUpdate, onAnalyticsBatch, onStockUpdate]);

  useEffect(() => {
    const resolvedToken = token || readSharedAccessToken();
    if (!resolvedToken) {
      disconnectAdminSocket();
      setStatus("disconnected");
      return undefined;
    }

    const socket = getAdminSocket(resolvedToken);
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
    const handleStockUpdate = (payload) => {
      handlersRef.current.onStockUpdate?.(payload);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleError);
    socket.on("reconnect_attempt", handleReconnectAttempt);

    socket.on("order:update", handleOrderUpdate);
    socket.on("order.updated", handleOrderUpdate);
    socket.on("analytics:batch", handleAnalyticsBatch);
    socket.on("analytics:event", handleAnalyticsBatch);
    socket.on("stock_update", handleStockUpdate);

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
      socket.off("stock_update", handleStockUpdate);
    };
  }, [token]);

  return { status };
};

export default useAdminRealtime;
