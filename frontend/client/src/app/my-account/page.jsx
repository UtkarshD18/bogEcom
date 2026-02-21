"use client";

import { API_BASE_URL, getStoredAccessToken } from "@/utils/api";
import AccountSidebar from "@/components/AccountSiderbar";
import AuthenticationMethods from "@/components/AuthenticationMethods";
import { Button } from "@mui/material";
import TextField from "@mui/material/TextField";
import cookies from "js-cookie";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

const MyAccount = () => {
  const API_URL = API_BASE_URL;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const formatPhone = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("91") && digits.length > 10) {
      return `+${digits}`;
    }
    return `+91 ${digits}`;
  };

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) return;

    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/api/user/user-details`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        const data = await response.json();
        if (data.success && data.data) {
          setFullName(data.data?.name || "");
          setEmail(data.data?.email || "");
          const expiry = data.data?.membershipExpiry
            ? new Date(data.data.membershipExpiry)
            : null;
          setIsMember(
            Boolean(data.data?.isMember) &&
              (!expiry || !Number.isNaN(expiry.getTime()) && expiry > new Date()),
          );
        }
      } catch (err) {
        // Silent fallback
      }
    };

    const fetchPrimaryPhone = async () => {
      try {
        const response = await fetch(`${API_URL}/api/address`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          const preferred =
            data.data.find((addr) => addr.selected) || data.data[0];
          if (preferred?.mobile) {
            setPhone(formatPhone(preferred.mobile));
          }
        }
      } catch (err) {
        // Silent fallback
      }
    };

    fetchProfile();
    fetchPrimaryPhone();
  }, [API_URL]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const token = getStoredAccessToken();
    if (!token) {
      setSaving(false);
      setError("Please login again to update your profile.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          name: fullName,
          email,
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        const updatedName = data.data?.name || fullName;
        const updatedEmail = data.data?.email || email;
        setFullName(updatedName);
        setEmail(updatedEmail);
        cookies.set("userName", updatedName, { expires: 7 });
        cookies.set("userEmail", updatedEmail, { expires: 7 });
        window.dispatchEvent(new Event("loginSuccess"));
        setMessage("Profile updated successfully.");
        toast.success("Profile updated successfully.");
      } else {
        setError(data.message || "Failed to update profile.");
        toast.error(data.message || "Failed to update profile.");
      }
    } catch (err) {
      setError("Failed to update profile.");
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-gray-100 py-8">
      <div className="container flex flex-col lg:flex-row gap-5">
        <div className="w-full lg:w-[20%] shrink-0">
          <AccountSidebar />
        </div>

        <div className="wrapper w-full lg:w-[75%]">
          {/* Authentication Methods Overview */}
          <AuthenticationMethods />

          <div className="bg-white shadow-md rounded-md mb-5">
            <div className="p-4 flex items-center justify-between border-b-[1px] border-[rgba(0,0,0,0.2)">
              <div className="info">
                <h4 className="text-[20px] font-[500] text-gray-700">
                  My Profile
                </h4>
                <p className="text-[16px] text-gray-500">
                  All your account information in one place
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[14px] text-gray-700 font-[500]">
                    {fullName || "User"}
                  </span>
                  <MemberBadge isMember={isMember} className="text-[9px]" />
                </div>
              </div>
            </div>
            <form className=" p-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-5 mb-5">
                <div className="form-group">
                  <TextField
                    id="fullName"
                    label="Full Name"
                    variant="outlined"
                    size="small"
                    className="w-full"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <TextField
                    id="email"
                    label="Email"
                    variant="outlined"
                    size="small"
                    className="w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="form-group w-full">
                  <PhoneInput
                    value={phone}
                    onChange={(next) => setPhone(next)}
                    disabled
                  />
                </div>
              </div>
              {message && (
                <p className="text-emerald-600 text-sm font-semibold mb-3">
                  {message}
                </p>
              )}
              {error && (
                <p className="text-red-500 text-sm font-semibold mb-3">
                  {error}
                </p>
              )}
              <Button type="submit" className="btn-g px-5" disabled={saving}>
                {saving ? "Updating..." : "Update Profile"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
export default MyAccount;
