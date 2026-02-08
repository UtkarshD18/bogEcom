"use client";

import { useAdmin } from "@/context/AdminContext";
import { getData, putData } from "@/utils/api";
import { Button, CircularProgress, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function CoinSettingsPage() {
  const { token } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    coinsPerRupee: 0.05,
    redeemRate: 0.1,
    maxRedeemPercentage: 20,
    expiryDays: 365,
  });

  useEffect(() => {
    if (!token) return;
    const fetchSettings = async () => {
      const response = await getData("/api/coins/admin/settings", token);
      if (response.success && response.data) {
        setForm({
          coinsPerRupee: response.data.coinsPerRupee ?? 0.05,
          redeemRate: response.data.redeemRate ?? 0.1,
          maxRedeemPercentage: response.data.maxRedeemPercentage ?? 20,
          expiryDays: response.data.expiryDays ?? 365,
        });
      }
      setLoading(false);
    };
    fetchSettings();
  }, [token]);

  const onSave = async () => {
    setSaving(true);
    const payload = {
      coinsPerRupee: Number(form.coinsPerRupee),
      redeemRate: Number(form.redeemRate),
      maxRedeemPercentage: Number(form.maxRedeemPercentage),
      expiryDays: Number(form.expiryDays),
    };

    const response = await putData("/api/coins/admin/settings", payload, token);
    if (response.success) {
      toast.success("Coin settings updated");
    } else {
      toast.error(response.message || "Failed to update coin settings");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-5">Coin Settings</h1>

      <div className="bg-white rounded-xl shadow-sm p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField
          label="Coins Per Rupee"
          type="number"
          value={form.coinsPerRupee}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, coinsPerRupee: e.target.value }))
          }
          size="small"
        />
        <TextField
          label="Redeem Rate (₹ per coin)"
          type="number"
          value={form.redeemRate}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, redeemRate: e.target.value }))
          }
          size="small"
        />
        <TextField
          label="Max Redeem Percentage"
          type="number"
          value={form.maxRedeemPercentage}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, maxRedeemPercentage: e.target.value }))
          }
          size="small"
        />
        <TextField
          label="Coin Expiry (days)"
          type="number"
          value={form.expiryDays}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, expiryDays: e.target.value }))
          }
          size="small"
        />

        <div className="md:col-span-2">
          <Button variant="contained" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save Coin Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
