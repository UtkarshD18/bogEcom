import PDFDocument from "pdfkit";
import AddressModel from "../models/address.model.js";
import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import PurchaseOrderModel from "../models/purchaseOrder.model.js";
import UserModel from "../models/user.model.js";
import { getShippingQuote, validateIndianPincode } from "../services/shippingRate.service.js";
import { splitGstInclusiveAmount } from "../services/tax.service.js";

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeGuestDetails = (guestDetails = {}) => ({
  fullName: String(guestDetails.fullName || "").trim(),
  phone: String(guestDetails.phone || "").trim(),
  address: String(guestDetails.address || "").trim(),
  pincode: String(guestDetails.pincode || "").trim(),
  state: String(guestDetails.state || "").trim(),
  email: String(guestDetails.email || "").trim().toLowerCase(),
  gst: String(guestDetails.gst || "").trim(),
});

const validateGuestCheckoutDetails = (details) => {
  const requiredFields = [
    "fullName",
    "phone",
    "address",
    "pincode",
    "state",
    "email",
  ];

  for (const field of requiredFields) {
    if (!details[field]) {
      return `${field} is required for guest checkout`;
    }
  }

  if (!/^\d{10}$/.test(details.phone)) {
    return "Phone must be 10 digits";
  }
  if (!validateIndianPincode(details.pincode)) {
    return "Pincode must be a valid 6 digit code";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) {
    return "Email is invalid";
  }

  return null;
};

const resolveDeliveryInfo = async ({ userId, deliveryAddressId, guestDetails }) => {
  if (deliveryAddressId) {
    const address = await AddressModel.findById(deliveryAddressId).lean();
    if (!address) {
      throw new Error("Delivery address not found");
    }
    return {
      state: String(address.state || "").trim(),
      pincode: String(address.pincode || "").trim(),
      guest: {
        fullName: String(address.name || guestDetails?.fullName || "").trim(),
        phone: String(address.mobile || guestDetails?.phone || "").trim(),
        address: String(address.address_line1 || guestDetails?.address || "").trim(),
        pincode: String(address.pincode || "").trim(),
        state: String(address.state || "").trim(),
        email: String(guestDetails?.email || "").trim().toLowerCase(),
        gst: String(guestDetails?.gst || "").trim(),
      },
    };
  }

  const normalizedGuest = normalizeGuestDetails(guestDetails);
  if (!userId) {
    const guestError = validateGuestCheckoutDetails(normalizedGuest);
    if (guestError) {
      throw new Error(guestError);
    }
  }

  return {
    state: normalizedGuest.state,
    pincode: normalizedGuest.pincode,
    guest: normalizedGuest,
  };
};

const validateAndNormalizeItems = async (itemsInput = []) => {
  if (!Array.isArray(itemsInput) || itemsInput.length === 0) {
    throw new Error("At least one purchase order item is required");
  }

  const productIds = itemsInput
    .map((item) => item.productId || item._id || item.id)
    .filter(Boolean);
  const uniqueIds = Array.from(new Set(productIds.map((id) => String(id))));
  const products = await ProductModel.find({ _id: { $in: uniqueIds } })
    .select("_id name price images")
    .lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const normalizedItems = itemsInput.map((item) => {
    const productId = String(item.productId || item._id || item.id || "");
    const product = productMap.get(productId);
    if (!product) {
      throw new Error(`Product not found for ID: ${productId}`);
    }

    const quantity = Math.max(Number(item.quantity || 1), 1);
    const price = round2(Number(item.price || product.price || 0));
    const subTotal = round2(price * quantity);

    return {
      productId,
      productTitle: item.productTitle || product.name,
      quantity,
      price,
      subTotal,
      image: item.image || product.images?.[0] || "",
    };
  });

  return normalizedItems;
};

