import mongoose from "mongoose";
import connectDb from "../config/connectDb.js";
import AddressModel from "../models/address.model.js";
import InvoiceModel from "../models/invoice.model.js";
import OrderModel from "../models/order.model.js";
import {
  INDIA_COUNTRY,
  buildLegacyGuestDetails,
  buildOrderAddressSnapshot,
  composeAddressLine1,
  normalizeStructuredAddress,
  serializeAddressDocument,
} from "../utils/addressUtils.js";

const shouldApply = process.argv.includes("--apply");
const limitArg = process.argv.find((arg) =>
  String(arg || "").startsWith("--limit="),
);
const limit = Math.max(Number(limitArg?.split("=")[1] || 0), 0);

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const getDocumentId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value?._id) return getDocumentId(value._id);
  return "";
};

const splitLegacyAddress = (value) => {
  const parts = String(value || "")
    .split(",")
    .map((part) => normalizeText(part))
    .filter(Boolean);

  return {
    flatHouse: parts[0] || "",
    areaStreetSector: parts.slice(1).join(", "),
  };
};

const toStructuredSource = (source = {}) => {
  const legacyAddress = normalizeText(
    source.address_line1 || source.address || source.full_address || "",
  );
  const legacyParts = splitLegacyAddress(legacyAddress);

  return normalizeStructuredAddress({
    full_name:
      source.full_name ||
      source.fullName ||
      source.name ||
      source.order_name ||
      "",
    mobile_number:
      source.mobile_number ||
      source.mobileNumber ||
      source.mobile ||
      source.phone ||
      source.order_mobile ||
      "",
    flat_house:
      source.flat_house ||
      source.flatHouse ||
      source.order_flat_house ||
      legacyParts.flatHouse,
    area_street_sector:
      source.area_street_sector ||
      source.areaStreetSector ||
      source.order_area ||
      legacyParts.areaStreetSector,
    landmark:
      source.landmark || source.order_landmark || source.address_line2 || "",
    city: source.city || source.order_city || "",
    state: source.state || source.order_state || "",
    district: source.district || source.order_district || "",
    pincode: source.pincode || source.order_pincode || "",
    email: source.email || "",
    addressType: source.addressType || "Home",
  });
};

const hasStructuredValues = (structured = {}) =>
  [
    structured.full_name,
    structured.mobile_number,
    structured.flat_house,
    structured.area_street_sector,
    structured.city,
    structured.state,
    structured.pincode,
    structured.email,
  ].some(Boolean);

const buildBillingDetails = ({
  structured,
  snapshot,
  existing = {},
  email = "",
}) => ({
  fullName: snapshot.order_name || existing.fullName || "",
  email: normalizeText(email || snapshot.email || existing.email || "").toLowerCase(),
  phone: snapshot.order_mobile || existing.phone || "",
  address:
    snapshot.address_line1 ||
    existing.address ||
    composeAddressLine1({
      flat_house: structured.flat_house,
      area_street_sector: structured.area_street_sector,
    }) ||
    "Address not available",
  pincode: snapshot.order_pincode || existing.pincode || "",
  state: snapshot.order_state || existing.state || "",
  city: snapshot.order_city || existing.city || "",
  flat_house: snapshot.order_flat_house || existing.flat_house || "",
  area_street_sector: snapshot.order_area || existing.area_street_sector || "",
  landmark: snapshot.order_landmark || existing.landmark || "",
  country: INDIA_COUNTRY,
});

const buildGuestDetails = ({
  structured,
  existing = {},
  email = "",
  gst = "",
}) => ({
  ...buildLegacyGuestDetails(structured, {
    email,
    gst: existing?.gst || gst,
  }),
  city: structured.city || existing.city || "",
  flat_house: structured.flat_house || existing.flat_house || "",
  area_street_sector:
    structured.area_street_sector || existing.area_street_sector || "",
  landmark: structured.landmark || existing.landmark || "",
  district: structured.district || existing.district || "",
  country: INDIA_COUNTRY,
});

