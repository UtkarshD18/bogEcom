import ExcelJS from "exceljs";
import fs from "fs/promises";

const DEFAULT_TEMPLATE_PATH =
  "d:\\buyonegram\\pro_pricing_engine_1000_products.xlsx";

export const ORDER_REPORT_COLUMNS = [
  { header: "Order ID", key: "orderId", width: 22 },
  { header: "Product ID", key: "productId", width: 22 },
  { header: "Product Name", key: "productName", width: 32 },
  { header: "Quantity", key: "quantity", width: 12 },
  { header: "Price", key: "price", width: 14 },
  { header: "Order Status", key: "orderStatus", width: 16 },
  { header: "Customer", key: "customer", width: 24 },
  { header: "Order Date", key: "orderDate", width: 18 },
];

export const resolveOrderReportTemplatePath = () =>
  String(process.env.ORDER_REPORT_TEMPLATE_PATH || DEFAULT_TEMPLATE_PATH).trim();

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
  templatePath = resolveOrderReportTemplatePath(),
  columns = ORDER_REPORT_COLUMNS,
} = {}) => {
  const templateMeta = await loadTemplateMeta(templatePath, columns.length);
  const normalizedColumns = columns.map((column, index) => ({
    ...column,
    width: templateMeta?.columnWidths?.[index + 1] || column.width || 18,
  }));

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream,
    useStyles: true,
    useSharedStrings: false,
  });
  const worksheet = workbook.addWorksheet("Order Report", {
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
