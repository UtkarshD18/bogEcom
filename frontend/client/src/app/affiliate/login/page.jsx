"use client";

import { API_BASE_URL } from "@/utils/api";

import { useEffect, useState } from "react";
import { Button, CircularProgress, TextField } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { FiLock } from "react-icons/fi";

const API_URL = API_BASE_URL;

const INFLUENCER_TOKEN_KEY = "influencerToken";
const INFLUENCER_REFRESH_TOKEN_KEY = "influencerRefreshToken";

const EMPTY_RESET_FORM = {
  code: "",
  email: "",
  otp: "",
  newPassword: "",
  confirmPassword: "",
};

const InfluencerLoginPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ code: "", password: "" });
  const [resetForm, setResetForm] = useState(EMPTY_RESET_FORM);
  const [resetRequested, setResetRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const prefilledCode = String(
    searchParams.get("code") ||
      searchParams.get("ref") ||
      searchParams.get("affiliate") ||
      "",
  )
    .trim()
    .toUpperCase();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem(INFLUENCER_TOKEN_KEY);
    if (token) {
      router.replace("/affiliate");
    }
  }, [router]);

  useEffect(() => {
    if (!prefilledCode) return;

    setForm((prev) => ({
      ...prev,
      code: prev.code || prefilledCode,
    }));
    setResetForm((prev) => ({
      ...prev,
      code: prev.code || prefilledCode,
    }));
  }, [prefilledCode]);

  const setModeState = (nextMode) => {
    setMode(nextMode);
    setError("");
    setNotice("");
    if (nextMode === "login") {
      setResetRequested(false);
      setResetForm({
        ...EMPTY_RESET_FORM,
        code: prefilledCode,
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleResetChange = (e) => {
    const { name, value } = e.target;
    setResetForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!form.code.trim() || !form.password.trim()) {
      setError("Please enter both referral code and password.");
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
          password: form.password,
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
        window.dispatchEvent(new Event("influencerAuthChanged"));
      }

      router.replace("/affiliate");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!resetForm.code.trim() || !resetForm.email.trim()) {
      setError("Please enter the referral code and registered email.");
      return;
    }

    setResetLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/influencers/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: resetForm.code.trim(),
          email: resetForm.email.trim(),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to request OTP");
      }

      setResetRequested(true);
      setNotice(
        result.message ||
          "If the referral code and email match our records, an OTP has been sent.",
      );
      setForm((prev) => ({
        ...prev,
        code: resetForm.code.trim().toUpperCase(),
      }));
    } catch (err) {
      setError(err.message || "Failed to request OTP");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!resetForm.otp.trim()) {
      setError("Please enter the OTP sent to your email.");
      return;
    }

    if (!resetForm.newPassword.trim() || !resetForm.confirmPassword.trim()) {
      setError("Please enter and confirm your new password.");
      return;
    }

    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setError("Password and confirm password must match.");
      return;
    }

    setResetLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/influencers/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: resetForm.code.trim(),
          email: resetForm.email.trim(),
          otp: resetForm.otp.trim(),
          newPassword: resetForm.newPassword,
          confirmPassword: resetForm.confirmPassword,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to reset password");
      }

      setMode("login");
      setResetRequested(false);
      setResetForm({
        ...EMPTY_RESET_FORM,
        code: prefilledCode,
      });
      setForm((prev) => ({
        ...prev,
        code: resetForm.code.trim().toUpperCase(),
        password: "",
      }));
      setNotice(
        result.message || "Password updated successfully. Please sign in.",
      );
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <section className="relative flex min-h-[calc(100vh-var(--header-height,128px))] items-center justify-center overflow-hidden bg-[#f6efe4] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(189,122,6,0.14),transparent_34%),radial-gradient(circle_at_78%_72%,rgba(36,21,15,0.12),transparent_30%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[34px] border border-[#e6d8ca] bg-white/95 shadow-[0_30px_90px_-60px_rgba(83,52,28,0.85)] lg:grid-cols-[0.95fr_1.05fr]">
        <div className="hidden bg-gradient-to-br from-[#281710] via-[#6f4a32] to-[#bd7a06] p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-100">
              Collaborator Program
            </p>
            <h2 className="mt-5 text-4xl font-black leading-tight">
              Track your referral growth with Buy One Gram.
            </h2>
            <p className="mt-4 text-sm font-medium leading-6 text-white/75">
              Sign in to view earnings, referral activity, and campaign performance from the same storefront experience customers already trust.
            </p>
          </div>
          <div className="grid gap-3 text-sm font-semibold text-white/80">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              Secure referral dashboard
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              Real-time order and commission tracking
            </div>
          </div>
        </div>
      <div className="p-7 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
            <FiLock />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Collaborator Portal
            </h1>
            <p className="text-sm text-gray-500">
              Secure sign-in now uses your referral code and portal password.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Use the password setup flow once if this is your first secure login.
        </div>

        <div className="mt-6 flex gap-2">
          <Button
            type="button"
            variant={mode === "login" ? "contained" : "outlined"}
            onClick={() => setModeState("login")}
            sx={{
              backgroundColor:
                mode === "login" ? "var(--primary)" : "transparent",
              "&:hover": {
                backgroundColor:
                  mode === "login" ? "#047857" : "rgba(4, 120, 87, 0.04)",
              },
            }}
          >
            Sign In
          </Button>
          <Button
            type="button"
            variant={mode === "reset" ? "contained" : "outlined"}
            onClick={() => setModeState("reset")}
            sx={{
              backgroundColor:
                mode === "reset" ? "var(--primary)" : "transparent",
              "&:hover": {
                backgroundColor:
                  mode === "reset" ? "#047857" : "rgba(4, 120, 87, 0.04)",
              },
            }}
          >
            Set Or Reset Password
          </Button>
        </div>

        {mode === "login" ? (
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
              label="Portal Password"
              name="password"
              value={form.password}
              onChange={handleChange}
              fullWidth
              size="small"
              type="password"
            />
            {notice && <p className="text-sm text-emerald-700">{notice}</p>}
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
            <button
              type="button"
              className="text-sm text-emerald-700 hover:text-emerald-800"
              onClick={() => setModeState("reset")}
            >
              Forgot password or need to create one?
            </button>
          </form>
        ) : (
          <form
            onSubmit={resetRequested ? handleResetPassword : handleRequestReset}
            className="space-y-4 mt-6"
          >
            <TextField
              label="Referral Code"
              name="code"
              value={resetForm.code}
              onChange={handleResetChange}
              fullWidth
              size="small"
            />
            <TextField
              label="Registered Email"
              name="email"
              value={resetForm.email}
              onChange={handleResetChange}
              fullWidth
              size="small"
              type="email"
            />
            {resetRequested && (
              <>
                <TextField
                  label="OTP"
                  name="otp"
                  value={resetForm.otp}
                  onChange={handleResetChange}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="New Password"
                  name="newPassword"
                  value={resetForm.newPassword}
                  onChange={handleResetChange}
                  fullWidth
                  size="small"
                  type="password"
                  helperText="Use at least 8 characters with uppercase, lowercase, and a number."
                />
                <TextField
                  label="Confirm New Password"
                  name="confirmPassword"
                  value={resetForm.confirmPassword}
                  onChange={handleResetChange}
                  fullWidth
                  size="small"
                  type="password"
                />
              </>
            )}
            {notice && <p className="text-sm text-emerald-700">{notice}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              variant="contained"
              sx={{
                backgroundColor: "var(--primary)",
                "&:hover": { backgroundColor: "#047857" },
              }}
              disabled={resetLoading}
              fullWidth
            >
              {resetLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : resetRequested ? (
                "Save New Password"
              ) : (
                "Send OTP"
              )}
            </Button>
          </form>
        )}
      </div>
      </div>
    </section>
  );
};

export default InfluencerLoginPage;
