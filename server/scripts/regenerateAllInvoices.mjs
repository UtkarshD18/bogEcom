import mongoose from "mongoose";
import connectDb from "../config/connectDb.js";
import "../models/address.model.js";
import InvoiceModel from "../models/invoice.model.js";
import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import "../models/user.model.js";
import { generateInvoicePdf } from "../utils/generateInvoicePdf.js";

const ELIGIBLE_STATUS_VALUES = ["delivered", "completed", "DELIVERED", "COMPLETED"];
const DEFAULT_GST_RATE = 5;
const DEFAULT_HSN = "2106";

const FIXED_SELLER_DETAILS = Object.freeze({
  name: "BUY ONE GRAM PRIVATE LIMITED",
  gstin: "08AAJCB3889Q1ZO",
  address: "G-225, RIICO INDUSTRIAL AREA SITAPURA, TONK ROAD, JAIPUR-302022",
  state: "Rajasthan",
  placeOfSupplyStateCode: "08",
  cin: "U51909RJ2020PTC071817",
  msme: "UDYAM-RJ-17-0154669",
  fssai: "12224027000921",
  currencySymbol: "Rs. ",
  jurisdictionLine: "SUBJECT TO JAIPUR JURISDICTION",
});

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const parseNumericFlag = (flagName) => {
  const token = process.argv.find((arg) =>
    String(arg || "").startsWith(`${flagName}=`),
  );
  if (!token) return 0;
  const raw = String(token).split("=")[1];
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const extractHsnFromSpecifications = (specifications) => {
  if (!specifications) return "";

  if (specifications instanceof Map) {
    return (
      specifications.get("HSN") ||
      specifications.get("hsn") ||
      specifications.get("Hsn") ||
      ""
    );
  }

  if (typeof specifications === "object") {
    return specifications.HSN || specifications.hsn || specifications.Hsn || "";
  }

  return "";
};

const buildFilter = ({ includeAll = false } = {}) => {
  if (includeAll) {
    return { order_status: { $ne: "cancelled" } };
  }

  return {
    $or: [
      { order_status: { $in: ELIGIBLE_STATUS_VALUES } },
      { invoicePath: { $exists: true, $ne: "" } },
      { invoiceNumber: { $exists: true, $ne: "" } },
      { isInvoiceGenerated: true },
      { invoiceUrl: { $exists: true, $ne: "" } },
    ],
  };
};

const buildProductMetaById = async (order) => {
  const productIds = Array.from(
    new Set(
      (Array.isArray(order?.products) ? order.products : [])
        .map((item) => String(item?.productId || ""))
        .filter((id) => mongoose.Types.ObjectId.isValid(id)),
    ),
  );

  if (productIds.length === 0) {
    return {};
  }

  const products = await ProductModel.find({ _id: { $in: productIds } })
    .select("_id hsnCode specifications unit weight")
    .lean();

  const map = {};
  for (const product of products) {
    const hsn =
      String(product?.hsnCode || "").trim() ||
      String(extractHsnFromSpecifications(product?.specifications) || "").trim() ||
      DEFAULT_HSN;

    map[String(product._id)] = {
      hsn,
      unit: product?.unit || "Nos",
      weight: Number(product?.weight || 0),
      taxRate: Number(order?.gst?.rate || DEFAULT_GST_RATE),
    };
  }

  return map;
};

const run = async () => {
  const includeAll = process.argv.includes("--all");
  const limit = parseNumericFlag("--limit");
  const offset = parseNumericFlag("--offset");
  const filter = buildFilter({ includeAll });

  await connectDb();

  const summary = {
    scanned: 0,
    regenerated: 0,
    failed: 0,
  };

  try {
    const query = OrderModel.find(filter)
      .populate("user", "name email")
      .populate("delivery_address")
      .sort({ _id: 1 });

    if (offset > 0) query.skip(offset);
    if (limit > 0) query.limit(limit);

    const orders = await query.exec();

    console.log(
      `Processing invoices: count=${orders.length}, includeAll=${includeAll}, offset=${offset}, limit=${limit || "all"}`,
    );

    for (const [index, order] of orders.entries()) {
      summary.scanned += 1;

      try {
        const productMetaById = await buildProductMetaById(order);
        const generated = await generateInvoicePdf({
          order,
          sellerDetails: FIXED_SELLER_DETAILS,
          productMetaById,
          forceRegenerate: true,
        });

        const shipping = round2(Number(order?.shipping || 0));
        const grossTotal = round2(
          Number(order?.finalAmount || order?.totalAmt || 0),
        );
        const invoiceTotal = round2(Math.max(grossTotal - shipping, 0));
        const taxTotal = round2(
          Number(order?.gst?.totalTax || order?.tax || 0),
        );
        const taxableAmount = round2(Math.max(invoiceTotal - taxTotal, 0));
        const state =
          order?.billingDetails?.state ||
          order?.guestDetails?.state ||
          order?.delivery_address?.state ||
          "";
        const gstRate = Number(order?.gst?.rate || DEFAULT_GST_RATE);
        const igst = round2(Number(order?.gst?.igst || 0));
        const cgst = round2(
          Number(order?.gst?.cgst || (igst > 0 ? 0 : taxTotal / 2)),
        );
        const sgst = round2(
          Number(order?.gst?.sgst || (igst > 0 ? 0 : taxTotal - cgst)),
        );

        await OrderModel.updateOne(
          { _id: order._id },
          {
            $set: {
              invoiceNumber: generated.invoiceNumber,
              invoicePath: generated.invoicePath,
              invoiceGeneratedAt: generated.invoiceGeneratedAt,
              isInvoiceGenerated: true,
              invoiceUrl: generated.invoicePath,
            },
          },
        );

        await InvoiceModel.findOneAndUpdate(
          { orderId: order._id },
          {
            orderId: order._id,
            invoiceNumber: generated.invoiceNumber,
            subtotal: taxableAmount,
            taxBreakdown: {
              rate: gstRate,
              state: state || "",
              taxableAmount,
              cgst,
              sgst,
              igst,
              totalTax: taxTotal,
            },
            shipping: 0,
            total: invoiceTotal,
            gstNumber:
              order?.gstNumber || order?.guestDetails?.gst || FIXED_SELLER_DETAILS.gstin,
            billingDetails: {
              fullName:
                order?.billingDetails?.fullName ||
                order?.guestDetails?.fullName ||
                order?.delivery_address?.name ||
                order?.user?.name ||
                "",
              email:
                order?.billingDetails?.email ||
                order?.guestDetails?.email ||
                order?.user?.email ||
                "",
              phone:
                order?.billingDetails?.phone ||
                order?.guestDetails?.phone ||
                order?.delivery_address?.mobile ||
                "",
              address:
                order?.billingDetails?.address ||
                order?.guestDetails?.address ||
                order?.delivery_address?.address_line1 ||
                "",
              pincode:
                order?.billingDetails?.pincode ||
                order?.guestDetails?.pincode ||
                order?.delivery_address?.pincode ||
                "",
              state: state || "",
            },
            invoicePath: generated.invoicePath,
            createdBy: order?.user?._id || order?.user || null,
          },
          { upsert: true, new: true, runValidators: true },
        );

        summary.regenerated += 1;
      } catch (error) {
        summary.failed += 1;
        console.error(
          `[FAILED] order=${order?._id} status=${order?.order_status} error=${error?.message || "unknown"}`,
        );
      }

      if ((index + 1) % 25 === 0 || index + 1 === orders.length) {
        console.log(
          `Progress ${index + 1}/${orders.length} | regenerated=${summary.regenerated} failed=${summary.failed}`,
        );
      }
    }
  } finally {
    await mongoose.connection.close();
  }

  console.log("Invoice regeneration completed");
  console.log(JSON.stringify(summary, null, 2));
};

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Invoice regeneration failed:", error?.message || error);
    if (error?.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
