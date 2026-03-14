import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import AddressModel from "../models/address.model.js";
import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import PurchaseOrderModel from "../models/purchaseOrder.model.js";
import {
  applyPurchaseOrderInventory,
  logInventoryAudit,
  releaseInventory,
  reserveInventory,
  syncParentStockFromVariants,
} from "../services/inventory.service.js";
import UserModel from "../models/user.model.js";
import { validateIndianPincode } from "../services/shippingRate.service.js";
import { splitGstInclusiveAmount } from "../services/tax.service.js";
import { checkExclusiveAccess } from "../middlewares/membershipGuard.js";

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const round3 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 1000) / 1000;
const PO_COMPANY_NAME = "Buy One Gram Private Limited";
const PO_COMPANY_ADDRESS =
  "G-225, Sitapura Industrial Area, Tonk Road, Jaipur 302022";
const PO_COMPANY_GST = "GST No: 08AAJCB3889Q1ZO";

const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || "");
  return (
    message.includes("Transaction numbers are only allowed") ||
    message.includes("Transaction support is not available")
  );
};

const runWithMongoTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (isTransactionUnsupportedError(error)) {
      return work(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

const canUserAccessExclusiveProducts = async (userId) => {
  if (!userId) return false;
  return checkExclusiveAccess(userId);
};

const extractPurchaseOrderProductIds = (items = []) =>
  Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => String(item?.productId || item?._id || item?.id || ""))
        .filter(Boolean),
    ),
  );

const ensureExclusiveAccessForProducts = async ({
  productIds = [],
  userId = null,
  isAdmin = false,
}) => {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return;
  }

  const products = await ProductModel.find({ _id: { $in: productIds } })
    .select("_id isExclusive isActive")
    .lean();

  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const missingIds = productIds.filter((id) => !productMap.has(String(id)));
  if (missingIds.length > 0) {
    throw new Error(`Product not found for ID: ${missingIds[0]}`);
  }

  const inactiveProduct = products.find((product) => product.isActive === false);
  if (inactiveProduct) {
    throw new Error("Product is not available");
  }

  const hasExclusiveProducts = products.some((product) => product.isExclusive === true);
  if (!hasExclusiveProducts) {
    return;
  }

  if (isAdmin) {
    return;
  }

  const hasExclusiveAccess = await canUserAccessExclusiveProducts(userId);
  if (!hasExclusiveAccess) {
    const accessError = new Error("Active membership required for exclusive products.");
    accessError.statusCode = 403;
    throw accessError;
  }
};

const normalizeUnitForPacking = (unit) => {
  const normalized = String(unit || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "";
  if (["g", "gm", "gram", "grams"].includes(normalized)) return "g";
  if (["kg", "kgs", "kilogram", "kilograms"].includes(normalized)) return "kg";
  if (["ml", "millilitre", "milliliter", "millilitres", "milliliters"].includes(normalized)) {
    return "ml";
  }
  if (["l", "lt", "ltr", "liter", "litre", "liters", "litres"].includes(normalized)) {
    return "l";
  }
  return normalized;
};

const normalizePackingKey = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/(\d)\.0+(?=[a-z]|$)/g, "$1");
};

const buildPackingFromWeightAndUnit = (weightValue, unitValue) => {
  const weight = Number(weightValue || 0);
  if (!Number.isFinite(weight) || weight <= 0) return "";

  const unit = normalizeUnitForPacking(unitValue);
  if (unit === "g") {
    return weight >= 1000 ? `${weight / 1000}kg` : `${weight}g`;
  }
  if (unit === "kg") {
    return `${weight}kg`;
  }
  if (unit === "ml" || unit === "l") {
    return `${weight}${unit}`;
  }

  return `${weight}${unit || ""}`;
};

const resolveVariantForPacking = ({
  product,
  variantId = "",
  variantName = "",
  packing = "",
}) => {
  if (!Array.isArray(product?.variants) || product.variants.length === 0) {
    return null;
  }

  const normalizedVariantId = String(variantId || "").trim();
  if (normalizedVariantId) {
    const byId = product.variants.find(
      (variant) => String(variant?._id || "") === normalizedVariantId,
    );
    if (byId) return byId;
  }

  const candidateKeys = new Set(
    [variantName, packing]
      .map((value) => normalizePackingKey(value))
      .filter(Boolean),
  );
  if (candidateKeys.size === 0) return null;

  return (
    product.variants.find((variant) => {
      const variantNameKey = normalizePackingKey(variant?.name || "");
      const variantWeightKey = normalizePackingKey(
        buildPackingFromWeightAndUnit(variant?.weight, variant?.unit),
      );
      return candidateKeys.has(variantNameKey) || candidateKeys.has(variantWeightKey);
    }) || null
  );
};

