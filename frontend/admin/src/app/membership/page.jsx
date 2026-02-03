"use client";

import { useAdmin } from "@/context/AdminContext";
import { deleteData, getData, postData, putData } from "@/utils/api";
import {
  Button,
  CircularProgress,
  FormControlLabel,
  Switch,
  TextField,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FaEdit, FaPlus, FaStar, FaTrash } from "react-icons/fa";

export default function MembershipPage() {
  const { token } = useAdmin();
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    originalPrice: "",
    duration: "365",
    durationUnit: "days",
    benefits: "",
    isActive: false,
  });

  const fetchPlans = useCallback(async () => {
    const res = await getData("/api/membership/admin/plans", token);
    if (res.success) {
      setPlans(res.data);
    } else {
      console.error("Failed to fetch plans:", res.message);
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    const res = await getData("/api/membership/admin/stats", token);
    if (res.success) {
      setStats(res.data);
    }
  }, [token]);

  useEffect(() => {
    // Wait for token to be available from AdminContext
    if (!token) return;

    const init = async () => {
      await Promise.all([fetchPlans(), fetchStats()]);
      setLoading(false);
    };
    init();
  }, [token, fetchPlans, fetchStats]);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      originalPrice: "",
      duration: "365",
      durationUnit: "days",
      benefits: "",
      isActive: false,
    });
    setEditingPlan(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      price: Number(formData.price),
      originalPrice: Number(formData.originalPrice) || 0,
      duration: Number(formData.duration),
      benefits: formData.benefits.split("\n").filter((b) => b.trim()),
    };

    let res;
    if (editingPlan) {
      res = await putData(
        `/api/membership/admin/plans/${editingPlan._id}`,
        payload,
        token,
      );
    } else {
      res = await postData("/api/membership/admin/plans", payload, token);
    }

    if (res.success) {
      toast.success(editingPlan ? "Plan updated" : "Plan created");
      resetForm();
      fetchPlans();
    } else {
      toast.error(res.message || "Operation failed");
    }
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || "",
      price: plan.price.toString(),
      originalPrice: plan.originalPrice?.toString() || "",
      duration: plan.duration.toString(),
      durationUnit: plan.durationUnit,
      benefits: plan.benefits?.join("\n") || "",
      isActive: plan.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this plan?")) return;
    const res = await deleteData(`/api/membership/admin/plans/${id}`, token);
    if (res.success) {
      toast.success("Plan deleted");
      fetchPlans();
    } else {
      toast.error("Failed to delete plan");
    }
  };

  const handleActivate = async (id) => {
    const res = await putData(
      `/api/membership/admin/plans/${id}/activate`,
      {},
      token,
    );
    if (res.success) {
      toast.success("Plan activated");
      fetchPlans();
    } else {
      toast.error("Failed to activate plan");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Membership Plans</h1>
        <Button
          variant="contained"
          startIcon={<FaPlus />}
          onClick={() => setShowForm(true)}
          sx={{
            backgroundColor: "#c1591c",
            "&:hover": { backgroundColor: "#a04a17" },
          }}
        >
          Add Plan
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">Total Members</p>
            <p className="text-2xl font-bold text-gray-800">
              {stats.totalMembers}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">Active Members</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.activeMembers}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">Expired Members</p>
            <p className="text-2xl font-bold text-red-500">
              {stats.expiredMembers}
            </p>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingPlan ? "Edit Plan" : "Create Plan"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <TextField
                label="Plan Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                fullWidth
                required
              />
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                fullWidth
                multiline
                rows={2}
              />
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Price (₹)"
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  required
                />
                <TextField
                  label="Original Price (₹)"
                  type="number"
                  value={formData.originalPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, originalPrice: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({ ...formData, duration: e.target.value })
                  }
                  required
                />
                <select
                  value={formData.durationUnit}
                  onChange={(e) =>
                    setFormData({ ...formData, durationUnit: e.target.value })
                  }
                  className="border rounded px-3 py-2"
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
              <TextField
                label="Benefits (one per line)"
                value={formData.benefits}
                onChange={(e) =>
                  setFormData({ ...formData, benefits: e.target.value })
                }
                fullWidth
                multiline
                rows={4}
                placeholder="Earn 2x points&#10;Free shipping&#10;Exclusive discounts"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                  />
                }
                label="Set as Active Plan"
              />
              <div className="flex gap-2 pt-4">
                <Button type="submit" variant="contained" fullWidth>
                  {editingPlan ? "Update" : "Create"}
                </Button>
                <Button variant="outlined" onClick={resetForm} fullWidth>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plans List */}
      <div className="grid gap-4">
        {plans.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No membership plans yet. Create one to get started.
          </div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan._id}
              className={`bg-white rounded-lg shadow p-4 border-2 ${
                plan.isActive ? "border-green-500" : "border-transparent"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-800">
                      {plan.name}
                    </h3>
                    {plan.isActive && (
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <FaStar size={10} /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mt-1">
                    {plan.description}
                  </p>
                  <p className="text-xl font-bold text-[#c1591c] mt-2">
                    ₹{plan.price}
                    {plan.originalPrice > plan.price && (
                      <span className="text-sm text-gray-400 line-through ml-2">
                        ₹{plan.originalPrice}
                      </span>
                    )}
                    <span className="text-sm text-gray-500 font-normal ml-2">
                      / {plan.duration} {plan.durationUnit}
                    </span>
                  </p>
                  {plan.benefits?.length > 0 && (
                    <ul className="mt-2 text-sm text-gray-600">
                      {plan.benefits.slice(0, 3).map((b, i) => (
                        <li key={i}>• {b}</li>
                      ))}
                      {plan.benefits.length > 3 && (
                        <li className="text-gray-400">
                          +{plan.benefits.length - 3} more
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                <div className="flex gap-2">
                  {!plan.isActive && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      onClick={() => handleActivate(plan._id)}
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleEdit(plan)}
                  >
                    <FaEdit />
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => handleDelete(plan._id)}
                  >
                    <FaTrash />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
