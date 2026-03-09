import AddressModel from "../models/address.model.js";
import { lookupIndiaPostPincode } from "../services/addressLookup.service.js";
import { createUserLocationLog } from "../services/userLocationLog.service.js";
import {
  INDIA_COUNTRY,
  buildAddressDedupeKey,
  mapStructuredAddressToAddressDocument,
  normalizeStructuredAddress,
  serializeAddressDocument,
  validateStructuredAddress,
} from "../utils/addressUtils.js";

const normalizeLocationPayload = (raw) => {
  if (!raw || typeof raw !== "object") return null;

  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);

  const source =
    raw.source === "google_maps" && hasCoords ? "google_maps" : "manual";

  return {
    latitude: source === "google_maps" ? latitude : null,
    longitude: source === "google_maps" ? longitude : null,
    formattedAddress: String(raw.formattedAddress || "").trim(),
    source,
    capturedAt: new Date(),
  };
};

const buildAddressPayloadFromRequest = (body = {}) => {
  const normalized = normalizeStructuredAddress({
    ...body,
    country: INDIA_COUNTRY,
  });
  const mapped = mapStructuredAddressToAddressDocument(normalized, {
    is_default: body.is_default ?? body.selected ?? body.makeDefault,
    addressType: body.addressType,
  });

  return {
    ...mapped,
    country: INDIA_COUNTRY,
    location: normalizeLocationPayload(body.location),
  };
};

const logAddressLocation = async ({
  userId,
  location,
  addressPayload,
  orderId = null,
  context = "address",
}) => {
  try {
    await createUserLocationLog({
      userId,
      orderId,
      location: location || null,
      addressFields: {
        street: addressPayload.address_line1,
        city: addressPayload.city,
        state: addressPayload.state,
        pincode: addressPayload.pincode,
        country: INDIA_COUNTRY,
      },
    });
  } catch (logError) {
    console.warn(`${context} location log failed:`, logError?.message || logError);
  }
};

const ensureNoDuplicateAddress = async ({
  userId,
  dedupeKey,
  excludeId = null,
}) => {
  const filter = { userId, dedupeKey };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  return AddressModel.findOne(filter);
};

const normalizeAddressesForResponse = (addresses = []) =>
  addresses.map((address) => serializeAddressDocument(address));

/**
 * Public pincode lookup for India Post autofill
 */
export const lookupPincodeAddress = async (req, res) => {
  try {
    const pincode = String(req.params.pincode || "").trim();
    const data = await lookupIndiaPostPincode(pincode);

    return res.status(200).json({
      success: true,
      error: false,
      data,
      message: data.cacheHit
        ? "Pincode details fetched from cache"
        : "Pincode details fetched successfully",
    });
  } catch (error) {
    const status = error?.code === "INVALID_PINCODE" ? 400 : 502;
    return res.status(status).json({
      success: false,
      error: true,
      message: error.message || "Failed to lookup pincode",
    });
  }
};

/**
 * Get all addresses for the current user
 */
export const getUserAddresses = async (req, res) => {
  try {
    const userId = req.user;

    const addresses = await AddressModel.find({ userId }).sort({
      is_default: -1,
      selected: -1,
      updatedAt: -1,
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      error: false,
      data: normalizeAddressesForResponse(addresses),
      message: "Addresses fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || "Failed to fetch addresses",
    });
  }
};

/**
 * Get a single address by ID
 */
export const getAddressById = async (req, res) => {
  try {
    const userId = req.user;
    const { addressId } = req.params;

    const address = await AddressModel.findOne({ _id: addressId, userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Address not found",
      });
    }

    return res.status(200).json({
      success: true,
      error: false,
      data: serializeAddressDocument(address),
      message: "Address fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching address:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || "Failed to fetch address",
    });
  }
};

/**
 * Create a new address
 */
export const createAddress = async (req, res) => {
  try {
    const userId = req.user;
    const payload = buildAddressPayloadFromRequest(req.body || {});
    const validation = validateStructuredAddress(payload);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Please complete all required address fields",
        errors: validation.errors,
      });
    }

    payload.dedupeKey = buildAddressDedupeKey(payload);

    const duplicate = await ensureNoDuplicateAddress({
      userId,
      dedupeKey: payload.dedupeKey,
    });
    if (duplicate) {
      return res.status(200).json({
        success: true,
        error: false,
        duplicate: true,
        data: serializeAddressDocument(duplicate),
        message: "Address already saved",
      });
    }

    const existingAddresses = await AddressModel.find({ userId })
      .select("_id")
      .lean();
    const shouldBeDefault =
      existingAddresses.length === 0 || Boolean(payload.is_default);

    if (shouldBeDefault) {
      await AddressModel.updateMany(
        { userId },
        { $set: { selected: false, is_default: false } },
      );
    }

    const newAddress = new AddressModel({
      ...payload,
      userId,
      selected: shouldBeDefault,
      is_default: shouldBeDefault,
    });

    await newAddress.save();
    await logAddressLocation({
      userId,
      location: req.body?.location,
      addressPayload: newAddress,
      context: "createAddress",
    });

    return res.status(201).json({
      success: true,
      error: false,
      data: serializeAddressDocument(newAddress),
      message: "Address created successfully",
    });
  } catch (error) {
    console.error("Error creating address:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || "Failed to create address",
    });
  }
};

