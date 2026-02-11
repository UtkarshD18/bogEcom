"use client";

import { useEffect, useState } from "react";
import { Button, CircularProgress, TextField } from "@mui/material";
import { useRouter } from "next/navigation";
import { FiLock } from "react-icons/fi";

const API_URL =
  process.env.NEXT_PUBLIC_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

const INFLUENCER_TOKEN_KEY = "influencerToken";
const INFLUENCER_REFRESH_TOKEN_KEY = "influencerRefreshToken";
const SESSION_KEY = "influencerPortalSession";

const InfluencerLoginPage = () => {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem(INFLUENCER_TOKEN_KEY);
    if (token) {
      router.replace("/affiliate");
    }
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.code.trim() || !form.email.trim()) {
      setError("Please enter both referral code and email.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/influencers/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: form.code.trim(),
          email: form.email.trim(),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Login failed");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(INFLUENCER_TOKEN_KEY, result.data.accessToken);
        if (result.data.refreshToken) {
          localStorage.setItem(
            INFLUENCER_REFRESH_TOKEN_KEY,
            result.data.refreshToken,
          );
        }
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            code: form.code.trim().toUpperCase(),
            email: form.email.trim().toLowerCase(),
            savedAt: Date.now(),
          }),
        );
        window.dispatchEvent(new Event("influencerAuthChanged"));
      }

      router.replace("/affiliate");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
            <FiLock />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Influencer Login
            </h1>
            <p className="text-sm text-gray-500">
              Sign in to view your earnings and referrals.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <TextField
            label="Referral Code"
            name="code"
            value={form.code}
            onChange={handleChange}
            fullWidth
            size="small"
          />
          <TextField
            label="Registered Email"
            name="email"
            value={form.email}
            onChange={handleChange}
            fullWidth
            size="small"
            type="email"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            variant="contained"
            sx={{
              backgroundColor: "var(--primary)",
              "&:hover": { backgroundColor: "#047857" },
            }}
            disabled={loading}
            fullWidth
          >
            {loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </div>
    </section>
  );
};

export default InfluencerLoginPage;
