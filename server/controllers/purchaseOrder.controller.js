
import PDFDocument from "pdfkit";
import AddressModel from "../models/address.model.js";
import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import PurchaseOrderModel from "../models/purchaseOrder.model.js";
import {
  applyPurchaseOrderInventory,
  releaseInventory,
  reserveInventory,
} from "../services/inventory.service.js";
import UserModel from "../models/user.model.js";
import { getShippingQuote, validateIndianPincode } from "../services/shippingRate.service.js";
import { splitGstInclusiveAmount } from "../services/tax.service.js";

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const resolvePackingFromProduct = (item, product) => {
  if (item?.packing) return String(item.packing);
  if (item?.packSize) return String(item.packSize);
  if (!product) return "";

  const weight = Number(product.weight || 0);
  const unit = String(product.unit || "").toLowerCase();

  if (weight > 0) {
    if (["g", "gm", "gram", "grams"].includes(unit)) {
      return weight >= 1000 ? `${weight / 1000}kg` : `${weight}g`;
    }
    if (["kg", "kilogram", "kilograms"].includes(unit)) {
      return `${weight}kg`;
    }
    return `${weight}${product.unit || ""}`;
  }

  return product.unit || "";
};

const getFiscalYearRange = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const fyStartYear = month >= 3 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  const start = new Date(fyStartYear, 3, 1, 0, 0, 0, 0);
  const end = new Date(fyEndYear, 2, 31, 23, 59, 59, 999);
  return { fyStartYear, fyEndYear, start, end };
};

const buildPoNumber = ({ fyStartYear, fyEndYear, sequence }) => {
  const fyStart = String(fyStartYear % 100).padStart(2, "0");
  const fyEnd = String(fyEndYear % 100).padStart(2, "0");
  const seq = String(sequence || 1).padStart(3, "0");
  return `BOGPO${fyStart}-${fyEnd}/${seq}`;
};

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
    const receivedQuantity = Math.max(Number(item.receivedQuantity || 0), 0);
    const packing = resolvePackingFromProduct(item, product);

    return {
      productId,
      productTitle: item.productTitle || product.name,
      quantity,
      receivedQuantity: Math.min(receivedQuantity, quantity),
      price,
      subTotal,
      packing,
      image: item.image || product.images?.[0] || "",
    };
  });

  return normalizedItems;
};

const formatPdfDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const datePart = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timePart = date
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
  return `${datePart} at ${timePart}`;
};

const formatPdfStatus = (status) => {
  const raw = String(status || "").toLowerCase();
  if (raw === "converted") return "PLACED";
  if (raw === "received") return "RECEIVED";
  if (raw === "approved") return "APPROVED";
  if (raw === "draft") return "DRAFT";
  if (raw) return raw.toUpperCase();
  return "N/A";
};

