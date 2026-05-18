"use client";

import AccountSidebar from "@/components/AccountSiderbar";
import AuthenticationMethods from "@/components/AuthenticationMethods";
import MemberBadge from "@/components/MemberBadge";
import {
  getAddressDisplayLines,
  mapAddressResponseToForm,
} from "@/utils/addressForm";
import { fetchDataFromApi, getStoredAccessToken, putData } from "@/utils/api";
import { Button } from "@mui/material";
import TextField from "@mui/material/TextField";
import cookies from "js-cookie";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

const getStoredProfileField = (fieldName) => {
  const cookieValue = cookies.get(fieldName);
  if (cookieValue) return cookieValue;
  if (typeof window === "undefined") return "";
  return localStorage.getItem(fieldName) || "";
};

const persistProfileIdentity = ({ name, email }) => {
  const normalizedName = String(name || "").trim();
  const normalizedEmail = String(email || "").trim();

  if (normalizedName) {
    cookies.set("userName", normalizedName, { expires: 365 });
  } else {
    cookies.remove("userName");
  }

  if (normalizedEmail) {
    cookies.set("userEmail", normalizedEmail, { expires: 365 });
  } else {
    cookies.remove("userEmail");
  }

  if (typeof window !== "undefined") {
    if (normalizedName) {
      localStorage.setItem("userName", normalizedName);
    } else {
      localStorage.removeItem("userName");
    }

    if (normalizedEmail) {
      localStorage.setItem("userEmail", normalizedEmail);
    } else {
      localStorage.removeItem("userEmail");
    }
  }
};

