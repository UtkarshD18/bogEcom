import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";
import { getOrderDisplayId } from "./orderPresentation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, "..");
const INVOICE_DIR = path.join(SERVER_ROOT, "invoices");

const DEFAULT_HSN = process.env.INVOICE_DEFAULT_HSN || "2106";
const DEFAULT_TAX_RATE = Number(process.env.INVOICE_DEFAULT_GST_RATE || 5);

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeState = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeStateCode = (value) => {
  const cleaned = String(value || "").replace(/\D/g, "");
  return cleaned ? cleaned.padStart(2, "0") : "";
};

const ensureInvoiceDirectory = async () => {
  await fsPromises.mkdir(INVOICE_DIR, { recursive: true });
};

const fileExists = async (filePath) => {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const resolveInvoiceLogoPath = () => {
  const candidates = [
    path.join(SERVER_ROOT, "assets", "logo.png"),
    path.join(SERVER_ROOT, "..", "frontend", "client", "public", "logo.png"),
    path.join(SERVER_ROOT, "..", "frontend", "client", "public", "logo.svg"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore invalid paths
    }
  }
  return null;
};

const buildInvoiceNumber = (order) => {
  if (order?.invoiceNumber) return order.invoiceNumber;

  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const suffix = String(order?._id || "")
    .slice(-6)
    .toUpperCase();
  return `INV-${yyyy}${mm}${dd}-${suffix}`;
};

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatAmount = (amount, currencySymbol) =>
  `${currencySymbol}${roundMoney(amount).toFixed(2)}`;

const allocateByWeight = (total, weights) => {
  const safeTotal = roundMoney(total);
  const sumWeights = weights.reduce((sum, w) => sum + Math.max(Number(w || 0), 0), 0);
  if (safeTotal <= 0 || sumWeights <= 0 || weights.length === 0) {
    return weights.map(() => 0);
  }

  let running = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      return roundMoney(safeTotal - running);
    }
    const allocated = roundMoney((safeTotal * Math.max(Number(weight || 0), 0)) / sumWeights);
    running = roundMoney(running + allocated);
    return allocated;
  });
};

const getProductMeta = (productMetaById, productId) => {
  const key = String(productId || "");
  return productMetaById?.[key] || {};
};

const buildAddressLines = (address) => {
  if (!address) return ["Address not available"];

  const lines = [
    address.name || address.fullName,
    address.address_line1 || address.address,
    address.landmark,
    [address.city, address.state].filter(Boolean).join(", "),
    [address.country, address.pincode || address.pinCode].filter(Boolean).join(" - "),
    (address.mobile || address.phone)
      ? `Phone: ${address.mobile || address.phone}`
      : "",
    address.email ? `Email: ${address.email}` : "",
  ]
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : ["Address not available"];
};

const resolveBuyerAddress = (order) => {
  const deliveryAddress = order?.delivery_address;
  if (deliveryAddress) {
    return {
      name: deliveryAddress.name || "",
      address_line1: deliveryAddress.address_line1 || deliveryAddress.addressLine1 || "",
      landmark: deliveryAddress.landmark || "",
      city: deliveryAddress.city || "",
      state: deliveryAddress.state || "",
      country: deliveryAddress.country || "India",
      pincode: deliveryAddress.pincode || deliveryAddress.pinCode || "",
      mobile: deliveryAddress.mobile || "",
      email: order?.billingDetails?.email || order?.guestDetails?.email || "",
    };
  }

  if (order?.billingDetails && Object.values(order.billingDetails).some(Boolean)) {
    return {
      name: order.billingDetails.fullName || "",
      address_line1: order.billingDetails.address || "",
      state: order.billingDetails.state || "",
      pincode: order.billingDetails.pincode || "",
      mobile: order.billingDetails.phone || "",
      email: order.billingDetails.email || "",
      country: "India",
      city: "",
      landmark: "",
    };
  }

  if (order?.guestDetails && Object.values(order.guestDetails).some(Boolean)) {
    return {
      name: order.guestDetails.fullName || "",
      address_line1: order.guestDetails.address || "",
      state: order.guestDetails.state || "",
      pincode: order.guestDetails.pincode || "",
      mobile: order.guestDetails.phone || "",
      email: order.guestDetails.email || "",
      country: "India",
      city: "",
      landmark: "",
    };
  }

  return null;
};

