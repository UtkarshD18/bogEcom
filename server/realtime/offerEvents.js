import { getIO } from "./socket.js";

const getRoomSize = (io, roomName) =>
  Number(io?.sockets?.adapter?.rooms?.get(roomName)?.size || 0);

/**
 * Broadcast an in-app offer notification to currently connected visitors.
 *
 * This is a real-time fallback for users who are online but not push-registered yet
 * (for example first-time visitors and logged-out guests).
 */
export const emitLiveOfferNotification = (payload, options = {}) => {
  const io = getIO();
  if (!io) {
    return {
      delivered: 0,
      guestDelivered: 0,
      userDelivered: 0,
      room: null,
      reason: "socket_not_ready",
    };
  }

  const includeUsers = options.includeUsers !== false;
  const guestDelivered = getRoomSize(io, "audience:guest");
  const userDelivered = getRoomSize(io, "audience:user");
  const delivered = includeUsers ? guestDelivered + userDelivered : guestDelivered;
  const room = includeUsers ? "audience:all" : "audience:guest";

  io.to(room).emit("offer:live", payload);

  return {
    delivered,
    guestDelivered,
    userDelivered,
    room,
    reason: null,
  };
};
