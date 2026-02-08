import fsPromises from "fs/promises";
import InvoiceModel from "../models/invoice.model.js";
import OrderModel from "../models/order.model.js";
import UserModel from "../models/user.model.js";
import { getAbsolutePathFromStoredInvoicePath } from "../utils/generateInvoicePdf.js";

const isOrderAccessible = (order, requester) => {
  const isAdmin = requester?.role === "Admin";
  if (isAdmin) return true;
  const orderUserId = order?.user?._id?.toString?.() || order?.user?.toString?.();
  return Boolean(orderUserId && requester && orderUserId === String(requester._id));
};

const resolveRequester = async (req) => {
  const requesterId = req.user?._id || req.user?.id || req.user || null;
  if (!requesterId) return null;
  return UserModel.findById(requesterId).select("_id role").lean();
};

export const getInvoiceByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const requester = await resolveRequester(req);
    if (!requester) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Authentication required",
      });
    }

    const order = await OrderModel.findById(orderId).select("user");
    if (!order) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Order not found",
      });
    }

    if (!isOrderAccessible(order, requester)) {
      return res.status(403).json({
        error: true,
        success: false,
        message: "Not authorized to access this invoice",
      });
    }

    const invoice = await InvoiceModel.findOne({ orderId }).lean();
    if (!invoice) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Invoice not found",
      });
    }

    return res.json({
      error: false,
      success: true,
      data: invoice,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch invoice",
    });
  }
};

export const downloadInvoiceByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const requester = await resolveRequester(req);
    if (!requester) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Authentication required",
      });
    }

    const order = await OrderModel.findById(orderId).select("user invoicePath invoiceNumber");
    if (!order) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Order not found",
      });
    }

    if (!isOrderAccessible(order, requester)) {
      return res.status(403).json({
        error: true,
        success: false,
        message: "Not authorized to download this invoice",
      });
    }

    const absolutePath = getAbsolutePathFromStoredInvoicePath(order.invoicePath);
    if (!absolutePath) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Invoice file not available",
      });
    }

    await fsPromises.access(absolutePath);
    const filename = `${order.invoiceNumber || `invoice_${orderId}`}.pdf`;
    return res.download(absolutePath, filename);
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to download invoice",
    });
  }
};

export default {
  downloadInvoiceByOrder,
  getInvoiceByOrder,
};
