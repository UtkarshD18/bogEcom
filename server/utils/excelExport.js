import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PRICING_ENGINE_TEMPLATE_PATH = path.resolve(
  MODULE_DIR,
  "../assets/templates/pro_pricing_engine_1000_products.xlsx",
);

const resolveNumberEnv = (key, fallback) => {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) ? raw : fallback;
};

export const PRICING_ENGINE_DEFAULTS = {
  deliveryCost: resolveNumberEnv("PRICING_ENGINE_DEFAULT_DELIVERY_COST", 80),
  cgstPercent: resolveNumberEnv("PRICING_ENGINE_DEFAULT_CGST_PERCENT", 2.5),
  sgstPercent: resolveNumberEnv("PRICING_ENGINE_DEFAULT_SGST_PERCENT", 2.5),
  targetProfitMarginPercent: resolveNumberEnv(
    "PRICING_ENGINE_DEFAULT_TARGET_MARGIN_PERCENT",
    0,
  ),
  influencerCommissionPercent: resolveNumberEnv(
    "PRICING_ENGINE_DEFAULT_INFLUENCER_COMMISSION_PERCENT",
    0,
  ),
  influencerCustomerDiscountPercent: resolveNumberEnv(
    "PRICING_ENGINE_DEFAULT_INFLUENCER_CUSTOMER_DISCOUNT_PERCENT",
    0,
  ),
  couponDiscountPercent: resolveNumberEnv(
    "PRICING_ENGINE_DEFAULT_COUPON_DISCOUNT_PERCENT",
    0,
  ),
};

export const ORDER_REPORT_COLUMNS = [
  { header: "Order ID", key: "orderId", width: 22 },
  { header: "Product ID", key: "productId", width: 22 },
  { header: "SKU", key: "sku", width: 18 },
  { header: "HSN Code", key: "hsnCode", width: 12 },
  { header: "Product Name", key: "productName", width: 32 },
  { header: "Variant Name", key: "variantName", width: 18 },
  { header: "Quantity", key: "quantity", width: 12 },
  { header: "Price", key: "price", width: 14 },
  { header: "Order Status", key: "orderStatus", width: 16 },
  { header: "Customer", key: "customer", width: 24 },
  { header: "Order Date", key: "orderDate", width: 18 },
  { header: "Delivery Status", key: "deliveryStatus", width: 18 },
];

export const PRICING_ENGINE_COLUMNS = [
  { header: "Product", key: "product", width: 30 },
  { header: "Cost of Making", key: "costOfMaking", width: 16 },
  { header: "Delivery Cost", key: "deliveryCost", width: 14 },
  {
    header: "Target Profit Margin %",
    key: "targetProfitMarginPercent",
    width: 20,
  },
  {
    header: "Influencer Commission %",
    key: "influencerCommissionPercent",
    width: 22,
  },
  {
    header: "Influencer Customer Discount %",
    key: "influencerCustomerDiscountPercent",
    width: 26,
  },
  { header: "Coupon Discount %", key: "couponDiscountPercent", width: 18 },
  { header: "CGST %", key: "cgstPercent", width: 10 },
  { header: "SGST %", key: "sgstPercent", width: 10 },
  { header: "Subtotal (Product)", key: "subtotalProduct", width: 18 },
  {
    header: "Influencer Discount ₹",
    key: "influencerDiscountRs",
    width: 20,
  },
  { header: "Coupon Discount ₹", key: "couponDiscountRs", width: 18 },
  {
    header: "Discounted Product Price",
    key: "discountedProductPrice",
    width: 22,
  },
  { header: "CGST ₹", key: "cgstRs", width: 12 },
  { header: "SGST ₹", key: "sgstRs", width: 12 },
  {
    header: "Product Price After GST",
    key: "productPriceAfterGst",
    width: 22,
  },
  {
    header: "Customer Price (Product + Delivery)",
    key: "customerPrice",
    width: 28,
  },
  {
    header: "Influencer Commission ₹",
    key: "influencerCommissionRs",
    width: 22,
  },
  { header: "Total Cost", key: "totalCost", width: 14 },
  { header: "Actual Profit", key: "actualProfit", width: 14 },
  { header: "Actual Margin %", key: "actualMarginPercent", width: 16 },
  {
    header: "Minimum Customer Price for Target Margin",
    key: "minCustomerPriceForTargetMargin",
    width: 34,
  },
  { header: "Product ID", key: "productId", width: 22 },
  { header: "Variant ID", key: "variantId", width: 22 },
  { header: "SKU", key: "sku", width: 18 },
  { header: "HSN Code", key: "hsnCode", width: 12 },
  { header: "Unit", key: "unit", width: 10 },
  { header: "Weight", key: "weight", width: 10 },
  { header: "MRP", key: "mrp", width: 12 },
  { header: "Selling Price", key: "sellingPrice", width: 14 },
];

export const resolveOrderReportTemplatePath = () =>
  String(process.env.ORDER_REPORT_TEMPLATE_PATH || "").trim();

export const resolvePricingEngineTemplatePath = () =>
  String(
    process.env.PRICING_ENGINE_TEMPLATE_PATH ||
      DEFAULT_PRICING_ENGINE_TEMPLATE_PATH,
  ).trim();

const safeAccess = async (filePath) => {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const loadTemplateMeta = async (templatePath, columnCount) => {
  const exists = await safeAccess(templatePath);
  if (!exists) return null;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const sheet = workbook.worksheets?.[0];
  if (!sheet) return null;

  const headerRow = sheet.getRow(1);
  const headerStyles = [];
  const columnWidths = [];
  const widthCount = Math.max(columnCount, sheet.columnCount || 0, 1);

  for (let i = 1; i <= widthCount; i += 1) {
    const cell = headerRow.getCell(i);
    headerStyles[i] = cell?.style && Object.keys(cell.style).length > 0 ? cell.style : null;
    const width = sheet.getColumn(i)?.width;
    columnWidths[i] = Number.isFinite(width) ? width : null;
  }

  return {
    headerStyles,
    columnWidths,
    headerRowHeight: headerRow?.height || null,
  };
};

export const createOrderReportWriter = async ({
  stream,
  workbook: existingWorkbook,
  sheetName = "Order Report",
  templatePath = resolveOrderReportTemplatePath(),
  columns = ORDER_REPORT_COLUMNS,
} = {}) => {
  const templateMeta = await loadTemplateMeta(templatePath, columns.length);
  const normalizedColumns = columns.map((column, index) => ({
    ...column,
    width: templateMeta?.columnWidths?.[index + 1] || column.width || 18,
  }));

  const workbook =
    existingWorkbook ||
    new ExcelJS.stream.xlsx.WorkbookWriter({
      stream,
      useStyles: true,
      useSharedStrings: false,
    });
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  worksheet.columns = normalizedColumns;

  const headerRow = worksheet.getRow(1);
  if (templateMeta?.headerRowHeight) {
    headerRow.height = templateMeta.headerRowHeight;
  }
  if (!headerRow.values || headerRow.values.length <= 1) {
    headerRow.values = [null, ...normalizedColumns.map((column) => column.header)];
  }

  headerRow.eachCell((cell, colNumber) => {
    const templateStyle = templateMeta?.headerStyles?.[colNumber];
    if (templateStyle) {
      cell.style = { ...templateStyle };
    } else {
      cell.font = { bold: true };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    }
  });
  headerRow.commit();

  return { workbook, worksheet, columns: normalizedColumns };
};
