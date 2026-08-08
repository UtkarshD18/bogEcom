import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEnvPath = path.join(__dirname, "..", ".env");

// Manual parser for env files to make this script dependency-free
const parseEnvFile = (filePath) => {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key] = val;
  }
  return env;
};

const env = parseEnvFile(serverEnvPath);
const mongoUri = env.MONGO_URI || process.env.MONGO_URI;

if (!mongoUri) {
  console.error("❌ MONGO_URI is not set in server/.env or process.env");
  process.exit(1);
}

// Schemas
const productSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.model("Product", productSchema);

const categorySchema = new mongoose.Schema({}, { strict: false });
const Category = mongoose.model("Category", categorySchema);

const reviewSchema = new mongoose.Schema({}, { strict: false });
const Review = mongoose.model("Review", reviewSchema);

const orderSchema = new mongoose.Schema({}, { strict: false });
const Order = mongoose.model("order", orderSchema);

async function verifyRealism() {
  console.log("\n=== bogEcom Database Realism Verification ===");
  try {
    await mongoose.connect(mongoUri);
    console.log("🟢 Connected to MongoDB");

    // 1. Verify categories exist and are populated
    const categories = await Category.find({});
    console.log(`📂 Categories: ${categories.length} found`);
    if (categories.length === 0) throw new Error("No categories found in database");
    for (const cat of categories) {
      if (cat.productCount === 0) {
        console.warn(`  ⚠️ Category [${cat.name}] has 0 products.`);
      }
    }

    // 2. Verify products exist
    const products = await Product.find({}).lean();
    console.log(`🥜 Products: ${products.length} found`);
    if (products.length === 0) throw new Error("No products found in database");

    // 3. Verify best sellers (used as featured products on the homepage) exist
    const bestSellers = products.filter(p => p.isBestSeller);
    console.log(`⭐ Best Sellers (Featured): ${bestSellers.length} found`);
    if (bestSellers.length === 0) throw new Error("No best seller (featured) products found");

    // 5. Verify new arrivals exist
    const newArrivals = products.filter(p => p.isNewArrival);
    console.log(`✨ New Arrivals: ${newArrivals.length} found`);
    if (newArrivals.length === 0) throw new Error("No new arrivals found");

    // 6. Verify discounted products exist
    const discounted = products.filter(p => p.originalPrice > p.price);
    console.log(`🏷️  Discounted Products: ${discounted.length} found`);
    if (discounted.length === 0) throw new Error("No discounted products found");

    // 7. Verify out-of-stock products exist
    const outOfStock = products.filter(p => p.stock === 0);
    console.log(`❌ Out-of-Stock Products: ${outOfStock.length} found`);
    if (outOfStock.length === 0) throw new Error("No out-of-stock products found");

    // 8. Verify low-stock products exist
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5);
    console.log(`⚠️  Low-Stock Products (<=5): ${lowStock.length} found`);
    if (lowStock.length === 0) throw new Error("No low-stock products found");

    // 9. Verify reviews distribution
    const reviews = await Review.find({}).lean();
    console.log(`💬 Total Reviews: ${reviews.length} found`);
    if (reviews.length === 0) throw new Error("No reviews found in database");

    const reviewCounts = products.map(p => {
      const count = reviews.filter(r => String(r.productId) === String(p._id)).length;
      return { name: p.name, count };
    });

    console.log("📊 Review Distribution Sample:");
    for (const item of reviewCounts.slice(0, 5)) {
      console.log(`  - [${item.name}]: ${item.count} reviews`);
    }

    const hasZeroReviews = reviewCounts.some(item => item.count === 0);
    const hasManyReviews = reviewCounts.some(item => item.count >= 3);
    if (!hasZeroReviews || !hasManyReviews) {
      throw new Error("Review distribution is not naturally distributed (need both reviewed and unreviewed items)");
    }

    // 10. Verify recent orders exist
    const orders = await Order.find({}).lean();
    console.log(`📦 Historical Orders: ${orders.length} found`);
    if (orders.length === 0) throw new Error("No orders found");

    console.log("\n🟢 bogEcom Database Realism Validation PASSED.\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ bogEcom Database Realism Validation FAILED:");
    console.error(error.message || error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

verifyRealism();