const isEqual = (left, right) =>
  JSON.stringify(left || {}) === JSON.stringify(right || {});

const printMode = () =>
  console.log(
    shouldApply
      ? "Applying address backfill changes."
      : "Dry run only. Re-run with --apply to persist changes.",
  );

const buildOrderLikeAddressSource = (order) =>
  order?.delivery_address ||
  order?.deliveryAddressSnapshot ||
  order?.guestDetails ||
  order?.billingDetails ||
  {};

const updateAddresses = async (summary) => {
  let query = AddressModel.find({});
  if (limit > 0) query = query.limit(limit);
  const addresses = await query.sort({ updatedAt: -1, createdAt: -1 }).exec();

  for (const address of addresses) {
    summary.addressesScanned += 1;
    const serialized = serializeAddressDocument(address);
    const nextAddress = {
      full_name: serialized.full_name,
      mobile_number: serialized.mobile_number,
      flat_house: serialized.flat_house,
      area_street_sector: serialized.area_street_sector,
      landmark: serialized.landmark,
      city: serialized.city,
      state: serialized.state,
      district: serialized.district,
      pincode: serialized.pincode,
      country: INDIA_COUNTRY,
      is_default: Boolean(serialized.is_default),
      selected: Boolean(serialized.selected),
      addressType: serialized.addressType || "Home",
      dedupeKey: serialized.dedupeKey,
      name: serialized.name,
      mobile: serialized.mobile,
      address_line1: serialized.address_line1,
    };

    const currentAddress = {
      full_name: address.full_name || "",
      mobile_number: address.mobile_number || "",
      flat_house: address.flat_house || "",
      area_street_sector: address.area_street_sector || "",
      landmark: address.landmark || "",
      city: address.city || "",
      state: address.state || "",
      district: address.district || "",
      pincode: address.pincode || "",
      country: address.country || INDIA_COUNTRY,
      is_default: Boolean(address.is_default),
      selected: Boolean(address.selected),
      addressType: address.addressType || "Home",
      dedupeKey: address.dedupeKey || "",
      name: address.name || "",
      mobile: address.mobile || "",
      address_line1: address.address_line1 || "",
    };

    if (isEqual(currentAddress, nextAddress)) {
      continue;
    }

    summary.addressesUpdated += 1;
    console.log(
      `[address] ${address._id} ${shouldApply ? "updating" : "would update"}`,
    );

    if (!shouldApply) continue;
    address.set(nextAddress);
    await address.save();
  }
};

const updateOrders = async (summary) => {
  let query = OrderModel.find({}).populate("delivery_address");
  if (limit > 0) query = query.limit(limit);
  const orders = await query.sort({ updatedAt: -1, createdAt: -1 }).exec();

  for (const order of orders) {
    summary.ordersScanned += 1;
    const source = buildOrderLikeAddressSource(order);
    const structured = toStructuredSource(source);
    if (!hasStructuredValues(structured)) continue;

    const email = normalizeText(
      order?.deliveryAddressSnapshot?.email ||
        order?.billingDetails?.email ||
        order?.guestDetails?.email ||
        source?.email ||
        "",
    ).toLowerCase();
    const sourceType = order?.delivery_address
      ? "saved_address"
      : order?.user
        ? "registered_manual"
        : "guest_manual";
    const addressId = getDocumentId(order?.delivery_address);
    const nextSnapshot = buildOrderAddressSnapshot(structured, {
      email,
      source: sourceType,
      addressId,
    });
    const nextBillingDetails = buildBillingDetails({
      structured,
      snapshot: nextSnapshot,
      existing: order.billingDetails || {},
      email,
    });

    const shouldStoreGuest =
      !order.user ||
      Object.values(order.guestDetails?.toObject?.() || order.guestDetails || {}).some(
        Boolean,
      );
    const nextGuestDetails = shouldStoreGuest
      ? buildGuestDetails({
          structured,
          existing: order.guestDetails || {},
          email,
          gst: order.gstNumber || "",
        })
      : order.guestDetails || {};

    const currentSnapshot =
      order.deliveryAddressSnapshot?.toObject?.() || order.deliveryAddressSnapshot || {};
    const currentBilling =
      order.billingDetails?.toObject?.() || order.billingDetails || {};
    const currentGuest = order.guestDetails?.toObject?.() || order.guestDetails || {};

    if (
      isEqual(currentSnapshot, nextSnapshot) &&
      isEqual(currentBilling, nextBillingDetails) &&
      isEqual(currentGuest, nextGuestDetails)
    ) {
      continue;
    }

    summary.ordersUpdated += 1;
    console.log(
      `[order] ${order._id} ${shouldApply ? "updating" : "would update"}`,
    );

    if (!shouldApply) continue;
    order.set({
      deliveryAddressSnapshot: nextSnapshot,
      billingDetails: nextBillingDetails,
      guestDetails: nextGuestDetails,
    });
    await order.save();
  }
};

