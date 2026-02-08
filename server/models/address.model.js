import mongoose from "mongoose";
const addressSchema = mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
    },
    address_line1: {
      type: String,
      default: "",
    },
    city: {
      type: String,
      default: "",
    },
    state: {
      type: String,
      default: "",
    },
    pincode: {
      type: String,
    },
    country: {
      type: String,
      default: "India",
    },
    mobile: {
      type: Number,
      default: null,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    landmark: {
      type: String,
      default: "",
    },
    addressType: {
      type: String,
      enum: ["Home", "Work", "Other"],
      default: "Home",
    },
    location: {
      latitude: { type: Number, default: null, select: false },
      longitude: { type: Number, default: null, select: false },
      formattedAddress: { type: String, default: "", select: false, trim: true },
      source: {
        type: String,
        enum: ["manual", "google_maps"],
        default: "manual",
        select: false,
      },
      capturedAt: { type: Date, default: null, select: false },
    },
    userId: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);
const AddressModel = mongoose.model("Address", addressSchema);
export default AddressModel;