const buildPdfBuffer = (purchaseOrder) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").text("Purchase Order", {
      align: "center",
    });
    doc.moveDown(1);

    doc.fontSize(10).font("Helvetica");
    doc.text(`PO ID: ${purchaseOrder._id}`);
    doc.text(`Status: ${String(purchaseOrder.status || "").toUpperCase()}`);
    doc.text(`Date: ${new Date(purchaseOrder.createdAt).toLocaleString("en-IN")}`);
    doc.moveDown(1);

    doc.font("Helvetica-Bold").text("Items");
    doc.moveDown(0.3);

    purchaseOrder.items.forEach((item, index) => {
      doc
        .font("Helvetica")
        .text(
          `${index + 1}. ${item.productTitle} | Qty: ${item.quantity} | Price: Rs. ${item.price.toFixed(2)} | Subtotal: Rs. ${item.subTotal.toFixed(2)}`,
        );
    });

    doc.moveDown(1);
    doc.font("Helvetica-Bold");
    doc.text(`Subtotal: Rs. ${Number(purchaseOrder.subtotal || 0).toFixed(2)}`);
    doc.text(`Tax: Rs. ${Number(purchaseOrder.tax || 0).toFixed(2)}`);
    doc.text(`Shipping: Rs. ${Number(purchaseOrder.shipping || 0).toFixed(2)}`);
    doc.text(`Total: Rs. ${Number(purchaseOrder.total || 0).toFixed(2)}`);

    doc.end();
  });

export const createPurchaseOrder = async (req, res) => {
  try {
    const userId = req.user || null;
    const {
      items,
      products,
      deliveryAddressId,
      delivery_address,
      guestDetails,
      paymentType = "prepaid",
    } = req.body || {};

    const normalizedItems = await validateAndNormalizeItems(items || products || []);
    const grossInclusiveSubtotal = round2(
      normalizedItems.reduce((sum, item) => sum + Number(item.subTotal || 0), 0),
    );

    const deliveryInfo = await resolveDeliveryInfo({
      userId,
      deliveryAddressId: deliveryAddressId || delivery_address || null,
      guestDetails,
    });

    const taxData = splitGstInclusiveAmount(
      grossInclusiveSubtotal,
      5,
      deliveryInfo.state,
    );
    const shippingQuote = await getShippingQuote({
      destinationPincode: deliveryInfo.pincode,
      subtotal: grossInclusiveSubtotal,
      paymentType,
    });

    const total = round2(grossInclusiveSubtotal + shippingQuote.amount);

    const purchaseOrder = await PurchaseOrderModel.create({
      userId,
      items: normalizedItems,
      subtotal: taxData.taxableAmount,
      tax: taxData.tax,
      shipping: shippingQuote.amount,
      total,
      gst: {
        rate: taxData.rate,
        state: taxData.state,
        taxableAmount: taxData.taxableAmount,
        cgst: taxData.cgst,
        sgst: taxData.sgst,
        igst: taxData.igst,
      },
      status: "draft",
      guestDetails: deliveryInfo.guest,
      deliveryAddressId: deliveryAddressId || delivery_address || null,
    });

    return res.status(201).json({
      error: false,
      success: true,
      message: "Purchase order created successfully",
      data: {
        purchaseOrder,
        shippingSource: shippingQuote.source,
      },
    });
  } catch (error) {
    return res.status(400).json({
      error: true,
      success: false,
      message: error.message || "Failed to create purchase order",
    });
  }
};

export const getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user || null;
    let isAdmin = false;
    if (userId) {
      const requester = await UserModel.findById(userId).select("role").lean();
      isAdmin = requester?.role === "Admin";
    }

    const po = await PurchaseOrderModel.findById(id).lean();
    if (!po) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Purchase order not found",
      });
    }

    if (!isAdmin) {
      if (po.userId && String(po.userId) !== String(userId)) {
        return res.status(403).json({
          error: true,
          success: false,
          message: "Not authorized to access this purchase order",
        });
      }

      if (!po.userId) {
        const email = String(req.query.email || "").trim().toLowerCase();
        if (!email || email !== String(po.guestDetails?.email || "").toLowerCase()) {
          return res.status(403).json({
            error: true,
            success: false,
            message: "Guest verification failed",
          });
        }
      }
    }

    return res.json({
      error: false,
      success: true,
      data: po,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch purchase order",
    });
  }
};

