"use client";

import { useEffect, useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import { FiCopy, FiTrendingUp, FiUser } from "react-icons/fi";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

const INFLUENCER_TOKEN_KEY = "influencerToken";
const INFLUENCER_REFRESH_TOKEN_KEY = "influencerRefreshToken";
const SESSION_KEY = "influencerPortalSession";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const AffiliatePortalPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [hasToken, setHasToken] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  const saveSession = (code, email) => {
    if (typeof window === "undefined") return;
    const payload = {
      code: code.trim().toUpperCase(),
      email: email.trim().toLowerCase(),
      savedAt: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  };

  const clearSession = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(SESSION_KEY);
  };

  const refreshAccessToken = async () => {
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
  };

  const loadSession = () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.code || !parsed?.email) return null;
      if (parsed?.savedAt && Date.now() - parsed.savedAt > SESSION_TTL_MS) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return parsed;
    } catch (err) {
      return null;
    }
  };

  const fetchPortalData = async (code, email, persistSession = false) => {
    setError("");
    setData(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        code: code.trim(),
        email: email.trim(),
      });

      const response = await fetch(
        `${API_URL}/api/influencers/portal?${params.toString()}`,
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to load collaborator stats");
      }

      setData(result.data);
      if (persistSession) {
        saveSession(code, email);
      }
    } catch (err) {
      setError(err.message || "Failed to load collaborator stats.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPortalDataWithToken = async (token, retry = true) => {
    setError("");
    setData(null);
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
        if (typeof window !== "undefined") {
          localStorage.removeItem(INFLUENCER_TOKEN_KEY);
          localStorage.removeItem(INFLUENCER_REFRESH_TOKEN_KEY);
          window.dispatchEvent(new Event("influencerAuthChanged"));
        }
        setHasToken(false);
        router.push("/affiliate/login");
      }
      setError(err.message || "Failed to load collaborator stats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem(INFLUENCER_TOKEN_KEY)
        : null;

    if (token) {
      setHasToken(true);
      fetchPortalDataWithToken(token);
      return;
    }

    const session = loadSession();
    if (session?.code && session?.email) {
      fetchPortalData(session.code, session.email, false);
    }
  }, []);

  const handleLogout = () => {
    clearSession();
    if (typeof window !== "undefined") {
      localStorage.removeItem(INFLUENCER_TOKEN_KEY);
      localStorage.removeItem(INFLUENCER_REFRESH_TOKEN_KEY);
      window.dispatchEvent(new Event("influencerAuthChanged"));
    }
    setData(null);
    setError("");
    setHasToken(false);
    router.replace("/");
  };

  const stats = data?.stats || {};
  const referralUrl = data?.influencer?.referralUrl || "";

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
    } catch (error) {
      setCopyStatus("Copy failed");
    } finally {
      setTimeout(() => setCopyStatus(""), 2000);
    }
  };

  return (
    <section className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                Collaborator Earnings Portal
              </h1>
              <p className="text-gray-600">
                Enter your referral code and registered email to view earnings.
              </p>
            </div>
            {data && (
              <Button variant="outlined" onClick={handleLogout}>
                Sign out
              </Button>
            )}
          </div>

          {!hasToken && (
            <div className="mt-6">
              <Button
                variant="contained"
                sx={{
                  backgroundColor: "var(--primary)",
                  "&:hover": { backgroundColor: "#047857" },
                }}
                onClick={() => router.push("/affiliate/login")}
              >
                Go to Influencer Login
              </Button>
            </div>
          )}

          {loading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <CircularProgress size={16} />
              Loading earnings...
            </div>
          )}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>

        {data && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    Welcome, {data.influencer?.name || "Collaborator"}
                  </h2>
                  <p className="text-gray-500">
                    Code: <span className="font-semibold">{data.influencer?.code}</span>
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
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {stats.totalOrders || 0}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-800">
                    ₹{Number(stats.totalRevenue || 0).toFixed(0)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Commission Earned</p>
                  <p className="text-2xl font-bold text-gray-800">
                    ₹{Number(stats.totalCommission || 0).toFixed(0)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Pending Commission</p>
                  <p className="text-2xl font-bold text-gray-800">
                    ₹{Number(stats.pendingCommission || 0).toFixed(0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <FiTrendingUp className="text-primary" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Recent Orders
                </h3>
              </div>
              {data.recentOrders?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
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
                            ₹{Number(order.finalAmount || order.totalAmt || 0).toFixed(0)}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            ₹{Number(order.influencerCommission || 0).toFixed(0)}
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

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <FiUser className="text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Monthly Summary
                </h3>
              </div>
              {data.monthlyStats?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data.monthlyStats.map((item) => (
                    <div key={`${item._id.year}-${item._id.month}`} className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-500">
                        {item._id.month}/{item._id.year}
                      </p>
                      <p className="text-sm text-gray-700">
                        Orders: {item.orders}
                      </p>
                      <p className="text-sm text-gray-700">
                        Revenue: ₹{Number(item.revenue || 0).toFixed(0)}
                      </p>
                      <p className="text-sm text-gray-700">
                        Commission: ₹{Number(item.commission || 0).toFixed(0)}
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
