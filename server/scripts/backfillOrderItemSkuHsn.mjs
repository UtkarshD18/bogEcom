/**
 * Backfill Script: Populate order item SKU/HSN snapshots for legacy orders.
 *
 * Usage:
 *   node scripts/backfillOrderItemSkuHsn.mjs --dry-run
 *   node scripts/backfillOrderItemSkuHsn.mjs --apply --default-hsn 200811
 *   node scripts/backfillOrderItemSkuHsn.mjs --apply --start 2026-02-01 --end 2026-03-24 --default-hsn 200811
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "";
if (!MONGO_URI) {
  throw new Error("Missing MongoDB URI. Set MONGO_URI or MONGODB_URI in server/.env");
}

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readArg = (flag) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return "";
  return String(args[idx + 1] || "").trim();
};

const isDryRun = hasFlag("--dry-run") || !hasFlag("--apply");
const includeSku = hasFlag("--include-sku");
const defaultHsn = String(readArg("--default-hsn") || "").replace(/\D/g, "").slice(0, 6);
const productIdsFilter = new Set(
  String(readArg("--product-ids") || "")
    .split(",")
    .map((value) => String(value || "").trim())
    .filter(Boolean),
);
const startDateArg = readArg("--start");
const endDateArg = readArg("--end");

const toDate = (value, isEnd = false) => {
  if (!value) return null;
  const normalized = value.includes("T")
    ? value
    : `${value}T${isEnd ? "23:59:59.999Z" : "00:00:00.000Z"}`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const pickVariant = ({ variants, variantId, variantName }) => {
  const list = Array.isArray(variants) ? variants : [];
  if (list.length === 0) return null;

  const byId = list.find((variant) => String(variant?._id || "") === String(variantId || ""));
  if (byId) return byId;

  const normalizedVariantName = String(variantName || "").trim().toLowerCase();
  if (normalizedVariantName) {
    const byName = list.find(
      (variant) => String(variant?.name || "").trim().toLowerCase() === normalizedVariantName,
    );
    if (byName) return byName;
  }

  const byDefault = list.find((variant) => variant?.isDefault === true);
  if (byDefault) return byDefault;

  return list[0] || null;
};

async function main() {
  const { default: OrderModel } = await import("../models/order.model.js");
  const { default: ProductModel } = await import("../models/product.model.js");

  const startDate = toDate(startDateArg, false);
  const endDate = toDate(endDateArg, true);
  if ((startDateArg && !startDate) || (endDateArg && !endDate)) {
    throw new Error("Invalid --start or --end date. Use YYYY-MM-DD or ISO string.");
  }

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 20000 });

  const query = {
    products: {
      $elemMatch: {
        $or: [
          { hsnCode: { $exists: false } },
          { hsnCode: { $in: [null, ""] } },
          ...(includeSku
            ? [{ sku: { $exists: false } }, { sku: { $in: [null, ""] } }]
            : []),
        ],
        ...(productIdsFilter.size > 0
          ? { productId: { $in: Array.from(productIdsFilter) } }
          : {}),
      },
    },
  };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = startDate;
    if (endDate) query.createdAt.$lte = endDate;
  }

  const orders = await OrderModel.find(query)
    .select("_id orderNumber createdAt products")
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (orders.length === 0) {
    console.log("No orders found that require SKU/HSN backfill.");
    await mongoose.disconnect();
    return;
  }

  const productIds = [
    ...new Set(
      orders.flatMap((order) =>
        (order.products || [])
          .map((item) => String(item?.productId || "").trim())
          .filter(Boolean),
      ),
    ),
  ];

  const objectIdProductIds = productIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const slugProductIds = productIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));

  const [byObjectId, bySlug] = await Promise.all([
    objectIdProductIds.length
      ? ProductModel.find({ _id: { $in: objectIdProductIds } })
          .select("_id slug sku hsnCode variants")
          .lean()
      : [],
    slugProductIds.length
      ? ProductModel.find({ slug: { $in: slugProductIds } })
          .select("_id slug sku hsnCode variants")
          .lean()
      : [],
  ]);

  const productMap = new Map();
  [...byObjectId, ...bySlug].forEach((product) => {
    const idKey = String(product?._id || "").trim();
    if (idKey) productMap.set(idKey, product);
    const slugKey = String(product?.slug || "").trim();
    if (slugKey) productMap.set(slugKey, product);
  });

  let updatedOrders = 0;
  let updatedItems = 0;
  let defaultHsnAppliedItems = 0;

  const updates = [];
  for (const order of orders) {
    const originalItems = Array.isArray(order.products) ? order.products : [];
    let orderChanged = false;

    const nextItems = originalItems.map((item) => {
      const currentSku = String(item?.sku || "").trim().toUpperCase();
      const currentHsn = String(item?.hsnCode || "").trim();
      if ((!includeSku || currentSku) && currentHsn) {
        return item;
      }

      const productId = String(item?.productId || "").trim();
      if (productIdsFilter.size > 0 && !productIdsFilter.has(productId)) {
        return item;
      }
      const product = productMap.get(productId) || null;
      const variant = pickVariant({
        variants: product?.variants,
        variantId: item?.variantId,
        variantName: item?.variantName,
      });

      const resolvedSku = includeSku
        ? currentSku ||
          String(variant?.sku || product?.sku || "")
            .trim()
            .toUpperCase()
        : currentSku;

      let resolvedHsn =
        currentHsn ||
        String(variant?.hsnCode || product?.hsnCode || "")
          .replace(/\D/g, "")
          .slice(0, 6);

      let usedDefaultHsn = false;
      if (!resolvedHsn && defaultHsn) {
        resolvedHsn = defaultHsn;
        usedDefaultHsn = true;
      }

      if (resolvedSku === currentSku && resolvedHsn === currentHsn) {
        return item;
      }

      orderChanged = true;
      updatedItems += 1;
      if (usedDefaultHsn) defaultHsnAppliedItems += 1;

      return {
        ...item,
        sku: resolvedSku,
        hsnCode: resolvedHsn,
      };
    });

    if (!orderChanged) continue;

    updatedOrders += 1;
    updates.push({
      orderId: String(order._id),
      orderNumber: String(order.orderNumber || ""),
      createdAt: order.createdAt,
      products: nextItems,
    });
  }

  console.log(
    JSON.stringify(
      {
        totalOrdersScanned: orders.length,
        updatedOrders,
        updatedItems,
        defaultHsnAppliedItems,
        dryRun: isDryRun,
        includeSku,
        defaultHsn: defaultHsn || null,
        productIdsFilter: Array.from(productIdsFilter),
      },
      null,
      2,
    ),
  );

  const sample = updates.slice(0, 5).map((u) => ({
    orderId: u.orderId,
    orderNumber: u.orderNumber,
    createdAt: u.createdAt,
  }));
  if (sample.length > 0) {
    console.log("Sample updated orders:", JSON.stringify(sample, null, 2));
  }

  if (isDryRun) {
    console.log("Dry-run mode: no DB updates applied.");
    await mongoose.disconnect();
    return;
  }

  if (updates.length === 0) {
    await mongoose.disconnect();
    return;
  }

  const bulkOps = updates.map((u) => ({
    updateOne: {
      filter: { _id: new mongoose.Types.ObjectId(u.orderId) },
      update: { $set: { products: u.products } },
    },
  }));

  const result = await OrderModel.bulkWrite(bulkOps, { ordered: false });
  console.log(
    "Backfill complete:",
    JSON.stringify(
      {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("backfillOrderItemSkuHsn failed:", error?.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