export const downloadPurchaseOrderPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const po = await PurchaseOrderModel.findById(id).lean();
    if (!po) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Purchase order not found",
      });
    }

    const requesterId = req.user || null;
    let isAdmin = false;
    if (requesterId) {
      const requester = await UserModel.findById(requesterId).select("role").lean();
      isAdmin = requester?.role === "Admin";
    }

    if (!isAdmin) {
      if (po.userId) {
        if (!requesterId || String(po.userId) !== String(requesterId)) {
          return res.status(403).json({
            error: true,
            success: false,
            message: "Not authorized to download this purchase order",
          });
        }
      } else {
        const email = String(req.query.email || "").trim().toLowerCase();
        if (!email || email !== String(po.guestDetails?.email || "").toLowerCase()) {
          return res.status(403).json({
            error: true,
            success: false,
            message: "Guest verification failed",
          });
        }
      }
    }

    const buffer = await buildPdfBuffer(po);
    const filename = `PO-${String(po._id).slice(-8).toUpperCase()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to generate purchase order PDF",
    });
  }
};

export const getAllPurchaseOrdersAdmin = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      PurchaseOrderModel.find()
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseOrderModel.countDocuments(),
    ]);

    return res.status(200).json({
      error: false,
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch purchase orders",
    });
  }
};

export const convertPurchaseOrderToOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user || null;
    const po = await PurchaseOrderModel.findById(id);
    let isAdmin = false;
    if (userId) {
      const requester = await UserModel.findById(userId).select("role").lean();
      isAdmin = requester?.role === "Admin";
    }

    if (!po) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Purchase order not found",
      });
    }

    if (po.status === "converted" && po.convertedOrderId) {
      return res.json({
        error: false,
        success: true,
        message: "Purchase order already converted",
        data: {
          orderId: po.convertedOrderId,
        },
      });
    }

    if (po.userId && !isAdmin) {
      if (!userId || String(po.userId) !== String(userId)) {
        return res.status(403).json({
          error: true,
          success: false,
          message: "Not authorized to convert this purchase order",
        });
      }
    } else if (!isAdmin) {
      const email = String(req.query.email || "").trim().toLowerCase();
      if (!email || email !== String(po.guestDetails?.email || "").toLowerCase()) {
        return res.status(403).json({
          error: true,
          success: false,
          message: "Guest verification failed",
        });
      }
    }

    const order = await OrderModel.create({
      user: po.userId || userId || null,
      products: po.items.map((item) => ({
        productId: String(item.productId),
        productTitle: item.productTitle,
        quantity: item.quantity,
        price: item.price,
        image: item.image,
        subTotal: item.subTotal,
      })),
      subtotal: round2(po.subtotal),
      totalAmt: round2(po.total),
      finalAmount: round2(po.total),
      tax: round2(po.tax),
      shipping: round2(po.shipping),
      gst: {
        rate: Number(po.gst?.rate || 5),
        state: String(po.gst?.state || po.guestDetails?.state || ""),
        taxableAmount: round2(po.gst?.taxableAmount ?? po.subtotal),
        cgst: round2(po.gst?.cgst ?? 0),
        sgst: round2(po.gst?.sgst ?? 0),
        igst: round2(po.gst?.igst ?? po.tax),
      },
      gstNumber: po.guestDetails?.gst || "",
      delivery_address: po.deliveryAddressId || null,
      guestDetails: po.guestDetails || {},
      billingDetails: {
        fullName: po.guestDetails?.fullName || "",
        email: po.guestDetails?.email || "",
        phone: po.guestDetails?.phone || "",
        address: po.guestDetails?.address || "",
        pincode: po.guestDetails?.pincode || "",
        state: po.guestDetails?.state || "",
      },
      order_status: "pending",
      payment_status: "pending",
      paymentMethod: "PENDING",
      purchaseOrder: po._id,
    });

    po.status = "converted";
    po.convertedOrderId = order._id;
    await po.save();

    return res.json({
      error: false,
      success: true,
      message: "Purchase order converted to order",
      data: {
        orderId: order._id,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: error.message || "Failed to convert purchase order",
    });
  }
};

export default {
  convertPurchaseOrderToOrder,
  createPurchaseOrder,
  downloadPurchaseOrderPdf,
  getPurchaseOrderById,
};
