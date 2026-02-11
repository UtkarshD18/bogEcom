import mongoose from "mongoose";

const policySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    content: {
      type: String,
      required: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
    },
    theme: {
      style: {
        type: String,
        default: "mint",
      },
      layout: {
        type: String,
        default: "glass",
      },
    },
  },
  { timestamps: true },
);

policySchema.index({ slug: 1, isActive: 1 });
policySchema.index({ effectiveDate: -1, updatedAt: -1 });

const PolicyModel = mongoose.model("Policy", policySchema);

export default PolicyModel;