const updateInvoices = async (summary) => {
  let query = InvoiceModel.find({}).populate({
    path: "orderId",
    populate: { path: "delivery_address" },
  });
  if (limit > 0) query = query.limit(limit);
  const invoices = await query.sort({ updatedAt: -1, createdAt: -1 }).exec();

  for (const invoice of invoices) {
    summary.invoicesScanned += 1;
    const order = invoice.orderId || null;
    const source =
      order?.deliveryAddressSnapshot ||
      buildOrderLikeAddressSource(order) ||
      invoice.deliveryAddress ||
      invoice.billingDetails ||
      {};
    const structured = toStructuredSource(source);
    if (!hasStructuredValues(structured)) continue;

    const email = normalizeText(
      invoice?.deliveryAddress?.email ||
        invoice?.billingDetails?.email ||
        order?.billingDetails?.email ||
        order?.guestDetails?.email ||
        source?.email ||
        "",
    ).toLowerCase();
    const sourceType = order?.delivery_address ? "saved_address" : "manual";
    const addressId = getDocumentId(order?.delivery_address);
    const nextDeliveryAddress =
      order?.deliveryAddressSnapshot ||
      buildOrderAddressSnapshot(structured, {
        email,
        source: sourceType,
        addressId,
      });
    const nextBillingDetails = buildBillingDetails({
      structured,
      snapshot: nextDeliveryAddress,
      existing: invoice.billingDetails || {},
      email,
    });

    const currentDelivery =
      invoice.deliveryAddress?.toObject?.() || invoice.deliveryAddress || {};
    const currentBilling =
      invoice.billingDetails?.toObject?.() || invoice.billingDetails || {};

    if (
      isEqual(currentDelivery, nextDeliveryAddress) &&
      isEqual(currentBilling, nextBillingDetails)
    ) {
      continue;
    }

    summary.invoicesUpdated += 1;
    console.log(
      `[invoice] ${invoice._id} ${shouldApply ? "updating" : "would update"}`,
    );

    if (!shouldApply) continue;
    invoice.set({
      deliveryAddress: nextDeliveryAddress,
      billingDetails: nextBillingDetails,
      gstNumber: invoice.gstNumber || order?.gstNumber || "",
    });
    await invoice.save();
  }
};

const run = async () => {
  const summary = {
    addressesScanned: 0,
    addressesUpdated: 0,
    ordersScanned: 0,
    ordersUpdated: 0,
    invoicesScanned: 0,
    invoicesUpdated: 0,
  };

  await connectDb();
  printMode();

  try {
    await updateAddresses(summary);
    await updateOrders(summary);
    await updateInvoices(summary);

    console.log("\nAddress backfill summary:");
    console.table(summary);
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Address backfill failed:", error);
  process.exit(1);
});