const resolveConsigneeAddress = (order) => {
  const deliveryAddress = order?.delivery_address;
  if (deliveryAddress) {
    return {
      name: deliveryAddress.name || "",
      address_line1: deliveryAddress.address_line1 || deliveryAddress.addressLine1 || "",
      landmark: deliveryAddress.landmark || "",
      city: deliveryAddress.city || "",
      state: deliveryAddress.state || "",
      country: deliveryAddress.country || "India",
      pincode: deliveryAddress.pincode || deliveryAddress.pinCode || "",
      mobile: deliveryAddress.mobile || "",
      email: order?.billingDetails?.email || order?.guestDetails?.email || "",
    };
  }

  return resolveBuyerAddress(order);
};

const formatPartyLines = (address, stateCode) => {
  if (!address) return ["Address not available"];
  const lines = [
    address.name || address.fullName || "",
    address.address_line1 || address.address || "",
    address.landmark || "",
    [address.city, address.state].filter(Boolean).join(", "),
    [address.pincode || address.pinCode, address.country].filter(Boolean).join(" "),
    address.state
      ? `State Name: ${address.state}${stateCode ? `, Code: ${stateCode}` : ""}`
      : "",
    address.mobile || address.phone
      ? `Contact: ${address.mobile || address.phone}`
      : "",
  ]
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : ["Address not available"];
};

const drawSectionTitle = (doc, text, y) => {
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(text, 40, y, { align: "left" });
  return y + 14;
};

const drawMetadataRow = (doc, labelLeft, valueLeft, labelRight, valueRight, y) => {
  doc.font("Helvetica-Bold").fontSize(9).text(labelLeft, 40, y);
  doc.font("Helvetica").fontSize(9).text(valueLeft, 130, y);

  doc.font("Helvetica-Bold").fontSize(9).text(labelRight, 320, y);
  doc.font("Helvetica").fontSize(9).text(valueRight, 430, y, { width: 130 });

  return y + 14;
};

const drawTableHeader = (doc, x, y, tableWidth) => {
  const widths = {
    sl: 18,
    description: 180,
    hsn: 45,
    qty: 35,
    gross: 55,
    discount: 45,
    taxable: 55,
    gst: 55,
    amount: 47,
  };

  const cols = {};
  let cursor = x;
  Object.entries(widths).forEach(([key, width]) => {
    cols[key] = cursor;
    cursor += width;
  });

  const headerHeight = 20;
  doc.rect(x, y, tableWidth, headerHeight).fillAndStroke("#f3f4f6", "#111827");
  Object.values(cols)
    .slice(1)
    .forEach((colX) => {
      doc.moveTo(colX, y).lineTo(colX, y + headerHeight).stroke("#111827");
    });

  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8);
  doc.text("Sl", cols.sl + 2, y + 6, { width: widths.sl - 4 });
  doc.text("Description of Goods", cols.description + 2, y + 4, {
    width: widths.description - 4,
  });
  doc.text("HSN", cols.hsn + 2, y + 6, { width: widths.hsn - 4 });
  doc.text("Qty", cols.qty + 2, y + 6, { width: widths.qty - 4 });
  doc.text("Gross", cols.gross + 2, y + 6, { width: widths.gross - 4 });
  doc.text("Discount", cols.discount + 2, y + 4, { width: widths.discount - 4 });
  doc.text("Taxable", cols.taxable + 2, y + 4, { width: widths.taxable - 4 });
  doc.text("GST", cols.gst + 2, y + 6, { width: widths.gst - 4 });
  doc.text("Amount", cols.amount + 2, y + 6, { width: widths.amount - 4 });
  doc.fillColor("black");

  return { y: y + headerHeight, cols, widths, headerHeight };
};

