import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";
import {
  INDIA_COUNTRY,
  composeAddressLine1,
  composeFullAddressText,
  snapshotToDisplayAddress,
} from "./addressUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, "..");
const LABEL_DIR = path.join(SERVER_ROOT, "labels");

const ensureLabelDir = async () => {
  await fsPromises.mkdir(LABEL_DIR, { recursive: true });
};

const safeFileName = (value) =>
  String(value || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "") || `label_${Date.now()}`;

export const buildXpressbeesShipmentPayload = (snapshot = {}) => {
  const display = snapshotToDisplayAddress(snapshot);

  return {
    name: display.name,
    mobile: display.mobile,
    address_line1:
      display.address_line1 ||
      composeAddressLine1({
        flat_house: snapshot.order_flat_house,
        area_street_sector: snapshot.order_area,
      }),
    address_line2: display.address_line2 || "",
    landmark: display.landmark || "",
    pincode: display.pincode,
    city: display.city,
    state: display.state,
    country: INDIA_COUNTRY,
  };
};

export const buildShippingLabelData = ({ order, snapshot }) => {
  const display = snapshotToDisplayAddress(snapshot || order?.deliveryAddressSnapshot || {});
  const orderId =
    order?.displayOrderId ||
    order?.orderNumber ||
    order?.order_id ||
    order?._id ||
    "ORDER";

  return {
    orderId: String(orderId),
    customerName: display.name || "Customer",
    mobile: display.mobile || "",
    flatHouse: snapshot?.order_flat_house || "",
    area: snapshot?.order_area || "",
    landmark: snapshot?.order_landmark || "",
    city: display.city || "",
    state: display.state || "",
    pincode: display.pincode || "",
    country: INDIA_COUNTRY,
    addressLine1: display.address_line1 || "",
    addressLine2: display.address_line2 || "",
    fullAddress:
      snapshot?.full_address ||
      composeFullAddressText({
        flat_house: snapshot?.order_flat_house,
        area_street_sector: snapshot?.order_area,
        landmark: snapshot?.order_landmark,
        city: snapshot?.order_city,
        state: snapshot?.order_state,
        pincode: snapshot?.order_pincode,
      }),
  };
};

export const generateShippingLabelPdf = async ({ order, snapshot }) => {
  const labelData = buildShippingLabelData({ order, snapshot });
  await ensureLabelDir();
  const fileName = `${safeFileName(labelData.orderId)}.pdf`;
  const absolutePath = path.join(LABEL_DIR, fileName);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [420, 300],
      margin: 24,
    });
    const stream = fs.createWriteStream(absolutePath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("XPRESSBEES SHIPPING LABEL", { align: "center" });

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(12).text(`Order ID: ${labelData.orderId}`);
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11);
    doc.text(`Customer Name: ${labelData.customerName}`);
    doc.text(`Mobile: ${labelData.mobile}`);
    doc.text(`Flat / House: ${labelData.flatHouse}`);
    doc.text(`Area / Street: ${labelData.area}`);
    if (labelData.landmark) {
      doc.text(`Landmark: ${labelData.landmark}`);
    }
    doc.text(`City: ${labelData.city}`);
    doc.text(`State: ${labelData.state}`);
    doc.text(`Pincode: ${labelData.pincode}`);
    doc.text(`Country: ${labelData.country}`);
    doc.moveDown(1);
    doc.font("Helvetica-Bold").text("Delivery Address");
    doc.font("Helvetica").text(labelData.fullAddress || "Address not available");
    doc.end();
  });

  return {
    ...labelData,
    absolutePath,
    relativePath: path.relative(process.cwd(), absolutePath).replace(/\\/g, "/"),
  };
};

export default {
  buildShippingLabelData,
  buildXpressbeesShipmentPayload,
  generateShippingLabelPdf,
};
