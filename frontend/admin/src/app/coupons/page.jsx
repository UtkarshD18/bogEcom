"use client";
import { useAdmin } from "@/context/AdminContext";
import { deleteData, getData, postData, putData } from "@/utils/api";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { FaRegTrashAlt } from "react-icons/fa";
import { RiEdit2Line } from "react-icons/ri";

const Coupons = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: "",
    minOrderAmount: "",
    maxDiscountAmount: "",
    usageLimit: "",
    perUserLimit: "1",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    isActive: true,
  });

  const fetchCoupons = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getData("/api/coupons/admin/all", token);
      if (response.success) {
        setCoupons(response.data || []);
      } else {
        setCoupons([]);
      }
    } catch (error) {
      console.error("Failed to fetch coupons:", error);
      setCoupons([]);
    }
    setIsLoading(false);
  }, [token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchCoupons();
    }
  }, [isAuthenticated, token, fetchCoupons]);

  const handleOpenDialog = (coupon = null) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData({
        code: coupon.code || "",
        description: coupon.description || "",
        discountType: coupon.discountType || "percentage",
        discountValue: coupon.discountValue?.toString() || "",
        minOrderAmount: coupon.minOrderAmount?.toString() || "",
        maxDiscountAmount: coupon.maxDiscountAmount?.toString() || "",
        usageLimit: coupon.usageLimit?.toString() || "",
        perUserLimit: coupon.perUserLimit?.toString() || "1",
        startDate: coupon.startDate
          ? new Date(coupon.startDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        endDate: coupon.endDate
          ? new Date(coupon.endDate).toISOString().split("T")[0]
          : "",
        isActive: coupon.isActive !== false,
      });
    } else {
      setEditingCoupon(null);
      setFormData({
        code: "",
        description: "",
        discountType: "percentage",
        discountValue: "",
        minOrderAmount: "",
        maxDiscountAmount: "",
        usageLimit: "",
        perUserLimit: "1",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        isActive: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCoupon(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }
    if (!formData.discountValue || formData.discountValue <= 0) {
      toast.error("Please enter a valid discount value");
      return;
    }
    if (!formData.endDate) {
      toast.error("Please select an end date");
      return;
    }

    try {
      const payload = {
        code: formData.code.toUpperCase().trim(),
        description: formData.description,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minOrderAmount: formData.minOrderAmount
          ? Number(formData.minOrderAmount)
          : 0,
        maxDiscountAmount: formData.maxDiscountAmount
          ? Number(formData.maxDiscountAmount)
          : null,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        perUserLimit: formData.perUserLimit ? Number(formData.perUserLimit) : 1,
        startDate: formData.startDate,
        endDate: formData.endDate,
        isActive: formData.isActive,
      };

      let response;
      if (editingCoupon) {
        response = await putData(
          `/api/coupons/admin/${editingCoupon._id}`,
          payload,
          token,
        );
      } else {
        response = await postData("/api/coupons/admin/create", payload, token);
      }

      if (response.success) {
        toast.success(
          editingCoupon
            ? "Coupon updated successfully!"
            : "Coupon created successfully!",
        );
        handleCloseDialog();
        fetchCoupons();
      } else {
        toast.error(response.message || "Failed to save coupon");
      }
    } catch (error) {
      console.error("Error saving coupon:", error);
      toast.error("Failed to save coupon");
    }
  };

  const handleDelete = async (couponId) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;

    try {
      const response = await deleteData(
        `/api/coupons/admin/${couponId}`,
        token,
      );
      if (response.success) {
        toast.success("Coupon deleted successfully!");
        fetchCoupons();
      } else {
        toast.error(response.message || "Failed to delete coupon");
      }
    } catch (error) {
      console.error("Error deleting coupon:", error);
      toast.error("Failed to delete coupon");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <div className="bg-white shadow-md rounded-md p-5">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold text-gray-700">
            Coupon Management
          </h1>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleOpenDialog()}
          >
            + Add Coupon
          </Button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>💡 Tip:</strong> Create coupons here that customers can use
            at checkout. The coupon code entered in Settings → Offer Popup must
            also exist here to work.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p>No coupons found. Create your first coupon!</p>
          </div>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow className="bg-gray-100">
                  <TableCell>Code</TableCell>
                  <TableCell>Discount</TableCell>
                  <TableCell>Min Order</TableCell>
                  <TableCell>Usage</TableCell>
                  <TableCell>Valid Until</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {coupons.map((coupon) => (
                  <TableRow key={coupon._id} hover>
                    <TableCell>
                      <span className="font-mono font-semibold text-blue-600">
                        {coupon.code}
                      </span>
                      {coupon.description && (
                        <p className="text-xs text-gray-500 mt-1">
                          {coupon.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {coupon.discountType === "percentage"
                        ? `${coupon.discountValue}%`
                        : `₹${coupon.discountValue}`}
                      {coupon.maxDiscountAmount && (
                        <p className="text-xs text-gray-500">
                          Max: ₹{coupon.maxDiscountAmount}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {coupon.minOrderAmount > 0
                        ? `₹${coupon.minOrderAmount}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {coupon.usageCount || 0}
                      {coupon.usageLimit && ` / ${coupon.usageLimit}`}
                    </TableCell>
                    <TableCell>{formatDate(coupon.endDate)}</TableCell>
                    <TableCell>
                      <Chip
                        label={coupon.isActive ? "Active" : "Inactive"}
                        color={coupon.isActive ? "success" : "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="small"
                          color="primary"
                          onClick={() => handleOpenDialog(coupon)}
                        >
                          <RiEdit2Line size={18} />
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleDelete(coupon._id)}
                        >
                          <FaRegTrashAlt size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editingCoupon ? "Edit Coupon" : "Add New Coupon"}
          </DialogTitle>
          <DialogContent>
            <div className="space-y-4 mt-2">
              <TextField
                label="Coupon Code"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                fullWidth
                required
                placeholder="e.g., WELCOME10"
                helperText="Code will be converted to uppercase"
              />

              <TextField
                label="Description (Optional)"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                fullWidth
                placeholder="e.g., 10% off on first order"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Discount Type
                  </label>
                  <Select
                    name="discountType"
                    value={formData.discountType}
                    onChange={handleInputChange}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="percentage">Percentage (%)</MenuItem>
                    <MenuItem value="fixed">Fixed Amount (₹)</MenuItem>
                  </Select>
                </div>
                <TextField
                  label="Discount Value"
                  name="discountValue"
                  type="number"
                  value={formData.discountValue}
                  onChange={handleInputChange}
                  required
                  placeholder={
                    formData.discountType === "percentage" ? "10" : "100"
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Min Order Amount (₹)"
                  name="minOrderAmount"
                  type="number"
                  value={formData.minOrderAmount}
                  onChange={handleInputChange}
                  placeholder="0"
                  helperText="0 = No minimum"
                />
                <TextField
                  label="Max Discount (₹)"
                  name="maxDiscountAmount"
                  type="number"
                  value={formData.maxDiscountAmount}
                  onChange={handleInputChange}
                  placeholder="Empty = No limit"
                  helperText="For % discounts"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Usage Limit"
                  name="usageLimit"
                  type="number"
                  value={formData.usageLimit}
                  onChange={handleInputChange}
                  placeholder="Empty = Unlimited"
                  helperText="Total uses allowed"
                />
                <TextField
                  label="Per User Limit"
                  name="perUserLimit"
                  type="number"
                  value={formData.perUserLimit}
                  onChange={handleInputChange}
                  placeholder="1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Start Date"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="End Date"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </div>

              <FormControlLabel
                control={
                  <Switch
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                  />
                }
                label="Active"
              />
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary">
              {editingCoupon ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
};

export default Coupons;
