import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    change_type: {
      type: String,
      required: true,
      trim: true,
    },
    quantity_change: {
      type: Number,
      required: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    reference_id: {
      type: String,
      default: null,
      trim: true,
    },
    previous_stock: {
      type: Number,
      required: true,
    },
    new_stock: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  },
);

stockMovementSchema.index({ variant_id: 1, created_at: -1 });
stockMovementSchema.index({ reference_id: 1, created_at: -1 });

const StockMovementModel = mongoose.model(
  "StockMovement",
  stockMovementSchema,
  "stock_movements",
);

export default StockMovementModel;
