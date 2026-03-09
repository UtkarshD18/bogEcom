export const INDIA_COUNTRY = "India";

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export const ADDRESS_DEV_SAMPLE = Object.freeze({
  fullName: "Rahul Sharma",
  mobileNumber: "9876543210",
  pincode: "302017",
  flatHouse: "B-42",
  areaStreetSector: "SKIT Road",
  landmark: "Near Apollo Hospital",
  city: "Jaipur",
  state: "Rajasthan",
  district: "Jaipur",
  email: "rahul.sharma@example.com",
  addressType: "Home",
  isDefault: true,
});

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

export const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

export const normalizeMobileNumber = (value) => digitsOnly(value).slice(-10);

export const normalizePincode = (value) => digitsOnly(value).slice(0, 6);

export const normalizeStateValue = (value) => {
  const incoming = normalizeText(value).toLowerCase();
  if (!incoming) return "";
  const match = INDIAN_STATES.find(
    (state) => normalizeText(state).toLowerCase() === incoming,
  );
  return match || normalizeText(value);
};

const dedupeLocationParts = (parts = []) => {
  const seen = new Set();
  return parts
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const buildAreaStreetSectorFromLocation = (location = {}, fallback = "") => {
  const directParts = dedupeLocationParts([
    location.area,
    location.street,
    location.sector,
  ]);
  if (directParts.length > 0) {
    return directParts.join(", ");
  }

  const city = normalizeText(location.city).toLowerCase();
  const district = normalizeText(location.district).toLowerCase();
  const state = normalizeStateValue(location.state).toLowerCase();
  const country = normalizeText(location.country).toLowerCase();
  const pincode = normalizePincode(location.pincode);

  const formattedParts = dedupeLocationParts(
    String(location.formattedAddress || "").split(","),
  ).filter((part) => {
    const lowered = part.toLowerCase();
    return (
      lowered !== city &&
      lowered !== district &&
      lowered !== state &&
      lowered !== country &&
      !(pincode && lowered.includes(pincode))
    );
  });

  return formattedParts.join(", ") || fallback;
};

export const createEmptyAddressForm = (overrides = {}) => ({
  fullName: "",
  mobileNumber: "",
  pincode: "",
  flatHouse: "",
  areaStreetSector: "",
  landmark: "",
  city: "",
  state: "",
  district: "",
  email: "",
  addressType: "Home",
  isDefault: false,
  ...overrides,
});

export const composeAddressLine1 = (form = {}) =>
  [normalizeText(form.flatHouse), normalizeText(form.areaStreetSector)]
    .filter(Boolean)
    .join(", ");

export const composeFullAddress = (form = {}) =>
  [
    composeAddressLine1(form),
    normalizeText(form.landmark),
    normalizeText(form.city),
    normalizeText(form.state),
    normalizePincode(form.pincode),
    INDIA_COUNTRY,
  ]
    .filter(Boolean)
    .join(", ");

export const mapAddressResponseToForm = (address = {}) =>
  createEmptyAddressForm({
    fullName: address.full_name || address.name || "",
    mobileNumber: address.mobile_number || address.mobile || "",
    pincode: address.pincode || "",
    flatHouse: address.flat_house || "",
    areaStreetSector: address.area_street_sector || "",
    landmark: address.landmark || "",
    city: address.city || "",
    state: address.state || "",
    district: address.district || "",
    email: address.email || "",
    addressType: address.addressType || "Home",
    isDefault: Boolean(address.is_default ?? address.selected),
  });

export const validateAddressForm = (form = {}, { requireEmail = false } = {}) => {
  const errors = {};
  if (!normalizeText(form.fullName)) {
    errors.fullName = "Full name is required";
  }
  if (!/^[0-9]{10}$/.test(normalizeMobileNumber(form.mobileNumber))) {
    errors.mobileNumber = "Enter a valid 10-digit mobile number";
  }
  if (!/^[0-9]{6}$/.test(normalizePincode(form.pincode))) {
    errors.pincode = "Enter a valid 6-digit pincode";
  }
  if (!normalizeText(form.flatHouse)) {
    errors.flatHouse = "Flat / House / Building is required";
  }
  if (!normalizeText(form.areaStreetSector)) {
    errors.areaStreetSector = "Area / Street / Sector is required";
  }
  if (!normalizeText(form.city)) {
    errors.city = "Town / City is required";
  }
  if (!normalizeStateValue(form.state)) {
    errors.state = "State is required";
  }

  const email = normalizeText(form.email).toLowerCase();
  if (requireEmail) {
    if (!email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Enter a valid email address";
    }
  } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};

export const buildAddressPayload = ({ form, location }) => {
  const normalized = mapAddressResponseToForm(form);
  return {
    full_name: normalizeText(normalized.fullName),
    mobile_number: normalizeMobileNumber(normalized.mobileNumber),
    pincode: normalizePincode(normalized.pincode),
    flat_house: normalizeText(normalized.flatHouse),
    area_street_sector: normalizeText(normalized.areaStreetSector),
    landmark: normalizeText(normalized.landmark),
    city: normalizeText(normalized.city),
    state: normalizeStateValue(normalized.state),
    district: normalizeText(normalized.district),
    is_default: Boolean(normalized.isDefault),
    addressType: normalized.addressType || "Home",
    country: INDIA_COUNTRY,
    name: normalizeText(normalized.fullName),
    mobile: normalizeMobileNumber(normalized.mobileNumber),
    address_line1: composeAddressLine1(normalized),
    location: location || null,
  };
};

export const buildGuestDetailsPayload = ({ form, gstNumber = "" }) => {
  const normalized = mapAddressResponseToForm(form);
  return {
    fullName: normalizeText(normalized.fullName),
    phone: normalizeMobileNumber(normalized.mobileNumber),
    address: composeAddressLine1(normalized),
    pincode: normalizePincode(normalized.pincode),
    state: normalizeStateValue(normalized.state),
    city: normalizeText(normalized.city),
    flat_house: normalizeText(normalized.flatHouse),
    area_street_sector: normalizeText(normalized.areaStreetSector),
    landmark: normalizeText(normalized.landmark),
    district: normalizeText(normalized.district),
    country: INDIA_COUNTRY,
    email: normalizeText(normalized.email).toLowerCase(),
    gst: normalizeText(gstNumber).toUpperCase(),
  };
};

export const applyGoogleLocationToForm = (form = {}, location = {}) => ({
  ...form,
  areaStreetSector: buildAreaStreetSectorFromLocation(
    location,
    form.areaStreetSector,
  ),
  city: location.city || form.city,
  state: normalizeStateValue(location.state) || form.state,
  district: location.district || form.district,
  pincode: normalizePincode(location.pincode) || form.pincode,
});

export const applyPincodeLookupToForm = (form = {}, lookup = {}) => ({
  ...form,
  city: lookup.city || form.city,
  state: normalizeStateValue(lookup.state) || form.state,
  district: lookup.district || form.district,
});

export const getAddressDisplayLines = (form = {}) => ({
  line1: composeAddressLine1(form),
  line2: normalizeText(form.landmark),
  meta: [
    normalizeText(form.city),
    normalizeStateValue(form.state),
    normalizePincode(form.pincode),
  ]
    .filter(Boolean)
    .join(" - "),
});

export default {
  ADDRESS_DEV_SAMPLE,
  INDIA_COUNTRY,
  INDIAN_STATES,
  applyGoogleLocationToForm,
  applyPincodeLookupToForm,
  buildAddressPayload,
  buildGuestDetailsPayload,
  composeAddressLine1,
  composeFullAddress,
  createEmptyAddressForm,
  getAddressDisplayLines,
  mapAddressResponseToForm,
  normalizeMobileNumber,
  normalizePincode,
  normalizeStateValue,
  validateAddressForm,
};
