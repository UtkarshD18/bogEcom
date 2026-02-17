import dotenv from "dotenv";
import mongoose from "mongoose";
import ProductModel from "../models/product.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "";

if (!MONGO_URI) {
  console.error("Missing MONGO_URI for inventory backfill");
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(MONGO_URI);

  try {
    const reservedResult = await ProductModel.updateMany(
      {
        $or: [
          { reserved_quantity: { $exists: false } },
          { reserved_quantity: null },
        ],
      },
      { $set: { reserved_quantity: 0 } },
    );

    const trackFromLegacy = await ProductModel.updateMany(
      {
        $and: [
          {
            $or: [
              { track_inventory: { $exists: false } },
              { track_inventory: null },
            ],
          },
          {
            $or: [
              { trackInventory: { $exists: true } },
              { trackInventory: { $type: "bool" } },
            ],
          },
        ],
      },
      [
        {
          $set: {
            track_inventory: {
              $ifNull: ["$trackInventory", true],
            },
          },
        },
      ],
      { updatePipeline: true },
    );

    const trackResult = await ProductModel.updateMany(
      {
        $or: [
          { track_inventory: { $exists: false } },
          { track_inventory: null },
        ],
      },
      { $set: { track_inventory: true } },
    );

    const lowStockFromLegacy = await ProductModel.updateMany(
      {
        $and: [
          {
            $or: [
              { low_stock_threshold: { $exists: false } },
              { low_stock_threshold: null },
            ],
          },
          {
            $or: [
              { lowStockThreshold: { $exists: true } },
              { lowStockThreshold: { $type: "number" } },
            ],
          },
        ],
      },
      [
        {
          $set: {
            low_stock_threshold: {
              $ifNull: ["$lowStockThreshold", 5],
            },
          },
        },
      ],
      { updatePipeline: true },
    );

    const lowStockResult = await ProductModel.updateMany(
      {
        $or: [
          { low_stock_threshold: { $exists: false } },
          { low_stock_threshold: null },
        ],
      },
      { $set: { low_stock_threshold: 5 } },
    );

    // Use updatePipeline for field-to-field assignments (Mongoose v9 requirement).
    const stockQuantityFromStock = await ProductModel.updateMany(
      {
        $and: [
          {
            $or: [
              { stock_quantity: { $exists: false } },
              { stock_quantity: null },
            ],
          },
          {
            $or: [{ stock: { $exists: true } }, { stock: { $type: "number" } }],
          },
        ],
      },
      [
        {
          $set: {
            stock_quantity: {
              $ifNull: ["$stock", 0],
            },
          },
        },
      ],
      { updatePipeline: true },
    );

    const stockFromStockQuantity = await ProductModel.updateMany(
      {
        $and: [
          {
            $or: [{ stock: { $exists: false } }, { stock: null }],
          },
          {
            $or: [
              { stock_quantity: { $exists: true } },
              { stock_quantity: { $type: "number" } },
            ],
          },
        ],
      },
      [
        {
          $set: {
            stock: {
              $ifNull: ["$stock_quantity", 0],
            },
          },
        },
      ],
      { updatePipeline: true },
    );

    const stockQuantityFallback = await ProductModel.updateMany(
      {
        $and: [
          {
            $or: [
              { stock_quantity: { $exists: false } },
              { stock_quantity: null },
            ],
          },
          {
            $or: [{ stock: { $exists: false } }, { stock: null }],
          },
        ],
      },
      { $set: { stock_quantity: 0 } },
    );

    // Backfill variant inventory fields from legacy variant.stock.
    const variantBackfill = await ProductModel.updateMany(
      { variants: { $exists: true, $ne: [] } },
      [
        {
          $set: {
            variants: {
              $map: {
                input: "$variants",
                as: "variant",
                in: {
                  $mergeObjects: [
                    "$$variant",
                    {
                      stock_quantity: {
                        $ifNull: [
                          "$$variant.stock_quantity",
                          {
                            $ifNull: ["$$variant.stock", 0],
                          },
                        ],
                      },
                      stock: {
                        $ifNull: [
                          "$$variant.stock",
                          {
                            $ifNull: ["$$variant.stock_quantity", 0],
                          },
                        ],
                      },
                      reserved_quantity: {
                        $ifNull: ["$$variant.reserved_quantity", 0],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ],
      { updatePipeline: true },
    );

    console.log("Inventory backfill complete", {
      reserved: {
        matched: reservedResult.matchedCount,
        modified: reservedResult.modifiedCount,
      },
      trackInventory: {
        matched: trackResult.matchedCount,
        modified: trackResult.modifiedCount,
      },
      trackFromLegacy: {
        matched: trackFromLegacy.matchedCount,
        modified: trackFromLegacy.modifiedCount,
      },
      lowStockThreshold: {
        matched: lowStockResult.matchedCount,
        modified: lowStockResult.modifiedCount,
      },
      lowStockFromLegacy: {
        matched: lowStockFromLegacy.matchedCount,
        modified: lowStockFromLegacy.modifiedCount,
      },
      stockQuantityFromStock: {
        matched: stockQuantityFromStock.matchedCount,
        modified: stockQuantityFromStock.modifiedCount,
      },
      stockFromStockQuantity: {
        matched: stockFromStockQuantity.matchedCount,
        modified: stockFromStockQuantity.modifiedCount,
      },
      stockQuantityFallback: {
        matched: stockQuantityFallback.matchedCount,
        modified: stockQuantityFallback.modifiedCount,
      },
      variantBackfill: {
        matched: variantBackfill.matchedCount,
        modified: variantBackfill.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Inventory backfill failed", {
      message: error?.message || "Unknown error",
      stack: error?.stack,
    });
    throw error;
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Inventory backfill failed", error);
  process.exit(1);
});
