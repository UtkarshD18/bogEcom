import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";
import { UPLOAD_ROOT } from "../middlewares/upload.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, "..");
const configuredInvoiceDir = String(process.env.INVOICE_DIR || "").trim();
const defaultInvoiceDir =
  process.env.NODE_ENV === "production"
    ? path.join(UPLOAD_ROOT, "invoices")
    : path.join(SERVER_ROOT, "invoices");
const INVOICE_DIR = configuredInvoiceDir
  ? path.resolve(configuredInvoiceDir)
  : defaultInvoiceDir;
const SHOULD_FORCE_REGENERATE = String(process.env.INVOICE_FORCE_REGENERATE || "false").toLowerCase() === "true";

const DEFAULT_HSN = process.env.INVOICE_DEFAULT_HSN || "2106";
const DEFAULT_TAX_RATE = Number(process.env.INVOICE_DEFAULT_GST_RATE || 5);
const FIXED_SELLER_PROFILE = Object.freeze({
  name: "BUY ONE GRAM PRIVATE LIMITED",
  address: "G-225, RIICO INDUSTRIAL AREA SITAPURA, TONK ROAD, JAIPUR-302022",
  gstin: "08AAJCB3889Q1ZO",
  state: "Rajasthan",
  placeOfSupplyStateCode: "08",
  cin: "U51909RJ2020PTC071817",
  msme: "UDYAM-RJ-17-0154669",
  fssai: "12224027000921",
});
const normalizeHsnSixDigit = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(0, 6);
  if (digits.length > 0) return digits.padEnd(6, "0");
  return "";
};
const DEFAULT_HSN_6 = normalizeHsnSixDigit(DEFAULT_HSN) || "210600";
const GST_STATE_CODE_BY_NAME = Object.freeze({
  "jammu & kashmir": "01",
  "jammu and kashmir": "01",
  "himachal pradesh": "02",
  punjab: "03",
  chandigarh: "04",
  uttarakhand: "05",
  haryana: "06",
  delhi: "07",
  rajasthan: "08",
  "uttar pradesh": "09",
  bihar: "10",
  sikkim: "11",
  "arunachal pradesh": "12",
  nagaland: "13",
  manipur: "14",
  mizoram: "15",
  tripura: "16",
  meghalaya: "17",
  assam: "18",
  "west bengal": "19",
  jharkhand: "20",
  odisha: "21",
  chhattisgarh: "22",
  "madhya pradesh": "23",
  gujarat: "24",
  "daman & diu": "25",
  "daman and diu": "25",
  "dadra & nagar haveli": "26",
  "dadra and nagar haveli": "26",
  maharashtra: "27",
  karnataka: "29",
  goa: "30",
  lakshadweep: "31",
  kerala: "32",
  "tamil nadu": "33",
  puducherry: "34",
  pondicherry: "34",
  "andaman & nicobar islands": "35",
  "andaman and nicobar islands": "35",
  telangana: "36",
  "andhra pradesh": "37",
  "other territory": "98",
});

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeState = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeStateCode = (value) => {
  const cleaned = String(value || "").replace(/\D/g, "");
  return cleaned ? cleaned.padStart(2, "0") : "";
};

