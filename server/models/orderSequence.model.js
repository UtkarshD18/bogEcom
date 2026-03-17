import mongoose from "mongoose";

const orderSequenceSchema = new mongoose.Schema(
  {
    // e.g. "HOG-2526" (prefix + fiscal year code)
    _id: { type: String, required: true, trim: true },
    seq: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "order_sequences",
  },
);

const OrderSequenceModel =
  mongoose.models.OrderSequence ||
  mongoose.model("OrderSequence", orderSequenceSchema);

export default OrderSequenceModel;