const drawTableRow = (doc, item, cols, widths, y, currencySymbol, index) => {
  const rowHeight = 24;
  const tableWidth = Object.values(widths).reduce((sum, width) => sum + width, 0);

  doc.rect(cols.sl, y, tableWidth, rowHeight).stroke("#111827");
  Object.values(cols)
    .slice(1)
    .forEach((colX) => {
      doc.moveTo(colX, y).lineTo(colX, y + rowHeight).stroke("#111827");
    });

  doc.font("Helvetica").fontSize(8).fillColor("#111827");
  doc.text(String(index + 1), cols.sl + 2, y + 6, { width: widths.sl - 4 });
  doc.text(item.description, cols.description + 2, y + 4, {
    width: widths.description - 6,
  });
  if (item.variantName) {
    doc.fontSize(7).fillColor("#6b7280");
    doc.text(item.variantName, cols.description + 2, y + 13, {
      width: widths.description - 6,
    });
    doc.fontSize(8).fillColor("#111827");
  }
  doc.text(item.hsn, cols.hsn + 2, y + 6, { width: widths.hsn - 4 });
  doc.text(
    `${item.quantity}${item.unitLabel ? ` ${item.unitLabel}` : ""}`,
    cols.qty + 2,
    y + 6,
    { width: widths.qty - 4 },
  );
  doc.text(formatAmount(item.gross, currencySymbol), cols.gross + 2, y + 6, {
    width: widths.gross - 4,
  });
  doc.text(formatAmount(item.discount, currencySymbol), cols.discount + 2, y + 6, {
    width: widths.discount - 4,
  });
  doc.text(formatAmount(item.taxable, currencySymbol), cols.taxable + 2, y + 6, {
    width: widths.taxable - 4,
  });

  const gstLabel = item.isInterState
    ? `I:${formatAmount(item.igst, currencySymbol)}`
    : `C:${formatAmount(item.cgst, currencySymbol)} S:${formatAmount(
        item.sgst,
        currencySymbol,
      )}`;
  doc.text(gstLabel, cols.gst + 2, y + 6, { width: widths.gst - 4 });
  doc.text(formatAmount(item.total, currencySymbol), cols.amount + 2, y + 6, {
    width: widths.amount - 4,
    align: "right",
  });

  return y + rowHeight;
};

const drawSummaryRow = (
  doc,
  label,
  value,
  x,
  y,
  currencySymbol,
  bold = false,
  labelWidth = 120,
  valueWidth = 70,
) => {
  doc
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(9)
    .text(label, x, y, { width: labelWidth });
  doc
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(9)
    .text(formatAmount(value, currencySymbol), x + labelWidth + 4, y, {
      width: valueWidth,
      align: "right",
    });
  return y + 14;
};

const drawKeyValueTable = (doc, x, y, width, height, rows) => {
  if (!rows || rows.length === 0) return;
  const rowHeight = height / rows.length;
  const splitX = x + Math.round(width * 0.48);

  doc.rect(x, y, width, height).stroke("#111827");
  doc.moveTo(splitX, y).lineTo(splitX, y + height).stroke("#111827");

  rows.forEach((row, index) => {
    const rowY = y + rowHeight * index;
    if (index > 0) {
      doc.moveTo(x, rowY).lineTo(x + width, rowY).stroke("#111827");
    }
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827");
    doc.text(String(row.label || ""), x + 4, rowY + 4, {
      width: splitX - x - 8,
    });
    doc.font("Helvetica").fontSize(8).fillColor("#111827");
    doc.text(String(row.value || "-"), splitX + 4, rowY + 4, {
      width: x + width - splitX - 8,
    });
  });
};

