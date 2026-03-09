"use client";

import { API_BASE_URL, getStoredAccessToken } from "@/utils/api";
import AccountSidebar from "@/components/AccountSiderbar";
import UseCurrentLocationGoogleMaps from "@/components/UseCurrentLocationGoogleMaps";
import useIndiaPincodeLookup from "@/hooks/useIndiaPincodeLookup";
import {
  applyGoogleLocationToForm,
  applyPincodeLookupToForm,
  buildAddressPayload,
  createEmptyAddressForm,
  getAddressDisplayLines,
  INDIAN_STATES,
  mapAddressResponseToForm,
  normalizeMobileNumber,
  normalizePincode,
  validateAddressForm as validateStructuredAddressForm,
} from "@/utils/addressForm";
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FiCheck, FiEdit2, FiMapPin, FiPlus, FiTrash2 } from "react-icons/fi";
import { MdHome, MdLocationOn, MdWork } from "react-icons/md";

const API_URL = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL;

const parseResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  const text = await response.text();
  return text ? { message: text } : {};
};

const buildAuthHeaders = (extraHeaders = {}) => {
  const token = getStoredAccessToken();
  return token
    ? { ...extraHeaders, Authorization: `Bearer ${token}` }
    : extraHeaders;
};

const getLookupHelperText = (lookup) => {
  if (lookup.status === "loading") return "Looking up city/state from pincode...";
  if (lookup.status === "error") return lookup.message;
  if (lookup.status === "empty") return lookup.message;
  if (lookup.status !== "success") return "";

  const city = lookup.data?.city || "";
  const state = lookup.data?.state || "";
  return [city, state].filter(Boolean).join(", ");
};

const hasResolvedPincodeDetails = (form) =>
  Boolean(String(form?.city || "").trim() && String(form?.state || "").trim());

