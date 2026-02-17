"use client";

import { useAdmin } from "@/context/AdminContext";
import {
  API_BASE_URL,
  deleteData,
  getData,
  patchData,
  postData,
  putData,
} from "@/utils/api";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FaBoxOpen,
  FaClipboardList,
  FaDownload,
  FaEdit,
  FaPlus,
  FaTrash,
} from "react-icons/fa";
import { IoClose } from "react-icons/io5";

const API_URL = API_BASE_URL;

const EMPTY_ITEM = {
  productId: "",
  quantity: 1,
  price: 0,
  packing: "",
};

export default function PurchaseOrdersPage() {
  const { token } = useAdmin();
  const [activeTab, setActiveTab] = useState("create");
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([EMPTY_ITEM]);
  const [paymentType, setPaymentType] = useState("prepaid");
  const [guestDetails, setGuestDetails] = useState({
    fullName: "",
    phone: "",
    address: "",
    pincode: "",
    state: "",
    email: "",
    gst: "",
  });
  const [creating, setCreating] = useState(false);

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [receiveForm, setReceiveForm] = useState({
    invoiceNumber: "",
    vehicleNumber: "",
    notes: "",
    items: [],
  });
  const [receiving, setReceiving] = useState(false);

  // Vendor management state
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    pincode: "",
    state: "",
    gst: "",
  });
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [vendorSaving, setVendorSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      const res = await getData("/api/products?limit=200", token);
      if (res.success) {
        setProducts(res.data || []);
      }
    };
    load();
  }, [token]);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    const res = await getData(
      "/api/purchase-orders/admin/all?page=1&limit=50",
      token,
    );
    if (res.success) {
      setOrders(res.data?.orders || []);
    }
    setLoadingOrders(false);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchOrders();
    fetchVendors();
  }, [token, fetchOrders]);

  const fetchVendors = useCallback(async () => {
    if (!token) return;
    setVendorsLoading(true);
    const res = await getData("/api/vendors", token);
    if (res.success) {
      setVendors(res.data || []);
    }
    setVendorsLoading(false);
  }, [token]);

  const handleOpenVendorDialog = () => {
    setEditingVendorId(null);
    setVendorForm({
      fullName: "",
      phone: "",
      email: "",
      address: "",
      pincode: "",
      state: "",
      gst: "",
    });
    setVendorDialogOpen(true);
  };

  const handleEditVendor = (vendor) => {
    setEditingVendorId(vendor._id);
    setVendorForm({
      fullName: vendor.fullName || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      address: vendor.address || "",
      pincode: vendor.pincode || "",
      state: vendor.state || "",
      gst: vendor.gst || "",
    });
    setVendorDialogOpen(true);
  };

  const handleSaveVendor = async () => {
    if (!vendorForm.fullName.trim()) {
      toast.error("Vendor name is required");
      return;
    }
    setVendorSaving(true);
    try {
      let res;
      if (editingVendorId) {
        res = await putData(
          `/api/vendors/${editingVendorId}`,
          vendorForm,
          token,
        );
      } else {
        res = await postData("/api/vendors", vendorForm, token);
      }
      if (res.success) {
        toast.success(editingVendorId ? "Vendor updated" : "Vendor added");
        setVendorDialogOpen(false);
        fetchVendors();
      } else {
        toast.error(res.message || "Failed to save vendor");
      }
    } catch (err) {
      toast.error("Failed to save vendor");
    }
    setVendorSaving(false);
  };

  const handleDeleteVendor = async (id) => {
    if (!confirm("Delete this vendor?")) return;
    const res = await deleteData(`/api/vendors/${id}`, token);
    if (res.success) {
      toast.success("Vendor deleted");
      fetchVendors();
    } else {
      toast.error("Failed to delete vendor");
    }
  };

  const handleSelectVendor = (vendor) => {
    setGuestDetails({
      fullName: vendor.fullName || "",
      phone: vendor.phone || "",
      address: vendor.address || "",
      pincode: vendor.pincode || "",
      state: vendor.state || "",
      email: vendor.email || "",
      gst: vendor.gst || "",
    });
    toast.success(`Vendor "${vendor.fullName}" selected`);
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const itemRows = useMemo(() => {
    return items.map((item, index) => {
      const product = products.find((p) => p._id === item.productId);
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || product?.price || 0);
      const amount = quantity * price;
      const packing = item.packing || "";
      return { ...item, product, quantity, price, amount, packing, index };
    });
  }, [items, products]);

  const totalAmount = itemRows.reduce((sum, row) => sum + row.amount, 0);
  const productLookup = useMemo(() => {
    return new Map(
      (products || []).map((product) => [String(product._id), product]),
    );
  }, [products]);

  const formatPoStatus = (status) => {
    const raw = String(status || "").toLowerCase();
    if (raw === "converted") return "PLACED";
    if (raw === "approved") return "APPROVED";
    if (raw === "draft") return "DRAFT";
    if (raw) return raw.toUpperCase();
    return "N/A";
  };

  const formatPoNumber = (order, index = 0) => {
    if (!order) return "N/A";
    if (order.poNumber) return String(order.poNumber);
    const created = order.createdAt ? new Date(order.createdAt) : new Date();
    const year = created.getFullYear();
    const month = created.getMonth();
    const fyStartYear = month >= 3 ? year : year - 1;
    const fyEndYear = fyStartYear + 1;
    const fyStart = String(fyStartYear % 100).padStart(2, "0");
    const fyEnd = String(fyEndYear % 100).padStart(2, "0");
    const seq = String((index ?? 0) + 1).padStart(3, "0");
    return `BOGPO${fyStart}-${fyEnd}/${seq}`;
  };

  const formatPacking = (item) => {
    if (!item) return "-";
    if (item.packing) return item.packing;
    if (item.packSize) return item.packSize;
    const product = productLookup.get(String(item.productId || ""));
    const weight = Number(product?.weight || 0);
    const unit = String(product?.unit || "").toLowerCase();
    if (weight > 0) {
      if (unit === "g" || unit === "gm" || unit === "gram" || unit === "grams") {
        return weight >= 1000 ? `${weight / 1000}kg` : `${weight}g`;
      }
      if (unit === "kg" || unit === "kilogram" || unit === "kilograms") {
        return `${weight}kg`;
      }
      return `${weight}${product?.unit || ""}`;
    }
    return product?.unit || "-";
  };

  const handleCreateOrder = async () => {
    const validItems = itemRows.filter((row) => row.product?._id);
    if (validItems.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    if (
      !guestDetails.fullName ||
      !guestDetails.phone ||
      !guestDetails.address
    ) {
      toast.error("Fill vendor details (name, phone, address)");
      return;
    }

    setCreating(true);
    const payload = {
      items: validItems.map((row) => ({
        productId: row.product._id,
        productTitle: row.product.name,
        quantity: row.quantity,
        packing: row.packing,
        price: row.price,
        subTotal: row.amount,
        image: row.product.thumbnail || row.product.images?.[0] || "",
      })),
      guestDetails,
      paymentType,
    };

    const res = await postData("/api/purchase-orders", payload, token);
    if (res.success) {
      toast.success("Purchase order created");
      setItems([EMPTY_ITEM]);
      setGuestDetails({
        fullName: "",
        phone: "",
        address: "",
        pincode: "",
        state: "",
        email: "",
        gst: "",
      });
      fetchOrders();
      setActiveTab("placed");
    } else {
      toast.error(res.message || "Failed to create purchase order");
    }
    setCreating(false);
  };

  const handleDownload = async (orderId) => {
    try {
      const downloadRequest = async (authToken) =>
        fetch(`${API_URL}/api/purchase-orders/${orderId}/pdf`, {
          method: "GET",
          headers: authToken
            ? {
                Authorization: `Bearer ${authToken}`,
              }
            : undefined,
          credentials: "include",
        });

      let response = await downloadRequest(token);

      if (response.status === 401) {
        try {
          const refreshResponse = await fetch(
            `${API_URL}/api/user/refresh-token`,
            {
              method: "POST",
              credentials: "include",
            },
          );
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            const newToken = refreshData?.data?.accessToken || null;
            if (newToken) {
              localStorage.setItem("adminToken", newToken);
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("adminTokenRefreshed", { detail: newToken }),
                );
              }
              response = await downloadRequest(newToken);
            }
          }
        } catch (refreshError) {
          // Ignore refresh errors and fall through to error handler
        }
      }

      if (!response.ok) {
        let message = "Failed to download PDF";
        try {
          const errorData = await response.json();
          message = errorData?.message || message;
        } catch {
          // ignore parsing errors for non-JSON responses
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PO-${String(orderId).slice(-8).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.message || "Failed to download PDF");
    }
  };

  const handleMarkReceived = async (orderId) => {
    try {
      const res = await patchData(
        `/api/purchase-orders/admin/${orderId}/status`,
        { status: "received" },
        token,
      );
      if (res.success) {
        toast.success("Purchase order marked as received");
        fetchOrders();
        setSelectedOrder((prev) =>
          prev && prev._id === orderId ? res.data?.purchaseOrder || prev : prev,
        );
      } else {
        toast.error(res.message || "Failed to mark as received");
      }
    } catch (error) {
      toast.error("Failed to mark as received");
    }
  };
  const handleOpenReceiveDialog = (order) => {
    if (!order) return;
    setReceiveTarget(order);
    setReceiveForm({
      invoiceNumber: order.receipt?.invoiceNumber || "",
      vehicleNumber: order.receipt?.vehicleNumber || "",
      notes: order.receipt?.notes || "",
      items: (order.items || []).map((item) => ({
        productId: item.productId,
        productTitle: item.productTitle,
        orderedQty: Number(item.quantity || 0),
        receivedQty: Number(item.receivedQuantity || 0),
        receiveNow: 0,
      })),
    });
    setReceiveDialogOpen(true);
  };

  const updateReceiveItem = (index, value) => {
    setReceiveForm((prev) => {
      const next = [...(prev.items || [])];
      next[index] = { ...next[index], receiveNow: value };
      return { ...prev, items: next };
    });
  };

  const handleSubmitReceive = async () => {
    if (!receiveTarget?._id) return;
    const payload = {
      invoiceNumber: receiveForm.invoiceNumber,
      vehicleNumber: receiveForm.vehicleNumber,
      notes: receiveForm.notes,
      items: (receiveForm.items || [])
        .filter((item) => Number(item.receiveNow || 0) > 0)
        .map((item) => ({
          productId: item.productId,
          receivedQuantity: Number(item.receiveNow || 0),
        })),
    };

    setReceiving(true);
    try {
      const res = await patchData(
        `/api/purchase-orders/${receiveTarget._id}/receive`,
        payload,
        token,
      );
      if (res.success) {
        toast.success("Receipt updated");
        setReceiveDialogOpen(false);
        setReceiveTarget(null);
        fetchOrders();
      } else {
        toast.error(res.message || "Failed to update receipt");
      }
    } catch (error) {
      toast.error(error.message || "Failed to update receipt");
    }
    setReceiving(false);
  };

  const selectedOrderData = selectedOrder?.order || null;
  const selectedOrderIndex = selectedOrder
    ? Number.isInteger(selectedOrder.index)
      ? selectedOrder.index
      : orders.findIndex((o) => o._id === selectedOrder?.order?._id)
    : -1;
  return (
    <div className="min-h-screen bg-[#EAF6FF] px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 text-gray-800">
          <FaClipboardList className="text-xl" />
          <h1 className="text-2xl font-semibold">Purchase Orders</h1>
        </div>
        <Button
          variant="outlined"
          startIcon={<FaBoxOpen />}
          onClick={handleOpenVendorDialog}
        >
          Manage Vendors
        </Button>
      </div>

      {/* Tabs */}
      <div className="bg-white/70 rounded-xl p-2 flex items-center gap-2 border border-white/60 shadow-sm mb-6">
        <button
          className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
            activeTab === "create"
              ? "bg-white shadow text-sky-700"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("create")}
        >
          Create Order
        </button>
        <button
          className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
            activeTab === "placed"
              ? "bg-white shadow text-sky-700"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("placed")}
        >
          Placed Orders
        </button>
      </div>

      {activeTab === "create" && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">
            New Purchase Order
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Add items to your purchase order. Select a product to auto-fill
            rate.
          </p>

          {/* Vendor Selector */}
          {vendors.length > 0 && (
            <div className="mb-4">
              <TextField
                select
                label="Select Saved Vendor"
                size="small"
                fullWidth
                value=""
                onChange={(e) => {
                  const vendor = vendors.find((v) => v._id === e.target.value);
                  if (vendor) handleSelectVendor(vendor);
                }}
              >
                <MenuItem value="">— Select a vendor —</MenuItem>
                {vendors.map((v) => (
                  <MenuItem key={v._id} value={v._id}>
                    {v.fullName} {v.phone ? `• ${v.phone}` : ""}
                  </MenuItem>
                ))}
              </TextField>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <TextField
              label="Vendor Name"
              value={guestDetails.fullName}
              onChange={(e) =>
                setGuestDetails((prev) => ({
                  ...prev,
                  fullName: e.target.value,
                }))
              }
              size="small"
              fullWidth
            />
            <TextField
              label="Vendor Phone"
              value={guestDetails.phone}
              onChange={(e) =>
                setGuestDetails((prev) => ({ ...prev, phone: e.target.value }))
              }
              size="small"
              fullWidth
            />
            <TextField
              label="Vendor Address"
              value={guestDetails.address}
              onChange={(e) =>
                setGuestDetails((prev) => ({
                  ...prev,
                  address: e.target.value,
                }))
              }
              size="small"
              fullWidth
            />
            <TextField
              label="Pincode"
              value={guestDetails.pincode}
              onChange={(e) =>
                setGuestDetails((prev) => ({
                  ...prev,
                  pincode: e.target.value,
                }))
              }
              size="small"
              fullWidth
            />
            <TextField
              label="State"
              value={guestDetails.state}
              onChange={(e) =>
                setGuestDetails((prev) => ({ ...prev, state: e.target.value }))
              }
              size="small"
              fullWidth
            />
            <TextField
              label="Email"
              value={guestDetails.email}
              onChange={(e) =>
                setGuestDetails((prev) => ({ ...prev, email: e.target.value }))
              }
              size="small"
              fullWidth
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-7 text-xs text-gray-500 font-semibold border-b pb-2">
              <div className="col-span-2">Product</div>
              <div>Quantity</div>
              <div>Packing</div>
              <div>Rate (₹)</div>
              <div>Amount</div>
              <div className="text-right">Action</div>
            </div>

            {itemRows.map((row) => (
              <div
                key={row.index}
                className="grid grid-cols-7 items-center gap-3 bg-[#F2F8FF] p-3 rounded-lg"
              >
                <div className="col-span-2">
                  <select
                    className="w-full px-3 py-2 rounded-lg border border-sky-100 bg-white"
                    value={row.productId}
                    onChange={(e) =>
                      updateItem(row.index, "productId", e.target.value)
                    }
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product._id} value={product._id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <TextField
                  size="small"
                  value={row.quantity}
                  onChange={(e) =>
                    updateItem(row.index, "quantity", e.target.value)
                  }
                />
                <TextField
                  size="small"
                  placeholder="e.g. 1kg"
                  value={row.packing}
                  onChange={(e) =>
                    updateItem(row.index, "packing", e.target.value)
                  }
                />
                <TextField
                  size="small"
                  value={row.price}
                  onChange={(e) =>
                    updateItem(row.index, "price", e.target.value)
                  }
                />
                <div className="text-gray-700 font-semibold">
                  ₹{row.amount.toLocaleString("en-IN")}
                </div>
                <div className="flex justify-end">
                  <button
                    className="text-red-500 hover:text-red-600"
                    onClick={() => handleRemoveItem(row.index)}
                  >
                    <IoClose />
                  </button>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between bg-[#F7FBFF] px-4 py-3 rounded-lg">
              <span className="text-sm font-semibold text-gray-700">
                Total Amount
              </span>
              <span className="text-base font-bold text-gray-900">
                ₹{totalAmount.toLocaleString("en-IN")}
              </span>
            </div>

            <div>
              <Button
                variant="outlined"
                startIcon={<FaPlus />}
                onClick={handleAddItem}
              >
                Add Item
              </Button>
            </div>

            <div className="flex justify-end">
              <Button
                variant="contained"
                disabled={creating}
                onClick={handleCreateOrder}
                sx={{
                  backgroundColor: "#7BC7F5",
                  color: "#0C2D48",
                  "&:hover": { backgroundColor: "#6AB7E8" },
                }}
              >
                {creating ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  "Place Purchase Order"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "placed" && (
        <div className="space-y-4">
          {loadingOrders ? (
            <div className="flex items-center justify-center h-48">
              <CircularProgress />
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-gray-500">
              No purchase orders found.
            </div>
          ) : (
            orders.map((order, index) => (
              <div
                key={order._id}
                className="bg-white rounded-xl shadow p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div>
                  <div className="text-lg font-semibold text-gray-800">
                    {formatPoNumber(order, index)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {order.guestDetails?.fullName ||
                      order.userId?.name ||
                      "Vendor"}{" "}
                    • {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-800">
                    ₹{Number(order.total || 0).toLocaleString("en-IN")}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    Status: {formatPoStatus(order.status)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outlined"
                    onClick={() => handleOpenReceiveDialog(order)}
                  >
                    Receive Items
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setSelectedOrder({ order, index })}
                  >
                    View/Download
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {selectedOrderData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[#EAF6FF] rounded-2xl shadow-xl w-full max-w-3xl p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-500"
              onClick={() => setSelectedOrder(null)}
            >
              <IoClose size={20} />
            </button>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Purchase Order:{" "}
              {formatPoNumber(selectedOrderData, selectedOrderIndex)}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {selectedOrderData.guestDetails?.fullName ||
                selectedOrderData.userId?.name ||
                "Vendor"}{" "}
              • {new Date(selectedOrderData.createdAt).toLocaleString()}
            </p>

            <div className="bg-white/70 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-700">
              <div>
                <div className="text-xs uppercase text-gray-500">PO Number</div>
                <div className="font-semibold">
                  {formatPoNumber(selectedOrderData, selectedOrderIndex)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Date</div>
                <div className="font-semibold">
                  {new Date(selectedOrderData.createdAt).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Status</div>
                <div className="font-semibold">
                  {formatPoStatus(selectedOrderData.status)}
                </div>
              </div>
            </div>

            <div className="mt-4 bg-white/70 rounded-xl p-4">
              <div className="text-sm font-semibold text-gray-800 mb-3">
                Vendor Details
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                <div>
                  <span className="text-gray-500 text-xs uppercase">Name</span>
                  <div className="font-medium">
                    {selectedOrderData.guestDetails?.fullName ||
                      selectedOrderData.userId?.name ||
                      "Vendor"}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase">Phone</span>
                  <div className="font-medium">
                    {selectedOrderData.guestDetails?.phone || "N/A"}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase">Address</span>
                  <div className="font-medium">
                    {selectedOrderData.guestDetails?.address || "N/A"}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase">State</span>
                  <div className="font-medium">
                    {selectedOrderData.guestDetails?.state || "N/A"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-white/70 rounded-xl p-4">
              <div className="text-sm font-semibold text-gray-800 mb-3">
                Receipt Details
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                <div>
                  <span className="text-gray-500 text-xs uppercase">
                    Invoice Number
                  </span>
                  <div className="font-medium">
                    {selectedOrderData.receipt?.invoiceNumber || "N/A"}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase">
                    Vehicle Number
                  </span>
                  <div className="font-medium">
                    {selectedOrderData.receipt?.vehicleNumber || "N/A"}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <span className="text-gray-500 text-xs uppercase">Notes</span>
                  <div className="font-medium">
                    {selectedOrderData.receipt?.notes || "N/A"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-white/70 rounded-xl p-4">
              <div className="grid grid-cols-7 text-xs text-gray-500 font-semibold border-b pb-2">
                <div>S.N</div>
                <div className="col-span-2">Product</div>
                <div>Packing</div>
                <div>Qty</div>
                <div>Rate/kg</div>
                <div>Amount</div>
              </div>
              {selectedOrderData.items?.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-7 text-sm text-gray-700 py-2 border-b last:border-b-0"
                >
                  <div>{index + 1}</div>
                  <div className="col-span-2">{item.productTitle}</div>
                  <div>{formatPacking(item)}</div>
                  <div>
                    {item.quantity}
                    {Number(item.receivedQuantity || 0) > 0
                      ? ` (${item.receivedQuantity} rec)`
                      : ""}
                  </div>
                  <div>₹{Number(item.price || 0).toLocaleString("en-IN")}</div>
                  <div className="font-semibold">
                    ₹{Number(item.subTotal || 0).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4 text-sm text-gray-700">
                <div className="text-xs text-gray-500">
                  Generated on{" "}
                  {new Date(selectedOrderData.createdAt).toLocaleString()}
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    Total: ₹
                    {Number(selectedOrderData.total || 0).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outlined" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
              {selectedOrderData?.status !== "received" && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => handleMarkReceived(selectedOrderData._id)}
                >
                  Mark Received
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<FaDownload />}
                onClick={() => handleDownload(selectedOrderData._id)}
              >
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={receiveDialogOpen}
        onClose={() => setReceiveDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Receive Items
          {receiveTarget
            ? ` — ${formatPoNumber(
                receiveTarget,
                orders.findIndex((o) => o._id === receiveTarget?._id),
              )}`
            : ""}
        </DialogTitle>
        <DialogContent>
          <div className="space-y-4 mt-2">
            {(receiveForm.items || []).map((item, index) => {
              const orderedQty = Number(item.orderedQty || 0);
              const receivedQty = Number(item.receivedQty || 0);
              const remaining = Math.max(orderedQty - receivedQty, 0);
              return (
                <div
                  key={item.productId || index}
                  className="border rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-gray-800">
                      {item.productTitle || "Product"}
                    </div>
                    <div className="text-xs text-gray-500">
                      Ordered: {orderedQty} | Received: {receivedQty} |
                      Remaining: {remaining}
                    </div>
                  </div>
                  <TextField
                    label="Qty Receiving"
                    type="number"
                    size="small"
                    value={item.receiveNow}
                    onChange={(e) =>
                      updateReceiveItem(index, Number(e.target.value || 0))
                    }
                    inputProps={{ min: 0, max: remaining }}
                    fullWidth
                  />
                </div>
              );
            })}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextField
                label="Invoice / Bill Number"
                size="small"
                value={receiveForm.invoiceNumber}
                onChange={(e) =>
                  setReceiveForm((prev) => ({
                    ...prev,
                    invoiceNumber: e.target.value,
                  }))
                }
                fullWidth
              />
              <TextField
                label="Vehicle Number"
                size="small"
                value={receiveForm.vehicleNumber}
                onChange={(e) =>
                  setReceiveForm((prev) => ({
                    ...prev,
                    vehicleNumber: e.target.value,
                  }))
                }
                fullWidth
              />
              <TextField
                label="Notes (Optional)"
                size="small"
                value={receiveForm.notes}
                onChange={(e) =>
                  setReceiveForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                fullWidth
                multiline
                rows={3}
              />
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiveDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={receiving}
            onClick={handleSubmitReceive}
          >
            {receiving ? "Saving..." : "Confirm Receipt"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Vendor Management Dialog */}
      <Dialog
        open={vendorDialogOpen}
        onClose={() => setVendorDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingVendorId ? "Edit Vendor" : "Manage Vendors"}
        </DialogTitle>
        <DialogContent>
          {/* Vendor form */}
          <div className="border rounded-lg p-4 mb-4 mt-2 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              {editingVendorId ? "Update Vendor" : "Add New Vendor"}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextField
                label="Name *"
                size="small"
                fullWidth
                value={vendorForm.fullName}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, fullName: e.target.value }))
                }
              />
              <TextField
                label="Phone"
                size="small"
                fullWidth
                value={vendorForm.phone}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
              <TextField
                label="Email"
                size="small"
                fullWidth
                value={vendorForm.email}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, email: e.target.value }))
                }
              />
              <TextField
                label="Address"
                size="small"
                fullWidth
                value={vendorForm.address}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, address: e.target.value }))
                }
              />
              <TextField
                label="Pincode"
                size="small"
                fullWidth
                value={vendorForm.pincode}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, pincode: e.target.value }))
                }
              />
              <TextField
                label="State"
                size="small"
                fullWidth
                value={vendorForm.state}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, state: e.target.value }))
                }
              />
              <TextField
                label="GST Number"
                size="small"
                fullWidth
                value={vendorForm.gst}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, gst: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              {editingVendorId && (
                <Button
                  size="small"
                  onClick={() => {
                    setEditingVendorId(null);
                    setVendorForm({
                      fullName: "",
                      phone: "",
                      email: "",
                      address: "",
                      pincode: "",
                      state: "",
                      gst: "",
                    });
                  }}
                >
                  Cancel Edit
                </Button>
              )}
              <Button
                variant="contained"
                size="small"
                disabled={vendorSaving}
                onClick={handleSaveVendor}
              >
                {vendorSaving ? (
                  <CircularProgress size={18} color="inherit" />
                ) : editingVendorId ? (
                  "Update"
                ) : (
                  "Add Vendor"
                )}
              </Button>
            </div>
          </div>

          {/* Vendor list */}
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Saved Vendors
          </h4>
          {vendorsLoading ? (
            <div className="flex justify-center py-4">
              <CircularProgress size={24} />
            </div>
          ) : vendors.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              No vendors yet. Add one above.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {vendors.map((v) => (
                <div
                  key={v._id}
                  className="flex items-center justify-between bg-white border rounded-lg px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-gray-800">
                      {v.fullName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {[v.phone, v.email, v.state].filter(Boolean).join(" • ")}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="text-blue-500 hover:text-blue-700 p-1"
                      onClick={() => handleEditVendor(v)}
                      title="Edit"
                    >
                      <FaEdit size={14} />
                    </button>
                    <button
                      className="text-red-500 hover:text-red-700 p-1"
                      onClick={() => handleDeleteVendor(v._id)}
                      title="Delete"
                    >
                      <FaTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVendorDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
