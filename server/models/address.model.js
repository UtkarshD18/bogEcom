import mongoose from "mongoose";
import {
  INDIA_COUNTRY,
  buildAddressDedupeKey,
  composeAddressLine1,
  mapStructuredAddressToAddressDocument,
  normalizeStructuredAddress,
} from "../utils/addressUtils.js";

const addressSchema = mongoose.Schema(
  {
    full_name: {
      type: String,
      default: "",
      trim: true,
    },
    mobile_number: {
      type: String,
      default: "",
      trim: true,
    },
    flat_house: {
      type: String,
      default: "",
      trim: true,
    },
    area_street_sector: {
      type: String,
      default: "",
      trim: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    address_line1: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    district: {
      type: String,
      default: "",
      trim: true,
    },
    pincode: {
      type: String,
      default: "",
      trim: true,
    },
    country: {
      type: String,
      default: INDIA_COUNTRY,
      immutable: true,
    },
    mobile: {
      type: String,
      default: null,
      trim: true,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    is_default: {
      type: Boolean,
      default: false,
      index: true,
    },
    landmark: {
      type: String,
      default: "",
      trim: true,
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
    dedupeKey: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
  },
  { timestamps: true },
);

addressSchema.index({ userId: 1, is_default: -1, updatedAt: -1 });
addressSchema.index({ userId: 1, dedupeKey: 1 });

addressSchema.pre("validate", function syncStructuredAddressFields() {
  const normalized = normalizeStructuredAddress({
    full_name: this.full_name || this.name,
    mobile_number: this.mobile_number || this.mobile,
    pincode: this.pincode,
    flat_house: this.flat_house || this.address_line1,
    area_street_sector: this.area_street_sector,
    landmark: this.landmark,
    city: this.city,
    state: this.state,
    district: this.district,
    addressType: this.addressType,
    is_default: this.is_default ?? this.selected,
  });
  const mapped = mapStructuredAddressToAddressDocument(normalized, {
    is_default: this.is_default ?? this.selected,
    addressType: this.addressType,
  });

  this.full_name = mapped.full_name;
  this.mobile_number = mapped.mobile_number;
  this.flat_house = mapped.flat_house;
  this.area_street_sector = mapped.area_street_sector;
  this.landmark = mapped.landmark;
  this.city = mapped.city;
  this.state = mapped.state;
  this.district = mapped.district;
  this.pincode = mapped.pincode;
  this.country = INDIA_COUNTRY;
  this.is_default = Boolean(this.is_default ?? this.selected);
  this.selected = Boolean(this.is_default);
  this.addressType = mapped.addressType;
  this.name = mapped.name;
  this.mobile = mapped.mobile_number || null;
  this.address_line1 =
    mapped.address_line1 || composeAddressLine1(mapped);
  this.dedupeKey = buildAddressDedupeKey(mapped);
});

const AddressModel = mongoose.model("Address", addressSchema);
export default AddressModel;