const resolvePreferredVariantIdForProduct = ({
  product,
  variantId = "",
  variantName = "",
  packing = "",
}) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const explicitVariantId = String(variantId || "").trim();
  if (explicitVariantId) {
    const explicitVariant = variants.find(
      (variant) => String(variant?._id || "") === explicitVariantId,
    );
    if (explicitVariant?._id) {
      return String(explicitVariant._id);
    }
  }

  const resolvedVariant = resolveVariantForPacking({
    product,
    variantId,
    variantName,
    packing,
  });
  return resolvedVariant?._id ? String(resolvedVariant._id) : "";
};

const resolvePackingFromProduct = (item, product) => {
  if (item?.packing) return String(item.packing);
  if (item?.packSize) return String(item.packSize);
  if (item?.variantName) return String(item.variantName);

  const resolvedVariant = resolveVariantForPacking({
    product,
    variantId: item?.variantId,
    variantName: item?.variantName,
    packing: item?.packing || item?.packSize,
  });
  if (resolvedVariant) {
    return (
      buildPackingFromWeightAndUnit(resolvedVariant?.weight, resolvedVariant?.unit) ||
      String(resolvedVariant?.name || "")
    );
  }

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

  const uniqueIds = extractPurchaseOrderProductIds(itemsInput);
  const products = await ProductModel.find({ _id: { $in: uniqueIds } })
    .select("_id name price images hasVariants variants._id variants.name variants.weight variants.unit weight unit")
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
    const resolvedVariant = resolveVariantForPacking({
      product,
      variantId: item?.variantId,
      variantName: item?.variantName,
      packing,
    });
    const hasVariantOptions =
      Array.isArray(product?.variants) && product.variants.length > 0;
    if (hasVariantOptions && !resolvedVariant) {
      throw new Error(`Select a valid packing variant for ${product.name}`);
    }
    const normalizedPacking = String(
      (resolvedVariant &&
        (buildPackingFromWeightAndUnit(
          resolvedVariant?.weight,
          resolvedVariant?.unit,
        ) ||
          resolvedVariant?.name)) ||
        packing ||
        item?.variantName ||
        "",
    ).trim();
    const variantName = String(
      resolvedVariant?.name || item?.variantName || normalizedPacking || "",
    ).trim();
    const variantId = resolvedVariant?._id ? String(resolvedVariant._id) : null;

    return {
      productId,
      productTitle: item.productTitle || product.name,
      variantId,
      variantName,
      quantity,
      receivedQuantity: Math.min(receivedQuantity, quantity),
      price,
      subTotal,
      packing: normalizedPacking,
      image: item.image || product.images?.[0] || "",
    };
  });

  return normalizedItems;
};

const sumGrossInclusiveItems = (items = []) =>
  round2(
    (Array.isArray(items) ? items : []).reduce((sum, item) => {
      const lineSubTotal = Number(item?.subTotal);
      if (Number.isFinite(lineSubTotal) && lineSubTotal > 0) {
        return sum + lineSubTotal;
      }
      const quantity = Math.max(Number(item?.quantity || 0), 0);
      const price = Math.max(Number(item?.price || 0), 0);
      return sum + quantity * price;
    }, 0),
  );

/**
 * Keep stored PO totals intact for backend compatibility.
 * Shipping remains 0 to avoid mismatches with the entered line-item data.
 */
const computePurchaseOrderTotals = ({
  items = [],
  gstRate = 5,
  state = "",
} = {}) => {
  const grossInclusiveSubtotal = sumGrossInclusiveItems(items);
  const taxData = splitGstInclusiveAmount(grossInclusiveSubtotal, gstRate, state);
  const shipping = 0;
  const total = round2(grossInclusiveSubtotal + shipping);

  return {
    subtotal: round2(taxData.taxableAmount),
    tax: round2(taxData.tax),
    shipping,
    total,
    gst: {
      rate: Number(taxData.rate || gstRate || 5),
      state: String(taxData.state || state || ""),
      taxableAmount: round2(taxData.taxableAmount),
      cgst: round2(taxData.cgst || 0),
      sgst: round2(taxData.sgst || 0),
      igst: round2(taxData.igst || 0),
    },
  };
};