const resolveStateCode = (stateCode, stateName) => {
  const directCode = normalizeStateCode(stateCode);
  if (directCode) return directCode;

  const normalizedName = normalizeState(stateName)
    .replace(/\./g, "")
    .replace(/\s+/g, " ");

  return GST_STATE_CODE_BY_NAME[normalizedName] || "";
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

const formatPlainAmount = (amount) => roundMoney(amount).toFixed(2);
const formatQuantity = (value) => Number(value || 0).toFixed(4);

const NUMBER_WORDS_ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const NUMBER_WORDS_TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

const twoDigitWords = (num) => {
  const safe = Math.max(0, Math.floor(Number(num || 0)));
  if (safe < 20) return NUMBER_WORDS_ONES[safe];
  const tens = Math.floor(safe / 10);
  const ones = safe % 10;
  return `${NUMBER_WORDS_TENS[tens]}${ones ? ` ${NUMBER_WORDS_ONES[ones]}` : ""}`.trim();
};

const numberToWordsIndian = (num) => {
  const safe = Math.max(0, Math.floor(Number(num || 0)));
  if (safe === 0) return "Zero";

  const parts = [];
  let remaining = safe;

  const crore = Math.floor(remaining / 10000000);
  if (crore > 0) {
    parts.push(`${twoDigitWords(crore)} Crore`);
    remaining %= 10000000;
  }

  const lakh = Math.floor(remaining / 100000);
  if (lakh > 0) {
    parts.push(`${twoDigitWords(lakh)} Lakh`);
    remaining %= 100000;
  }

  const thousand = Math.floor(remaining / 1000);
  if (thousand > 0) {
    parts.push(`${twoDigitWords(thousand)} Thousand`);
    remaining %= 1000;
  }

  const hundred = Math.floor(remaining / 100);
  if (hundred > 0) {
    parts.push(`${NUMBER_WORDS_ONES[hundred]} Hundred`);
    remaining %= 100;
  }

  if (remaining > 0) {
    parts.push(twoDigitWords(remaining));
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
};

const amountToWordsINR = (amount) => {
  const safe = roundMoney(Math.max(0, Number(amount || 0)));
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  const rupeeWords = numberToWordsIndian(rupees);
  if (paise > 0) {
    return `INR ${rupeeWords} and ${numberToWordsIndian(paise)} Paise Only`;
  }
  return `INR ${rupeeWords} Only`;
};

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
    sl: 22,
    description: 213,
    hsn: 58,
    qty: 65,
    rate: 65,
    per: 45,
    amount: 67,
  };

  const computedTableWidth = Object.values(widths).reduce((sum, width) => sum + width, 0);
  const effectiveWidth = tableWidth || computedTableWidth;
  const cols = {};
  let cursor = x;
  Object.entries(widths).forEach(([key, width]) => {
    cols[key] = cursor;
    cursor += width;
  });

  const headerHeight = 22;
  doc.rect(x, y, effectiveWidth, headerHeight).fillAndStroke("#f5f5f5", "#111827");
  Object.values(cols)
    .slice(1)
    .forEach((colX) => {
      doc.moveTo(colX, y).lineTo(colX, y + headerHeight).stroke("#111827");
    });

  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8);
  doc.text("Sl", cols.sl + 2, y + 7, { width: widths.sl - 4 });
  doc.text("Description of Goods", cols.description + 2, y + 7, {
    width: widths.description - 4,
  });
  doc.text("HSN/SAC", cols.hsn + 2, y + 7, { width: widths.hsn - 4 });
  doc.text("Quantity", cols.qty + 2, y + 7, { width: widths.qty - 4 });
  doc.text("Rate", cols.rate + 2, y + 7, { width: widths.rate - 4 });
  doc.text("per", cols.per + 2, y + 7, { width: widths.per - 4 });
  doc.text("Amount", cols.amount + 2, y + 7, { width: widths.amount - 4, align: "right" });
  doc.fillColor("#111827");

  return {
    y: y + headerHeight,
    cols,
    widths,
    headerHeight,
    tableWidth: effectiveWidth,
  };
};

