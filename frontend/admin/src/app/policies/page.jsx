"use client";

import { useAdmin } from "@/context/AdminContext";
import { deleteData, getData, patchData, postData, putData } from "@/utils/api";
import { Button, CircularProgress, Switch, TextField } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const initialForm = {
  title: "",
  slug: "",
  content: "",
  isActive: true,
  effectiveDate: "",
};

export default function PoliciesPage() {
  const { token } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policies, setPolicies] = useState([]);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [form, setForm] = useState(initialForm);

  const fetchPolicies = useCallback(async () => {
    const response = await getData("/api/policies/admin/all", token);
    if (response.success) {
      setPolicies(response.data || []);
    } else {
      toast.error(response.message || "Failed to load policies");
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const init = async () => {
      await fetchPolicies();
      setLoading(false);
    };
    init();
  }, [token, fetchPolicies]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingPolicy(null);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    const payload = {
      title: form.title,
      slug: form.slug,
      content: form.content,
      isActive: form.isActive,
      effectiveDate: form.effectiveDate || undefined,
    };

    const response = editingPolicy
      ? await putData(`/api/policies/admin/${editingPolicy._id}`, payload, token)
      : await postData("/api/policies/admin", payload, token);

    if (response.success) {
      toast.success(editingPolicy ? "Policy updated" : "Policy created");
      resetForm();
      await fetchPolicies();
    } else {
      toast.error(response.message || "Failed to save policy");
    }
    setSaving(false);
  };

  const onEdit = (policy) => {
    setEditingPolicy(policy);
    setForm({
      title: policy.title || "",
      slug: policy.slug || "",
      content: policy.content || "",
      isActive: Boolean(policy.isActive),
      effectiveDate: policy.effectiveDate
        ? new Date(policy.effectiveDate).toISOString().slice(0, 10)
        : "",
    });
  };

  const onDelete = async (policyId) => {
    if (!confirm("Delete this policy?")) return;
    const response = await deleteData(`/api/policies/admin/${policyId}`, token);
    if (response.success) {
      toast.success("Policy deleted");
      await fetchPolicies();
    } else {
      toast.error(response.message || "Failed to delete policy");
    }
  };

  const onToggle = async (policyId) => {
    const response = await patchData(`/api/policies/admin/${policyId}/toggle`, {}, token);
    if (response.success) {
      toast.success("Policy status updated");
      await fetchPolicies();
    } else {
      toast.error(response.message || "Failed to toggle policy");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-5">Policy CMS</h1>

      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="text-lg font-semibold mb-4">
          {editingPolicy ? "Edit Policy" : "Create Policy"}
        </h2>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField
            label="Title"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
            fullWidth
            size="small"
          />
          <TextField
            label="Slug"
            value={form.slug}
            onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
            placeholder="terms-and-conditions"
            fullWidth
            size="small"
          />
          <TextField
            label="Effective Date"
            type="date"
            value={form.effectiveDate}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, effectiveDate: e.target.value }))
            }
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Active</span>
            <Switch
              checked={form.isActive}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, isActive: e.target.checked }))
              }
            />
          </div>
          <TextField
            label="Policy HTML Content"
            value={form.content}
            onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
            required
            fullWidth
            multiline
            rows={10}
            className="md:col-span-2"
          />
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Saving..." : editingPolicy ? "Update Policy" : "Create Policy"}
            </Button>
            {editingPolicy && (
              <Button variant="outlined" onClick={resetForm}>
                Cancel Edit
              </Button>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-3">
        {policies.map((policy) => (
          <div
            key={policy._id}
            className="bg-white rounded-xl shadow-sm p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
          >
            <div>
              <p className="font-semibold text-slate-800">{policy.title}</p>
              <p className="text-sm text-slate-500">/{policy.slug}</p>
              <p className="text-xs text-slate-500 mt-1">
                v{policy.version} | Effective{" "}
                {new Date(policy.effectiveDate).toLocaleDateString("en-IN")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  policy.isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {policy.isActive ? "Active" : "Inactive"}
              </span>
              <Button size="small" variant="outlined" onClick={() => onEdit(policy)}>
                Edit
              </Button>
              <Button size="small" variant="outlined" onClick={() => onToggle(policy._id)}>
                Toggle
              </Button>
              <Button
                size="small"
                color="error"
                variant="outlined"
                onClick={() => onDelete(policy._id)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
