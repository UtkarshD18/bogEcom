import mongoose from "mongoose";

const sequenceSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    value: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const SequenceModel = mongoose.model("sequence", sequenceSchema);

export default SequenceModel;