const AddressPage = () => {
  const router = useRouter();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [locationPayload, setLocationPayload] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [formData, setFormData] = useState(() => createEmptyAddressForm());
  const [formErrors, setFormErrors] = useState({});

  const {
    lookup: pincodeLookup,
    lookupPincode,
    resetLookup,
  } = useIndiaPincodeLookup({
    onResolved: (lookupData) => {
      setFormData((prev) => applyPincodeLookupToForm(prev, lookupData));
    },
  });

  const fetchAddresses = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/address`, {
        method: "GET",
        headers: buildAuthHeaders(),
        credentials: "include",
      });

      const data = await parseResponse(response);
      if (response.ok && data.success) {
        setAddresses(data.data || []);
      } else if (response.status === 401) {
        router.push("/login?redirect=/address");
      } else {
        setSnackbar({
          open: true,
          message: data.message || "Failed to load addresses",
          severity: "error",
        });
      }
    } catch (_error) {
      setSnackbar({
        open: true,
        message: "Unable to reach server. Please check the backend and API URL.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const resetForm = useCallback(() => {
    setFormData(createEmptyAddressForm());
    setFormErrors({});
    setEditingAddress(null);
    setLocationPayload(null);
    resetLookup();
  }, [resetLookup]);

  const handleAddNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (address) => {
    setEditingAddress(address);
    setFormData(mapAddressResponseToForm(address));
    setFormErrors({});
    setLocationPayload(null);
    resetLookup();
    setIsDialogOpen(true);
  };

  const handleChange = (event) => {
    const { name, value, checked, type } = event.target;
    const nextValue =
      type === "checkbox"
        ? checked
        : name === "mobileNumber"
          ? normalizeMobileNumber(value)
          : name === "pincode"
            ? normalizePincode(value)
            : value;

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));

    if (name === "pincode") {
      if (nextValue.length === 6) {
        lookupPincode(nextValue);
      } else {
        resetLookup();
      }
    }

    const normalizedErrorKey = name === "mobileNumber" ? "mobileNumber" : name;
    if (formErrors[normalizedErrorKey]) {
      setFormErrors((prev) => ({ ...prev, [normalizedErrorKey]: "" }));
    }
  };

  const handleUseLocationResolved = async (location) => {
    setLocationPayload(location);
    const nextForm = applyGoogleLocationToForm(formData, location);
    setFormData(nextForm);
    if (
      normalizePincode(nextForm.pincode).length === 6 &&
      !hasResolvedPincodeDetails(nextForm)
    ) {
      await lookupPincode(nextForm.pincode);
    } else {
      resetLookup();
    }
  };

  const handleSave = async () => {
    const validation = validateStructuredAddressForm(formData);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setSaving(true);
    try {
      const url = editingAddress
        ? `${API_URL}/api/address/${editingAddress._id}`
        : `${API_URL}/api/address`;

      const response = await fetch(url, {
        method: editingAddress ? "PUT" : "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(
          buildAddressPayload({
            form: formData,
            location: locationPayload,
          }),
        ),
      });

      const data = await parseResponse(response);

      if (response.status === 401) {
        router.push("/login?redirect=/address");
        return;
      }

      if (data.success) {
        setSnackbar({
          open: true,
          message: editingAddress
            ? data.duplicate
              ? "Matching address already exists."
              : "Address updated."
            : data.duplicate
              ? "Address already saved."
              : "Address added.",
          severity: "success",
        });
        setIsDialogOpen(false);
        resetForm();
        await fetchAddresses();
      } else {
        setSnackbar({
          open: true,
          message: data.message || "Failed to save address",
          severity: "error",
        });
      }
    } catch (_error) {
      setSnackbar({
        open: true,
        message: "Failed to save address",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (addressId) => {
    if (!confirm("Are you sure you want to delete this address?")) return;

    setDeleting(addressId);
    try {
      const response = await fetch(`${API_URL}/api/address/${addressId}`, {
        method: "DELETE",
        headers: buildAuthHeaders(),
        credentials: "include",
      });

      const data = await parseResponse(response);

      if (response.status === 401) {
        router.push("/login?redirect=/address");
        return;
      }

      if (data.success) {
        setSnackbar({
          open: true,
          message: "Address deleted",
          severity: "success",
        });
        await fetchAddresses();
      } else {
        setSnackbar({
          open: true,
          message: data.message || "Failed to delete address",
          severity: "error",
        });
      }
    } catch (_error) {
      setSnackbar({
        open: true,
        message: "Failed to delete address",
        severity: "error",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/address/${addressId}/default`,
        {
          method: "PUT",
          headers: buildAuthHeaders(),
          credentials: "include",
        },
      );

      const data = await parseResponse(response);

      if (response.status === 401) {
        router.push("/login?redirect=/address");
        return;
      }

      if (data.success) {
        setSnackbar({
          open: true,
          message: "Default address updated",
          severity: "success",
        });
        await fetchAddresses();
      } else {
        setSnackbar({
          open: true,
          message: data.message || "Failed to update default address",
          severity: "error",
        });
      }
    } catch (_error) {
      setSnackbar({
        open: true,
        message: "Failed to update default address",
        severity: "error",
      });
    }
  };

  const getAddressIcon = (type) => {
    switch (type) {
      case "Work":
        return <MdWork size={18} />;
      case "Other":
        return <MdLocationOn size={18} />;
      default:
        return <MdHome size={18} />;
    }
  };

  if (loading) {
    return (
      <section className="bg-gray-100 py-8 min-h-screen">
        <div className="container flex gap-5">
          <div className="w-[20%] hidden md:block">
            <AccountSidebar />
          </div>
          <div className="flex-1 flex items-center justify-center py-20">
            <CircularProgress sx={{ color: "var(--primary)" }} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gray-100 py-8">
      <div className="container flex flex-col lg:flex-row gap-5">
        <div className="w-full lg:w-[20%] shrink-0">
          <AccountSidebar />
        </div>

        <div className="wrapper w-full lg:w-[75%]">
          <div className="bg-white shadow-md rounded-md mb-5">
            <div className="p-4 flex items-center justify-between border-b border-gray-200">
              <div className="info">
                <h4 className="text-xl font-medium text-gray-700">
                  My Addresses
                </h4>
                <p className="text-sm text-gray-500">
                  Manage delivery addresses with auto-filled area, city, and
                  state details.
                </p>
              </div>
              <Button
                onClick={handleAddNew}
                sx={{
                  backgroundColor: "var(--primary)",
                  color: "white",
                  textTransform: "none",
                  borderRadius: "8px",
                  "&:hover": { backgroundColor: "#a04a17" },
                }}
              >
                <FiPlus className="mr-1" /> Add New Address
              </Button>
            </div>

            <div className="p-5">
              {addresses.length === 0 ? (
                <div className="text-center py-12">
                  <FiMapPin className="mx-auto text-gray-300 mb-4" size={64} />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">
                    No addresses yet
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Save your first address to speed up checkout.
                  </p>
                  <Button
                    onClick={handleAddNew}
                    sx={{
                      backgroundColor: "var(--primary)",
                      color: "white",
                      textTransform: "none",
                      borderRadius: "8px",
                      "&:hover": { backgroundColor: "#a04a17" },
                    }}
                  >
                    <FiPlus className="mr-1" /> Add Address
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {addresses.map((address) => {
                    const display = getAddressDisplayLines(
                      mapAddressResponseToForm(address),
                    );

                    return (
                      <div
                        key={address._id}
                        className={`relative p-4 rounded-lg border-2 transition-all ${
                          address.selected
                            ? "border-orange-500 bg-orange-50"
                            : "border-gray-200 bg-gray-50 hover:border-orange-300"
                        }`}
                      >
                        {address.selected && (
                          <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                            <FiCheck size={12} /> Default
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 bg-gray-200 text-gray-700 text-sm px-2 py-1 rounded-md mb-2">
                          {getAddressIcon(address.addressType)}
                          {address.addressType || "Home"}
                        </span>

                        <h3 className="text-lg font-medium text-gray-800 mb-1">
                          {address.full_name || address.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-1">
                          {display.line1 || "Address not available"}
                        </p>
                        {display.line2 && (
                          <p className="text-sm text-gray-600 mb-1">
                            {display.line2}
                          </p>
                        )}
                        <p className="text-sm text-gray-600 mb-1">
                          {[address.city, address.state]
                            .filter(Boolean)
                            .join(", ")}{" "}
                          - {address.pincode}
                        </p>
                        <p className="text-sm text-gray-600">
                          +91 {address.mobile_number || address.mobile}
                        </p>

                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-200">
                          <Button
                            size="small"
                            onClick={() => handleEdit(address)}
                            sx={{
                              textTransform: "none",
                              color: "var(--primary)",
                              minWidth: "auto",
                            }}
                          >
                            <FiEdit2 className="mr-1" size={14} /> Edit
                          </Button>
                          <Button
                            size="small"
                            onClick={() => handleDelete(address._id)}
                            disabled={deleting === address._id}
                            sx={{
                              textTransform: "none",
                              color: "#dc2626",
                              minWidth: "auto",
                            }}
                          >
                            {deleting === address._id ? (
                              <CircularProgress size={14} />
                            ) : (
                              <>
                                <FiTrash2 className="mr-1" size={14} /> Delete
                              </>
                            )}
                          </Button>
                          {!address.selected && (
                            <Button
                              size="small"
                              onClick={() => handleSetDefault(address._id)}
                              sx={{
                                textTransform: "none",
                                color: "var(--primary)",
                                minWidth: "auto",
                                marginLeft: "auto",
                              }}
                            >
                              Set Default
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: "1px solid #e5e7eb" }}>
          {editingAddress ? "Edit Address" : "Add New Address"}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <div className="grid grid-cols-1 gap-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                name="fullName"
                label="Full Name *"
                value={formData.fullName}
                onChange={handleChange}
                error={!!formErrors.fullName}
                helperText={formErrors.fullName}
                fullWidth
                size="small"
              />

              <TextField
                name="mobileNumber"
                label="Mobile Number *"
                value={formData.mobileNumber}
                onChange={handleChange}
                error={!!formErrors.mobileNumber}
                helperText={formErrors.mobileNumber}
                fullWidth
                size="small"
                placeholder="10-digit mobile number"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <UseCurrentLocationGoogleMaps
                onResolved={handleUseLocationResolved}
                onError={(message) =>
                  setSnackbar({
                    open: true,
                    message,
                    severity: "error",
                  })
                }
              />
              {locationPayload?.formattedAddress && (
                <span className="text-xs text-gray-500">
                  Location selected from Google Maps
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                name="pincode"
                label="Pincode *"
                value={formData.pincode}
                onChange={handleChange}
                onBlur={() => {
                  if (formData.pincode.length === 6) {
                    lookupPincode(formData.pincode);
                  }
                }}
                error={
                  !!formErrors.pincode ||
                  (pincodeLookup.status === "error" &&
                    !hasResolvedPincodeDetails(formData))
                }
                helperText={
                  formErrors.pincode ||
                  (pincodeLookup.status === "error" &&
                  hasResolvedPincodeDetails(formData)
                    ? ""
                    : getLookupHelperText(pincodeLookup))
                }
                fullWidth
                size="small"
                placeholder="6-digit pincode"
              />

              <TextField
                name="flatHouse"
                label="Flat / House / Building *"
                value={formData.flatHouse}
                onChange={handleChange}
                error={!!formErrors.flatHouse}
                helperText={formErrors.flatHouse}
                fullWidth
                size="small"
              />
            </div>

            <TextField
              name="areaStreetSector"
              label="Area / Street / Sector *"
              value={formData.areaStreetSector}
              onChange={handleChange}
              error={!!formErrors.areaStreetSector}
              helperText={formErrors.areaStreetSector}
              fullWidth
              size="small"
            />

            <TextField
              name="landmark"
              label="Landmark (Optional)"
              value={formData.landmark}
              onChange={handleChange}
              fullWidth
              size="small"
              placeholder="Near park, mall, etc."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                name="city"
                label="Town / City *"
                value={formData.city}
                onChange={handleChange}
                error={!!formErrors.city}
                helperText={formErrors.city}
                fullWidth
                size="small"
              />
              <FormControl fullWidth size="small" error={!!formErrors.state}>
                <InputLabel>State *</InputLabel>
                <Select
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  label="State *"
                >
                  {INDIAN_STATES.map((state) => (
                    <MenuItem key={state} value={state}>
                      {state}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <FormControl fullWidth size="small">
                <InputLabel>Address Type</InputLabel>
                <Select
                  name="addressType"
                  value={formData.addressType}
                  onChange={handleChange}
                  label="Address Type"
                >
                  <MenuItem value="Home">
                    <span className="flex items-center gap-2">
                      <MdHome /> Home
                    </span>
                  </MenuItem>
                  <MenuItem value="Work">
                    <span className="flex items-center gap-2">
                      <MdWork /> Work
                    </span>
                  </MenuItem>
                  <MenuItem value="Other">
                    <span className="flex items-center gap-2">
                      <MdLocationOn /> Other
                    </span>
                  </MenuItem>
                </Select>
              </FormControl>
            </div>

            <FormControlLabel
              control={
                <Checkbox
                  name="isDefault"
                  checked={Boolean(formData.isDefault)}
                  onChange={handleChange}
                />
              }
              label="Make this my default delivery address"
            />
          </div>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: "1px solid #e5e7eb" }}>
          <Button
            onClick={() => setIsDialogOpen(false)}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            sx={{
              backgroundColor: "var(--primary)",
              color: "white",
              textTransform: "none",
              "&:hover": { backgroundColor: "#a04a17" },
              "&:disabled": { backgroundColor: "#ccc" },
            }}
          >
            {saving ? (
              <CircularProgress size={20} color="inherit" />
            ) : editingAddress ? (
              "Update"
            ) : (
              "Save"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </section>
  );
};

export default AddressPage;
