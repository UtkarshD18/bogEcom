"use client";

import { API_BASE_URL, getStoredAccessToken } from "@/utils/api";
import AccountSidebar from "@/components/AccountSiderbar";
import UseCurrentLocationGoogleMaps from "@/components/UseCurrentLocationGoogleMaps";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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

const API_URL = API_BASE_URL;

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

const INDIAN_STATES = [
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

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    address_line1: "",
    city: "",
    state: "",
    pincode: "",
    mobile: "",
    landmark: "",
    addressType: "Home",
  });
  const [formErrors, setFormErrors] = useState({});

  // Fetch addresses
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
      } else {
        if (response.status === 401) {
          router.push("/login?redirect=/address");
        } else {
          setSnackbar({
            open: true,
            message: data.message || "Failed to load addresses",
            severity: "error",
          });
        }
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message:
          "Unable to reach server. Please check the backend and API URL.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      address_line1: "",
      city: "",
      state: "",
      pincode: "",
      mobile: "",
      landmark: "",
      addressType: "Home",
    });
    setFormErrors({});
    setEditingAddress(null);
    setLocationPayload(null);
  };

  // Open dialog for new address
  const handleAddNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Open dialog for editing
  const handleEdit = (address) => {
    setEditingAddress(address);
    setFormData({
      name: address.name || "",
      address_line1: address.address_line1 || "",
      city: address.city || "",
      state: address.state || "",
      pincode: address.pincode || "",
      mobile: address.mobile?.toString() || "",
      landmark: address.landmark || "",
      addressType: address.addressType || "Home",
    });
    setFormErrors({});
    setLocationPayload(null);
    setIsDialogOpen(true);
  };

  const normalizeStateValue = (value) => {
    const incoming = String(value || "").trim().toLowerCase();
    if (!incoming) return "";
    const match = INDIAN_STATES.find(
      (s) => String(s).trim().toLowerCase() === incoming,
    );
    return match || "";
  };

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = "Name is required";
    if (!formData.address_line1.trim())
      errors.address_line1 = "Address is required";
    if (!formData.city.trim()) errors.city = "City is required";
    if (!formData.state) errors.state = "State is required";
    if (!formData.pincode.trim()) errors.pincode = "Pincode is required";
    else if (!/^\d{6}$/.test(formData.pincode))
      errors.pincode = "Enter valid 6-digit pincode";
    if (!formData.mobile.trim()) errors.mobile = "Mobile is required";
    else if (!/^\d{10}$/.test(formData.mobile.replace(/\D/g, "")))
      errors.mobile = "Enter valid 10-digit mobile";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save address
  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const url = editingAddress
        ? `${API_URL}/api/address/${editingAddress._id}`
        : `${API_URL}/api/address`;

      const response = await fetch(url, {
        method: editingAddress ? "PUT" : "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          location: locationPayload,
        }),
      });

      const data = await parseResponse(response);

      if (response.status === 401) {
        router.push("/login?redirect=/address");
        return;
      }

      if (data.success) {
        setSnackbar({
          open: true,
          message: editingAddress ? "Address updated!" : "Address added!",
          severity: "success",
        });
        setIsDialogOpen(false);
        resetForm();
        fetchAddresses();
      } else {
        setSnackbar({
          open: true,
          message: data.message || "Failed to save",
          severity: "error",
        });
      }
    } catch (error) {
      console.warn("Address save failed:", error);
      setSnackbar({
        open: true,
        message: "Failed to save address",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete address
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
        fetchAddresses();
      } else {
        setSnackbar({
          open: true,
          message: data.message || "Failed to delete",
          severity: "error",
        });
      }
    } catch (error) {
      console.warn("Address delete failed:", error);
      setSnackbar({
        open: true,
        message: "Failed to delete address",
        severity: "error",
      });
    } finally {
      setDeleting(null);
    }
  };

  // Set as default
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
        fetchAddresses();
      } else {
        setSnackbar({
          open: true,
          message: data.message || "Failed to update",
          severity: "error",
        });
      }
    } catch (error) {
      console.warn("Address default update failed:", error);
      setSnackbar({
        open: true,
        message: "Failed to update default address",
        severity: "error",
      });
    }
  };

  // Get address type icon
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
                  Manage your delivery addresses
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
                    Add your first delivery address
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {addresses.map((address) => (
                    <div
                      key={address._id}
                      className={`relative p-4 rounded-lg border-2 transition-all ${address.selected
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
                        {address.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-1">
                        {address.address_line1}
                        {address.landmark && `, ${address.landmark}`}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        {address.city}, {address.state} - {address.pincode}
                      </p>
                      <p className="text-sm text-gray-600">
                        +91 {address.mobile}
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
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
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
            <TextField
              name="name"
              label="Full Name *"
              value={formData.name}
              onChange={handleChange}
              error={!!formErrors.name}
              helperText={formErrors.name}
              fullWidth
              size="small"
            />

            <TextField
              name="mobile"
              label="Mobile Number *"
              value={formData.mobile}
              onChange={handleChange}
              error={!!formErrors.mobile}
              helperText={formErrors.mobile}
              fullWidth
              size="small"
              placeholder="10-digit mobile number"
            />

            <div className="flex items-center gap-2 flex-wrap">
              <UseCurrentLocationGoogleMaps
                onResolved={(loc) => {
                  setLocationPayload(loc);
                  setFormData((prev) => ({
                    ...prev,
                    address_line1: loc.street || loc.formattedAddress || prev.address_line1,
                    city: loc.city || prev.city,
                    pincode: loc.pincode || prev.pincode,
                    state: normalizeStateValue(loc.state) || prev.state,
                  }));
                }}
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
                  Location selected
                </span>
              )}
            </div>

            <TextField
              name="address_line1"
              label="Address (House No, Building, Street) *"
              value={formData.address_line1}
              onChange={handleChange}
              error={!!formErrors.address_line1}
              helperText={formErrors.address_line1}
              fullWidth
              size="small"
              multiline
              rows={2}
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

            <div className="grid grid-cols-2 gap-4">
              <TextField
                name="city"
                label="City *"
                value={formData.city}
                onChange={handleChange}
                error={!!formErrors.city}
                helperText={formErrors.city}
                fullWidth
                size="small"
              />

              <TextField
                name="pincode"
                label="Pincode *"
                value={formData.pincode}
                onChange={handleChange}
                error={!!formErrors.pincode}
                helperText={formErrors.pincode}
                fullWidth
                size="small"
                placeholder="6-digit pincode"
              />
            </div>

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

      {/* Snackbar */}
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