const drawHsnSummaryTable = (doc, x, y, width, rows, currencySymbol) => {
  if (!rows || rows.length === 0) return y;
  const headerHeight = 18;
  const rowHeight = 16;
  const columns = {
    hsn: 70,
    taxable: 90,
    rate: 50,
    igst: 70,
    cgst: 70,
    sgst: 70,
    totalTax: 85,
  };

  const cols = {};
  let cursor = x;
  Object.entries(columns).forEach(([key, widthValue]) => {
    cols[key] = cursor;
    cursor += widthValue;
  });

  doc.rect(x, y, width, headerHeight).fillAndStroke("#f9fafb", "#111827");
  Object.values(cols)
    .slice(1)
    .forEach((colX) => {
      doc.moveTo(colX, y).lineTo(colX, y + headerHeight).stroke("#111827");
    });
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827");
  doc.text("HSN/SAC", cols.hsn + 2, y + 5, { width: columns.hsn - 4 });
  doc.text("Taxable", cols.taxable + 2, y + 5, { width: columns.taxable - 4 });
  doc.text("Rate", cols.rate + 2, y + 5, { width: columns.rate - 4 });
  doc.text("IGST", cols.igst + 2, y + 5, { width: columns.igst - 4 });
  doc.text("CGST", cols.cgst + 2, y + 5, { width: columns.cgst - 4 });
  doc.text("SGST", cols.sgst + 2, y + 5, { width: columns.sgst - 4 });
  doc.text("Total Tax", cols.totalTax + 2, y + 5, {
    width: columns.totalTax - 4,
  });

  let currentY = y + headerHeight;
  rows.forEach((row) => {
    doc.rect(x, currentY, width, rowHeight).stroke("#111827");
    Object.values(cols)
      .slice(1)
      .forEach((colX) => {
        doc.moveTo(colX, currentY).lineTo(colX, currentY + rowHeight).stroke("#111827");
      });
    doc.font("Helvetica").fontSize(8).fillColor("#111827");
    doc.text(String(row.hsn), cols.hsn + 2, currentY + 4, { width: columns.hsn - 4 });
    doc.text(formatAmount(row.taxable, currencySymbol), cols.taxable + 2, currentY + 4, {
      width: columns.taxable - 4,
    });
    doc.text(`${Number(row.taxRate || 0).toFixed(2)}%`, cols.rate + 2, currentY + 4, {
      width: columns.rate - 4,
    });
    doc.text(formatAmount(row.igst, currencySymbol), cols.igst + 2, currentY + 4, {
      width: columns.igst - 4,
    });
    doc.text(formatAmount(row.cgst, currencySymbol), cols.cgst + 2, currentY + 4, {
      width: columns.cgst - 4,
    });
    doc.text(formatAmount(row.sgst, currencySymbol), cols.sgst + 2, currentY + 4, {
      width: columns.sgst - 4,
    });
    doc.text(
      formatAmount(row.igst + row.cgst + row.sgst, currencySymbol),
      cols.totalTax + 2,
      currentY + 4,
      { width: columns.totalTax - 4 },
    );
    currentY += rowHeight;
  });

  return currentY;
};

const resolveSellerDetails = (sellerDetails = {}) => {
  const fallbackAddress = [
    process.env.INVOICE_SELLER_ADDRESS_LINE1 || "",
    process.env.INVOICE_SELLER_ADDRESS_LINE2 || "",
    process.env.INVOICE_SELLER_CITY || "",
    process.env.INVOICE_SELLER_STATE || "",
    process.env.INVOICE_SELLER_PINCODE || "",
  ]
    .filter(Boolean)
    .join(", ");

  return {
    name: sellerDetails.name || process.env.INVOICE_SELLER_NAME || "BuyOneGram",
    gstin: sellerDetails.gstin || process.env.INVOICE_SELLER_GSTIN || "",
    address: sellerDetails.address || fallbackAddress || "Address not configured",
    state: sellerDetails.state || process.env.INVOICE_SELLER_STATE || "",
    phone: sellerDetails.phone || process.env.INVOICE_SELLER_PHONE || "",
    email: sellerDetails.email || process.env.INVOICE_SELLER_EMAIL || "",
    currencySymbol: sellerDetails.currencySymbol || process.env.INVOICE_CURRENCY_SYMBOL || "Rs. ",
    placeOfSupplyStateCode:
      sellerDetails.placeOfSupplyStateCode || process.env.INVOICE_SELLER_STATE_CODE || "",
  };
};