/**
 * Update an existing address
 */
export const updateAddress = async (req, res) => {
  try {
    const userId = req.user;
    const { addressId } = req.params;
    const existingAddress = await AddressModel.findOne({
      _id: addressId,
      userId,
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Address not found",
      });
    }

    const payload = buildAddressPayloadFromRequest({
      ...existingAddress.toObject(),
      ...req.body,
    });
    const validation = validateStructuredAddress(payload);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Please complete all required address fields",
        errors: validation.errors,
      });
    }

    payload.dedupeKey = buildAddressDedupeKey(payload);

    const duplicate = await ensureNoDuplicateAddress({
      userId,
      dedupeKey: payload.dedupeKey,
      excludeId: addressId,
    });
    if (duplicate) {
      return res.status(200).json({
        success: true,
        error: false,
        duplicate: true,
        data: serializeAddressDocument(duplicate),
        message: "Address already saved",
      });
    }

    let shouldBeDefault = Boolean(
      req.body?.is_default ??
        req.body?.selected ??
        req.body?.makeDefault ??
        existingAddress.is_default ??
        existingAddress.selected,
    );

    let replacementDefault = null;
    if (
      !shouldBeDefault &&
      (existingAddress.is_default || existingAddress.selected)
    ) {
      replacementDefault = await AddressModel.findOne({
        userId,
        _id: { $ne: addressId },
      }).sort({
        is_default: -1,
        selected: -1,
        updatedAt: -1,
        createdAt: -1,
      });

      if (!replacementDefault) {
        shouldBeDefault = true;
      }
    }

    if (shouldBeDefault) {
      await AddressModel.updateMany(
        { userId, _id: { $ne: addressId } },
        { $set: { selected: false, is_default: false } },
      );
    }

    Object.assign(existingAddress, {
      ...payload,
      selected: shouldBeDefault,
      is_default: shouldBeDefault,
      country: INDIA_COUNTRY,
    });

    if (req.body?.location !== undefined) {
      existingAddress.location = normalizeLocationPayload(req.body.location);
    }

    await existingAddress.save();

    if (replacementDefault && !shouldBeDefault) {
      replacementDefault.selected = true;
      replacementDefault.is_default = true;
      await replacementDefault.save();
    }
    await logAddressLocation({
      userId,
      location: req.body?.location,
      addressPayload: existingAddress,
      context: "updateAddress",
    });

    return res.status(200).json({
      success: true,
      error: false,
      data: serializeAddressDocument(existingAddress),
      message: "Address updated successfully",
    });
  } catch (error) {
    console.error("Error updating address:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || "Failed to update address",
    });
  }
};

/**
 * Delete an address
 */
export const deleteAddress = async (req, res) => {
  try {
    const userId = req.user;
    const { addressId } = req.params;

    const existingAddress = await AddressModel.findOne({
      _id: addressId,
      userId,
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Address not found",
      });
    }

    await AddressModel.findByIdAndDelete(addressId);

    if (existingAddress.selected || existingAddress.is_default) {
      const replacement = await AddressModel.findOne({ userId }).sort({
        updatedAt: -1,
        createdAt: -1,
      });
      if (replacement) {
        replacement.selected = true;
        replacement.is_default = true;
        await replacement.save();
      }
    }

    return res.status(200).json({
      success: true,
      error: false,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting address:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || "Failed to delete address",
    });
  }
};

/**
 * Set an address as the default/selected address
 */
export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user;
    const { addressId } = req.params;

    const existingAddress = await AddressModel.findOne({
      _id: addressId,
      userId,
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Address not found",
      });
    }

    await AddressModel.updateMany(
      { userId, _id: { $ne: addressId } },
      { $set: { selected: false, is_default: false } },
    );

    existingAddress.selected = true;
    existingAddress.is_default = true;
    await existingAddress.save();

    return res.status(200).json({
      success: true,
      error: false,
      data: serializeAddressDocument(existingAddress),
      message: "Default address updated successfully",
    });
  } catch (error) {
    console.error("Error setting default address:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || "Failed to set default address",
    });
  }
};

export default {
  createAddress,
  deleteAddress,
  getAddressById,
  getUserAddresses,
  lookupPincodeAddress,
  setDefaultAddress,
  updateAddress,
};
