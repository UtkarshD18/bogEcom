import OrderModel from "../models/order.model.js";
import { evaluateRefundEligibility } from "../services/refund.service.js";

export const evaluateRefund = async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "orderId is required",
      });
    }

    const order = await OrderModel.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Order not found",
      });
    }

    const evaluation = evaluateRefundEligibility(order);
    return res.json({
      error: false,
      success: true,
      data: evaluation,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to evaluate refund",
    });
  }
};

export default {
  evaluateRefund,
};
