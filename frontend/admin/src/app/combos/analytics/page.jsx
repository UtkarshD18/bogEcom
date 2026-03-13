"use client";

import { useAdmin } from "@/context/AdminContext";
import { getData } from "@/utils/api";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const RANGE_OPTIONS = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
];

const buildRangeQuery = (days) => {
  const to = new Date();
  const from = new Date(to.getTime() - Number(days || 30) * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
};

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function ComboAnalyticsPage() {
  const { token, isAuthenticated, loading: authLoading } = useAdmin();
  const router = useRouter();

  const [rangeDays, setRangeDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [combos, setCombos] = useState([]);
  const [charts, setCharts] = useState(null);
  const [heatmap, setHeatmap] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const range = buildRangeQuery(rangeDays);
      const response = await getData(
        `/api/combos/admin/analytics?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
        token,
      );
      if (response?.success) {
        setSummary(response.data?.summary || null);
        setCombos(response.data?.combos || []);
        setCharts(response.data?.charts || null);
        setHeatmap(response.data?.heatmap || []);
      } else {
        setError(response?.message || "Failed to load combo analytics");
      }
    } catch (error) {
      setError("Failed to load combo analytics");
    } finally {
      setLoading(false);
    }
  }, [rangeDays, token]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchAnalytics();
    }
  }, [fetchAnalytics, isAuthenticated, token]);

  const funnelData = useMemo(() => {
    if (!summary) return [];
    return [
      { stage: "Impressions", value: summary.totalImpressions || 0 },
      { stage: "Clicks", value: summary.totalClicks || 0 },
      { stage: "Add To Cart", value: summary.totalAddToCart || 0 },
      { stage: "Purchases", value: summary.totalPurchases || 0 },
    ];
  }, [summary]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <section className="w-full py-4 px-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] text-gray-700 font-semibold">Combo Analytics</h2>
          <p className="text-xs text-gray-500">
            Track bundle performance and conversion funnels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRangeDays(option.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${
                rangeDays === option.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => fetchAnalytics()}
            className="px-3 py-1.5 rounded-full text-sm font-semibold border border-gray-200 text-gray-600"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}

      {loading ? (
        <div className="text-sm text-gray-500">Loading analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary?.totalRevenue || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Overall AOV impact: {formatCurrency(summary?.overallAov || 0)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Conversions</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary?.totalPurchases || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Clicks: {summary?.totalClicks || 0} / Add to cart: {summary?.totalAddToCart || 0}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Impressions</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary?.totalImpressions || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Active combos: {summary?.totalCombos || 0}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Combo Revenue Over Time
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={charts?.series || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="purchases" stroke="#2563eb" />
                  <Line type="monotone" dataKey="addToCart" stroke="#f59e0b" />
                  <Line type="monotone" dataKey="clicks" stroke="#0ea5e9" />
                  <Line type="monotone" dataKey="impressions" stroke="#94a3b8" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Conversion Funnel
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={funnelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Top Performing Combos
              </h3>
              <div className="space-y-3">
                {combos.slice(0, 6).map((combo) => (
                  <div
                    key={combo.comboId}
                    className="flex items-center justify-between text-sm text-gray-700"
                  >
                    <span className="font-semibold">{combo.comboName}</span>
                    <span className="text-gray-500">
                      {formatCurrency(combo.revenue || 0)} / {combo.conversionRate || 0}% CVR
                    </span>
                  </div>
                ))}
                {combos.length === 0 && (
                  <p className="text-xs text-gray-400">No combo data yet.</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Product Pairing Heatmap
              </h3>
              <div className="space-y-2 text-xs text-gray-600">
                {heatmap.slice(0, 8).map((pair) => (
                  <div key={`${pair.productId}-${pair.relatedProductId}`} className="flex justify-between">
                    <span>
                      {pair.productId} → {pair.relatedProductId}
                    </span>
                    <span>
                      {pair.pairCount} orders • {Math.round((pair.confidenceScore || 0) * 100)}%
                    </span>
                  </div>
                ))}
                {heatmap.length === 0 && (
                  <p className="text-xs text-gray-400">No pairing data yet.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
