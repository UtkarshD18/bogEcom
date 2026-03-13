import mongoose from "mongoose";

const comboOrderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productTitle: {
      type: String,
      default: "",
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    variantName: {
      type: String,
      default: "",
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    originalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    image: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

const comboOrderSchema = new mongoose.Schema(
  {
    comboId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Combo",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "order",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    comboPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    originalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    savings: {
      type: Number,
      default: 0,
      min: 0,
    },
    orderTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    items: {
      type: [comboOrderItemSchema],
      default: [],
    },
  },
  { timestamps: true },
);

comboOrderSchema.index({ comboId: 1, createdAt: -1 });
comboOrderSchema.index({ orderId: 1, comboId: 1 });
comboOrderSchema.index({ userId: 1, createdAt: -1 });

const ComboOrderModel = mongoose.model("ComboOrder", comboOrderSchema);

export default ComboOrderModel;