const normalizePurchaseOrderTotals = (purchaseOrder) => {
  if (!purchaseOrder) return purchaseOrder;
  const computed = computePurchaseOrderTotals({
    items: purchaseOrder.items,
    gstRate: Number(purchaseOrder?.gst?.rate || 5),
    state: String(purchaseOrder?.gst?.state || purchaseOrder?.guestDetails?.state || ""),
  });

  return {
    ...purchaseOrder,
    subtotal: computed.subtotal,
    tax: computed.tax,
    shipping: computed.shipping,
    total: computed.total,
    gst: {
      ...(purchaseOrder.gst || {}),
      ...computed.gst,
    },
  };
};

const formatPdfDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const getOrdinalSuffix = (day) => {
    const mod100 = day % 100;
    if (mod100 >= 11 && mod100 <= 13) return "th";
    const mod10 = day % 10;
    if (mod10 === 1) return "st";
    if (mod10 === 2) return "nd";
    if (mod10 === 3) return "rd";
    return "th";
  };
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}${getOrdinalSuffix(day)}, ${year}`;
};

const parsePackingToKg = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(kg|g)\b/i);
  if (!match) return 0;

  const quantity = Number(match[1] || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;

  return String(match[2] || "").toLowerCase() === "g"
    ? quantity / 1000
    : quantity;
};

const calculateTotalQuantityKg = (items = []) =>
  round3(
    (Array.isArray(items) ? items : []).reduce((sum, item) => {
      const quantity = Math.max(Number(item?.quantity || 0), 0);
      const packingSizeKg = parsePackingToKg(
        item?.packing || item?.packSize || item?.variantName,
      );
      return sum + quantity * packingSizeKg;
    }, 0),
  );

const calculateLineTotalQuantityKg = (item) =>
  round3(
    Math.max(Number(item?.quantity || 0), 0) *
      parsePackingToKg(item?.packing || item?.packSize || item?.variantName),
  );

const formatPdfKg = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });

const buildPdfBuffer = (purchaseOrder) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 46 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const margin = doc.page.margins.left;
    const contentWidth = pageWidth - margin * 2;
    const halfWidth = contentWidth / 2;

    const formatMoney = (value) =>
      `Rs. ${Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    const totalQuantityKg = calculateTotalQuantityKg(purchaseOrder.items);
    const poNumber = String(purchaseOrder.poNumber || purchaseOrder._id || "").trim();
    const vendorName = String(
      purchaseOrder.guestDetails?.fullName || "N/A",
    ).trim();

    doc.fillColor("#111111");
    doc.font("Helvetica-Bold").fontSize(16).text(PO_COMPANY_NAME, margin, doc.y, {
      width: contentWidth,
      align: "center",
    });
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(9.5).text(PO_COMPANY_ADDRESS, margin, doc.y, {
      width: contentWidth,
      align: "center",
    });
    doc.moveDown(0.15);
    doc.font("Helvetica").fontSize(9.5).text(PO_COMPANY_GST, margin, doc.y, {
      width: contentWidth,
      align: "center",
    });
    doc.moveDown(0.65);
    doc.font("Helvetica-Bold").fontSize(15).text("Purchase Order", margin, doc.y, {
      width: contentWidth,
      align: "center",
    });
    doc.moveDown(0.9);

    const metaRowY = doc.y;
    doc.font("Helvetica").fontSize(10).fillColor("#111111");
    doc.text(`PO Number: ${poNumber}`, margin, metaRowY, {
      width: halfWidth,
      align: "left",
    });
    doc.text(`Date: ${formatPdfDate(purchaseOrder.createdAt)}`, margin + halfWidth, metaRowY, {
      width: halfWidth,
      align: "right",
    });

    doc.y = metaRowY + 24;
    doc.font("Helvetica-Bold").fontSize(10.5).text(`Vendor: ${vendorName}`, margin, doc.y, {
      width: contentWidth,
      align: "left",
    });
    doc.moveDown(0.9);

    const tableStartX = margin;
    let tableY = doc.y;
    const colWidths = {
      product: 150,
      qty: 65,
      packing: 75,
      rate: 90,
      totalQty: 123,
    };
    const tableHeaderHeight = 24;
    const rowHeight = 24;

    doc
      .fillColor("#2f81bd")
      .rect(tableStartX, tableY, contentWidth, tableHeaderHeight)
      .fill();
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9.2);
    doc.text("Product", tableStartX + 6, tableY + 6);
    doc.text(
      "Quantity",
      tableStartX + colWidths.product + 6,
      tableY + 6,
    );
    doc.text(
      "Packing",
      tableStartX + colWidths.product + colWidths.qty + 6,
      tableY + 6,
    );
    doc.text(
      "Rate (per kg)",
      tableStartX +
        colWidths.product +
        colWidths.qty +
        colWidths.packing +
        6,
      tableY + 6,
    );
    doc.text(
      "Total Quantity (kg)",
      tableStartX +
        colWidths.product +
        colWidths.qty +
        colWidths.packing +
        colWidths.rate +
        6,
      tableY + 6,
    );

    tableY += tableHeaderHeight;
    doc.fillColor("#111").font("Helvetica").fontSize(9);

    purchaseOrder.items.forEach((item) => {
      const productText = item.productTitle || "Product";
      const packing = item.packing || "-";
      const lineTotalQuantityKg = calculateLineTotalQuantityKg(item);

      doc.text(
        productText,
        tableStartX + 6,
        tableY + 6,
        { width: colWidths.product - 12, align: "left" },
      );
      doc.text(
        String(item.quantity || 0),
        tableStartX + colWidths.product + 6,
        tableY + 6,
        { width: colWidths.qty - 12, align: "right" },
      );
      doc.text(
        packing,
        tableStartX + colWidths.product + colWidths.qty + 6,
        tableY + 6,
        { width: colWidths.packing - 12 },
      );
      doc.text(
        formatMoney(item.price),
        tableStartX +
          colWidths.product +
          colWidths.qty +
          colWidths.packing +
          6,
        tableY + 6,
        { width: colWidths.rate - 12, align: "right" },
      );
      doc.text(
        `${formatPdfKg(lineTotalQuantityKg)} kg`,
        tableStartX +
          colWidths.product +
          colWidths.qty +
          colWidths.packing +
          colWidths.rate +
          6,
        tableY + 6,
        { width: colWidths.totalQty - 12, align: "right" },
      );

      doc
        .strokeColor("#E5E7EB")
        .lineWidth(1)
        .moveTo(tableStartX, tableY + rowHeight)
        .lineTo(tableStartX + contentWidth, tableY + rowHeight)
        .stroke();

      tableY += rowHeight;
    });

    const summaryY = tableY + 26;
    if (summaryY > doc.page.height - doc.page.margins.bottom - 50) {
      doc.addPage();
      doc.y = margin;
    } else {
      doc.y = summaryY;
    }
    doc
      .strokeColor("#D1D5DB")
      .lineWidth(1)
      .moveTo(margin, doc.y)
      .lineTo(margin + contentWidth, doc.y)
      .stroke();
    doc.moveDown(1.1);
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111");
    doc.text(
      `Total Quantity: ${formatPdfKg(totalQuantityKg)} kg`,
      margin,
      doc.y,
      {
        width: contentWidth,
        align: "right",
      },
    );

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
    } = req.body || {};

    const normalizedItems = await validateAndNormalizeItems(items || products || []);
    const normalizedProductIds = extractPurchaseOrderProductIds(normalizedItems);
    await ensureExclusiveAccessForProducts({
      productIds: normalizedProductIds,
      userId,
    });

    const deliveryInfo = await resolveDeliveryInfo({
      userId,
      deliveryAddressId: deliveryAddressId || delivery_address || null,
      guestDetails,
    });

    const computedTotals = computePurchaseOrderTotals({
      items: normalizedItems,
      gstRate: 5,
      state: deliveryInfo.state,
    });

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
      subtotal: computedTotals.subtotal,
      tax: computedTotals.tax,
      shipping: computedTotals.shipping,
      total: computedTotals.total,
      gst: computedTotals.gst,
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
        shippingSource: "none",
      },
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 400;
    return res.status(statusCode).json({
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

    const purchaseOrderProductIds = extractPurchaseOrderProductIds(po.items);
    await ensureExclusiveAccessForProducts({
      productIds: purchaseOrderProductIds,
      userId,
      isAdmin,
    });

    const normalizedPo = normalizePurchaseOrderTotals(po);

    return res.json({
      error: false,
      success: true,
      data: normalizedPo,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({
      error: true,
      success: false,
      message: error.message || "Failed to fetch purchase order",
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

    const purchaseOrderProductIds = extractPurchaseOrderProductIds(po.items);
    await ensureExclusiveAccessForProducts({
      productIds: purchaseOrderProductIds,
      userId: requesterId,
      isAdmin,
    });

    if (!po.poNumber) {
      await ensurePoNumber(po);
    }

    const normalizedPo = normalizePurchaseOrderTotals(po);
    const buffer = await buildPdfBuffer(normalizedPo);
    const filename = `${po.poNumber || po._id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return res.send(buffer);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({
      error: true,
      success: false,
      message: error.message || "Failed to generate purchase order PDF",
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

    const normalizedOrders = orders.map((order) =>
      normalizePurchaseOrderTotals(order),
    );

    return res.status(200).json({
      error: false,
      success: true,
      data: {
        orders: normalizedOrders,
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
    const normalizedPo = await runWithMongoTransaction(async (session) => {
      const appliedAdjustments = [];
      try {
        const poQuery = PurchaseOrderModel.findById(id);
        if (session) {
          poQuery.session(session);
        }
        const po = await poQuery;

        if (!po) {
          const notFoundError = new Error("Purchase order not found");
          notFoundError.statusCode = 404;
          throw notFoundError;
        }

        const normalizedItems = Array.isArray(items) ? items : [];
        const inventoryAdjustments = [];
        const consumedLineIndexes = new Set();

        normalizedItems.forEach((item, payloadIndex) => {
          const productId = String(item.productId || item._id || item.id || "").trim();
          if (!productId) return;
          const receivedNow = Math.max(Number(item.receivedQuantity || 0), 0);
          if (!receivedNow) return;

          const requestedLineIndex = Number(item.lineIndex);
          const payloadPacking = normalizePackingKey(item.packing || item.packSize || "");
          const payloadVariantId = String(item.variantId || "").trim();
          let matchedIndex = -1;
          let line = null;

          if (
            Number.isInteger(requestedLineIndex) &&
            requestedLineIndex >= 0 &&
            requestedLineIndex < po.items.length
          ) {
            const requestedLine = po.items[requestedLineIndex];
            if (requestedLine && String(requestedLine.productId || "") === productId) {
              matchedIndex = requestedLineIndex;
              line = requestedLine;
            }
          }

          if (!line) {
            matchedIndex = po.items.findIndex((poItem, idx) => {
              if (consumedLineIndexes.has(idx)) return false;
              if (String(poItem.productId || "") !== productId) return false;

              const poVariantId = String(poItem.variantId || "").trim();
              if (payloadVariantId && poVariantId) {
                return payloadVariantId === poVariantId;
              }

              const poPacking = normalizePackingKey(poItem.packing || "");
              if (payloadPacking && poPacking) {
                return payloadPacking === poPacking;
              }

              return true;
            });

            if (matchedIndex >= 0) {
              line = po.items[matchedIndex];
            }
          }

          if (!line || matchedIndex < 0) return;
          consumedLineIndexes.add(matchedIndex);

          const orderedQty = Math.max(Number(line.quantity || 0), 0);
          const currentReceived = Math.max(Number(line.receivedQuantity || 0), 0);
          const nextReceived = Math.min(orderedQty, currentReceived + receivedNow);
          const incrementBy = Math.max(nextReceived - currentReceived, 0);
          line.receivedQuantity = nextReceived;
          line.qty_received = nextReceived;
          if (incrementBy > 0) {
            inventoryAdjustments.push({
              productId,
              quantity: incrementBy,
              lineIndex: matchedIndex,
              payloadIndex,
              packing: String(line.packing || item.packing || "").trim(),
              variantId: String(line.variantId || item.variantId || "").trim() || null,
              variantName: String(line.variantName || item.variantName || "").trim(),
            });
          }
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

        for (const adjustment of inventoryAdjustments) {
          const productQuery = ProductModel.findById(adjustment.productId)
            .select(
              [
                "track_inventory",
                "trackInventory",
                "hasVariants",
                "stock",
                "stock_quantity",
                "reserved_quantity",
                "low_stock_threshold",
                "variants._id",
                "variants.name",
                "variants.weight",
                "variants.unit",
                "variants.stock",
                "variants.stock_quantity",
                "variants.reserved_quantity",
              ].join(" "),
            )
            .lean();
          if (session) {
            productQuery.session(session);
          }
          const product = await productQuery;
          if (!product) continue;

          const trackInventory =
            typeof product.track_inventory === "boolean"
              ? product.track_inventory
              : typeof product.trackInventory === "boolean"
                ? product.trackInventory
                : true;

          if (!trackInventory) continue;

          const resolvedVariantId = resolvePreferredVariantIdForProduct({
            product,
            variantId: adjustment.variantId,
            variantName: adjustment.variantName,
            packing: adjustment.packing,
          });
          const hasVariantOptions =
            Array.isArray(product?.variants) && product.variants.length > 0;
          if (hasVariantOptions && !resolvedVariantId) {
            throw new Error(
              `Unable to resolve variant for received item (${adjustment.productId})`,
            );
          }

          const resolvedVariant = resolvedVariantId
            ? (product.variants || []).find(
                (variant) =>
                  String(variant?._id || "") === String(resolvedVariantId),
              )
            : null;
          const resolvedPacking = String(
            adjustment.packing ||
              buildPackingFromWeightAndUnit(
                resolvedVariant?.weight,
                resolvedVariant?.unit,
              ) ||
              adjustment.variantName ||
              resolvedVariant?.name ||
              "",
          ).trim();
          const resolvedVariantName = String(
            adjustment.variantName ||
              resolvedVariant?.name ||
              resolvedPacking ||
              "",
          ).trim();

          if (
            resolvedVariantId &&
            Number.isInteger(Number(adjustment.lineIndex)) &&
            po.items?.[Number(adjustment.lineIndex)]
          ) {
            const line = po.items[Number(adjustment.lineIndex)];
            line.variantId = resolvedVariantId;
            line.variantName = resolvedVariantName;
            line.packing = resolvedPacking;
          }

          if (resolvedVariantId) {
            const updateResult = await ProductModel.updateOne(
              { _id: adjustment.productId, "variants._id": resolvedVariantId },
              {
                $inc: {
                  "variants.$.stock_quantity": Number(adjustment.quantity || 0),
                  "variants.$.stock": Number(adjustment.quantity || 0),
                },
              },
              session ? { session } : undefined,
            );
            if (updateResult.modifiedCount !== 1) {
              throw new Error(
                `Failed to update variant stock for received item (${adjustment.productId})`,
              );
            }
            await syncParentStockFromVariants(adjustment.productId, session);
            appliedAdjustments.push({
              ...adjustment,
              variantId: resolvedVariantId,
            });
          } else {
            const updateResult = await ProductModel.updateOne(
              { _id: adjustment.productId },
              {
                $inc: {
                  stock_quantity: Number(adjustment.quantity || 0),
                  stock: Number(adjustment.quantity || 0),
                },
              },
              session ? { session } : undefined,
            );
            if (updateResult.modifiedCount !== 1) {
              throw new Error(
                `Failed to update stock for received item (${adjustment.productId})`,
              );
            }
            appliedAdjustments.push(adjustment);
          }

          const productAfterQuery = ProductModel.findById(adjustment.productId)
            .select(
              "stock stock_quantity reserved_quantity low_stock_threshold variants",
            )
            .lean();
          if (session) {
            productAfterQuery.session(session);
          }
          const productAfter = await productAfterQuery;

          const auditBefore = resolvedVariantId
            ? (product.variants || []).find(
                (variant) =>
                  String(variant?._id || "") === String(resolvedVariantId),
              ) || {}
            : product;
          const auditAfter = resolvedVariantId
            ? (productAfter?.variants || []).find(
                (variant) =>
                  String(variant?._id || "") === String(resolvedVariantId),
              ) || {}
            : productAfter;

          await logInventoryAudit({
            productId: adjustment.productId,
            variantId: resolvedVariantId || null,
            action: "PO_RECEIVE",
            quantity: Number(adjustment.quantity || 0),
            before: {
              stock_quantity: Number(
                auditBefore?.stock_quantity ?? auditBefore?.stock ?? 0,
              ),
              reserved_quantity: Number(auditBefore?.reserved_quantity ?? 0),
            },
            after: {
              stock_quantity: Number(
                auditAfter?.stock_quantity ?? auditAfter?.stock ?? 0,
              ),
              reserved_quantity: Number(auditAfter?.reserved_quantity ?? 0),
            },
            source: "PO",
            referenceId: String(po._id || ""),
            session,
          });
        }

        if (appliedAdjustments.length > 0) {
          po.inventory_applied = true;
          po.receivedAt = new Date();
          if (req.user) {
            po.receivedBy = req.user?._id || req.user?.id || req.user;
          }
        }

        await po.save(session ? { session } : undefined);

        return normalizePurchaseOrderTotals(po.toObject ? po.toObject() : po);
      } catch (error) {
        if (!session && appliedAdjustments.length) {
          for (const adjustment of appliedAdjustments) {
            if (adjustment.variantId) {
              await ProductModel.updateOne(
                {
                  _id: adjustment.productId,
                  "variants._id": adjustment.variantId,
                },
                {
                  $inc: {
                    "variants.$.stock_quantity": -Number(adjustment.quantity || 0),
                    "variants.$.stock": -Number(adjustment.quantity || 0),
                  },
                },
              ).catch(() => {});
              await syncParentStockFromVariants(adjustment.productId).catch(
                () => {},
              );
              continue;
            }
            await ProductModel.updateOne(
              { _id: adjustment.productId },
              {
                $inc: {
                  stock_quantity: -Number(adjustment.quantity || 0),
                  stock: -Number(adjustment.quantity || 0),
                },
              },
            ).catch(() => {});
          }
        }
        throw error;
      }
    });

    return res.status(200).json({
      error: false,
      success: true,
      message: "Receipt details updated",
      data: normalizedPo,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) === 404 ? 404 : 500;
    return res.status(statusCode).json({
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

    const purchaseOrderProductIds = extractPurchaseOrderProductIds(po.items);
    await ensureExclusiveAccessForProducts({
      productIds: purchaseOrderProductIds,
      userId,
      isAdmin,
    });

    const computedPoTotals = computePurchaseOrderTotals({
      items: po.items || [],
      gstRate: Number(po.gst?.rate || 5),
      state: String(po.gst?.state || po.guestDetails?.state || ""),
    });

    const order = new OrderModel({
      user: po.userId || userId || null,
      products: po.items.map((item) => ({
        productId: String(item.productId),
        productTitle: item.productTitle,
        variantId: item.variantId ? String(item.variantId) : null,
        variantName: String(item.variantName || "").trim(),
        quantity: item.quantity,
        price: item.price,
        image: item.image,
        subTotal: item.subTotal,
      })),
      subtotal: round2(computedPoTotals.subtotal),
      totalAmt: round2(computedPoTotals.total),
      finalAmount: round2(computedPoTotals.total),
      tax: round2(computedPoTotals.tax),
      shipping: round2(computedPoTotals.shipping),
      gst: {
        rate: Number(computedPoTotals.gst?.rate || 5),
        state: String(computedPoTotals.gst?.state || po.guestDetails?.state || ""),
        taxableAmount: round2(computedPoTotals.gst?.taxableAmount ?? computedPoTotals.subtotal),
        cgst: round2(computedPoTotals.gst?.cgst ?? 0),
        sgst: round2(computedPoTotals.gst?.sgst ?? 0),
        igst: round2(computedPoTotals.gst?.igst ?? computedPoTotals.tax),
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

    po.subtotal = round2(computedPoTotals.subtotal);
    po.tax = round2(computedPoTotals.tax);
    po.shipping = round2(computedPoTotals.shipping);
    po.total = round2(computedPoTotals.total);
    po.gst = {
      ...(po.gst || {}),
      ...computedPoTotals.gst,
    };
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
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({
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
        data: {
          purchaseOrder: normalizePurchaseOrderTotals(
            result.purchaseOrder?.toObject
              ? result.purchaseOrder.toObject()
              : result.purchaseOrder,
          ),
        },
      });
    }

    po.status = normalizedStatus;
    await po.save();
    return res.status(200).json({
      error: false,
      success: true,
      message: "Purchase order status updated",
      data: {
        purchaseOrder: normalizePurchaseOrderTotals(
          po.toObject ? po.toObject() : po,
        ),
      },
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
