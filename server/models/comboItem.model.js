import mongoose from "mongoose";

const comboItemSchema = new mongoose.Schema(
  {
    comboId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Combo",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    productTitle: {
      type: String,
      default: "",
      trim: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    variantName: {
      type: String,
      default: "",
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
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
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
  },
  { timestamps: true },
);

comboItemSchema.index({ comboId: 1, productId: 1 });

const ComboItemModel = mongoose.model("ComboItem", comboItemSchema);

export default ComboItemModel;
