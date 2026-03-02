"use client";

import { useAdmin } from "@/context/AdminContext";
import { getData } from "@/utils/api";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import LoadingSpinner from "../components/LoadingSpinner";

const RANGE_OPTIONS = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
];

const SOURCE_COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

const formatCurrency = (value) =>
  `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const formatDuration = (seconds) => {
  const totalSeconds = Math.max(Number(seconds || 0), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const remainderSeconds = Math.floor(totalSeconds % 60);
  return `${minutes}m ${remainderSeconds}s`;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeString = (value) => String(value || "").trim();

const formatDateTime = (value) => {
  const candidate = new Date(value);
  return Number.isNaN(candidate.getTime()) ? "-" : candidate.toLocaleString();
};

const normalizePagePath = (pageUrl) => {
  const value = toSafeString(pageUrl);
  if (!value) return "-";

  try {
    const parsed = new URL(value);
    return `${parsed.pathname || "/"}${parsed.search || ""}`;
  } catch {
    return value;
  }
};

const buildUserActivityInsights = (activity = null) => {
  const timeline = Array.isArray(activity?.timeline) ? activity.timeline : [];
  const sessions = Array.isArray(activity?.sessions) ? activity.sessions : [];
  const purchases = Array.isArray(activity?.purchases) ? activity.purchases : [];

  const eventTypeMap = new Map();
  const pageMap = new Map();
  let addToCartSignals = 0;
  let checkoutSignals = 0;
  let purchaseSignals = 0;

  for (const event of timeline) {
    const eventType = toSafeString(event?.eventType || "unknown");
    eventTypeMap.set(eventType, (eventTypeMap.get(eventType) || 0) + 1);

    if (eventType === "add_to_cart") addToCartSignals += 1;
    if (eventType === "checkout_started") checkoutSignals += 1;
    if (eventType === "purchase_completed") purchaseSignals += 1;

    const pagePath = normalizePagePath(event?.pageUrl);
    if (pagePath !== "-") {
      pageMap.set(pagePath, (pageMap.get(pagePath) || 0) + 1);
    }
  }

  return {
    totalEvents: timeline.length,
    totalSessions: sessions.length,
    totalPurchases: purchases.length,
    addToCartSignals,
    checkoutSignals,
    purchaseSignals,
    eventTypes: Array.from(eventTypeMap.entries())
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count),
    pages: Array.from(pageMap.entries())
      .map(([path, events]) => ({ path, events }))
      .sort((a, b) => b.events - a.events),
  };
};

const buildRangeQuery = (days) => {
  const to = new Date();
  const from = new Date(to.getTime() - Number(days || 30) * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
};

const getApiErrorMessage = (response, fallback) =>
  [response?.message, response?.details].filter(Boolean).join(" - ") || fallback;

export default function AnalyticsDashboardPage() {
  const { token, isAuthenticated, loading: authLoading } = useAdmin();
  const router = useRouter();

  const [rangeDays, setRangeDays] = useState(30);
  const [overview, setOverview] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(true);

  const [userIdInput, setUserIdInput] = useState("");
  const [userActivity, setUserActivity] = useState(null);
  const [userActivityLoading, setUserActivityLoading] = useState(false);

  const rangeQuery = useMemo(() => buildRangeQuery(rangeDays), [rangeDays]);
  const activityInsights = useMemo(() => buildUserActivityInsights(userActivity), [userActivity]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const overviewRes = await getData(
        `/api/admin/analytics/overview?from=${encodeURIComponent(rangeQuery.from)}&to=${encodeURIComponent(rangeQuery.to)}`,
        token,
      );

      const chartsRes = await getData(
        `/api/admin/analytics/charts?from=${encodeURIComponent(rangeQuery.from)}&to=${encodeURIComponent(rangeQuery.to)}&interval=day`,
        token,
      );

      if (!overviewRes?.success || !chartsRes?.success) {
        throw new Error(
          getApiErrorMessage(
            overviewRes?.success ? chartsRes : overviewRes,
            "Failed to fetch analytics",
          ),
        );
      }

      setOverview(overviewRes.data);
      setCharts(chartsRes.data);
    } catch (requestError) {
      setError(requestError?.message || "Failed to fetch analytics data");
    } finally {
      setLoading(false);
    }
  }, [rangeQuery.from, rangeQuery.to, token]);

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

  const fetchUserActivity = async () => {
    const normalizedUserId = String(userIdInput || "").trim();
    if (!normalizedUserId) {
      setError("User ID is required for activity lookup");
      return;
    }

    setUserActivityLoading(true);
    setError("");

    try {
      const activityRes = await getData(
        `/api/admin/analytics/users/${encodeURIComponent(normalizedUserId)}?limit=1000`,
        token,
      );

      if (!activityRes?.success) {
        throw new Error(getApiErrorMessage(activityRes, "Failed to fetch user activity"));
      }

      setUserActivity(activityRes.data);
    } catch (activityError) {
      setError(activityError?.message || "Failed to fetch user activity");
      setUserActivity(null);
    } finally {
      setUserActivityLoading(false);
    }
  };

  if (authLoading || loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Analytics</h1>
            <p className="text-sm text-gray-600 mt-1">
              Event-driven analytics sourced from the dedicated analytics database
            </p>
            <button
              type="button"
              onClick={() => router.push("/behavior-analytics")}
              className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200"
            >
              Need guest/session-level behavior? Open Behavior Analytics
            </button>
          </div>
          <div className="flex gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRangeDays(option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  rangeDays === option.value
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">How To Read This Dashboard</h2>
            <button
              type="button"
              onClick={() => setShowGuide((prev) => !prev)}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm font-semibold text-gray-700"
            >
              {showGuide ? "Hide" : "Show"}
            </button>
          </div>
          {showGuide ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mt-3 text-xs text-gray-700">
              <GuideCard
                title="1) Check Overall Health"
                lines={[
                  "Total visitors, conversion, and revenue show funnel quality.",
                  "Use 7D/30D/90D to compare short-term vs long-term trends.",
                ]}
              />
              <GuideCard
                title="2) Find Growth Levers"
                lines={[
                  "Top products and keywords show what users care about.",
                  "Traffic source mix shows which channels drive visits.",
                ]}
              />
              <GuideCard
                title="3) Inspect Specific User"
                lines={[
                  "Use User Activity Viewer for event timeline + session history.",
                  "Use Behavior Analytics for guest/session-level drilldowns.",
                ]}
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <MetricCard
            title="Total Visitors"
            value={overview?.totalVisitors || 0}
            hint="Unique sessions in selected date range."
          />
          <MetricCard
            title="Active Users"
            value={overview?.activeUsers || 0}
            hint="Logged-in users active recently."
          />
          <MetricCard
            title="Total Page Views"
            value={overview?.totalPageViews || 0}
            hint="Tracked page view events."
          />
          <MetricCard
            title="Conversion Rate"
            value={`${toNumber(overview?.conversionRate || 0).toFixed(2)}%`}
            hint="Sessions that completed purchase."
          />
          <MetricCard
            title="Revenue"
            value={formatCurrency(overview?.revenue || 0)}
            hint="Revenue from tracked purchases."
          />
          <MetricCard
            title="Avg Session Duration"
            value={formatDuration(overview?.avgSessionDurationSeconds || 0)}
            hint="Average engaged session time."
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard
            title="Visitors Over Time"
            description="Traffic trend by day/week/month for selected range."
          >
            {(charts?.visitorsOverTime || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={charts?.visitorsOverTime || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="visitors" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyHint text="No visitor trend data available for selected range." />
            )}
          </ChartCard>

          <ChartCard
            title="Revenue Over Time"
            description="Revenue movement helps detect growth periods and dips."
          >
            {(charts?.revenueOverTime || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts?.revenueOverTime || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="revenue" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyHint text="No revenue trend data in selected range." />
            )}
          </ChartCard>

          <ChartCard
            title="Top Products Viewed"
            description="Products getting most attention from visitors."
          >
            {(charts?.topProductsViewed || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts?.topProductsViewed || []} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="productName" width={120} />
                  <Tooltip />
                  <Bar dataKey="views" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyHint text="No product view data captured yet." />
            )}
          </ChartCard>

          <ChartCard
            title="Top Searched Keywords"
            description="Most searched terms show purchase intent and content demand."
          >
            {(charts?.topSearchedKeywords || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts?.topSearchedKeywords || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="keyword" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="searches" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyHint text="No search keyword data captured yet." />
            )}
          </ChartCard>

          <ChartCard
            title="Traffic Sources"
            description="Channel mix shows where your visitors are coming from."
          >
            {(charts?.trafficSources || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={charts?.trafficSources || []}
                    dataKey="visits"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ source, visits }) => `${source}: ${visits}`}
                  >
                    {(charts?.trafficSources || []).map((entry, index) => (
                      <Cell key={entry.source} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyHint text="No referrer/source data available yet." />
            )}
          </ChartCard>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xl font-semibold text-gray-900">User Activity Viewer</h2>
          <p className="text-sm text-gray-600 mt-1">
            Search by user ID to inspect timeline, sessions, and purchase history.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <input
              type="text"
              value={userIdInput}
              onChange={(event) => setUserIdInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  fetchUserActivity();
                }
              }}
              placeholder="Enter user ID"
              className="border border-gray-300 rounded-lg px-3 py-2 w-full md:w-[360px]"
            />
            <button
              type="button"
              onClick={fetchUserActivity}
              disabled={userActivityLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
            >
              {userActivityLoading ? "Loading..." : "Load Activity"}
            </button>
          </div>

          {userActivity ? (
            <div className="space-y-4 mt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <MiniMetricCard title="Events" value={activityInsights.totalEvents} />
                <MiniMetricCard title="Sessions" value={activityInsights.totalSessions} />
                <MiniMetricCard title="Purchases" value={activityInsights.totalPurchases} />
                <MiniMetricCard title="Add To Cart" value={activityInsights.addToCartSignals} />
                <MiniMetricCard title="Checkout" value={activityInsights.checkoutSignals} />
                <MiniMetricCard title="Purchase Signals" value={activityInsights.purchaseSignals} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <InsightCard
                  title="Top Event Types"
                  rows={activityInsights.eventTypes.slice(0, 12).map((row) => `${row.eventType}: ${row.count}`)}
                />
                <InsightCard
                  title="Top Pages"
                  rows={activityInsights.pages.slice(0, 12).map((row) => `${row.path}: ${row.events}`)}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Timeline</h3>
                  {(userActivity.timeline || []).length > 0 ? (
                    <div className="max-h-80 overflow-auto space-y-2">
                      {(userActivity.timeline || []).map((event) => (
                        <div key={event.eventId} className="bg-white rounded-md border border-gray-200 p-3">
                          <div className="text-xs text-gray-500">{formatDateTime(event.timestamp)}</div>
                          <div className="text-sm font-semibold text-gray-800">{event.eventType}</div>
                          <div className="text-xs text-gray-600 break-all">Session: {event.sessionId || "-"}</div>
                          {event.pageUrl ? (
                            <div className="text-xs text-gray-600 break-all">Page: {normalizePagePath(event.pageUrl)}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyHint text="No timeline events for this user." />
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Session History</h3>
                  {(userActivity.sessions || []).length > 0 ? (
                    <div className="max-h-80 overflow-auto space-y-2">
                      {(userActivity.sessions || []).map((session) => (
                        <div key={session.sessionId} className="bg-white rounded-md border border-gray-200 p-3">
                          <div className="text-xs text-gray-500 break-all">{session.sessionId}</div>
                          <div className="text-xs text-gray-700">Started: {formatDateTime(session.startedAt)}</div>
                          <div className="text-xs text-gray-700">
                            Duration: {formatDuration((session.durationMs || 0) / 1000)}
                          </div>
                          <div className="text-xs text-gray-700">
                            Events: {session.eventCount || 0} | Page Views: {session.pageViews || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyHint text="No session history for this user." />
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Purchase History</h3>
                <div className="overflow-auto">
                  {(userActivity.purchases || []).length > 0 ? (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">
                          <th className="py-2 pr-4">Time</th>
                          <th className="py-2 pr-4">Order ID</th>
                          <th className="py-2 pr-4">Amount</th>
                          <th className="py-2 pr-4">Payment Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(userActivity.purchases || []).map((purchase, index) => (
                          <tr key={purchase.eventId || `${purchase.orderId}-${index}`} className="border-b border-gray-100 text-gray-700">
                            <td className="py-2 pr-4">{formatDateTime(purchase.timestamp)}</td>
                            <td className="py-2 pr-4 break-all">{purchase.orderId || "-"}</td>
                            <td className="py-2 pr-4">{formatCurrency(purchase.amount)}</td>
                            <td className="py-2 pr-4">{purchase.paymentMethod || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <EmptyHint text="No purchase history found for this user." />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <EmptyHint text="Enter a user ID and click Load Activity to inspect timeline, sessions, and purchases." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, hint }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-2xl font-bold text-gray-900 mt-2">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{hint}</div>
    </div>
  );
}

function ChartCard({ title, description, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {description ? <p className="text-sm text-gray-600 mt-1 mb-3">{description}</p> : null}
      {children}
    </div>
  );
}

function MiniMetricCard({ title, value }) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-lg font-semibold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

function GuideCard({ title, lines = [] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="font-semibold text-gray-900">{title}</div>
      <div className="mt-1.5 space-y-1">
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function InsightCard({ title, rows = [] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-base font-semibold text-gray-900 mb-3">{title}</h3>
      {rows.length > 0 ? (
        <div className="max-h-52 overflow-auto space-y-2">
          {rows.map((row, index) => (
            <div
              key={`${title}-${index}`}
              className="text-sm text-gray-700 bg-gray-50 rounded-md border border-gray-200 px-3 py-2"
            >
              {row}
            </div>
          ))}
        </div>
      ) : (
        <EmptyHint text="No data available." />
      )}
    </div>
  );
}

function EmptyHint({ text }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
      {text}
    </div>
  );
}
