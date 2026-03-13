import mongoose from "mongoose";
import VendorModel from "../models/vendor.model.js";

const normalizeVendorProductRates = (value) => {
  if (!Array.isArray(value)) return [];

  const dedupedRates = new Map();

  value.forEach((entry) => {
    const productId = String(entry?.productId || "").trim();
    const rate = Number(entry?.rate);

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) return;
    if (!Number.isFinite(rate) || rate < 0) return;

    dedupedRates.set(productId, {
      productId,
      rate,
    });
  });

  return Array.from(dedupedRates.values());
};

/**
 * Get all vendors (Admin)
 * @route GET /api/vendors
 */
export const getVendors = async (req, res) => {
  try {
    const vendors = await VendorModel.find({ isActive: true })
      .sort({ fullName: 1 })
      .lean();

    res.status(200).json({
      error: false,
      success: true,
      data: vendors,
    });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch vendors",
    });
  }
};

/**
 * Create a vendor (Admin)
 * @route POST /api/vendors
 */
export const createVendor = async (req, res) => {
  try {
    const { fullName, phone, email, address, pincode, state, gst, productRates } =
      req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Vendor name is required",
      });
    }

    const vendor = await VendorModel.create({
      fullName: fullName.trim(),
      phone: phone?.trim() || "",
      email: email?.trim() || "",
      address: address?.trim() || "",
      pincode: pincode?.trim() || "",
      state: state?.trim() || "",
      gst: gst?.trim() || "",
      productRates: normalizeVendorProductRates(productRates),
      createdBy: req.userId,
    });

    res.status(201).json({
      error: false,
      success: true,
      message: "Vendor created successfully",
      data: vendor,
    });
  } catch (error) {
    console.error("Error creating vendor:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create vendor",
    });
  }
};

/**
 * Update a vendor (Admin)
 * @route PUT /api/vendors/:id
 */
export const updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, email, address, pincode, state, gst, productRates } =
      req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Vendor name is required",
      });
    }

    const updatePayload = {
      fullName: fullName.trim(),
      phone: phone?.trim() || "",
      email: email?.trim() || "",
      address: address?.trim() || "",
      pincode: pincode?.trim() || "",
      state: state?.trim() || "",
      gst: gst?.trim() || "",
    };

    if (Object.prototype.hasOwnProperty.call(req.body, "productRates")) {
      updatePayload.productRates = normalizeVendorProductRates(productRates);
    }

    const vendor = await VendorModel.findByIdAndUpdate(
      id,
      updatePayload,
      { new: true },
    );

    if (!vendor) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Vendor updated successfully",
      data: vendor,
    });
  } catch (error) {
    console.error("Error updating vendor:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update vendor",
    });
  }
};

/**
 * Delete a vendor (Admin - soft delete)
 * @route DELETE /api/vendors/:id
 */
export const deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await VendorModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );

    if (!vendor) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Vendor deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete vendor",
    });
  }
};