const prepareInvoiceData = (order, sellerDetails, productMetaById = {}) => {
  const seller = resolveSellerDetails(sellerDetails);
  const buyerAddress = resolveBuyerAddress(order);
  const consigneeAddress = resolveConsigneeAddress(order);
  const sellerState = normalizeState(seller.state);
  const buyerState = normalizeState(buyerAddress?.state);
  const sellerStateCode = normalizeStateCode(seller.placeOfSupplyStateCode);
  const buyerStateCode = normalizeStateCode(
    buyerAddress?.stateCode || buyerAddress?.state_code || "",
  );
  const isInterState = sellerStateCode && buyerStateCode
    ? sellerStateCode !== buyerStateCode
    : sellerState && buyerState
      ? sellerState !== buyerState
      : true;
  const gstRate = Number(order?.gst?.rate || DEFAULT_TAX_RATE);

  const products = Array.isArray(order?.products) ? order.products : [];
  const grossSubtotal = roundMoney(
    products.reduce(
      (sum, item) =>
        sum +
        Number(
          item?.subTotal ||
            Number(item?.price || 0) * Number(item?.quantity || 0),
        ),
      0,
    ),
  );

  const shippingTotal = roundMoney(Number(order?.shipping || 0));

  // totalAmt is authoritative (includes GST + shipping).
  const storedGrandTotal = roundMoney(
    Number(order?.totalAmt || order?.finalAmount || 0),
  );
  const grandTotal =
    storedGrandTotal > 0
      ? storedGrandTotal
      : roundMoney(Math.max(grossSubtotal, 0) + shippingTotal);

  const netInclusiveSubtotal = roundMoney(
    Math.max(grandTotal - shippingTotal, 0),
  );

  // Derive discount so coins/coupons reconcile even if stored fields differ.
  const totalDiscount = roundMoney(
    Math.max(grossSubtotal - netInclusiveSubtotal, 0),
  );

  const storedTaxTotal = roundMoney(Number(order?.tax || 0));
  const taxTotal =
    storedTaxTotal > 0
      ? storedTaxTotal
      : gstRate > 0
        ? roundMoney(
            netInclusiveSubtotal -
              netInclusiveSubtotal / (1 + gstRate / 100),
          )
        : 0;

  const taxableTotal = roundMoney(Math.max(netInclusiveSubtotal - taxTotal, 0));

  const weights = products.map((item) => Number(item?.subTotal || 0));
  const discountAlloc = allocateByWeight(totalDiscount, weights);
  const taxAlloc = allocateByWeight(taxTotal, weights);

  const lineItems = products.map((item, index) => {
    const gross = roundMoney(
      item?.subTotal ||
        Number(item?.price || 0) * Number(item?.quantity || 0),
    );
    const discount = discountAlloc[index] || 0;
    const grossAfterDiscount = roundMoney(Math.max(gross - discount, 0));
    const lineTax = taxAlloc[index] || 0;
    const meta = getProductMeta(productMetaById, item?.productId);
    const lineTaxRate = Number(meta?.taxRate || gstRate || 0);
    const hsn = String(meta?.hsn || DEFAULT_HSN);
    const unitLabel = meta?.unit || "Nos";
    const rate = roundMoney(
      Number(item?.price || 0) || (Number(item?.quantity || 0) ? gross / Number(item.quantity) : gross),
    );

    const igst = isInterState ? lineTax : 0;
    const cgst = isInterState ? 0 : roundMoney(lineTax / 2);
    const sgst = isInterState ? 0 : roundMoney(lineTax - cgst);

    return {
      description: item?.productTitle || "Product",
      variantName: item?.variantName || "",
      hsn,
      quantity: Number(item?.quantity || 1),
      rate,
      unitLabel,
      gross,
      discount,
      taxable: roundMoney(Math.max(grossAfterDiscount - lineTax, 0)),
      taxRate: lineTaxRate,
      igst,
      cgst,
      sgst,
      total: grossAfterDiscount,
      isInterState,
    };
  });

  const halfTax = roundMoney(taxTotal / 2);
  const taxBreakup = {
    igst: isInterState ? taxTotal : 0,
    cgst: isInterState ? 0 : halfTax,
    sgst: isInterState ? 0 : roundMoney(taxTotal - halfTax),
  };

  const hsnSummaryMap = {};
  lineItems.forEach((item) => {
    const key = item.hsn || DEFAULT_HSN;
    if (!hsnSummaryMap[key]) {
      hsnSummaryMap[key] = {
        hsn: key,
        taxable: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        taxRate: item.taxRate,
      };
    }
    hsnSummaryMap[key].taxable = roundMoney(
      hsnSummaryMap[key].taxable + item.taxable,
    );
    hsnSummaryMap[key].igst = roundMoney(hsnSummaryMap[key].igst + item.igst);
    hsnSummaryMap[key].cgst = roundMoney(hsnSummaryMap[key].cgst + item.cgst);
    hsnSummaryMap[key].sgst = roundMoney(hsnSummaryMap[key].sgst + item.sgst);
  });
  const hsnSummary = Object.values(hsnSummaryMap);

  return {
    seller,
    buyerAddress,
    consigneeAddress,
    sellerStateCode,
    buyerStateCode,
    buyerGstNumber: String(order?.gstNumber || "").trim(),
    billingName:
      order?.user?.name ||
      buyerAddress?.name ||
      "Guest Customer",
    orderDate: order?.createdAt,
    invoiceDate: new Date(),
    placeOfSupply: buyerAddress?.state || "N/A",
    lineItems,
    summary: {
      grossSubtotal,
      totalDiscount,
      taxableTotal,
      shippingTotal,
      grandTotal,
    },
    taxBreakup,
    hsnSummary,
  };
};

