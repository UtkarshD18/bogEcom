import { getIO } from "./socket.js";

export const emitOrderStatusUpdate = (order, source = "SYSTEM") => {
  const io = getIO();
  if (!io || !order) return;

  const orderId = order._id?.toString() || order.id;
  const userId = order.user?._id?.toString() || order.user?.toString();
  if (!orderId || !userId) return;

  const payload = {
    orderId,
    status: order.order_status,
    paymentStatus: order.payment_status,
    statusTimeline: order.statusTimeline || [],
    shipment: {
      awb: order.awb_number || null,
      status: order.shipment_status || null,
      provider: order.shipping_provider || null,
      label: order.shipping_label || null,
      manifest: order.shipping_manifest || null,
    },
    source,
    updatedAt: order.updatedAt || new Date(),
  };

  io.to(`user:${userId}`).emit("order:update", payload);
  io.to(`user:${userId}`).emit("order.updated", payload);
  io.to("admin:orders").emit("order:update", payload);
  io.to("admin:orders").emit("order.updated", payload);
};
