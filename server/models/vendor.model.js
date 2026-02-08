import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Vendor name is required"],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    pincode: {
      type: String,
      trim: true,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      default: "",
    },
    gst: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

vendorSchema.index({ fullName: 1 });
vendorSchema.index({ isActive: 1 });

const VendorModel =
  mongoose.models.Vendor || mongoose.model("Vendor", vendorSchema);

export default VendorModel;