const MyAccount = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [profileSnapshot, setProfileSnapshot] = useState({
    name: "",
    email: "",
  });
  const [primaryAddress, setPrimaryAddress] = useState(null);

  useEffect(() => {
    const storedName = getStoredProfileField("userName");
    const storedEmail = getStoredProfileField("userEmail");

    if (storedName) {
      setFullName((prev) => prev || storedName);
    }
    if (storedEmail) {
      setEmail((prev) => prev || storedEmail);
    }

    if (storedName || storedEmail) {
      setProfileSnapshot({
        name: storedName,
        email: storedEmail,
      });
    }

    const token = getStoredAccessToken();
    if (!token) return;

    const fetchProfile = async () => {
      try {
        const data = await fetchDataFromApi("/api/user/user-details");
        if (data.success && data.data) {
          const resolvedName = String(data.data?.name || "").trim();
          const resolvedEmail = String(data.data?.email || "").trim();
          setFullName(resolvedName);
          setEmail(resolvedEmail);
          setProfileSnapshot({
            name: resolvedName,
            email: resolvedEmail,
          });
          persistProfileIdentity({
            name: resolvedName,
            email: resolvedEmail,
          });
          const expiry = data.data?.membershipExpiry
            ? new Date(data.data.membershipExpiry)
            : null;
          setIsMember(
            Boolean(data.data?.isMember) &&
              (!expiry ||
                (!Number.isNaN(expiry.getTime()) && expiry > new Date())),
          );
        }
      } catch (err) {
        // Silent fallback
      }
    };

    const fetchPrimaryPhone = async () => {
      try {
        const data = await fetchDataFromApi("/api/address");
        if (data.success && Array.isArray(data.data)) {
          const preferred =
            data.data.find((addr) => addr.selected) || data.data[0];
          setPrimaryAddress(preferred || null);
        }
      } catch (err) {
        // Silent fallback
      }
    };

    fetchProfile();
    fetchPrimaryPhone();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const normalizedName = String(fullName || "").trim();
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const snapshotName = String(profileSnapshot.name || "").trim();
    const snapshotEmail = String(profileSnapshot.email || "")
      .trim()
      .toLowerCase();

    if (normalizedName === snapshotName && normalizedEmail === snapshotEmail) {
      setSaving(false);
      setMessage("No changes to update.");
      return;
    }

    const token = getStoredAccessToken();
    if (!token) {
      setSaving(false);
      setError("Please login again to update your profile.");
      return;
    }

    try {
      const data = await putData("/api/user/profile", {
        name: normalizedName,
        email: normalizedEmail,
      });
      if (data.success && data.data) {
        const updatedName = String(data.data?.name || normalizedName).trim();
        const updatedEmail = String(data.data?.email || normalizedEmail).trim();
        setFullName(updatedName);
        setEmail(updatedEmail);
        setProfileSnapshot({
          name: updatedName,
          email: updatedEmail,
        });
        persistProfileIdentity({
          name: updatedName,
          email: updatedEmail,
        });
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
    <section className="bg-[#f7f4ef] py-8 sm:py-10">
      <div className="container mx-auto flex max-w-7xl flex-col gap-5 px-4 lg:flex-row">
        <div className="w-full shrink-0 lg:w-[20%]">
          <AccountSidebar />
        </div>

        <div className="wrapper mx-auto w-full max-w-5xl lg:w-[75%]">
          {/* Authentication Methods Overview */}
          <AuthenticationMethods />

          <div className="mb-5 overflow-hidden rounded-2xl border border-[#eadfd4] bg-white shadow-[0_18px_50px_rgba(74,52,36,0.08)]">
            <div className="flex flex-col gap-4 border-b border-[#efe6dd] bg-[#fffaf4] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="info">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#8a5b18]">
                  Account
                </p>
                <h4 className="text-[22px] font-bold text-gray-800">
                  My Profile
                </h4>
                <p className="mt-1 text-[14px] text-gray-500">
                  Keep your name and email updated for orders, invoices, and support.
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-gray-700">
                    {fullName || "User"}
                  </span>
                  <MemberBadge isMember={isMember} className="text-[9px]" />
                </div>
              </div>
            </div>
            <form className="p-5 sm:p-6" onSubmit={handleSubmit}>
              <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="form-group rounded-xl border border-[#eee3d8] bg-[#fffdf9] p-3">
                  <TextField
                    id="fullName"
                    label="Full Name"
                    variant="outlined"
                    size="medium"
                    className="w-full"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="form-group rounded-xl border border-[#eee3d8] bg-[#fffdf9] p-3">
                  <TextField
                    id="email"
                    label="Email"
                    variant="outlined"
                    size="medium"
                    type="email"
                    className="w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              {message && (
                <p className="mx-auto mt-4 max-w-4xl rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {message}
                </p>
              )}
              {error && (
                <p className="mx-auto mt-4 max-w-4xl rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {error}
                </p>
              )}
              <div className="mx-auto mt-5 flex max-w-4xl justify-center sm:justify-start">
                <Button
                  type="submit"
                  className="btn-g !rounded-full !px-7 !py-2.5"
                  disabled={saving}
                >
                  {saving ? "Updating..." : "Update Profile"}
                </Button>
              </div>
            </form>
          </div>

          <div className="mb-5 overflow-hidden rounded-2xl border border-[#eadfd4] bg-white shadow-[0_18px_50px_rgba(74,52,36,0.08)]">
            <div className="flex flex-col gap-4 border-b border-[#efe6dd] bg-[#fffaf4] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="info">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#8a5b18]">
                  Delivery
                </p>
                <h4 className="text-[22px] font-bold text-gray-800">
                  My Addresses
                </h4>
                <p className="mt-1 text-[14px] text-gray-500">
                  Your default delivery address and checkout shortcut
                </p>
              </div>
              <Link href="/address">
                <Button className="btn-g !rounded-full !px-6 !capitalize">
                  Manage Addresses
                </Button>
              </Link>
            </div>
            <div className="p-5">
              {primaryAddress ? (
                (() => {
                  const display = getAddressDisplayLines(
                    mapAddressResponseToForm(primaryAddress),
                  );

                  return (
                    <div className="mx-auto max-w-4xl rounded-2xl border border-[#eee3d8] bg-[#fffdf9] p-5">
                      <p className="text-[12px] font-[700] uppercase tracking-[0.2em] text-[var(--primary)] mb-2">
                        Default
                      </p>
                      <h5 className="text-[18px] font-[600] text-gray-800">
                        {primaryAddress.full_name || primaryAddress.name}
                      </h5>
                      <p className="text-[14px] text-gray-600 mt-2">
                        {display.line1 || "Address not available"}
                      </p>
                      {display.line2 && (
                        <p className="text-[14px] text-gray-600">
                          {display.line2}
                        </p>
                      )}
                      <p className="text-[14px] text-gray-600">
                        {[primaryAddress.city, primaryAddress.state]
                          .filter(Boolean)
                          .join(", ")}{" "}
                        - {primaryAddress.pincode}
                      </p>
                      <p className="text-[14px] text-gray-700 font-[500] mt-2">
                        +91{" "}
                        {primaryAddress.mobile_number || primaryAddress.mobile}
                      </p>
                    </div>
                  );
                })()
              ) : (
                <div className="mx-auto max-w-4xl rounded-2xl border border-dashed border-[#d9c8b9] bg-[#fffdf9] p-6 text-center">
                  <p className="text-[15px] text-gray-600 mb-4">
                    No delivery address saved yet.
                  </p>
                  <Link href="/address">
                    <Button className="btn-g !rounded-full !px-6 !capitalize">
                      Add Address
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default MyAccount;
