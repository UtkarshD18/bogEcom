"use client";

import { fetchDataFromApi } from "@/utils/api";
import cookies from "js-cookie";
import Link from "next/link";
import { useEffect, useState } from "react";

const getStoredAuthToken = () => {
  const cookieToken = cookies.get("accessToken");
  if (cookieToken) return cookieToken;
  if (typeof window === "undefined") return "";
  return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const formatInr = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const typeStyles = {
  earn: "bg-emerald-100 text-emerald-700",
  bonus: "bg-blue-100 text-blue-700",
  redeem: "bg-amber-100 text-amber-700",
  expire: "bg-red-100 text-red-700",
};

const CoinHistoryPage = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
  });
  const [error, setError] = useState("");

  const loadData = async (page = 1) => {
    setLoading(true);
    setError("");

    try {
      let [summaryRes, txRes] = await Promise.all([
        fetchDataFromApi("/api/coins/summary"),
        fetchDataFromApi(`/api/coins/transactions?page=${page}&limit=20`),
      ]);

      if (!summaryRes?.success || !txRes?.success) {
        const [legacySummaryRes, legacyTxRes] = await Promise.all([
          fetchDataFromApi("/api/user/coins-summary"),
          fetchDataFromApi(`/api/user/coin-transactions?page=${page}&limit=20`),
        ]);
        summaryRes = summaryRes?.success ? summaryRes : legacySummaryRes;
        txRes = txRes?.success ? txRes : legacyTxRes;
      }

      if (!summaryRes?.success || !txRes?.success) {
        throw new Error("Unable to load coin data");
      }

      setSummary(summaryRes.data || null);
      setTransactions(txRes?.data?.transactions || []);
      setPagination({
        page: txRes?.data?.pagination?.page || page,
        totalPages: Math.max(txRes?.data?.pagination?.totalPages || 1, 1),
      });
    } catch (loadError) {
      setError(loadError.message || "Failed to load coin history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!getStoredAuthToken()) {
      setLoading(false);
      setError("Please login to view coin history");
      return;
    }
    loadData(1);
  }, []);

  if (loading) {
    return (
      <section className="min-h-screen px-4 py-16">
        <div className="max-w-4xl mx-auto rounded-2xl bg-white/70 border border-white/60 p-6 shadow-md">
          Loading coin history...
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen px-4 py-10 sm:py-14">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-2xl border bg-white/75 backdrop-blur-xl p-5 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Coin History</h1>
              <p className="text-sm text-gray-600 mt-1">
                Track earned, redeemed, and expiring coins.
              </p>
            </div>
            <Link
              href="/my-account"
              className="text-sm font-semibold text-[var(--flavor-color)] hover:underline"
            >
              Back to Account
            </Link>
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="rounded-xl bg-white p-3 border border-gray-100">
                <p className="text-xs text-gray-500">Total Coins</p>
                <p className="text-lg font-bold text-gray-900">
                  {Number(summary?.usable_coins || 0)}
                </p>
              </div>
              <div className="rounded-xl bg-white p-3 border border-gray-100">
                <p className="text-xs text-gray-500">Value</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatInr(summary?.rupee_value || 0)}
                </p>
              </div>
              <div className="rounded-xl bg-white p-3 border border-gray-100">
                <p className="text-xs text-gray-500">Expiring Soon</p>
                <p className="text-lg font-bold text-amber-700">
                  {Number(summary?.expiring_soon || 0)}
                </p>
              </div>
              <div className="rounded-xl bg-white p-3 border border-gray-100">
                <p className="text-xs text-gray-500">Redeem Rate</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatInr(summary?.settings?.redeemRate || 0)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white/80 backdrop-blur-xl p-4 sm:p-5 shadow-lg">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-gray-600">No coin transactions yet.</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx._id}
                  className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeStyles[tx.type] || "bg-gray-100 text-gray-700"}`}
                      >
                        {String(tx.type || "-").toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {String(tx.source || "system")}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{tx.coins} coins</p>
                  </div>

                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
                    <div>
                      <p className="text-gray-500">Date</p>
                      <p>{formatDate(tx.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Expiry</p>
                      <p>{formatDate(tx.expiryDate)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Reference</p>
                      <p className="truncate">{tx.referenceId || "-"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Remaining</p>
                      <p>{Number(tx.remainingCoins || 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!error && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => loadData(pagination.page - 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-sm text-gray-600">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadData(pagination.page + 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CoinHistoryPage;
