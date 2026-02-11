import mongoose from "mongoose";

const purchaseOrderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productTitle: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    qty_received: {
      type: Number,
      default: null,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    subTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    image: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    items: {
      type: [purchaseOrderItemSchema],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "Purchase order must contain at least one item",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    tax: {
      type: Number,
      required: true,
      min: 0,
    },
    shipping: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    gst: {
      rate: { type: Number, default: 5 },
      state: { type: String, default: "" },
      taxableAmount: { type: Number, default: 0 },
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 },
      igst: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["draft", "approved", "received", "converted"],
      default: "draft",
      index: true,
    },
    inventory_applied: {
      type: Boolean,
      default: false,
      index: true,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    receivedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
    },
    guestDetails: {
      fullName: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
      pincode: { type: String, default: "" },
      state: { type: String, default: "" },
      email: { type: String, default: "" },
      gst: { type: String, default: "" },
    },
    deliveryAddressId: {
      type: mongoose.Schema.ObjectId,
      ref: "Address",
      default: null,
    },
    convertedOrderId: {
      type: mongoose.Schema.ObjectId,
      ref: "order",
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

purchaseOrderSchema.index({ createdAt: -1 });
purchaseOrderSchema.index({ userId: 1, status: 1, createdAt: -1 });

const PurchaseOrderModel = mongoose.model("PurchaseOrder", purchaseOrderSchema);

export default PurchaseOrderModel;
