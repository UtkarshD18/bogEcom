import mongoose from "mongoose";
import connectDb from "../config/connectDb.js";
import ProductModel from "../models/product.model.js";
import { getLowStockSummaryUpdate } from "../utils/lowStockSummary.js";

const shouldApply = process.argv.includes("--apply");
const limitArg = process.argv.find((arg) =>
  String(arg || "").startsWith("--limit="),
);
const limit = Math.max(Number(limitArg?.split("=")[1] || 0), 0);

const printMode = () =>
  console.log(
    shouldApply
      ? "Applying low-stock summary backfill."
      : "Dry run only. Re-run with --apply to persist changes.",
  );

const main = async () => {
  printMode();
  await connectDb();

  const query = {
    $or: [
      { availableStock: { $exists: false } },
      { isLowStock: { $exists: false } },
      { lowStockUpdatedAt: { $exists: false } },
      { lowStockUpdatedAt: null },
    ],
  };

  let cursorQuery = ProductModel.find(query).sort({ updatedAt: -1, _id: 1 });
  if (limit > 0) {
    cursorQuery = cursorQuery.limit(limit);
  }

  const summary = {
    scanned: 0,
    changed: 0,
  };

  for await (const product of cursorQuery.cursor()) {
    summary.scanned += 1;
    const updateResult = getLowStockSummaryUpdate(product);
    if (!updateResult?.update) {
      continue;
    }

    summary.changed += 1;
    console.log(
      `[product] ${product._id} ${shouldApply ? "updating" : "would update"} low-stock summary`,
    );

    if (!shouldApply) {
      continue;
    }

    await ProductModel.updateOne({ _id: product._id }, updateResult.update);
  }

  console.log(
    `Low-stock summary backfill complete. Scanned: ${summary.scanned}, changed: ${summary.changed}.`,
  );
};

main()
  .catch((error) => {
    console.error("Low-stock summary backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
