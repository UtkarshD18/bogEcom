import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";

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

const drawTableHeader = (doc, y) => {
  const cols = {
    description: 40,
    hsn: 170,
    qty: 215,
    gross: 245,
    discount: 300,
    taxable: 355,
    tax: 415,
    total: 475,
  };

  doc
    .rect(40, y, 495, 18)
    .fillAndStroke("#f3f4f6", "#d1d5db");

  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8);
  doc.text("Description", cols.description + 2, y + 5, { width: 125 });
  doc.text("HSN", cols.hsn + 2, y + 5, { width: 40 });
  doc.text("Qty", cols.qty + 2, y + 5, { width: 28 });
  doc.text("Gross", cols.gross + 2, y + 5, { width: 52 });
  doc.text("Discount", cols.discount + 2, y + 5, { width: 52 });
  doc.text("Taxable", cols.taxable + 2, y + 5, { width: 58 });
  doc.text("Tax", cols.tax + 2, y + 5, { width: 58 });
  doc.text("Total", cols.total + 2, y + 5, { width: 56 });
  doc.fillColor("black");

  return { y: y + 18, cols };
};

const drawTableRow = (doc, item, cols, y, currencySymbol) => {
  const rowHeight = 26;

  doc
    .rect(40, y, 495, rowHeight)
    .stroke("#e5e7eb");

  doc.font("Helvetica").fontSize(8).fillColor("#111827");
  doc.text(item.description, cols.description + 2, y + 4, { width: 125 });
  doc.text(item.hsn, cols.hsn + 2, y + 4, { width: 40 });
  doc.text(String(item.quantity), cols.qty + 2, y + 4, { width: 28 });
  doc.text(formatAmount(item.gross, currencySymbol), cols.gross + 2, y + 4, { width: 52 });
  doc.text(formatAmount(item.discount, currencySymbol), cols.discount + 2, y + 4, { width: 52 });
  doc.text(formatAmount(item.taxable, currencySymbol), cols.taxable + 2, y + 4, {
    width: 58,
  });

  const taxLabel = item.isInterState
    ? `IGST ${formatAmount(item.igst, currencySymbol)}`
    : `C:${formatAmount(item.cgst, currencySymbol)} S:${formatAmount(item.sgst, currencySymbol)}`;
  doc.text(taxLabel, cols.tax + 2, y + 4, { width: 58 });
  doc.text(formatAmount(item.total, currencySymbol), cols.total + 2, y + 4, { width: 56 });

  return y + rowHeight;
};

const drawSummaryRow = (doc, label, value, y, currencySymbol, bold = false) => {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).text(label, 360, y, { width: 120 });
  doc
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(9)
    .text(formatAmount(value, currencySymbol), 480, y, {
      width: 55,
      align: "right",
    });
  return y + 14;
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
  // Always treat GST as IGST-only for this project.
  const isInterState = true;
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

    // IGST-only.
    const igst = lineTax;
    const cgst = 0;
    const sgst = 0;

    return {
      description: item?.productTitle || "Product",
      hsn,
      quantity: Number(item?.quantity || 1),
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

  const taxBreakup = {
    igst: taxTotal,
    cgst: 0,
    sgst: 0,
  };

  return {
    seller,
    buyerAddress,
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

    let y = 40;
    const {
      seller,
      buyerAddress,
      buyerGstNumber,
      billingName,
      orderDate,
      invoiceDate,
      placeOfSupply,
    } = invoiceData;
    const { lineItems, summary, taxBreakup } = invoiceData;
    const currencySymbol = seller.currencySymbol || "Rs. ";

    doc.font("Helvetica-Bold").fontSize(14).text("TAX INVOICE - Original for Recipient", 40, y);
    y += 22;

    y = drawMetadataRow(doc, "Invoice Number:", invoiceNumber, "Order ID:", String(order._id), y);
    y = drawMetadataRow(doc, "Invoice Date:", formatDate(invoiceDate), "Order Date:", formatDate(orderDate), y);
    y = drawMetadataRow(doc, "Payment Status:", String(order.payment_status || "-").toUpperCase(), "Order Status:", String(order.order_status || "-").toUpperCase(), y);

    y += 4;
    y = drawSectionTitle(doc, "Seller Details", y);
    doc.font("Helvetica-Bold").fontSize(10).text(seller.name, 40, y);
    y += 13;
    doc.font("Helvetica").fontSize(9).text(seller.address, 40, y, { width: 250 });
    y += 13;
    if (seller.gstin) {
      doc.font("Helvetica").fontSize(9).text(`GSTIN: ${seller.gstin}`, 40, y);
      y += 13;
    }
    if (seller.phone) {
      doc.font("Helvetica").fontSize(9).text(`Phone: ${seller.phone}`, 40, y);
      y += 13;
    }
    if (seller.email) {
      doc.font("Helvetica").fontSize(9).text(`Email: ${seller.email}`, 40, y);
      y += 13;
    }

    const rightBlockTop = y - 65;
    doc.font("Helvetica-Bold").fontSize(10).text("Buyer / Shipping Details", 320, rightBlockTop);
    doc.font("Helvetica-Bold").fontSize(9).text(billingName, 320, rightBlockTop + 14, { width: 210 });

    const buyerLines = buildAddressLines(buyerAddress);
    let buyerY = rightBlockTop + 28;
    buyerLines.forEach((line) => {
      doc.font("Helvetica").fontSize(9).text(line, 320, buyerY, { width: 210 });
      buyerY += 12;
    });

    if (buyerGstNumber) {
      doc.font("Helvetica").fontSize(9).text(`GSTIN: ${buyerGstNumber}`, 320, buyerY + 2);
      buyerY += 12;
    }
    doc.font("Helvetica").fontSize(9).text(`Place of Supply: ${placeOfSupply}`, 320, buyerY + 2);
    y = Math.max(y, buyerY + 18);

    y += 8;
    const header = drawTableHeader(doc, y);
    y = header.y;
    const cols = header.cols;

    for (const item of lineItems) {
      if (y > 730) {
        doc.addPage();
        y = 40;
        const newHeader = drawTableHeader(doc, y);
        y = newHeader.y;
      }
      y = drawTableRow(doc, item, cols, y, currencySymbol);
    }

    y += 10;
    y = drawSummaryRow(doc, "Gross Total", summary.grossSubtotal, y, currencySymbol);
    y = drawSummaryRow(doc, "Discount", summary.totalDiscount, y, currencySymbol);
    y = drawSummaryRow(doc, "Taxable Value", summary.taxableTotal, y, currencySymbol);
    y = drawSummaryRow(doc, "IGST", taxBreakup.igst, y, currencySymbol);
    y = drawSummaryRow(doc, "CGST", taxBreakup.cgst, y, currencySymbol);
    y = drawSummaryRow(doc, "SGST", taxBreakup.sgst, y, currencySymbol);
    y = drawSummaryRow(doc, "Shipping / Logistics", summary.shippingTotal, y, currencySymbol);
    y = drawSummaryRow(doc, "Grand Total", summary.grandTotal, y, currencySymbol, true);

    y += 10;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#374151")
      .text(
        "This is a computer generated invoice and does not require signature.",
        40,
        y,
        { width: 495, align: "center" },
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