const buildPdfBuffer = (purchaseOrder) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const margin = doc.page.margins.left;
    const contentWidth = pageWidth - margin * 2;

    const formatMoney = (value) =>
      `Rs. ${Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    doc.fontSize(18).font("Helvetica-Bold").fillColor("#111");
    doc.text("Purchase Order", { align: "center" });
    doc.moveDown(0.4);

    doc
      .strokeColor("#1e88e5")
      .lineWidth(1)
      .moveTo(margin, doc.y)
      .lineTo(margin + contentWidth, doc.y)
      .stroke();

    doc.moveDown(0.8);
    doc.fontSize(10).font("Helvetica").fillColor("#111");
    doc.text(`PO Number: ${purchaseOrder.poNumber || purchaseOrder._id}`);
    doc.text(`Date: ${formatPdfDate(purchaseOrder.createdAt)}`);
    doc.text(`Status: ${formatPdfStatus(purchaseOrder.status)}`);
    doc.moveDown(0.6);

    doc.font("Helvetica-Bold").fillColor("#1e88e5").text("Vendor Details");
    doc.moveDown(0.3);
    doc.font("Helvetica").fillColor("#111");
    doc.text(`Name: ${purchaseOrder.guestDetails?.fullName || "N/A"}`);
    doc.text(`Phone: ${purchaseOrder.guestDetails?.phone || "N/A"}`);
    doc.text(`Address: ${purchaseOrder.guestDetails?.address || "N/A"}`);
    doc.text(`State: ${purchaseOrder.guestDetails?.state || "N/A"}`);
    doc.moveDown(0.8);

    const tableStartX = margin;
    let tableY = doc.y;
    const colWidths = {
      sn: 30,
      product: 220,
      packing: 70,
      qty: 50,
      rate: 70,
      amount: 75,
    };

    // Header background
    doc
      .fillColor("#EAF4FF")
      .rect(tableStartX, tableY, contentWidth, 22)
      .fill();
    doc.fillColor("#1e88e5").font("Helvetica-Bold").fontSize(9);
    doc.text("S.N", tableStartX + 6, tableY + 6);
    doc.text("Product", tableStartX + colWidths.sn + 6, tableY + 6);
    doc.text(
      "Packing",
      tableStartX + colWidths.sn + colWidths.product + 6,
      tableY + 6,
    );
    doc.text(
      "Qty",
      tableStartX +
        colWidths.sn +
        colWidths.product +
        colWidths.packing +
        6,
      tableY + 6,
    );
    doc.text(
      "Rate/kg",
      tableStartX +
        colWidths.sn +
        colWidths.product +
        colWidths.packing +
        colWidths.qty +
        6,
      tableY + 6,
    );
    doc.text(
      "Amount",
      tableStartX +
        colWidths.sn +
        colWidths.product +
        colWidths.packing +
        colWidths.qty +
        colWidths.rate +
        6,
      tableY + 6,
    );

    tableY += 22;
    doc.fillColor("#111").font("Helvetica").fontSize(9);

    purchaseOrder.items.forEach((item, index) => {
      const rowHeight = 20;
      const productText = item.productTitle || "Product";
      const packing = item.packing || "-";

      doc.text(String(index + 1), tableStartX + 6, tableY + 6);
      doc.text(
        productText,
        tableStartX + colWidths.sn + 6,
        tableY + 6,
        { width: colWidths.product - 10 },
      );
      doc.text(
        packing,
        tableStartX + colWidths.sn + colWidths.product + 6,
        tableY + 6,
      );
      doc.text(
        String(item.quantity || 0),
        tableStartX +
          colWidths.sn +
          colWidths.product +
          colWidths.packing +
          6,
        tableY + 6,
      );
      doc.text(
        formatMoney(item.price),
        tableStartX +
          colWidths.sn +
          colWidths.product +
          colWidths.packing +
          colWidths.qty +
          6,
        tableY + 6,
      );
      doc.text(
        formatMoney(item.subTotal),
        tableStartX +
          colWidths.sn +
          colWidths.product +
          colWidths.packing +
          colWidths.qty +
          colWidths.rate +
          6,
        tableY + 6,
      );

      doc
        .strokeColor("#E5E7EB")
        .lineWidth(1)
        .moveTo(tableStartX, tableY + rowHeight)
        .lineTo(tableStartX + contentWidth, tableY + rowHeight)
        .stroke();

      tableY += rowHeight;
    });

    // Total row
    doc
      .fillColor("#E8F5E9")
      .rect(tableStartX, tableY + 6, contentWidth, 24)
      .fill();
    doc.fillColor("#2E7D32").font("Helvetica-Bold").fontSize(10);
    doc.text("Total", tableStartX + contentWidth - 140, tableY + 12);
    doc.text(
      formatMoney(purchaseOrder.total),
      tableStartX + contentWidth - 70,
      tableY + 12,
    );

    doc.moveDown(4.2);

    const receipt = purchaseOrder.receipt || {};
    const hasReceipt =
      receipt.invoiceNumber ||
      receipt.vehicleNumber ||
      receipt.notes ||
      receipt.receivedAt ||
      (purchaseOrder.items || []).some(
        (item) => Number(item.receivedQuantity || 0) > 0,
      );

    if (hasReceipt) {
      doc.font("Helvetica-Bold").fillColor("#1e88e5").text("Receipt History");
      doc.moveDown(0.4);

      const boxY = doc.y;
      const boxHeight = 48;
      doc
        .fillColor("#FFF7DF")
        .rect(margin, boxY, contentWidth, boxHeight)
        .fill();

      doc.fillColor("#111").font("Helvetica-Bold").fontSize(9);
      const firstItem =
        purchaseOrder.items?.find(
          (item) => Number(item.receivedQuantity || 0) > 0,
        ) || purchaseOrder.items?.[0];
      const productName = firstItem?.productTitle || "Product";
      const receivedQty = Number(firstItem?.receivedQuantity || 0);
      const receivedLine = receipt.receivedAt
        ? `Received ${receivedQty || 0} on ${formatPdfDate(receipt.receivedAt)}`
        : "";

      doc.text(productName, margin + 12, boxY + 10);
      doc
        .font("Helvetica")
        .fillColor("#333")
        .text(receivedLine, margin + 12, boxY + 24);
      const metaParts = [];
      if (receipt.vehicleNumber) metaParts.push(`Vehicle: ${receipt.vehicleNumber}`);
      if (receipt.invoiceNumber) metaParts.push(`Invoice: ${receipt.invoiceNumber}`);
      if (receipt.notes) metaParts.push(`Notes: ${receipt.notes}`);
      if (metaParts.length > 0) {
        doc.text(metaParts.join(" | "), margin + 12, boxY + 36);
      }
    }

    doc.end();
  });

const ensurePoNumber = async (purchaseOrder) => {
  if (purchaseOrder?.poNumber) return purchaseOrder.poNumber;
  if (!purchaseOrder?.createdAt) return "";

  const fyRange = getFiscalYearRange(new Date(purchaseOrder.createdAt));
  const sequence = await PurchaseOrderModel.countDocuments({
    createdAt: { $gte: fyRange.start, $lte: purchaseOrder.createdAt },
  });
  const poNumber = buildPoNumber({
    fyStartYear: fyRange.fyStartYear,
    fyEndYear: fyRange.fyEndYear,
    sequence,
  });
  await PurchaseOrderModel.updateOne(
    { _id: purchaseOrder._id },
    { $set: { poNumber } },
  );
  purchaseOrder.poNumber = poNumber;
  return poNumber;
};

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
    const poDate = new Date();
    const fyRange = getFiscalYearRange(poDate);
    const existingCount = await PurchaseOrderModel.countDocuments({
      createdAt: { $gte: fyRange.start, $lte: fyRange.end },
    });
    const poNumber = buildPoNumber({
      fyStartYear: fyRange.fyStartYear,
      fyEndYear: fyRange.fyEndYear,
      sequence: existingCount + 1,
    });

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
      poNumber,
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

    const missingPackingIds = (po.items || [])
      .filter((item) => !item.packing && item.productId)
      .map((item) => String(item.productId));
    if (missingPackingIds.length > 0) {
      const products = await ProductModel.find({
        _id: { $in: missingPackingIds },
      })
        .select("_id weight unit")
        .lean();
      const productMap = new Map(
        products.map((product) => [String(product._id), product]),
      );
      po.items = po.items.map((item) => {
        if (item.packing) return item;
        const product = productMap.get(String(item.productId));
        return {
          ...item,
          packing: resolvePackingFromProduct(item, product),
        };
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

    if (!po.poNumber) {
      await ensurePoNumber(po);
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

export const updatePurchaseOrderReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { items = [], invoiceNumber, vehicleNumber, notes } = req.body || {};

    const po = await PurchaseOrderModel.findById(id);
    if (!po) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Purchase order not found",
      });
    }

    const normalizedItems = Array.isArray(items) ? items : [];
    normalizedItems.forEach((item) => {
      const productId = String(item.productId || item._id || item.id || "");
      if (!productId) return;
      const receivedNow = Math.max(Number(item.receivedQuantity || 0), 0);
      if (!receivedNow) return;

      const line = po.items.find(
        (poItem) => String(poItem.productId) === productId,
      );
      if (!line) return;

      const orderedQty = Math.max(Number(line.quantity || 0), 0);
      const currentReceived = Math.max(Number(line.receivedQuantity || 0), 0);
      const nextReceived = Math.min(orderedQty, currentReceived + receivedNow);
      line.receivedQuantity = nextReceived;
    });

    if (!po.receipt) po.receipt = {};
    if (invoiceNumber !== undefined) {
      po.receipt.invoiceNumber = String(invoiceNumber || "").trim();
    }
    if (vehicleNumber !== undefined) {
      po.receipt.vehicleNumber = String(vehicleNumber || "").trim();
    }
    if (notes !== undefined) {
      po.receipt.notes = String(notes || "").trim();
    }

    const hasReceiptUpdate =
      normalizedItems.some((item) => Number(item.receivedQuantity || 0) > 0) ||
      invoiceNumber ||
      vehicleNumber ||
      notes;

    if (hasReceiptUpdate) {
      po.receipt.receivedAt = new Date();
      po.status = "received";
    }

    await po.save();

    return res.status(200).json({
      error: false,
      success: true,
      message: "Receipt details updated",
      data: po,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: error.message || "Failed to update receipt",
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

    const order = new OrderModel({
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

    try {
      await reserveInventory(order, "PO_CONVERT");
      await order.save();
    } catch (inventoryError) {
      if (order.inventoryStatus === "reserved") {
        try {
          await releaseInventory(order, "PO_CONVERT_FAIL");
        } catch (releaseError) {
          // Best-effort rollback
        }
      }
      throw inventoryError;
    }

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

export const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, items } = req.body || {};

    const po = await PurchaseOrderModel.findById(id);
    if (!po) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Purchase order not found",
      });
    }

    const normalizedStatus = String(status || "").toLowerCase();
    if (!normalizedStatus) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Status is required",
      });
    }

    const allowedStatuses = ["draft", "approved", "received", "converted"];
    if (!allowedStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid status value",
      });
    }

    if (normalizedStatus === "received") {
      if (po.status === "received" && po.inventory_applied) {
        return res.status(200).json({
          error: false,
          success: true,
          message: "Purchase order already received",
          data: { purchaseOrder: po },
        });
      }

      if (!["draft", "approved"].includes(po.status)) {
        return res.status(400).json({
          error: true,
          success: false,
          message: `Cannot mark purchase order as received from status ${po.status}`,
        });
      }

      const result = await applyPurchaseOrderInventory(po, {
        receivedItems: Array.isArray(items) ? items : [],
        adminId: req.user?._id || req.user?.id || req.user || null,
      });

      return res.status(200).json({
        error: false,
        success: true,
        message: "Purchase order marked as received",
        data: { purchaseOrder: result.purchaseOrder },
      });
    }

    po.status = normalizedStatus;
    await po.save();
    return res.status(200).json({
      error: false,
      success: true,
      message: "Purchase order status updated",
      data: { purchaseOrder: po },
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: error.message || "Failed to update purchase order",
    });
  }
};

export default {
  convertPurchaseOrderToOrder,
  createPurchaseOrder,
  downloadPurchaseOrderPdf,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
  getAllPurchaseOrdersAdmin,
  updatePurchaseOrderReceipt,
};
