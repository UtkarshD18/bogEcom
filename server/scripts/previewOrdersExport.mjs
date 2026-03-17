/**
 * Preview Script: Generate the admin order export XLSX locally (without running the server).
 *
 * Usage:
 *   node scripts/previewOrdersExport.mjs --start 2026-02-11 --end 2026-03-13
 *   node scripts/previewOrdersExport.mjs --start 2026-02-11 --end 2026-03-13 --include-rto
 *   node scripts/previewOrdersExport.mjs --start 2026-02-11 --end 2026-03-13 --out ..\\..\\tmp\\order-report-preview.xlsx
 *
 * Notes:
 * - Reads MongoDB URI from server/.env (MONGO_URI or MONGODB_URI)
 * - Uses the same controller as the API export endpoint.
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";

import { exportOrdersReport } from "../controllers/reportController.js";

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
  if (idx === -1) return null;
  return args[idx + 1] || null;
};

const start = readArg("--start");
const end = readArg("--end");
if (!start || !end) {
  // eslint-disable-next-line no-console
  console.error("Missing --start/--end. Example: --start 2026-02-11 --end 2026-03-13");
  process.exitCode = 1;
  process.exit(1);
}

const includeRto = hasFlag("--include-rto");
const outArg = readArg("--out");
const defaultOut = path.join(
  __dirname,
  "..",
  "..",
  "tmp",
  `order-report-preview-${start}_to_${end}${includeRto ? "-with-rto" : ""}.xlsx`,
);
const outPath = path.resolve(__dirname, outArg || defaultOut);

fs.mkdirSync(path.dirname(outPath), { recursive: true });

const redactedMongo = MONGO_URI.replace(/\/\/.*@/, "//***@");

async function main() {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  // eslint-disable-next-line no-console
  console.log("Connected to MongoDB:", redactedMongo);

  const stream = fs.createWriteStream(outPath);

  // Minimal Express-like response wrapper: the controller writes XLSX bytes to this stream.
  const res = stream;
  res.headersSent = false;
  res.setHeader = () => {};
  res.status = () => res;
  res.json = (payload) => {
    // eslint-disable-next-line no-console
    console.error("Export failed:", payload);
    try {
      stream.end();
    } catch {
      // ignore
    }
  };

  const req = {
    query: {
      startDate: start,
      endDate: end,
      includeRto: includeRto ? "true" : "false",
    },
  };

  await new Promise((resolve, reject) => {
    const onError = (err) => reject(err);
    stream.once("error", onError);
    stream.once("close", () => resolve());
    stream.once("finish", () => resolve());

    Promise.resolve(exportOrdersReport(req, res, (err) => (err ? reject(err) : resolve())))
      .catch(reject)
      .finally(() => {
        stream.off("error", onError);
      });
  });

  await mongoose.disconnect();
  // eslint-disable-next-line no-console
  console.log("Wrote:", outPath);
}

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("Preview export failed:", error?.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});

