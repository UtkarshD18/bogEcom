import AddressModel from "../models/address.model.js";

/**
 * Get all addresses for the current user
 */
export const getUserAddresses = async (req, res) => {
  try {
    const userId = req.user;

    const addresses = await AddressModel.find({ userId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      error: false,
      data: addresses,
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
      data: address,
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
    const {
      address_line1,
      city,
      state,
      pincode,
      country,
      mobile,
      landmark,
      addressType,
      name,
    } = req.body;

    // Validation
    if (!address_line1 || !city || !state || !pincode || !mobile) {
      return res.status(400).json({
        success: false,
        error: true,
        message:
          "Please fill all required fields (address, city, state, pincode, mobile)",
      });
    }

    // Validate pincode (6 digits for India)
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Please enter a valid 6-digit pincode",
      });
    }

    // Validate mobile (10 digits)
    const mobileStr = String(mobile).replace(/\D/g, "");
    if (mobileStr.length !== 10) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Please enter a valid 10-digit mobile number",
      });
    }

    // If this is the first address or marked as selected, unselect others
    const existingAddresses = await AddressModel.find({ userId });
    const shouldBeSelected = existingAddresses.length === 0;

    const newAddress = new AddressModel({
      userId,
      address_line1,
      city,
      state,
      pincode,
      country: country || "India",
      mobile: parseInt(mobileStr),
      landmark,
      addressType: addressType || "Home",
      name,
      selected: shouldBeSelected,
    });

    await newAddress.save();

    return res.status(201).json({
      success: true,
      error: false,
      data: newAddress,
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
    const {
      address_line1,
      city,
      state,
      pincode,
      country,
      mobile,
      landmark,
      addressType,
      name,
    } = req.body;

    // Check if address exists and belongs to user
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

    // Validate pincode if provided
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Please enter a valid 6-digit pincode",
      });
    }

    // Validate mobile if provided
    if (mobile) {
      const mobileStr = String(mobile).replace(/\D/g, "");
      if (mobileStr.length !== 10) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Please enter a valid 10-digit mobile number",
        });
      }
    }

    // Update fields
    const updateData = {};
    if (address_line1) updateData.address_line1 = address_line1;
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (pincode) updateData.pincode = pincode;
    if (country) updateData.country = country;
    if (mobile) updateData.mobile = parseInt(String(mobile).replace(/\D/g, ""));
    if (landmark !== undefined) updateData.landmark = landmark;
    if (addressType) updateData.addressType = addressType;
    if (name) updateData.name = name;

    const updatedAddress = await AddressModel.findByIdAndUpdate(
      addressId,
      updateData,
      { new: true },
    );

    return res.status(200).json({
      success: true,
      error: false,
      data: updatedAddress,
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

    // Check if address exists and belongs to user
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

    // If deleted address was selected, select another one
    if (existingAddress.selected) {
      const remainingAddress = await AddressModel.findOne({ userId });
      if (remainingAddress) {
        remainingAddress.selected = true;
        await remainingAddress.save();
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

    // Check if address exists and belongs to user
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

    // Unselect all other addresses for this user
    await AddressModel.updateMany(
      { userId, _id: { $ne: addressId } },
      { selected: false },
    );

    // Select this address
    existingAddress.selected = true;
    await existingAddress.save();

    return res.status(200).json({
      success: true,
      error: false,
      data: existingAddress,
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
