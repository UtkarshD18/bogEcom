import crypto from "crypto";

export const INDIA_COUNTRY = "India";

export const ADDRESS_DEV_SAMPLE = Object.freeze({
  full_name: "Rahul Sharma",
  mobile_number: "9876543210",
  pincode: "302017",
  flat_house: "B-42",
  area_street_sector: "SKIT Road",
  landmark: "Near Apollo Hospital",
  city: "Jaipur",
  state: "Rajasthan",
  district: "Jaipur",
  country: INDIA_COUNTRY,
  is_default: true,
  addressType: "Home",
});

const DEFAULT_ADDRESS_TYPE = "Home";
const VALID_ADDRESS_TYPES = new Set(["Home", "Work", "Other"]);

const cleanText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const toTitleCase = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

export const normalizeMobileNumber = (value) => digitsOnly(value).slice(-10);

export const normalizePincode = (value) => digitsOnly(value).slice(0, 6);

export const composeAddressLine1 = ({
  flat_house = "",
  area_street_sector = "",
} = {}) => [cleanText(flat_house), cleanText(area_street_sector)].filter(Boolean).join(", ");

export const composeFullAddressText = (address = {}) =>
  [
    composeAddressLine1(address),
    cleanText(address.landmark),
    cleanText(address.city),
    cleanText(address.state),
    normalizePincode(address.pincode),
    INDIA_COUNTRY,
  ]
    .filter(Boolean)
    .join(", ");

const normalizeAddressType = (value) => {
  const normalized = cleanText(value) || DEFAULT_ADDRESS_TYPE;
  return VALID_ADDRESS_TYPES.has(normalized) ? normalized : DEFAULT_ADDRESS_TYPE;
};

export const normalizeStructuredAddress = (input = {}) => {
  const full_name = cleanText(
    input.full_name ?? input.fullName ?? input.name,
  );
  const mobile_number = normalizeMobileNumber(
    input.mobile_number ?? input.mobileNumber ?? input.mobile ?? input.phone,
  );
  const flat_house = cleanText(
    input.flat_house ??
      input.flatHouse ??
      input.house ??
      input.house_no ??
      input.houseNo,
  );
  const area_street_sector = cleanText(
    input.area_street_sector ??
      input.areaStreetSector ??
      input.area ??
      input.street ??
      input.sector ??
      input.village,
  );
  const landmark = cleanText(input.landmark);
  const city = toTitleCase(input.city ?? input.town ?? input.town_city);
  const state = toTitleCase(input.state);
  const district = toTitleCase(input.district);
  const pincode = normalizePincode(input.pincode ?? input.pinCode);
  const email = cleanText(input.email).toLowerCase();
  const addressType = normalizeAddressType(input.addressType);
  const is_default = Boolean(
    input.is_default ?? input.isDefault ?? input.selected ?? input.makeDefault,
  );
  const country = INDIA_COUNTRY;
  const address_line1 =
    cleanText(input.address_line1) || composeAddressLine1({ flat_house, area_street_sector });
  const full_address =
    cleanText(input.full_address) || composeFullAddressText({
      flat_house,
      area_street_sector,
      landmark,
      city,
      state,
      pincode,
    });

  return {
    full_name,
    mobile_number,
    pincode,
    flat_house,
    area_street_sector,
    landmark,
    city,
    state,
    district,
    country,
    email,
    addressType,
    is_default,
    address_line1,
    full_address,
  };
};

export const validateStructuredAddress = (
  input = {},
  { requireEmail = false, allowEmpty = false } = {},
) => {
  const normalized = normalizeStructuredAddress(input);
  const errors = {};

  const hasAnyAddressValue = [
    normalized.full_name,
    normalized.mobile_number,
    normalized.flat_house,
    normalized.area_street_sector,
    normalized.city,
    normalized.state,
    normalized.pincode,
    normalized.email,
  ].some(Boolean);

  if (allowEmpty && !hasAnyAddressValue) {
    return { normalized, errors, isValid: true };
  }

  if (!normalized.full_name) {
    errors.full_name = "Full name is required";
  }
  if (!normalized.mobile_number) {
    errors.mobile_number = "Mobile number is required";
  } else if (!/^[0-9]{10}$/.test(normalized.mobile_number)) {
    errors.mobile_number = "Mobile number must be 10 digits";
  }
  if (!normalized.pincode) {
    errors.pincode = "Pincode is required";
  } else if (!/^[0-9]{6}$/.test(normalized.pincode)) {
    errors.pincode = "Pincode must be 6 digits";
  }
  if (!normalized.flat_house) {
    errors.flat_house = "Flat / House / Building is required";
  }
  if (!normalized.area_street_sector) {
    errors.area_street_sector = "Area / Street / Sector is required";
  }
  if (!normalized.city) {
    errors.city = "Town / City is required";
  }
  if (!normalized.state) {
    errors.state = "State is required";
  }
  if (requireEmail) {
    if (!normalized.email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
      errors.email = "Email is invalid";
    }
  } else if (
    normalized.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)
  ) {
    errors.email = "Email is invalid";
  }

  return {
    normalized,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};

export const buildAddressDedupeKey = (input = {}) => {
  const normalized = normalizeStructuredAddress(input);
  const parts = [
    normalized.full_name.toLowerCase(),
    normalized.mobile_number,
    normalized.flat_house.toLowerCase(),
    normalized.area_street_sector.toLowerCase(),
    normalized.landmark.toLowerCase(),
    normalized.city.toLowerCase(),
    normalized.state.toLowerCase(),
    normalized.pincode,
  ];
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex");
};