export const getInvoiceFileName = (orderId) => `invoice_${orderId}.pdf`;

export const getInvoiceRelativePath = (orderId) =>
  path.posix.join("invoices", getInvoiceFileName(orderId));

export const getInvoiceAbsolutePath = (orderId) =>
  path.join(INVOICE_DIR, getInvoiceFileName(orderId));

export const getAbsolutePathFromStoredInvoicePath = (invoicePath) => {
  if (!invoicePath) return null;
  if (path.isAbsolute(invoicePath)) return invoicePath;
  return path.join(SERVER_ROOT, invoicePath);
};

export const generateInvoicePdf = async ({
  order,
  sellerDetails,
  productMetaById = {},
  forceRegenerate = false,
}) => {
  if (!order?._id) {
    throw new Error("Order is required for invoice generation");
  }

  await ensureInvoiceDirectory();

  const absolutePath = getInvoiceAbsolutePath(order._id);
  const relativePath = getInvoiceRelativePath(order._id);
  const invoiceNumber = buildInvoiceNumber(order);

  if (!forceRegenerate && (await fileExists(absolutePath))) {
    return {
      invoiceNumber,
      invoicePath: relativePath,
      invoiceGeneratedAt: order?.invoiceGeneratedAt || new Date(),
      absolutePath,
    };
  }

  const invoiceData = prepareInvoiceData(order, sellerDetails, productMetaById);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(absolutePath);

    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);

    doc.pipe(stream);

    const margin = 30;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - margin * 2;
    let y = margin + 4;
    const {
      seller,
      buyerAddress,
      consigneeAddress,
      sellerStateCode,
      buyerStateCode,
      buyerGstNumber,
      billingName,
      orderDate,
      invoiceDate,
      hsnSummary,
    } = invoiceData;
    const { lineItems, summary, taxBreakup } = invoiceData;
    const currencySymbol = seller.currencySymbol || "Rs. ";
    const logoPath = resolveInvoiceLogoPath();

    doc.rect(margin, margin, contentWidth, pageHeight - margin * 2).stroke("#111827");

    doc.font("Helvetica-Bold").fontSize(12).text("Tax Invoice", margin, y, {
      width: contentWidth,
      align: "center",
    });
    doc.font("Helvetica").fontSize(9).text("(ORIGINAL FOR RECIPIENT)", margin, y, {
      width: contentWidth,
      align: "right",
    });
    y += 18;

    const leftWidth = Math.round(contentWidth * 0.62);
    const rightWidth = contentWidth - leftWidth;
    const sellerHeight = 100;
    const consigneeHeight = 85;
    const buyerHeight = 85;
    const rightHeight = sellerHeight + consigneeHeight + buyerHeight;
    const leftX = margin;
    const rightX = margin + leftWidth;

    doc.rect(leftX, y, leftWidth, sellerHeight).stroke("#111827");
    doc.rect(leftX, y + sellerHeight, leftWidth, consigneeHeight).stroke("#111827");
    doc.rect(leftX, y + sellerHeight + consigneeHeight, leftWidth, buyerHeight).stroke("#111827");
    doc.rect(rightX, y, rightWidth, rightHeight).stroke("#111827");

    const sellerTextX = logoPath ? leftX + 50 : leftX + 8;
    if (logoPath) {
      try {
        doc.image(logoPath, leftX + 8, y + 8, { fit: [34, 34] });
      } catch {
        // ignore logo rendering errors
      }
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#111827")
      .text(String(seller.name || "BuyOneGram").toUpperCase(), sellerTextX, y + 8, {
        width: leftWidth - (sellerTextX - leftX) - 8,
      });

    const sellerAddressLines = String(seller.address || "")
      .split(",")
      .map((line) => line.trim())
      .filter(Boolean);
    let sellerInfoY = y + 22;
    sellerAddressLines.forEach((line) => {
      doc
        .font("Helvetica")
        .fontSize(8)
        .text(line, sellerTextX, sellerInfoY, {
          width: leftWidth - (sellerTextX - leftX) - 8,
        });
      sellerInfoY += 11;
    });

    if (seller.gstin) {
      doc.text(`GSTIN/UIN: ${seller.gstin}`, sellerTextX, sellerInfoY);
      sellerInfoY += 11;
    }
    if (seller.state) {
      doc.text(
        `State Name: ${seller.state}${sellerStateCode ? `, Code: ${sellerStateCode}` : ""}`,
        sellerTextX,
        sellerInfoY,
      );
      sellerInfoY += 11;
    }
    if (seller.phone) {
      doc.text(`Contact: ${seller.phone}`, sellerTextX, sellerInfoY);
      sellerInfoY += 11;
    }
    if (seller.email) {
      doc.text(`E-Mail: ${seller.email}`, sellerTextX, sellerInfoY);
    }

    const consigneeStateCode =
      normalizeStateCode(consigneeAddress?.stateCode || "") || buyerStateCode;
    doc.font("Helvetica-Bold").fontSize(9).text("Consignee (Ship to)", leftX + 6, y + sellerHeight + 4);
    let consigneeY = y + sellerHeight + 18;
    const consigneeLines = formatPartyLines(consigneeAddress, consigneeStateCode);
    consigneeLines.forEach((line) => {
      doc.font("Helvetica").fontSize(8).text(line, leftX + 6, consigneeY, {
        width: leftWidth - 12,
      });
      consigneeY += 11;
    });

    const buyerDetails = {
      ...buyerAddress,
      name: billingName || buyerAddress?.name,
    };
    doc.font("Helvetica-Bold").fontSize(9).text("Buyer (Bill to)", leftX + 6, y + sellerHeight + consigneeHeight + 4);
    let buyerY = y + sellerHeight + consigneeHeight + 18;
    const buyerLines = formatPartyLines(buyerDetails, buyerStateCode);
    buyerLines.forEach((line) => {
      doc.font("Helvetica").fontSize(8).text(line, leftX + 6, buyerY, {
        width: leftWidth - 12,
      });
      buyerY += 11;
    });
    if (buyerGstNumber) {
      doc.font("Helvetica").fontSize(8).text(`GSTIN: ${buyerGstNumber}`, leftX + 6, buyerY);
      buyerY += 11;
    }

    const destination = [consigneeAddress?.city, consigneeAddress?.state]
      .filter(Boolean)
      .join(", ");
    const canonicalDisplayOrderId = getOrderDisplayId(order);
    const buyerOrderNumber =
      (canonicalDisplayOrderId && `#${canonicalDisplayOrderId}`) ||
      order?.orderNumber ||
      order?.order_id ||
      order?.orderId ||
      String(order._id);
    const metaRows = [
      { label: "Invoice No.", value: invoiceNumber },
      { label: "Dated", value: formatDate(invoiceDate) },
      { label: "Delivery Note", value: order?.deliveryNote || "-" },
      {
        label: "Mode/Terms of Payment",
        value: String(order?.payment_status || order?.paymentMethod || "-").toUpperCase(),
      },
      { label: "Buyer's Order No.", value: buyerOrderNumber },
      { label: "Dated", value: formatDate(orderDate) },
      { label: "Dispatch Doc No.", value: order?.awb_number || "-" },
      {
        label: "Delivery Note Date",
        value: order?.shipment_created_at
          ? formatDate(order.shipment_created_at)
          : "-",
      },
      {
        label: "Dispatched through",
        value: order?.shipping_provider || order?.courier_name || "-",
      },
      { label: "Destination", value: destination || "-" },
      { label: "Terms of Delivery", value: order?.termsOfDelivery || "-" },
    ];
    drawKeyValueTable(doc, rightX, y, rightWidth, rightHeight, metaRows);

    y = y + rightHeight + 10;
    let header = drawTableHeader(doc, margin, y, contentWidth);
    y = header.y;
    let cols = header.cols;
    let widths = header.widths;

    for (let i = 0; i < lineItems.length; i += 1) {
      if (y + 24 > pageHeight - margin - 160) {
        doc.addPage();
        doc.rect(margin, margin, contentWidth, pageHeight - margin * 2).stroke("#111827");
        y = margin + 6;
        header = drawTableHeader(doc, margin, y, contentWidth);
        y = header.y;
        cols = header.cols;
        widths = header.widths;
      }
      y = drawTableRow(doc, lineItems[i], cols, widths, y, currencySymbol, i);
    }

    y += 10;
    const summaryX = margin + contentWidth - 200;
    y = drawSummaryRow(doc, "Gross Total", summary.grossSubtotal, summaryX, y, currencySymbol);
    y = drawSummaryRow(doc, "Discount", summary.totalDiscount, summaryX, y, currencySymbol);
    y = drawSummaryRow(doc, "Taxable Value", summary.taxableTotal, summaryX, y, currencySymbol);
    y = drawSummaryRow(doc, "IGST", taxBreakup.igst, summaryX, y, currencySymbol);
    y = drawSummaryRow(doc, "CGST", taxBreakup.cgst, summaryX, y, currencySymbol);
    y = drawSummaryRow(doc, "SGST", taxBreakup.sgst, summaryX, y, currencySymbol);
    if (Number(summary.shippingTotal || 0) > 0) {
      y = drawSummaryRow(doc, "Shipping", summary.shippingTotal, summaryX, y, currencySymbol);
    }
    y = drawSummaryRow(doc, "Grand Total", summary.grandTotal, summaryX, y, currencySymbol, true);

    if (hsnSummary?.length) {
      const hsnTableHeight = (hsnSummary.length + 1) * 16 + 18;
      if (y + hsnTableHeight > pageHeight - margin - 40) {
        doc.addPage();
        doc.rect(margin, margin, contentWidth, pageHeight - margin * 2).stroke("#111827");
        y = margin + 6;
      }
      doc.font("Helvetica-Bold").fontSize(9).text("HSN/SAC Summary", margin, y);
      y += 12;
      y = drawHsnSummaryTable(doc, margin, y, contentWidth, hsnSummary, currencySymbol);
    }

    y += 10;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#374151")
      .text(
        "This is a computer generated invoice and does not require a signature.",
        margin,
        y,
        { width: contentWidth, align: "center" },
      );

    doc.end();
  });

  return {
    invoiceNumber,
    invoicePath: relativePath,
    invoiceGeneratedAt: new Date(),
    absolutePath,
  };
};

export default {
  generateInvoicePdf,
  getInvoiceAbsolutePath,
  getInvoiceRelativePath,
  getAbsolutePathFromStoredInvoicePath,
};
