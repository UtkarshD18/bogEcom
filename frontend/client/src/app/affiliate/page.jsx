"use client";

import { API_BASE_URL } from "@/utils/api";

import { useEffect, useEffectEvent, useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import {
  FiCopy,
  FiExternalLink,
  FiGlobe,
  FiTrendingUp,
  FiUser,
} from "react-icons/fi";
import { useRouter } from "next/navigation";

const API_URL = API_BASE_URL;

const INFLUENCER_TOKEN_KEY = "influencerToken";
const INFLUENCER_REFRESH_TOKEN_KEY = "influencerRefreshToken";

const normalizePlatformKey = (platform) =>
  String(platform || "").trim().toLowerCase();

const indexPromotionPlatforms = (platforms = []) => {
  const validPlatforms = (platforms || [])
    .map((entry) => ({
      platform: String(entry?.platform || "").trim(),
      username: String(entry?.username || "")
        .replace(/^@+/, "")
        .trim(),
    }))
    .filter((entry) => entry.platform && entry.username);

  const totals = {};
  validPlatforms.forEach((entry) => {
    const key = normalizePlatformKey(entry.platform);
    if (!key) return;
    totals[key] = (totals[key] || 0) + 1;
  });

  const seen = {};
  return validPlatforms.map((entry) => {
    const key = normalizePlatformKey(entry.platform);
    const duplicateCount = totals[key] || 1;
    const duplicateIndex = (seen[key] || 0) + 1;
    seen[key] = duplicateIndex;
    return {
      ...entry,
      displayPlatform:
        duplicateCount > 1
          ? `${entry.platform} ${duplicateIndex}`
          : entry.platform,
    };
  });
};

const buildPlatformProfileUrl = (platform, username) => {
  const cleanUsername = String(username || "")
    .replace(/^@+/, "")
    .trim();
  if (!cleanUsername) return "";

  if (/^https?:\/\//i.test(cleanUsername)) {
    return cleanUsername;
  }

  const key = normalizePlatformKey(platform);
  switch (key) {
    case "instagram":
      return `https://instagram.com/${cleanUsername}`;
    case "youtube":
      return `https://youtube.com/@${cleanUsername}`;
    case "facebook":
      return `https://facebook.com/${cleanUsername}`;
    case "x":
    case "twitter":
      return `https://x.com/${cleanUsername}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${cleanUsername}`;
    case "telegram":
      return `https://t.me/${cleanUsername}`;
    case "whatsapp":
      return `https://wa.me/${cleanUsername.replace(/\D/g, "")}`;
    case "website":
      return `https://${cleanUsername}`;
    default:
      return "";
  }
};

const formatAmount = (value) =>
  `Rs ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))}`;

const AffiliatePortalPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [hasToken, setHasToken] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  const clearStoredAuth = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(INFLUENCER_TOKEN_KEY);
    localStorage.removeItem(INFLUENCER_REFRESH_TOKEN_KEY);
    window.dispatchEvent(new Event("influencerAuthChanged"));
  };

  const refreshAccessToken = useEffectEvent(async () => {
    if (typeof window === "undefined") return null;
    const refreshToken = localStorage.getItem(INFLUENCER_REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    const response = await fetch(`${API_URL}/api/influencers/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    const result = await response.json();
    if (!result?.success || !result?.data?.accessToken) {
      return null;
    }

    localStorage.setItem(INFLUENCER_TOKEN_KEY, result.data.accessToken);
    return result.data.accessToken;
  });

  const fetchPortalDataWithToken = useEffectEvent(async (token, retry = true) => {
    setError("");
    setLoading(true);
    try {
      let response = await fetch(`${API_URL}/api/influencers/portal/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 && retry) {
        const newToken = await refreshAccessToken();
        if (!newToken) {
          throw new Error("Session expired. Please login again.");
        }
        response = await fetch(`${API_URL}/api/influencers/portal/me`, {
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
        });
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to load collaborator stats");
      }

      setData(result.data);
    } catch (err) {
      if (err.message?.includes("Session expired")) {
        clearStoredAuth();
        setHasToken(false);
        setData(null);
        router.replace("/affiliate/login");
        return;
      }
      setError(err.message || "Failed to load collaborator stats.");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem(INFLUENCER_TOKEN_KEY);

    if (!token) {
      setHasToken(false);
      setLoading(false);
      return;
    }

    setHasToken(true);
    fetchPortalDataWithToken(token);
  }, []);

  const handleLogout = () => {
    clearStoredAuth();
    setData(null);
    setError("");
    setHasToken(false);
    router.replace("/affiliate/login");
  };

  const stats = data?.stats || {};
  const referralUrl = data?.influencer?.referralUrl || "";
  const indexedPlatforms = indexPromotionPlatforms(
    data?.influencer?.promotionPlatforms || [],
  );

  const handleCopyReferralLink = async () => {
    if (!referralUrl || typeof window === "undefined") return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralUrl);
      } else {
        const tempInput = document.createElement("textarea");
        tempInput.value = referralUrl;
        tempInput.setAttribute("readonly", "");
        tempInput.style.position = "absolute";
        tempInput.style.left = "-9999px";
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
      }
      setCopyStatus("Copied");
    } catch (copyError) {
      setCopyStatus("Copy failed");
    } finally {
      setTimeout(() => setCopyStatus(""), 2000);
    }
  };

  return (
    <section className="relative min-h-[calc(100vh-var(--header-height,128px))] overflow-hidden bg-[#f6efe4] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(189,122,6,0.13),transparent_32%),radial-gradient(circle_at_82%_68%,rgba(36,21,15,0.10),transparent_34%)]" />
      <div className="relative max-w-5xl mx-auto space-y-8">
        <div className="overflow-hidden rounded-[32px] border border-[#e2d1c0] bg-white shadow-[0_24px_70px_-50px_rgba(83,52,28,0.7)]">
          <div className="bg-gradient-to-br from-[#2c1a12] via-[#6f4a32] to-[#bd7a06] p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-amber-100">
                Buy One Gram
              </p>
              <h1 className="text-3xl font-black tracking-tight">
                Collaborator Earnings Portal
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-white/78">
                Sign in with your referral code and portal password to view earnings.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data && (
                <Button
                  variant="outlined"
                  onClick={handleLogout}
                  sx={{
                    borderColor: "rgba(255,255,255,0.65)",
                    color: "#fff",
                    fontWeight: 800,
                    "&:hover": {
                      borderColor: "#fff",
                      backgroundColor: "rgba(255,255,255,0.12)",
                    },
                  }}
                >
                  Sign out
                </Button>
              )}
            </div>
          </div>
          </div>

          {!hasToken && !loading && (
            <div className="m-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                Secure access is required for the collaborator dashboard.
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Use the password setup flow if this is your first login.
              </p>
              <div className="mt-4">
                <Button
                  variant="contained"
                  sx={{
                    backgroundColor: "var(--primary)",
                    "&:hover": { backgroundColor: "#047857" },
                  }}
                  onClick={() => router.push("/affiliate/login")}
                >
                  Go to Collaborator Login
                </Button>
              </div>
            </div>
          )}

          {loading && (
            <div className="m-6 flex items-center gap-2 text-sm text-gray-500">
              <CircularProgress size={16} />
              Loading earnings...
            </div>
          )}
          {error && <p className="m-6 text-sm text-red-600">{error}</p>}
        </div>

        {data && (
          <>
            <div className="rounded-[28px] border border-[#e2d1c0] bg-white/95 p-6 shadow-[0_20px_60px_-48px_rgba(83,52,28,0.65)]">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#bd7a06]">
                    Dashboard
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-gray-900">
                    Welcome, {data.influencer?.name || "Collaborator"}
                  </h2>
                  <p className="text-sm font-medium text-gray-500">
                    Code:{" "}
                    <span className="font-semibold">{data.influencer?.code}</span>
                  </p>
                </div>
                {referralUrl && (
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FiCopy />}
                      onClick={handleCopyReferralLink}
                    >
                      Copy referral link
                    </Button>
                    {copyStatus && (
                      <span className="text-xs text-emerald-600">
                        {copyStatus}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div className="rounded-2xl border border-[#efe3d7] bg-[#fff8ee] p-4">
                  <p className="text-sm text-gray-500">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {stats.totalOrders || 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#efe3d7] bg-[#fff8ee] p-4">
                  <p className="text-sm text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatAmount(stats.totalRevenue)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#efe3d7] bg-[#fff8ee] p-4">
                  <p className="text-sm text-gray-500">Commission Earned</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatAmount(stats.totalCommission)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#efe3d7] bg-[#fff8ee] p-4">
                  <p className="text-sm text-gray-500">Pending Commission</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatAmount(stats.pendingCommission)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#e2d1c0] bg-white/95 p-6 shadow-[0_20px_60px_-48px_rgba(83,52,28,0.65)]">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <FiGlobe className="text-indigo-500" />
                  <h3 className="text-lg font-semibold text-gray-800">
                    Promotion Platforms
                  </h3>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                  {indexedPlatforms.length} Platform
                  {indexedPlatforms.length === 1 ? "" : "s"}
                </span>
              </div>
              {indexedPlatforms.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {indexedPlatforms.map((entry, index) => {
                    const profileUrl = buildPlatformProfileUrl(
                      entry.platform,
                      entry.username,
                    );
                    return (
                      <div
                        key={`${entry.platform}-${entry.username}-${index}`}
                        className="rounded-2xl border border-[#efe3d7] bg-[#fff8ee] px-4 py-3"
                      >
                        <p className="text-sm font-semibold text-gray-800">
                          {entry.displayPlatform}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          @{entry.username}
                        </p>
                        {profileUrl && (
                          <a
                            href={profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            <FiExternalLink />
                            Open profile
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No promotion platforms have been configured yet.
                </p>
              )}
            </div>

            <div className="rounded-[28px] border border-[#e2d1c0] bg-white/95 p-6 shadow-[0_20px_60px_-48px_rgba(83,52,28,0.65)]">
              <div className="flex items-center gap-2 mb-4">
                <FiTrendingUp className="text-primary" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Recent Orders
                </h3>
              </div>
              {data.recentOrders?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f6efe4]">
                      <tr>
                        <th className="text-left px-3 py-2">Order</th>
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Status</th>
                        <th className="text-left px-3 py-2">Amount</th>
                        <th className="text-left px-3 py-2">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentOrders.map((order) => (
                        <tr key={order._id} className="border-b">
                          <td className="px-3 py-2 font-medium text-gray-800">
                            #{order._id.slice(-6).toUpperCase()}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {order.order_status || order.payment_status}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {formatAmount(order.finalAmount || order.totalAmt)}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {formatAmount(order.influencerCommission)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No orders yet.</p>
              )}
            </div>

            <div className="rounded-[28px] border border-[#e2d1c0] bg-white/95 p-6 shadow-[0_20px_60px_-48px_rgba(83,52,28,0.65)]">
              <div className="flex items-center gap-2 mb-4">
                <FiUser className="text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Monthly Summary
                </h3>
              </div>
              {data.monthlyStats?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data.monthlyStats.map((item) => (
                    <div
                      key={`${item._id.year}-${item._id.month}`}
                      className="rounded-2xl border border-[#efe3d7] bg-[#fff8ee] p-4"
                    >
                      <p className="text-sm text-gray-500">
                        {item._id.month}/{item._id.year}
                      </p>
                      <p className="text-sm text-gray-700">
                        Orders: {item.orders}
                      </p>
                      <p className="text-sm text-gray-700">
                        Revenue: {formatAmount(item.revenue)}
                      </p>
                      <p className="text-sm text-gray-700">
                        Commission: {formatAmount(item.commission)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No monthly stats yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default AffiliatePortalPage;