export const buildLegacyGuestDetails = (input = {}, extra = {}) => {
  const normalized = normalizeStructuredAddress(input);
  return {
    fullName: normalized.full_name,
    phone: normalized.mobile_number,
    address:
      composeAddressLine1(normalized) ||
      cleanText(extra.address) ||
      cleanText(input.address),
    pincode: normalized.pincode,
    state: normalized.state,
    email: cleanText(extra.email || normalized.email).toLowerCase(),
    gst: cleanText(extra.gst || input.gst),
    flat_house: normalized.flat_house,
    area_street_sector: normalized.area_street_sector,
    landmark: normalized.landmark,
    city: normalized.city,
    district: normalized.district,
    country: INDIA_COUNTRY,
  };
};

export const buildOrderAddressSnapshot = (input = {}, extra = {}) => {
  const normalized = normalizeStructuredAddress(input);
  return {
    order_name: normalized.full_name,
    order_mobile: normalized.mobile_number,
    order_flat_house: normalized.flat_house,
    order_area: normalized.area_street_sector,
    order_landmark: normalized.landmark,
    order_city: normalized.city,
    order_state: normalized.state,
    order_pincode: normalized.pincode,
    order_district: normalized.district,
    country: INDIA_COUNTRY,
    address_line1: composeAddressLine1(normalized),
    address_line2: normalized.landmark,
    full_address:
      normalized.full_address || composeFullAddressText(normalized),
    email: cleanText(extra.email || normalized.email).toLowerCase(),
    source:
      cleanText(extra.source || input.source || (extra.addressId ? "saved_address" : "manual")) ||
      "manual",
    address_id: cleanText(extra.addressId || input.address_id || input.addressId),
  };
};

export const mapStructuredAddressToAddressDocument = (input = {}, extra = {}) => {
  const normalized = normalizeStructuredAddress(input);
  return {
    full_name: normalized.full_name,
    mobile_number: normalized.mobile_number,
    pincode: normalized.pincode,
    flat_house: normalized.flat_house,
    area_street_sector: normalized.area_street_sector,
    landmark: normalized.landmark,
    city: normalized.city,
    state: normalized.state,
    district: normalized.district,
    country: INDIA_COUNTRY,
    is_default: Boolean(
      extra.is_default ?? extra.selected ?? normalized.is_default,
    ),
    addressType: normalizeAddressType(extra.addressType || normalized.addressType),
    dedupeKey: buildAddressDedupeKey(normalized),
    name: normalized.full_name,
    address_line1: composeAddressLine1(normalized),
    mobile: normalized.mobile_number ? Number(normalized.mobile_number) : null,
    selected: Boolean(
      extra.is_default ?? extra.selected ?? normalized.is_default,
    ),
  };
};

export const serializeAddressDocument = (addressDoc = {}) => {
  const raw =
    typeof addressDoc?.toObject === "function" ? addressDoc.toObject() : addressDoc;

  const normalized = normalizeStructuredAddress({
    full_name: raw.full_name || raw.name,
    mobile_number: raw.mobile_number || raw.mobile,
    pincode: raw.pincode,
    flat_house:
      raw.flat_house ||
      raw.address_line1?.split(",")[0] ||
      "",
    area_street_sector:
      raw.area_street_sector ||
      raw.address_line1?.split(",").slice(1).join(",") ||
      "",
    landmark: raw.landmark,
    city: raw.city,
    state: raw.state,
    district: raw.district,
    email: raw.email,
    addressType: raw.addressType,
    is_default: raw.is_default ?? raw.selected,
  });

  return {
    ...raw,
    full_name: normalized.full_name,
    mobile_number: normalized.mobile_number,
    flat_house: normalized.flat_house,
    area_street_sector: normalized.area_street_sector,
    landmark: normalized.landmark,
    city: normalized.city,
    state: normalized.state,
    district: normalized.district,
    pincode: normalized.pincode,
    country: INDIA_COUNTRY,
    is_default: Boolean(raw.is_default ?? raw.selected),
    addressType: normalizeAddressType(raw.addressType),
    dedupeKey: raw.dedupeKey || buildAddressDedupeKey(normalized),
    address_line1: composeAddressLine1(normalized),
    full_address:
      raw.full_address || composeFullAddressText(normalized),
    name: normalized.full_name,
    mobile: normalized.mobile_number,
    selected: Boolean(raw.is_default ?? raw.selected),
  };
};

export const snapshotToDisplayAddress = (snapshot = {}) => ({
  name: cleanText(snapshot.order_name || snapshot.full_name || snapshot.name),
  address_line1: cleanText(
    snapshot.address_line1 ||
      composeAddressLine1({
        flat_house: snapshot.order_flat_house,
        area_street_sector: snapshot.order_area,
      }),
  ),
  address_line2: cleanText(snapshot.address_line2 || snapshot.order_landmark),
  landmark: cleanText(snapshot.order_landmark || snapshot.landmark),
  city: cleanText(snapshot.order_city || snapshot.city),
  state: cleanText(snapshot.order_state || snapshot.state),
  pincode: normalizePincode(snapshot.order_pincode || snapshot.pincode),
  district: cleanText(snapshot.order_district || snapshot.district),
  country: INDIA_COUNTRY,
  mobile: normalizeMobileNumber(
    snapshot.order_mobile || snapshot.mobile || snapshot.phone,
  ),
  email: cleanText(snapshot.email).toLowerCase(),
});

export default {
  ADDRESS_DEV_SAMPLE,
  INDIA_COUNTRY,
  buildAddressDedupeKey,
  buildLegacyGuestDetails,
  buildOrderAddressSnapshot,
  composeAddressLine1,
  composeFullAddressText,
  digitsOnly,
  mapStructuredAddressToAddressDocument,
  normalizeMobileNumber,
  normalizePincode,
  normalizeStructuredAddress,
  serializeAddressDocument,
  snapshotToDisplayAddress,
  validateStructuredAddress,
};
