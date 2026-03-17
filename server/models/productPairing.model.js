import mongoose from "mongoose";

const productPairingSchema = new mongoose.Schema(
  {
    productAId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    productBId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    pairCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    confidenceScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

productPairingSchema.index(
  { productAId: 1, productBId: 1 },
  { unique: true },
);
productPairingSchema.index({ pairCount: -1, confidenceScore: -1 });

const ProductPairingModel = mongoose.model(
  "ProductPairing",
  productPairingSchema,
  "product_pairings",
);

export default ProductPairingModel;
