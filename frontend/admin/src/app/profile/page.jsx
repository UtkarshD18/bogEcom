"use client";

import { useAdmin } from "@/context/AdminContext";
import { getData, putData } from "@/utils/api";
import { Button, TextField } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

const normalizeMobileInput = (value) => String(value || "").replace(/\D/g, "").slice(0, 15);
const getEffectiveAdminToken = (primaryToken) => {
  if (primaryToken) return primaryToken;
  if (typeof window === "undefined") return "";
  return localStorage.getItem("adminToken") || "";
};

export default function AdminProfilePage() {
  const { token, admin, loading, isAuthenticated, updateAdminProfile } = useAdmin();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [saving, setSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState({
    name: "",
    email: "",
    mobile: "",
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    const effectiveToken = getEffectiveAdminToken(token);
    if (!isAuthenticated || !effectiveToken) {
      setIsFetching(false);
      return;
    }
    setIsFetching(true);

    let cancelled = false;
    const preloadFromContext = () => {
      const contextName = String(admin?.name || "").trim();
      const contextEmail = String(admin?.email || "").trim().toLowerCase();
      const contextMobile = normalizeMobileInput(admin?.mobile || "");
      if (!cancelled) {
        setFullName(contextName);
        setEmail(contextEmail);
        setMobile(contextMobile);
        setSnapshot({
          name: contextName,
          email: contextEmail,
          mobile: contextMobile,
        });
      }
    };

    const fetchProfile = async () => {
      preloadFromContext();
      try {
        const response = await getData("/api/user/user-details", effectiveToken);
        if (!response?.success || !response?.data) return;
        const profile = response.data;
        const nextName = String(profile?.name || "").trim();
        const nextEmail = String(profile?.email || "").trim().toLowerCase();
        const nextMobile = normalizeMobileInput(profile?.mobile || "");

        if (!cancelled) {
          setFullName(nextName);
          setEmail(nextEmail);
          setMobile(nextMobile);
          setSnapshot({
            name: nextName,
            email: nextEmail,
            mobile: nextMobile,
          });
        }

        const currentName = String(admin?.name || "").trim();
        const currentEmail = String(admin?.email || "").trim().toLowerCase();
        const currentMobile = normalizeMobileInput(admin?.mobile || "");
        if (
          nextName !== currentName ||
          nextEmail !== currentEmail ||
          nextMobile !== currentMobile
        ) {
          updateAdminProfile({
            name: nextName,
            email: nextEmail,
            mobile: nextMobile,
          });
        }
      } catch {
        // Silent fallback to context data.
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    };

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [admin, isAuthenticated, token, updateAdminProfile]);

  const hasChanges = useMemo(() => {
    const normalizedName = String(fullName || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedMobile = normalizeMobileInput(mobile);
    return (
      normalizedName !== snapshot.name ||
      normalizedEmail !== snapshot.email ||
      normalizedMobile !== snapshot.mobile
    );
  }, [email, fullName, mobile, snapshot.email, snapshot.mobile, snapshot.name]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const effectiveToken = getEffectiveAdminToken(token);
    if (!effectiveToken) {
      setError("Please login again.");
      return;
    }

    if (!hasChanges) {
      setMessage("No changes to update.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: String(fullName || "").trim(),
        email: String(email || "").trim().toLowerCase(),
        mobile: normalizeMobileInput(mobile),
      };
      const response = await putData("/api/user/profile", payload, effectiveToken);
      if (!response?.success || !response?.data) {
        const msg = response?.message || "Failed to update profile";
        setError(msg);
        toast.error(msg);
        return;
      }

      const profile = response.data;
      const nextName = String(profile?.name || payload.name).trim();
      const nextEmail = String(profile?.email || payload.email).trim().toLowerCase();
      const nextMobile = normalizeMobileInput(profile?.mobile || payload.mobile);

      setFullName(nextName);
      setEmail(nextEmail);
      setMobile(nextMobile);
      setSnapshot({
        name: nextName,
        email: nextEmail,
        mobile: nextMobile,
      });
      updateAdminProfile({
        name: nextName,
        email: nextEmail,
        mobile: nextMobile,
      });
      setMessage("Profile updated successfully.");
      toast.success("Profile updated successfully.");
    } catch {
      setError("Failed to update profile");
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full p-4">
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 max-w-4xl">
        <div className="pb-4 border-b border-gray-100">
          <h1 className="text-[28px] leading-none font-[700] text-gray-800">
            My Profile
          </h1>
          <p className="text-gray-500 mt-2">
            Update your admin account details
          </p>
        </div>

        <form className="pt-5" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <TextField
              label="Full Name"
              size="small"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isFetching}
              fullWidth
            />
            <TextField
              label="Email"
              size="small"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isFetching}
              fullWidth
            />
            <TextField
              label="Mobile Number"
              size="small"
              value={mobile}
              onChange={(e) => setMobile(normalizeMobileInput(e.target.value))}
              disabled={isFetching}
              fullWidth
            />
          </div>

          {message ? (
            <p className="text-emerald-600 text-sm font-semibold mb-3">{message}</p>
          ) : null}
          {error ? (
            <p className="text-red-500 text-sm font-semibold mb-3">{error}</p>
          ) : null}

          <Button
            type="submit"
            variant="contained"
            disabled={saving || isFetching}
            sx={{
              textTransform: "none",
              borderRadius: "10px",
              px: 2.5,
              py: 1,
            }}
          >
            {saving ? "Updating..." : "Update Profile"}
          </Button>
        </form>
      </div>
    </div>
  );
}
