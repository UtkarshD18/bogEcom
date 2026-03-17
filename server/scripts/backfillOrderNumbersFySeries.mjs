/**
 * Backfill Script: Assign FY-based order numbers (e.g. H1G2526/0001) to existing orders.
 *
 * Why:
 * - Older orders may only have legacy display IDs (e.g. BOG-XXXXXXXX).
 * - Admin export + invoices can use `orderNumber` for consistent reporting.
 *
 * Usage:
 *   node scripts/backfillOrderNumbersFySeries.mjs --dry-run
 *   node scripts/backfillOrderNumbersFySeries.mjs --apply
 *
 * Options:
 *   --fy 2526          Restrict to a specific fiscal year code (default: current FY)
 *   --prefix H1G       Override prefix (default: ORDER_NUMBER_PREFIX env or H1G)
 *
 * Notes:
 * - Updates `orderNumber` and `displayOrderId` only.
 * - Does NOT modify invoiceNumber / invoicePath (avoids breaking already-issued invoices).
 * - Safe by default (dry-run).
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

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run") || !args.has("--apply");

const readArgValue = (flag) => {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
};

const resolveFiscalYearCode = (date = new Date()) => {
  const safeDate = date instanceof Date ? date : new Date(date);
  const year = safeDate.getFullYear();
  const month = safeDate.getMonth(); // 0-based
  // India FY: Apr (3) -> Mar (2)
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  const yy = (value) => String(value).slice(-2);
  return `${yy(startYear)}${yy(endYear)}`;
};

const normalizePrefix = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const buildOrderNumber = ({ prefix, fiscalYearCode, seq }) => {
  const safeSeq = Math.max(Number(seq || 0), 0);
  const padded = String(safeSeq).padStart(4, "0");
  return `${prefix}${String(fiscalYearCode || "").trim()}/${padded}`.toUpperCase();
};

const redactedMongo = MONGO_URI.replace(/\/\/.*@/, "//***@");

async function main() {
  const { default: OrderModel } = await import("../models/order.model.js");
  const { default: OrderSequenceModel } = await import(
    "../models/orderSequence.model.js"
  );

  const requestedFy = String(readArgValue("--fy") || "").trim();
  const fy =
    requestedFy && /^\d{4}$/.test(requestedFy)
      ? requestedFy
      : resolveFiscalYearCode(new Date());

  const prefix = normalizePrefix(
    readArgValue("--prefix") || process.env.ORDER_NUMBER_PREFIX || "H1G",
  ) || "H1G";

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  // eslint-disable-next-line no-console
  console.log("Connected to MongoDB:", redactedMongo);

  // Restrict to this FY window so numbering is year-wise.
  const startYear = 2000 + Number(fy.slice(0, 2));
  const fyStart = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0)); // Apr 1
  const fyEnd = new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999)); // Mar 31

  const match = {
    purchaseOrder: null,
    createdAt: { $gte: fyStart, $lte: fyEnd },
    $or: [
      { orderNumber: { $in: [null, ""] } },
      { orderNumber: { $regex: /^BOG-/i } },
      { displayOrderId: { $in: [null, ""] } },
      { displayOrderId: { $regex: /^BOG-/i } },
    ],
  };

  const candidates = await OrderModel.find(match)
    .select("_id createdAt orderNumber displayOrderId")
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (candidates.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`No orders found requiring backfill for FY ${fy}.`);
    await mongoose.disconnect();
    return;
  }

  // Compute current max sequence in DB for this FY (if any).
  const pattern = new RegExp(`^${prefix}${fy}\\/([0-9]{4})$`, "i");
  const existing = await OrderModel.find({
    createdAt: { $gte: fyStart, $lte: fyEnd },
    orderNumber: { $regex: pattern },
  })
    .select("orderNumber")
    .lean();
  const usedSeqs = existing
    .map((o) => {
      const m = String(o?.orderNumber || "").match(pattern);
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
  const maxUsed = usedSeqs.length ? Math.max(...usedSeqs) : 0;

  let seq = maxUsed;
  const updates = candidates.map((order) => {
    seq += 1;
    const next = buildOrderNumber({ prefix, fiscalYearCode: fy, seq });
    return {
      _id: String(order._id),
      createdAt: order.createdAt,
      from: order.orderNumber || order.displayOrderId || "",
      to: next,
    };
  });

  // eslint-disable-next-line no-console
  console.log(
    `FY ${fy}: Found ${candidates.length} orders to backfill. Existing max=${maxUsed}. New max=${seq}.`,
  );
  // eslint-disable-next-line no-console
  console.log("Sample (first 10):");
  updates.slice(0, 10).forEach((u) => {
    // eslint-disable-next-line no-console
    console.log(`- ${u._id} ${u.createdAt?.toISOString?.() || ""} ${u.from} -> ${u.to}`);
  });

  if (isDryRun) {
    // eslint-disable-next-line no-console
    console.log("\nDry-run mode: no changes applied. Re-run with --apply to update.");
    await mongoose.disconnect();
    return;
  }

  const bulkOps = updates.map((u) => ({
    updateOne: {
      filter: { _id: new mongoose.Types.ObjectId(u._id) },
      update: {
        $set: {
          orderNumber: u.to,
          displayOrderId: u.to,
        },
      },
    },
  }));

  const bulkResult = await OrderModel.bulkWrite(bulkOps, { ordered: false });

  const seqKey = `${prefix}${fy}`.toUpperCase();
  await OrderSequenceModel.findOneAndUpdate(
    { _id: seqKey },
    { $max: { seq } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  // eslint-disable-next-line no-console
  console.log("Backfill complete:", {
    matched: bulkResult.matchedCount,
    modified: bulkResult.modifiedCount,
    seqKey,
    seq,
  });

  await mongoose.disconnect();
}

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("Backfill failed:", error?.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});

