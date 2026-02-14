/**
 * Migration Script: Convert existing products to weight-based variants
 *
 * For each product that does NOT already have variants:
 * 1. Creates a 500g default variant from existing price/stock
 * 2. Auto-creates a 1000g (1 Kg) variant at ~1.8x price
 * 3. Sets hasVariants = true, variantType = "weight"
 *
 * Usage:  node --experimental-modules scripts/migrateVariants.js
 *   or:   node scripts/migrateVariants.js  (if "type": "module" in package.json)
 *
 * SAFE: Only modifies products where hasVariants is false / variants is empty.
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/bogEcom";

async function migrate() {
  try {

    await mongoose.connect(MONGO_URI);
    console.log(
      "Connected to MongoDB:",
      MONGO_URI.replace(/\/\/.*@/, "//***@"),
    );

    // Import product model dynamically after connection
    const { default: ProductModel } =
      await import("../models/product.model.js");

    // Find products without variants
    const products = await ProductModel.find({
      $or: [
        { hasVariants: false },
        { hasVariants: { $exists: false } },
        { variants: { $size: 0 } },
        { variants: { $exists: false } },
      ],
    });

    console.log(`\nFound ${products.length} products without variants.\n`);

    let migrated = 0;
    let skipped = 0;

    for (const product of products) {
      // Skip if product already has populated variants
      if (product.variants && product.variants.length > 0) {
        console.log(
          `  SKIP: "${product.name}" already has ${product.variants.length} variants`,
        );
        skipped++;
        continue;
      }

      const currentWeight = product.weight || 500;
      const currentUnit =
        product.unit && product.unit !== "piece" ? product.unit : "g";
      const currentPrice = product.price || 0;
      const currentOriginalPrice = product.originalPrice || 0;
      const currentStock = product.stock_quantity ?? product.stock ?? 0;
      const skuBase = product.sku || product.name.substring(0, 3).toUpperCase();

      // Create 500g variant from existing product data
      const variant500 = {
        name: `${currentWeight}${currentUnit}`,
        sku: `${skuBase}-500G`,
        price: currentPrice,
        originalPrice:
          currentOriginalPrice > 0 ? currentOriginalPrice : undefined,
        discountPercent:
          currentOriginalPrice > currentPrice
            ? Math.round(
                ((currentOriginalPrice - currentPrice) / currentOriginalPrice) *
                  100,
              )
            : 0,
        weight: currentWeight,
        unit: currentUnit,
        isDefault: true,
        stock: currentStock,
        stock_quantity: currentStock,
        reserved_quantity: product.reserved_quantity || 0,
      };

      // Create 1000g variant at ~1.8x price
      const price1kg = Math.round(currentPrice * 1.8);
      const origPrice1kg =
        currentOriginalPrice > 0 ? Math.round(currentOriginalPrice * 2) : 0;
      const stock1kg = Math.max(Math.floor(currentStock / 2), 0);

      const variant1000 = {
        name: "1 Kg",
        sku: `${skuBase}-1KG`,
        price: price1kg,
        originalPrice: origPrice1kg > 0 ? origPrice1kg : undefined,
        discountPercent:
          origPrice1kg > price1kg
            ? Math.round(((origPrice1kg - price1kg) / origPrice1kg) * 100)
            : 0,
        weight: 1000,
        unit: "g",
        isDefault: false,
        stock: stock1kg,
        stock_quantity: stock1kg,
        reserved_quantity: 0,
      };

      product.hasVariants = true;
      product.variantType = "weight";
      product.variants = [variant500, variant1000];

      await product.save();
      console.log(
        `  MIGRATED: "${product.name}" → 2 variants (${variant500.name}, ${variant1000.name})`,
      );
      migrated++;
    }

    console.log(`\n--- Migration Complete ---`);
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped : ${skipped}`);
    console.log(`  Total   : ${products.length}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrate();