const drawTableRow = (doc, item, cols, widths, y, index) => {
  const hasDetail = Boolean(item?.detail);
  const rowHeight = hasDetail ? 28 : 20;
  const tableWidth = Object.values(widths).reduce((sum, width) => sum + width, 0);

  doc.rect(cols.sl, y, tableWidth, rowHeight).stroke("#111827");
  Object.values(cols)
    .slice(1)
    .forEach((colX) => {
      doc.moveTo(colX, y).lineTo(colX, y + rowHeight).stroke("#111827");
    });

  doc.font("Helvetica").fontSize(8).fillColor("#111827");
  doc.text(String(index + 1), cols.sl + 2, y + 6, { width: widths.sl - 4 });
  doc.text(item.description || "Product", cols.description + 2, y + 4, {
    width: widths.description - 6,
  });
  if (hasDetail) {
    doc.font("Helvetica").fontSize(7).fillColor("#4b5563");
    doc.text(item.detail, cols.description + 2, y + 13, {
      width: widths.description - 6,
    });
    doc.fillColor("#111827");
  }
  doc.font("Helvetica").fontSize(8);
  doc.text(item.hsn || DEFAULT_HSN_6, cols.hsn + 2, y + 6, { width: widths.hsn - 4 });
  doc.text(
    `${formatQuantity(item.quantityValue)} ${item.quantityUnit || "Nos"}`,
    cols.qty + 2,
    y + 6,
    { width: widths.qty - 4, align: "right" },
  );
  doc.text(formatPlainAmount(item.rate), cols.rate + 2, y + 6, {
    width: widths.rate - 4,
    align: "right",
  });
  doc.text(item.perLabel || "Nos", cols.per + 2, y + 6, {
    width: widths.per - 4,
    align: "center",
  });
  doc.text(formatPlainAmount(item.amount), cols.amount + 2, y + 6, {
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
  {
    bold = false,
    labelWidth = 160,
    valueWidth = 85,
    valuePrefix = "",
  } = {},
) => {
  const fontName = bold ? "Helvetica-Bold" : "Helvetica";
  const valueText = typeof value === "string" ? value : `${valuePrefix}${formatPlainAmount(value)}`;
  doc.font(fontName).fontSize(9).text(label, x, y, { width: labelWidth });
  doc.font(fontName).fontSize(9).text(valueText, x + labelWidth + 4, y, {
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

const drawHsnSummaryTable = (doc, x, y, width, rows, isInterState = false) => {
  if (!rows || rows.length === 0) return y;
  const headerHeight = 16;
  const rowHeight = 14;
  const columns = isInterState
    ? {
        hsn: 100,
        taxable: 130,
        rate: 80,
        igst: 110,
        totalTax: 115,
      }
    : {
        hsn: 90,
        taxable: 105,
        cgstRate: 60,
        cgst: 80,
        sgstRate: 60,
        sgst: 80,
        totalTax: 60,
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
  doc.text("HSN/SAC", cols.hsn + 2, y + 4, { width: columns.hsn - 4 });
  doc.text("Taxable Value", cols.taxable + 2, y + 4, { width: columns.taxable - 4 });
  if (isInterState) {
    doc.text("IGST Rate", cols.rate + 2, y + 4, { width: columns.rate - 4 });
    doc.text("IGST Amount", cols.igst + 2, y + 4, { width: columns.igst - 4 });
  } else {
    doc.text("CGST Rate", cols.cgstRate + 2, y + 4, { width: columns.cgstRate - 4 });
    doc.text("CGST Amount", cols.cgst + 2, y + 4, { width: columns.cgst - 4 });
    doc.text("SGST Rate", cols.sgstRate + 2, y + 4, { width: columns.sgstRate - 4 });
    doc.text("SGST Amount", cols.sgst + 2, y + 4, { width: columns.sgst - 4 });
  }
  doc.text("Tax Amount", cols.totalTax + 2, y + 4, { width: columns.totalTax - 4 });

  let currentY = y + headerHeight;
  rows.forEach((row) => {
    doc.rect(x, currentY, width, rowHeight).stroke("#111827");
    Object.values(cols)
      .slice(1)
      .forEach((colX) => {
        doc.moveTo(colX, currentY).lineTo(colX, currentY + rowHeight).stroke("#111827");
      });
    doc.font("Helvetica").fontSize(8).fillColor("#111827");
    doc.text(String(row.hsn), cols.hsn + 2, currentY + 3, { width: columns.hsn - 4 });
    doc.text(formatPlainAmount(row.taxable), cols.taxable + 2, currentY + 3, {
      width: columns.taxable - 4,
      align: "right",
    });
    if (isInterState) {
      doc.text(`${Number(row.taxRate || 0).toFixed(2)}%`, cols.rate + 2, currentY + 3, {
        width: columns.rate - 4,
        align: "right",
      });
      doc.text(formatPlainAmount(row.igst), cols.igst + 2, currentY + 3, {
        width: columns.igst - 4,
        align: "right",
      });
    } else {
      const halfRate = Number(row.taxRate || 0) / 2;
      doc.text(`${halfRate.toFixed(2)}%`, cols.cgstRate + 2, currentY + 3, {
        width: columns.cgstRate - 4,
        align: "right",
      });
      doc.text(formatPlainAmount(row.cgst), cols.cgst + 2, currentY + 3, {
        width: columns.cgst - 4,
        align: "right",
      });
      doc.text(`${halfRate.toFixed(2)}%`, cols.sgstRate + 2, currentY + 3, {
        width: columns.sgstRate - 4,
        align: "right",
      });
      doc.text(formatPlainAmount(row.sgst), cols.sgst + 2, currentY + 3, {
        width: columns.sgst - 4,
        align: "right",
      });
    }
    doc.text(
      formatPlainAmount(row.igst + row.cgst + row.sgst),
      cols.totalTax + 2,
      currentY + 3,
      { width: columns.totalTax - 4, align: "right" },
    );
    currentY += rowHeight;
  });

  return currentY;
};

const resolveSellerDetails = (sellerDetails = {}) => {
  return {
    name: FIXED_SELLER_PROFILE.name,
    gstin: FIXED_SELLER_PROFILE.gstin,
    address: FIXED_SELLER_PROFILE.address,
    state: FIXED_SELLER_PROFILE.state,
    cin: FIXED_SELLER_PROFILE.cin,
    msme: FIXED_SELLER_PROFILE.msme,
    fssai: FIXED_SELLER_PROFILE.fssai,
    phone: sellerDetails.phone || process.env.INVOICE_SELLER_PHONE || "",
    email: sellerDetails.email || process.env.INVOICE_SELLER_EMAIL || "",
    currencySymbol: sellerDetails.currencySymbol || process.env.INVOICE_CURRENCY_SYMBOL || "Rs. ",
    placeOfSupplyStateCode: FIXED_SELLER_PROFILE.placeOfSupplyStateCode,
    bankName: sellerDetails.bankName || process.env.INVOICE_BANK_NAME || "",
    bankAccount: sellerDetails.bankAccount || process.env.INVOICE_BANK_ACCOUNT || "",
    bankBranch: sellerDetails.bankBranch || process.env.INVOICE_BANK_BRANCH || "",
    bankIfsc: sellerDetails.bankIfsc || process.env.INVOICE_BANK_IFSC || "",
    declaration:
      sellerDetails.declaration ||
      process.env.INVOICE_DECLARATION ||
      "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
    terms:
      sellerDetails.terms ||
      process.env.INVOICE_TERMS ||
      "1. Kindly verify parcel condition at delivery. || 2. Please report transit damage within 24 hours with supporting photos. || 3. Subject to payment terms agreed with buyer.",
    jurisdictionLine:
      sellerDetails.jurisdictionLine ||
      process.env.INVOICE_JURISDICTION_LINE ||
      "SUBJECT TO JAIPUR JURISDICTION",
  };
};

const drawPartyBlock = (doc, { title, lines = [], x, y, width, height }) => {
  const textX = x + 6;
  const textWidth = width - 12;
  const topY = y + 4;
  const contentBottomY = y + height - 4;

  doc.font("Helvetica-Bold").fontSize(9).text(title, textX, topY, {
    width: textWidth,
    lineBreak: false,
  });

  let cursorY = y + 17;
  lines.forEach((line) => {
    const content = String(line || "").trim();
    if (!content || cursorY >= contentBottomY) return;

    const lineHeight = doc.heightOfString(content, {
      width: textWidth,
      align: "left",
    });

    if (cursorY + lineHeight > contentBottomY) {
      const remaining = contentBottomY - cursorY;
      if (remaining > 8) {
        let truncated = content;
        while (
          truncated.length > 0 &&
          doc.heightOfString(`${truncated}...`, { width: textWidth }) > remaining
        ) {
          truncated = truncated.slice(0, -1);
        }
        if (truncated.length > 0) {
          doc.font("Helvetica").fontSize(8).text(`${truncated}...`, textX, cursorY, {
            width: textWidth,
          });
        }
      }
      cursorY = contentBottomY;
      return;
    }

    doc.font("Helvetica").fontSize(8).text(content, textX, cursorY, {
      width: textWidth,
    });
    cursorY += lineHeight + 1;
  });
};

const prepareInvoiceData = (order, sellerDetails, productMetaById = {}) => {
  const seller = resolveSellerDetails(sellerDetails);
  const buyerAddress = resolveBuyerAddress(order);
  const consigneeAddress = resolveConsigneeAddress(order);
  const sellerState = normalizeState(seller.state);
  const buyerState = normalizeState(buyerAddress?.state);
  const sellerStateCode = resolveStateCode(
    seller.placeOfSupplyStateCode || seller.stateCode,
    seller.state,
  );
  const buyerStateCode = resolveStateCode(
    buyerAddress?.stateCode || buyerAddress?.state_code || "",
    buyerAddress?.state,
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

  // Shipping is intentionally excluded from invoice math and display.
  const persistedShippingTotal = roundMoney(Number(order?.shipping || 0));
  const shippingTotal = 0;

  // Persisted order totals may include shipping. Remove shipping from invoice total.
  const finalAmount = roundMoney(Number(order?.finalAmount || 0));
  const totalAmount = roundMoney(Number(order?.totalAmt || 0));
  const storedGrandTotalWithShipping = roundMoney(
    finalAmount > 0 ? finalAmount : totalAmount,
  );
  const derivedGrandTotalWithoutShipping = roundMoney(
    Math.max(storedGrandTotalWithShipping - persistedShippingTotal, 0),
  );
  const fallbackGrandTotalFromGoods = roundMoney(Math.max(grossSubtotal, 0));
  const grandTotal =
    storedGrandTotalWithShipping > 0
      ? roundMoney(
          Math.max(derivedGrandTotalWithoutShipping, fallbackGrandTotalFromGoods),
        )
      : fallbackGrandTotalFromGoods;

  const netInclusiveSubtotal = roundMoney(Math.max(grandTotal, 0));

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
    const quantityUnits = Math.max(Number(item?.quantity || 1), 1);
    const gross = roundMoney(
      item?.subTotal ||
        Number(item?.price || 0) * quantityUnits,
    );
    const discount = discountAlloc[index] || 0;
    const grossAfterDiscount = roundMoney(Math.max(gross - discount, 0));
    const lineTax = taxAlloc[index] || 0;
    const meta = getProductMeta(productMetaById, item?.productId);
    const lineTaxRate = Number(meta?.taxRate || gstRate || 0);
    const hsn = normalizeHsnSixDigit(
      meta?.hsn || item?.hsnCode || item?.hsn || item?.productHsn || DEFAULT_HSN_6,
    ) || DEFAULT_HSN_6;
    const weightInGrams = Number(meta?.weight || item?.weight || item?.netWeight || 0);
    const quantityUnit = weightInGrams > 0 ? "KG" : String(meta?.unit || "Nos").toUpperCase();
    const quantityValue =
      weightInGrams > 0
        ? roundMoney((quantityUnits * weightInGrams) / 1000)
        : roundMoney(quantityUnits);
    const perLabel = quantityUnit;
    const rateBase = quantityValue > 0 ? quantityValue : quantityUnits;
    const rate = roundMoney(
      rateBase > 0
        ? gross / rateBase
        : Number(item?.price || 0),
    );

    const igst = isInterState ? lineTax : 0;
    const cgst = isInterState ? 0 : roundMoney(lineTax / 2);
    const sgst = isInterState ? 0 : roundMoney(lineTax - cgst);
    const taxableAmount = roundMoney(Math.max(grossAfterDiscount - lineTax, 0));

    const lineDetails = [];
    if (item?.variantName) lineDetails.push(String(item.variantName).trim());
    if (weightInGrams > 0) {
      const packWeight =
        weightInGrams >= 1000
          ? `${roundMoney(weightInGrams / 1000)} kg`
          : `${roundMoney(weightInGrams)} g`;
      lineDetails.push(`(${quantityUnits} pack x ${packWeight})`);
    }

    return {
      description: item?.productTitle || "Product",
      detail: lineDetails.join(" ").trim(),
      hsn,
      quantityUnits,
      quantityValue,
      quantityUnit,
      rate,
      perLabel,
      gross,
      discount,
      taxable: taxableAmount,
      taxRate: lineTaxRate,
      igst,
      cgst,
      sgst,
      total: grossAfterDiscount,
      amount: taxableAmount,
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
    const key = normalizeHsnSixDigit(item.hsn || DEFAULT_HSN_6) || DEFAULT_HSN_6;
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

  const placeOfSupply =
    buyerAddress?.state &&
    String(buyerAddress.state).trim()
      ? `${buyerAddress.state}${buyerStateCode ? ` (${buyerStateCode})` : ""}`
      : "N/A";

  const goodsAmount = roundMoney(
    lineItems.reduce((sum, item) => sum + Number(item?.amount || 0), 0),
  );
  const taxAmount = roundMoney(taxBreakup.igst + taxBreakup.cgst + taxBreakup.sgst);
  const amountBeforeRound = roundMoney(
    goodsAmount + taxAmount + shippingTotal,
  );
  let roundOff = roundMoney(grandTotal - amountBeforeRound);
  if (Math.abs(roundOff) < 0.01) roundOff = 0;
  const roundedGrandTotal = roundMoney(amountBeforeRound + roundOff);

  const hasOnlyKg = lineItems.length > 0 && lineItems.every((item) => item.quantityUnit === "KG");
  const totalKg = roundMoney(
    lineItems
      .filter((item) => item.quantityUnit === "KG")
      .reduce((sum, item) => sum + Number(item.quantityValue || 0), 0),
  );
  const totalUnits = roundMoney(
    lineItems.reduce((sum, item) => sum + Number(item.quantityUnits || 0), 0),
  );
  const totalQuantityLabel = hasOnlyKg
    ? `${formatQuantity(totalKg)} KG`
    : `${formatQuantity(totalUnits)} Nos`;

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
    placeOfSupply,
    lineItems,
    summary: {
      grossSubtotal,
      totalDiscount,
      taxableTotal,
      goodsAmount,
      taxAmount,
      amountBeforeRound,
      roundOff,
      shippingTotal,
      grandTotal: roundedGrandTotal,
      totalQuantityLabel,
      amountInWords: amountToWordsINR(roundedGrandTotal),
      gstRate,
    },
    taxBreakup,
    hsnSummary,
  };
};

export const getInvoiceFileName = (orderId) => `invoice_${orderId}.pdf`;

export const getInvoiceRelativePath = (orderId) =>
  path.posix.join("uploads", "invoices", getInvoiceFileName(orderId));

export const getInvoiceAbsolutePath = (orderId) =>
  path.join(INVOICE_DIR, getInvoiceFileName(orderId));

export const getAbsolutePathFromStoredInvoicePath = (invoicePath) => {
  if (!invoicePath) return null;
  const normalizedPath = String(invoicePath).trim().replace(/\\/g, "/");
  if (!normalizedPath) return null;

  if (/^\/?uploads\//i.test(normalizedPath)) {
    const uploadRelative = normalizedPath.replace(/^\/?uploads\/?/i, "");
    return path.join(UPLOAD_ROOT, uploadRelative);
  }

  if (/^\/?invoices\//i.test(normalizedPath)) {
    const invoiceRelative = normalizedPath.replace(/^\/?invoices\/?/i, "");
    return path.join(INVOICE_DIR, invoiceRelative);
  }

  if (/^[a-zA-Z]:\//.test(normalizedPath) || path.isAbsolute(normalizedPath)) {
    return normalizedPath;
  }

  return path.join(SERVER_ROOT, normalizedPath);
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

  if (!forceRegenerate && !SHOULD_FORCE_REGENERATE && (await fileExists(absolutePath))) {
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
      placeOfSupply,
      hsnSummary,
    } = invoiceData;
    const { lineItems, summary, taxBreakup } = invoiceData;
    const currencySymbol = seller.currencySymbol || "Rs. ";
    const logoPath = resolveInvoiceLogoPath();

    doc.rect(margin, margin, contentWidth, pageHeight - margin * 2).stroke("#111827");

    doc.font("Helvetica-Bold").fontSize(12).text("Tax Invoice", margin + 4, y);
    doc
      .font("Helvetica")
      .fontSize(9)
      .text("(ORIGINAL FOR RECIPIENT)", margin + 74, y + 2, {
        width: contentWidth - 76,
        align: "left",
      });
    y += 18;

    const leftWidth = Math.round(contentWidth * 0.62);
    const rightWidth = contentWidth - leftWidth;
    const sellerHeight = 124;
    const consigneeHeight = 86;
    const buyerHeight = 86;
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
    const maxSellerInfoY = y + sellerHeight - 10;
    const appendSellerLine = (line) => {
      const content = String(line || "").trim();
      if (!content || sellerInfoY > maxSellerInfoY) return;
      doc
        .font("Helvetica")
        .fontSize(8)
        .text(content, sellerTextX, sellerInfoY, {
          width: leftWidth - (sellerTextX - leftX) - 8,
        });
      sellerInfoY += 11;
    };

    sellerAddressLines.forEach((line) => appendSellerLine(line));
    appendSellerLine(seller.gstin ? `GSTIN/UIN: ${seller.gstin}` : "");
    appendSellerLine(
      seller.state
        ? `State Name: ${seller.state}${sellerStateCode ? `, Code: ${sellerStateCode}` : ""}`
        : "",
    );
    appendSellerLine(seller.cin ? `CIN: ${seller.cin}` : "");
    appendSellerLine(seller.msme ? `MSME/UDYAM: ${seller.msme}` : "");
    appendSellerLine(seller.fssai ? `FSSAI: ${seller.fssai}` : "");
    appendSellerLine(seller.phone ? `Contact: ${seller.phone}` : "");
    appendSellerLine(seller.email ? `E-Mail: ${seller.email}` : "");

    const consigneeStateCode =
      resolveStateCode(
        consigneeAddress?.stateCode || consigneeAddress?.state_code || "",
        consigneeAddress?.state,
      ) || buyerStateCode;
    const consigneeLines = formatPartyLines(consigneeAddress, consigneeStateCode);
    drawPartyBlock(doc, {
      title: "Consignee (Ship to)",
      lines: consigneeLines,
      x: leftX,
      y: y + sellerHeight,
      width: leftWidth,
      height: consigneeHeight,
    });

    const buyerDetails = {
      ...buyerAddress,
      name: billingName || buyerAddress?.name,
    };
    const buyerLines = formatPartyLines(buyerDetails, buyerStateCode);
    const buyerBlockLines = [...buyerLines];
    if (buyerGstNumber) {
      buyerBlockLines.push(`GSTIN: ${buyerGstNumber}`);
    }
    drawPartyBlock(doc, {
      title: "Buyer (Bill to)",
      lines: buyerBlockLines,
      x: leftX,
      y: y + sellerHeight + consigneeHeight,
      width: leftWidth,
      height: buyerHeight,
    });

    const destination = [consigneeAddress?.city, consigneeAddress?.state]
      .filter(Boolean)
      .join(", ");
    const buyerOrderNumber =
      order?.displayOrderId ||
      order?.orderNumber ||
      order?.order_id ||
      order?.orderId ||
      (order?._id ? `BOG-${String(order._id).slice(-8).toUpperCase()}` : "-");
    const metaRows = [
      { label: "Invoice No.", value: invoiceNumber },
      { label: "Dated", value: formatDate(invoiceDate) },
      { label: "Customer Remarks", value: String(order?.notes || "").trim() || "-" },
      {
        label: "Mode/Terms of Payment",
        value: String(order?.payment_status || order?.paymentMethod || "-").toUpperCase(),
      },
      { label: "Buyer's Order No.", value: buyerOrderNumber },
      { label: "Dated", value: formatDate(orderDate) },
      { label: "Dispatch Doc No.", value: order?.awb_number || "-" },
      {
        label: "Shipment Date",
        value: order?.shipment_created_at
          ? formatDate(order.shipment_created_at)
          : "-",
      },
      {
        label: "Dispatched through",
        value: order?.shipping_provider || order?.courier_name || "-",
      },
      { label: "Destination", value: destination || "-" },
      { label: "Place of Supply", value: placeOfSupply || "-" },
      { label: "Terms of Delivery", value: order?.termsOfDelivery || "-" },
    ];
    drawKeyValueTable(doc, rightX, y, rightWidth, rightHeight, metaRows);

    y = y + rightHeight + 10;
    let header = drawTableHeader(doc, margin, y, contentWidth);
    y = header.y;
    let cols = header.cols;
    let widths = header.widths;

    for (let i = 0; i < lineItems.length; i += 1) {
      const projectedRowHeight = lineItems[i]?.detail ? 28 : 20;
      if (y + projectedRowHeight > pageHeight - margin - 205) {
        doc.addPage();
        doc.rect(margin, margin, contentWidth, pageHeight - margin * 2).stroke("#111827");
        y = margin + 6;
        header = drawTableHeader(doc, margin, y, contentWidth);
        y = header.y;
        cols = header.cols;
        widths = header.widths;
      }
      y = drawTableRow(doc, lineItems[i], cols, widths, y, i);
    }

    const drawLedgerRow = (
      label,
      value,
      { bold = false, showQty = false, showCurrency = false } = {},
    ) => {
      const rowHeight = 16;
      const tableWidth = Object.values(widths).reduce((sum, width) => sum + width, 0);
      doc.rect(cols.sl, y, tableWidth, rowHeight).stroke("#111827");
      Object.values(cols)
        .slice(1)
        .forEach((colX) => {
          doc.moveTo(colX, y).lineTo(colX, y + rowHeight).stroke("#111827");
        });

      const valueText =
        typeof value === "string"
          ? value
          : showCurrency
            ? formatAmount(value, currencySymbol).replace(/\s+/g, " ").trim()
            : formatPlainAmount(value);
      const fontName = bold ? "Helvetica-Bold" : "Helvetica";

      doc.font(fontName).fontSize(8).fillColor("#111827");
      doc.text(label, cols.description + 2, y + 4, {
        width: cols.amount - cols.description - 4,
      });
      if (showQty && summary.totalQuantityLabel) {
        doc.text(summary.totalQuantityLabel, cols.qty + 2, y + 4, {
          width: widths.qty - 4,
          align: "right",
        });
      }
      doc.text(valueText, cols.amount + 2, y + 4, {
        width: widths.amount - 4,
        align: "right",
      });
      y += rowHeight;
    };

    const gstRateText = Number(summary.gstRate || DEFAULT_TAX_RATE).toFixed(2);
    if (Number(taxBreakup.igst || 0) > 0) {
      drawLedgerRow(`OUTPUT IGST@${gstRateText}%`, taxBreakup.igst);
    } else {
      const splitRate = (Number(summary.gstRate || DEFAULT_TAX_RATE) / 2).toFixed(2);
      drawLedgerRow(`OUTPUT CGST@${splitRate}%`, taxBreakup.cgst);
      drawLedgerRow(`OUTPUT SGST@${splitRate}%`, taxBreakup.sgst);
    }

    drawLedgerRow("Roundoff", summary.roundOff);
    drawLedgerRow("Total", summary.grandTotal, {
      bold: true,
      showQty: true,
      showCurrency: true,
    });

    const amountWordsHeight = 20;
    doc.rect(margin, y, contentWidth, amountWordsHeight).stroke("#111827");
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("Amount Chargeable (in words)", margin + 4, y + 5, { width: 160 });
    doc
      .font("Helvetica")
      .fontSize(8)
      .text(summary.amountInWords, margin + 166, y + 5, {
        width: contentWidth - 170,
      });
    y += amountWordsHeight + 4;

    const footerHeight = 112;
    const reservedFooterTail = footerHeight + 34;
    if (hsnSummary?.length) {
      const hsnTableHeight = (hsnSummary.length + 1) * 14 + 16;
      if (y + hsnTableHeight + reservedFooterTail > pageHeight - margin) {
        doc.addPage();
        doc.rect(margin, margin, contentWidth, pageHeight - margin * 2).stroke("#111827");
        y = margin + 6;
      }
      y = drawHsnSummaryTable(
        doc,
        margin,
        y,
        contentWidth,
        hsnSummary,
        Number(taxBreakup.igst || 0) > 0,
      );
    }

    y += 6;
    const summaryFormula = `Taxable Amount + GST: ${formatPlainAmount(summary.goodsAmount)} + ${formatPlainAmount(summary.taxAmount)} = ${formatPlainAmount(summary.grandTotal)}`;
    doc.font("Helvetica").fontSize(8).fillColor("#111827").text(summaryFormula, margin + 2, y, {
      width: contentWidth - 4,
    });
    y += 12;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#111827")
      .text(`Total Amount (in words): ${summary.amountInWords}`, margin + 2, y, {
        width: contentWidth - 4,
      });
    y += 16;

    const termsLines = String(seller.terms || "")
      .split("||")
      .map((line) => String(line || "").trim())
      .filter(Boolean);
    if (y + footerHeight + 22 > pageHeight - margin) {
      doc.addPage();
      doc.rect(margin, margin, contentWidth, pageHeight - margin * 2).stroke("#111827");
      y = margin + 6;
    }

    const footerLeftWidth = Math.round(contentWidth * 0.64);
    const footerRightWidth = contentWidth - footerLeftWidth;
    const footerRightX = margin + footerLeftWidth;

    doc.rect(margin, y, contentWidth, footerHeight).stroke("#111827");
    doc.moveTo(footerRightX, y).lineTo(footerRightX, y + footerHeight).stroke("#111827");

    let declarationY = y + 6;
    doc.font("Helvetica-Bold").fontSize(8).text("Declaration", margin + 4, declarationY, {
      width: footerLeftWidth - 8,
    });
    declarationY += 12;
    doc.font("Helvetica").fontSize(7).text(seller.declaration, margin + 4, declarationY, {
      width: footerLeftWidth - 8,
    });
    declarationY = doc.y + 4;

    doc.font("Helvetica-Bold").fontSize(8).text("Terms & Condition", margin + 4, declarationY, {
      width: footerLeftWidth - 8,
    });
    declarationY += 11;
    termsLines.forEach((term, index) => {
      if (declarationY > y + footerHeight - 14) return;
      const prefixed = /^\d+\./.test(term) ? term : `${index + 1}. ${term}`;
      doc.font("Helvetica").fontSize(7).text(prefixed, margin + 4, declarationY, {
        width: footerLeftWidth - 8,
      });
      declarationY = doc.y + 2;
    });

    let bankY = y + 6;
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("Company's Bank Details", footerRightX + 4, bankY, {
        width: footerRightWidth - 8,
      });
    bankY += 12;

    const bankRows = [
      ["Bank Name", seller.bankName],
      ["A/c No.", seller.bankAccount],
      ["Branch", seller.bankBranch],
      ["IFS Code", seller.bankIfsc],
    ].filter(([, value]) => String(value || "").trim());

    if (bankRows.length === 0) {
      doc.font("Helvetica").fontSize(7).text("Bank details not configured", footerRightX + 4, bankY, {
        width: footerRightWidth - 8,
      });
    } else {
      bankRows.forEach(([label, value]) => {
        doc.font("Helvetica-Bold").fontSize(7).text(`${label}:`, footerRightX + 4, bankY, {
          width: 52,
        });
        doc.font("Helvetica").fontSize(7).text(String(value || ""), footerRightX + 58, bankY, {
          width: footerRightWidth - 62,
        });
        bankY += 11;
      });
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(`for ${String(seller.name || "").toUpperCase()}`, footerRightX + 4, y + footerHeight - 28, {
        width: footerRightWidth - 8,
        align: "right",
      });
    doc.font("Helvetica").fontSize(8).text("Authorised Signatory", footerRightX + 4, y + footerHeight - 14, {
      width: footerRightWidth - 8,
      align: "right",
    });

    y += footerHeight + 4;
    doc.font("Helvetica-Bold").fontSize(8).text(seller.jurisdictionLine, margin, y, {
      width: contentWidth,
      align: "center",
    });
    y += 10;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#374151")
      .text("This is a Computer Generated Invoice", margin, y, {
        width: contentWidth,
        align: "center",
      });

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
