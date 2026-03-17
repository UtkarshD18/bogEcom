/**
 * Backfill Script: Set Peanut Butter HSN Code (6-digit) for existing products/variants.
 *
 * Requirement (from GST sheet): Peanut Butter (chocolate/creamy/crispy/crunchy) -> HSN 200811
 *
 * Usage:
 *   node scripts/backfillPeanutButterHsn200811.mjs --dry-run
 *   node scripts/backfillPeanutButterHsn200811.mjs --apply
 *
 * Notes:
 * - Updates BOTH product.hsnCode and variants[].hsnCode so invoice + exports pick it up.
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
const HSN = "200811";

if (!MONGO_URI) {
  throw new Error("Missing MongoDB URI. Set MONGO_URI or MONGODB_URI in server/.env");
}

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run") || !args.has("--apply");

const redactedMongo = MONGO_URI.replace(/\/\/.*@/, "//***@");

const normalize = (value) => String(value || "").trim().toLowerCase();

const shouldUpdateProduct = (product) => {
  const name = normalize(product?.name);
  if (!name.includes("peanut butter")) return false;

  // Match the SKUs from the provided GST list (Chocolate/Creamy/Crispy/Crisp/Crunchy).
  const tokens = ["chocolate", "creamy", "crispy", "crisp", "crunchy"];
  return tokens.some((token) => name.includes(token));
};

async function main() {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  console.log("Connected to MongoDB:", redactedMongo);

  const { default: ProductModel } = await import("../models/product.model.js");

  const candidates = await ProductModel.find({ name: /peanut butter/i })
    .select("_id name hsnCode variants._id variants.name variants.sku variants.hsnCode")
    .lean();

  const targets = candidates.filter(shouldUpdateProduct);

  if (targets.length === 0) {
    console.log("No Peanut Butter products found that match chocolate/creamy/crispy/crunchy.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${targets.length} Peanut Butter products to update to HSN ${HSN}.`);
  targets.forEach((p) => {
    console.log(`- ${p.name} (${p._id}) product.hsnCode="${p.hsnCode || ""}" variants=${(p.variants || []).length}`);
  });

  if (isDryRun) {
    console.log("\nDry-run mode: no changes applied. Re-run with --apply to update.");
    await mongoose.disconnect();
    return;
  }

  let updated = 0;

  for (const target of targets) {
    const product = await ProductModel.findById(target._id);
    if (!product) continue;

    product.hsnCode = HSN;
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      product.variants.forEach((variant) => {
        variant.hsnCode = HSN;
      });
    }

    await product.save();
    updated += 1;
  }

  console.log(`\nUpdated ${updated}/${targets.length} products.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Backfill failed:", error?.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});

