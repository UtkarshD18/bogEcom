import mongoose from "mongoose";

const inventoryAuditSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    action: {
      type: String,
      enum: ["RESERVE", "CONFIRM", "RELEASE", "RESTORE", "PO_RECEIVE"],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    before: {
      stock_quantity: { type: Number, default: 0 },
      reserved_quantity: { type: Number, default: 0 },
    },
    after: {
      stock_quantity: { type: Number, default: 0 },
      reserved_quantity: { type: Number, default: 0 },
    },
    source: {
      type: String,
      enum: ["ORDER", "PAYMENT", "PO", "SYSTEM"],
      required: true,
      index: true,
    },
    referenceId: {
      type: String,
      default: "",
      index: true,
    },
  },
  { timestamps: true },
);

inventoryAuditSchema.index({ createdAt: -1 });

const InventoryAuditModel = mongoose.model("InventoryAudit", inventoryAuditSchema);

export default InventoryAuditModel;
