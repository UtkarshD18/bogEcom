"use client";

import { useAdmin } from "@/context/AdminContext";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useLiveRefreshSetting } from "@/hooks/useLiveRefreshSetting";
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
import LoadingSpinner from "../components/LoadingSpinner";

const RANGE_OPTIONS = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
];

const defaultUserViewState = {
  timeline: [],
  sessionSummary: null,
  sessionHistory: [],
  purchaseHistory: [],
  productInteractions: [],
  purchases: [],
};

const defaultProductJourneyState = {
  scope: null,
  product: null,
  summary: null,
  sessions: [],
  timeline: [],
};

const defaultSessionsExplorerState = {
  items: [],
  filter: null,
  pagination: {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  },
  totals: {
    all: 0,
    guest: 0,
    loggedIn: 0,
  },
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeString = (value) => String(value || "").trim();

const formatCurrency = (value) =>
  `Rs ${toNumber(value, 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const formatDuration = (milliseconds) => {
  const totalSeconds = Math.max(Math.floor(toNumber(milliseconds, 0) / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

const formatPercent = (value) => `${toNumber(value, 0).toFixed(2)}%`;

const formatDateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const normalizePath = (pageUrl) => {
  const value = safeString(pageUrl);
  if (!value) return "-";
  try {
    const parsed = new URL(value);
    return `${parsed.pathname || "/"}${parsed.search || ""}`;
  } catch {
    return value;
  }
};

const resolveUserTypeStats = (engagement, key) => {
  const defaults = {
    sessions: 0,
    events: 0,
    addToCart: 0,
    checkoutStarted: 0,
    purchases: 0,
    clickEvents: 0,
    rageClicks: 0,
    avgSessionActiveTimeMs: 0,
    avgPageActiveMs: 0,
  };

  const fromApi = engagement?.userTypeMatrix?.[key] || {};
  return {
    ...defaults,
    ...fromApi,
  };
};

const toTypeConversionRate = (stats) => {
  const sessions = Math.max(toNumber(stats?.sessions, 0), 0);
  if (!sessions) return 0;
  return (toNumber(stats?.purchases, 0) / sessions) * 100;
};

const resolveEventSectionName = (event) =>
  safeString(
    event?.metadata?.sectionName ||
      event?.metadata?.section ||
      event?.metadata?.sectionKey ||
      "",
  );

const resolveEventProductId = (event) =>
  safeString(
    event?.metadata?.productId ||
      event?.metadata?.product_id ||
      event?.metadata?.id ||
      event?.metadata?.product?._id ||
      event?.metadata?.product?.id ||
      "",
  );

const resolveClickTarget = (metadata = {}) =>
  safeString(
    metadata?.trackName ||
      metadata?.text ||
      metadata?.id ||
      metadata?.className ||
      metadata?.tagName ||
      "",
  );

const buildRangeQuery = (days) => {
  const to = new Date();
  const from = new Date(to.getTime() - Number(days || 30) * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
};

const getApiErrorMessage = (response, fallback) =>
  [response?.message, response?.details].filter(Boolean).join(" - ") || fallback;

const getSessionIntent = (session) => {
  const events = toNumber(session?.eventCount, 0);
  const pages = toNumber(session?.pageViews, 0);
  const activeTime = toNumber(session?.totalActiveTime, 0);

  if (events >= 15 || pages >= 4 || activeTime >= 120000) {
    return { label: "High", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (events >= 5 || pages >= 2 || activeTime >= 30000) {
    return { label: "Medium", className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  return { label: "Low", className: "bg-slate-50 text-slate-700 border-slate-200" };
};

const getWorkerState = (performance) => {
  const total = toNumber(performance?.workerHealth?.totalWorkers, 0);
  const healthy = toNumber(performance?.workerHealth?.healthyWorkers, 0);

  if (!total) return { label: "No workers", className: "bg-amber-50 text-amber-700 border-amber-200" };
  if (healthy === total) return { label: "Healthy", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (healthy === 0) return { label: "Critical", className: "bg-rose-50 text-rose-700 border-rose-200" };
  return { label: "Degraded", className: "bg-amber-50 text-amber-700 border-amber-200" };
};

const buildTimelineInsights = (timeline = [], productInteractions = []) => {
  const eventTypeMap = new Map();
  const pageMap = new Map();
  const sectionMap = new Map();
  const productMap = new Map();
  const clickTargetMap = new Map();

  let addToCart = 0;
  let checkoutStarted = 0;
  let purchases = 0;

  for (const event of timeline) {
    const type = safeString(event?.eventType || "unknown");
    const metadata = event?.metadata || {};

    eventTypeMap.set(type, (eventTypeMap.get(type) || 0) + 1);
    if (type === "add_to_cart") addToCart += 1;
    if (type === "checkout_started") checkoutStarted += 1;
    if (type === "purchase_completed") purchases += 1;

    const path = normalizePath(event?.pageUrl);
    if (path !== "-") {
      const page = pageMap.get(path) || { path, events: 0 };
      page.events += 1;
      pageMap.set(path, page);
    }

    const sectionName = resolveEventSectionName(event);
    if (sectionName) {
      const section = sectionMap.get(sectionName) || { sectionName, events: 0, durationMs: 0 };
      section.events += 1;
      section.durationMs += Math.max(toNumber(metadata.durationMs, 0), 0);
      sectionMap.set(sectionName, section);
    }

    const productKey = safeString(
      metadata.productName ||
        resolveEventProductId(event),
    );

    if (productKey || ["product_view", "add_to_cart", "checkout_started", "purchase_completed"].includes(type)) {
      const key = productKey || "unknown_product";
      const product = productMap.get(key) || { key, events: 0 };
      product.events += 1;
      productMap.set(key, product);
    }

    if (["click_event", "rage_click"].includes(type)) {
      const clickTarget = resolveClickTarget(metadata);
      if (clickTarget) {
        const click = clickTargetMap.get(clickTarget) || { target: clickTarget, clicks: 0 };
        click.clicks += 1;
        clickTargetMap.set(clickTarget, click);
      }
    }
  }

  for (const interaction of productInteractions || []) {
    const key = safeString(interaction?.productName || interaction?.productId || "unknown_product");
    const product = productMap.get(key) || { key, events: 0 };
    product.events += 1;
    productMap.set(key, product);
  }

  return {
    totalEvents: timeline.length,
    uniquePages: pageMap.size,
    uniqueSections: sectionMap.size,
    uniqueProducts: productMap.size,
    addToCart,
    checkoutStarted,
    purchases,
    eventTypes: Array.from(eventTypeMap.entries()).map(([eventType, count]) => ({ eventType, count })).sort((a, b) => b.count - a.count),
    pages: Array.from(pageMap.values()).sort((a, b) => b.events - a.events),
    sections: Array.from(sectionMap.values()).sort((a, b) => b.events - a.events),
    sectionsByDuration: Array.from(sectionMap.values()).sort((a, b) => b.durationMs - a.durationMs),
    clickTargets: Array.from(clickTargetMap.values()).sort((a, b) => b.clicks - a.clicks),
    products: Array.from(productMap.values()).sort((a, b) => b.events - a.events),
  };
};

export default function BehaviorAnalyticsPage() {
  const { token, isAuthenticated, loading: authLoading } = useAdmin();
  const router = useRouter();

  const [rangeDays, setRangeDays] = useState(30);
  const [overview, setOverview] = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(true);
  const { intervalMs } = useLiveRefreshSetting();
  const analyticsRefreshConfig = useMemo(
    () => ({
      minIntervalMs: intervalMs,
      fallbackIntervalMs: Math.max(intervalMs * 30, 30000),
    }),
    [intervalMs],
  );
  const sessionsRefreshConfig = useMemo(
    () => ({
      minIntervalMs: Math.max(intervalMs * 5, 5000),
      fallbackIntervalMs: Math.max(intervalMs * 60, 60000),
    }),
    [intervalMs],
  );

  const [lookupMode, setLookupMode] = useState("user");
  const [lookupValue, setLookupValue] = useState("");
  const [productIdInput, setProductIdInput] = useState("");
  const [userViewLoading, setUserViewLoading] = useState(false);
  const [userView, setUserView] = useState(defaultUserViewState);

  const [sessionExplorerType, setSessionExplorerType] = useState("all");
  const [sessionExplorerSearchInput, setSessionExplorerSearchInput] = useState("");
  const [sessionExplorerSearch, setSessionExplorerSearch] = useState("");
  const [sessionExplorerPage, setSessionExplorerPage] = useState(1);
  const [sessionExplorerLoading, setSessionExplorerLoading] = useState(false);
  const [sessionExplorer, setSessionExplorer] = useState(defaultSessionsExplorerState);

  const [productJourneyLoading, setProductJourneyLoading] = useState(false);
  const [productJourney, setProductJourney] = useState(defaultProductJourneyState);
  const [funnelTypeFilter, setFunnelTypeFilter] = useState("all");
  const [funnelMinSessionsInput, setFunnelMinSessionsInput] = useState("1");
  const [funnelSearchInput, setFunnelSearchInput] = useState("");

  const workerState = useMemo(() => getWorkerState(performance), [performance]);
  const timelineInsights = useMemo(
    () => buildTimelineInsights(userView.timeline || [], userView.productInteractions || []),
    [userView.timeline, userView.productInteractions],
  );
  const guestStats = useMemo(() => resolveUserTypeStats(engagement, "guest"), [engagement]);
  const loggedInStats = useMemo(() => resolveUserTypeStats(engagement, "logged_in"), [engagement]);
  const attractiveButtons = useMemo(
    () => (Array.isArray(engagement?.attractiveButtons) ? engagement.attractiveButtons : []),
    [engagement],
  );
  const topConvertingButtonsByProduct = useMemo(
    () =>
      Array.isArray(engagement?.topConvertingButtonsByProduct)
        ? engagement.topConvertingButtonsByProduct
        : [],
    [engagement],
  );
  const filteredTopConvertingButtonsByProduct = useMemo(() => {
    const minSessions = Math.max(Math.floor(toNumber(funnelMinSessionsInput, 1)), 1);
    const search = safeString(funnelSearchInput).toLowerCase();

    return topConvertingButtonsByProduct.filter((row) => {
      if (toNumber(row?.sessionsClicked, 0) < minSessions) {
        return false;
      }

      if (funnelTypeFilter === "guest" && toNumber(row?.guestClickedSessions, 0) <= 0) {
        return false;
      }

      if (funnelTypeFilter === "logged_in" && toNumber(row?.loggedInClickedSessions, 0) <= 0) {
        return false;
      }

      if (search) {
        const target = String(row?.target || "").toLowerCase();
        const productId = String(row?.productId || "").toLowerCase();
        return target.includes(search) || productId.includes(search);
      }

      return true;
    });
  }, [
    topConvertingButtonsByProduct,
    funnelTypeFilter,
    funnelMinSessionsInput,
    funnelSearchInput,
  ]);

  const fetchAnalytics = useCallback(async ({ silent = false } = {}) => {
    if (!token) return;
    if (!silent) {
      setLoading(true);
      setError("");
    } else {
      setRefreshing(true);
    }

    const nextRange = buildRangeQuery(rangeDays);
    const params = `from=${encodeURIComponent(nextRange.from)}&to=${encodeURIComponent(nextRange.to)}`;

    try {
      const [overviewRes, engagementRes, performanceRes] = await Promise.all([
        getData(`/api/admin/analytics/behavior/overview?${params}`, token),
        getData(`/api/admin/analytics/behavior/engagement?${params}`, token),
        getData(`/api/admin/analytics/behavior/performance`, token),
      ]);

      if (!overviewRes?.success) {
        throw new Error(getApiErrorMessage(overviewRes, "Failed to load behavior overview"));
      }
      if (!engagementRes?.success) {
        throw new Error(getApiErrorMessage(engagementRes, "Failed to load behavior engagement"));
      }
      if (!performanceRes?.success) {
        throw new Error(getApiErrorMessage(performanceRes, "Failed to load behavior performance"));
      }

      setOverview(overviewRes.data);
      setEngagement(engagementRes.data);
      setPerformance(performanceRes.data);
    } catch (requestError) {
      setError(requestError?.message || "Failed to load behavior analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rangeDays, token]);

  const fetchSessionExplorer = useCallback(async ({ silent = false } = {}) => {
    if (!token) return;
    if (!silent) {
      setSessionExplorerLoading(true);
      setError("");
    }

    const nextRange = buildRangeQuery(rangeDays);
    const params = new URLSearchParams({
      from: nextRange.from,
      to: nextRange.to,
      type: sessionExplorerType,
      page: String(sessionExplorerPage),
      limit: "25",
    });

    if (sessionExplorerSearch) params.set("q", sessionExplorerSearch);

    try {
      const response = await getData(`/api/admin/analytics/behavior/sessions?${params.toString()}`, token);
      if (!response?.success) {
        throw new Error(getApiErrorMessage(response, "Failed to load sessions"));
      }
      setSessionExplorer({ ...defaultSessionsExplorerState, ...response.data });
    } catch (requestError) {
      setError(requestError?.message || "Failed to load sessions");
      setSessionExplorer(defaultSessionsExplorerState);
    } finally {
      if (!silent) {
        setSessionExplorerLoading(false);
      }
    }
  }, [rangeDays, sessionExplorerType, sessionExplorerPage, sessionExplorerSearch, token]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && token) fetchAnalytics();
  }, [fetchAnalytics, isAuthenticated, token]);

  useEffect(() => {
    if (isAuthenticated && token) fetchSessionExplorer();
  }, [fetchSessionExplorer, isAuthenticated, token]);

  const { trigger: triggerAnalyticsRefresh } = useLiveRefresh(
    () => fetchAnalytics({ silent: true }),
    analyticsRefreshConfig,
  );

  const { trigger: triggerSessionsRefresh } = useLiveRefresh(
    () => fetchSessionExplorer({ silent: true }),
    sessionsRefreshConfig,
  );

  const handleAnalyticsBatch = useCallback(() => {
    triggerAnalyticsRefresh();
    triggerSessionsRefresh();
  }, [triggerAnalyticsRefresh, triggerSessionsRefresh]);

  useAdminRealtime({ token, onAnalyticsBatch: handleAnalyticsBatch });

  const fetchUserViewByLookup = async (mode, rawLookupValue) => {
    const normalizedMode = mode === "session" ? "session" : "user";
    const normalizedLookup = safeString(rawLookupValue);

    if (!normalizedLookup) {
      setError(`${normalizedMode === "user" ? "User ID" : "Session ID"} is required`);
      return;
    }

    setUserViewLoading(true);
    setError("");

    const query =
      normalizedMode === "user"
        ? `userId=${encodeURIComponent(normalizedLookup)}`
        : `sessionId=${encodeURIComponent(normalizedLookup)}`;

    try {
      const response = await getData(`/api/admin/analytics/behavior/user-activity?${query}&limit=3000`, token);
      if (!response?.success) {
        throw new Error(getApiErrorMessage(response, "Failed to load user activity"));
      }
      setUserView({ ...defaultUserViewState, ...response.data });
    } catch (requestError) {
      setError(requestError?.message || "Failed to load user activity");
      setUserView(defaultUserViewState);
    } finally {
      setUserViewLoading(false);
    }
  };

  const fetchUserView = async () => fetchUserViewByLookup(lookupMode, lookupValue);

  const handleApplySessionSearch = () => {
    const nextSearch = safeString(sessionExplorerSearchInput);
    const searchChanged = nextSearch !== sessionExplorerSearch;
    const pageChanged = sessionExplorerPage !== 1;

    setSessionExplorerPage(1);
    setSessionExplorerSearch(nextSearch);

    if (!searchChanged && !pageChanged) fetchSessionExplorer();
  };

  const handleOpenSession = async (sessionId) => {
    const id = safeString(sessionId);
    if (!id) return;
    setLookupMode("session");
    setLookupValue(id);
    await fetchUserViewByLookup("session", id);
  };

  const handleOpenUser = async (userId) => {
    const id = safeString(userId);
    if (!id) return;
    setLookupMode("user");
    setLookupValue(id);
    await fetchUserViewByLookup("user", id);
  };

  const fetchProductJourney = async () => {
    const normalizedLookup = safeString(lookupValue);
    const normalizedProductId = safeString(productIdInput);

    if (!normalizedLookup) {
      setError(`${lookupMode === "user" ? "User ID" : "Session ID"} is required`);
      return;
    }

    if (!normalizedProductId) {
      setError("Product ID is required");
      return;
    }

    setProductJourneyLoading(true);
    setError("");

    const identityQuery =
      lookupMode === "user"
        ? `userId=${encodeURIComponent(normalizedLookup)}`
        : `sessionId=${encodeURIComponent(normalizedLookup)}`;

    const nextRange = buildRangeQuery(rangeDays);
    const rangeParams = `from=${encodeURIComponent(nextRange.from)}&to=${encodeURIComponent(nextRange.to)}`;

    try {
      const response = await getData(
        `/api/admin/analytics/behavior/product-journey?${identityQuery}&productId=${encodeURIComponent(normalizedProductId)}&${rangeParams}&limit=2000`,
        token,
      );

      if (!response?.success) {
        throw new Error(getApiErrorMessage(response, "Failed to load product journey"));
      }

      setProductJourney({ ...defaultProductJourneyState, ...response.data });
    } catch (requestError) {
      setError(requestError?.message || "Failed to load product journey");
      setProductJourney(defaultProductJourneyState);
    } finally {
      setProductJourneyLoading(false);
    }
  };

  if (authLoading || loading) return <LoadingSpinner />;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Behavior Analytics</h1>
            <p className="text-sm text-gray-600 mt-1">Track user behavior across sessions, pages, sections, and products.</p>
            <div className="mt-3">
              <StatusPill label={`Worker: ${workerState.label}`} className={workerState.className} />
            </div>
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

        {refreshing ? (
          <div className="text-xs text-gray-500">Refreshing live data...</div>
        ) : null}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">How To Use</h2>
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
                title="Overview"
                lines={[
                  "Sessions and active users show traffic quality.",
                  "Bounce + conversion indicate funnel health.",
                ]}
              />
              <GuideCard
                title="Session Explorer"
                lines={[
                  "Filter All, Guest, or Logged In sessions.",
                  "Open Session/User for full timeline drilldown.",
                ]}
              />
              <GuideCard
                title="Product And Section"
                lines={[
                  "Use timeline insights for top pages and sections.",
                  "Use Most Attractive Buttons to spot strongest CTAs.",
                  "Use Top Converting Button By Product to find winning product CTA patterns.",
                  "Load Product Journey for product-level behavior.",
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
          <MetricCard title="Total Sessions" value={overview?.totalSessions || 0} hint="Guest + logged-in sessions." />
          <MetricCard title="Active Users" value={overview?.activeUsers || 0} hint="Recently active logged-in users." />
          <MetricCard title="Avg Active Time" value={formatDuration(overview?.avgActiveTimeMs || 0)} hint="Active time, not idle open tab time." />
          <MetricCard title="Bounce Rate" value={`${toNumber(overview?.bounceRate, 0).toFixed(2)}%`} hint="Lower is better." />
          <MetricCard title="Conversion Rate" value={`${toNumber(overview?.conversionRate, 0).toFixed(2)}%`} hint="Sessions that reached purchase." />
          <MetricCard title="Revenue" value={formatCurrency(overview?.revenue || 0)} hint="Tracked purchase amount." />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <MetricCard title="Avg Time Per Product" value={formatDuration(engagement?.avgTimePerProductMs || 0)} hint="Hover/product interaction depth." />
          <MetricCard title="Avg Scroll Depth" value={`${toNumber(engagement?.avgScrollDepth, 0).toFixed(1)}%`} hint="How far users scroll." />
          <MetricCard title="Rage Click Count" value={engagement?.rageClickCount || 0} hint="Possible UX friction." />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <UserTypeBehaviorCard
            title="Guest Behavior Snapshot"
            stats={guestStats}
            conversionRate={toTypeConversionRate(guestStats)}
            badgeClassName="bg-amber-50 text-amber-700 border-amber-200"
          />
          <UserTypeBehaviorCard
            title="Logged-In Behavior Snapshot"
            stats={loggedInStats}
            conversionRate={toTypeConversionRate(loggedInStats)}
            badgeClassName="bg-emerald-50 text-emerald-700 border-emerald-200"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard title="Events Per Minute (Last 60 Minutes)">
            {(performance?.eventsPerMinute || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={performance?.eventsPerMinute || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="minute" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="events" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyHint text="No events in the last 60 minutes." />
            )}
          </ChartCard>

          <ChartCard title="Section Engagement (Top)">
            {(engagement?.sectionEngagementHeatmap || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={(engagement?.sectionEngagementHeatmap || []).slice(0, 12)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sectionName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="views" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyHint text="No section events captured for this range." />
            )}
          </ChartCard>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Most Attractive Buttons</h2>
              <p className="text-sm text-gray-600 mt-1">
                Ranked by clicks, rage-click pressure, and pre-click dwell time.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Range: {rangeDays} days
            </div>
          </div>

          {attractiveButtons.length > 0 ? (
            <div className="mt-4 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Target</th>
                    <th className="py-2 pr-3">Interactions</th>
                    <th className="py-2 pr-3">Avg Pre-Click Dwell</th>
                    <th className="py-2 pr-3">Rage Clicks</th>
                    <th className="py-2 pr-3">Guest</th>
                    <th className="py-2 pr-3">Logged In</th>
                    <th className="py-2 pr-3">Top Sections</th>
                    <th className="py-2 pr-3">Top Products</th>
                  </tr>
                </thead>
                <tbody>
                  {attractiveButtons.slice(0, 20).map((row) => (
                    <tr key={`${row.target}-${row.score}`} className="border-b border-gray-100 text-gray-700 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-semibold break-all">{row.target}</div>
                        <div className="text-xs text-gray-500">Score: {toNumber(row.score, 0).toFixed(2)}</div>
                      </td>
                      <td className="py-2 pr-3">{toNumber(row.totalInteractions, 0)}</td>
                      <td className="py-2 pr-3">{formatDuration(row.avgPreClickDwellMs || 0)}</td>
                      <td className="py-2 pr-3">{toNumber(row.rageClicks, 0)}</td>
                      <td className="py-2 pr-3">{toNumber(row.guestInteractions, 0)}</td>
                      <td className="py-2 pr-3">{toNumber(row.loggedInInteractions, 0)}</td>
                      <td className="py-2 pr-3">
                        {(row.topSections || []).length > 0 ? (
                          <div className="space-y-1">
                            {row.topSections.map((section) => (
                              <div key={`${row.target}-${section}`} className="text-xs text-gray-700 break-all">
                                {section}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {(row.topProducts || []).length > 0 ? (
                          <div className="space-y-1">
                            {row.topProducts.map((product) => (
                              <div key={`${row.target}-${product}`} className="text-xs text-gray-700 break-all">
                                {product}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyHint text="No click/button data for this range yet." />
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Top Converting Button By Product</h2>
              <p className="text-sm text-gray-600 mt-1">
                Funnel by session: click to add-to-cart to checkout to purchase for each button and product.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Range: {rangeDays} days
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              {["all", "guest", "logged_in"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFunnelTypeFilter(type)}
                  className={`px-4 py-2 text-sm font-semibold ${
                    funnelTypeFilter === type
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700"
                  }`}
                >
                  {type === "all" ? "All" : type === "guest" ? "Guest" : "Logged In"}
                </button>
              ))}
            </div>

            <input
              type="number"
              min={1}
              step={1}
              value={funnelMinSessionsInput}
              onChange={(event) => setFunnelMinSessionsInput(event.target.value)}
              placeholder="Min clicked sessions"
              className="border border-gray-300 rounded-lg px-3 py-2 w-[170px]"
            />

            <input
              type="text"
              value={funnelSearchInput}
              onChange={(event) => setFunnelSearchInput(event.target.value)}
              placeholder="Search button or product"
              className="border border-gray-300 rounded-lg px-3 py-2 w-full md:w-[320px]"
            />

            <button
              type="button"
              onClick={() => {
                setFunnelTypeFilter("all");
                setFunnelMinSessionsInput("1");
                setFunnelSearchInput("");
              }}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700"
            >
              Reset
            </button>
          </div>

          <div className="mt-3 text-xs text-gray-600">
            Showing {filteredTopConvertingButtonsByProduct.length} of {topConvertingButtonsByProduct.length} rows
          </div>

          {filteredTopConvertingButtonsByProduct.length > 0 ? (
            <div className="mt-4 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Button</th>
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3">Clicked Sessions</th>
                    <th className="py-2 pr-3">Click To Cart</th>
                    <th className="py-2 pr-3">Cart To Checkout</th>
                    <th className="py-2 pr-3">Click To Purchase</th>
                    <th className="py-2 pr-3">Guest / Logged</th>
                    <th className="py-2 pr-3">Avg Pre-Click Dwell</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTopConvertingButtonsByProduct.slice(0, 25).map((row) => (
                    <tr
                      key={`${row.target}-${row.productId}`}
                      className="border-b border-gray-100 text-gray-700 align-top"
                    >
                      <td className="py-2 pr-3">
                        <div className="font-semibold break-all">{row.target || "-"}</div>
                        <div className="text-xs text-gray-500">
                          Clicks: {toNumber(row.totalClickEvents, 0)}
                        </div>
                      </td>
                      <td className="py-2 pr-3 break-all">{row.productId || "-"}</td>
                      <td className="py-2 pr-3">{toNumber(row.sessionsClicked, 0)}</td>
                      <td className="py-2 pr-3">
                        {formatPercent(row.clickToCartRate)}
                        <div className="text-xs text-gray-500">
                          {toNumber(row.sessionsWithAddToCart, 0)} sessions
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        {formatPercent(row.cartToCheckoutRate)}
                        <div className="text-xs text-gray-500">
                          {toNumber(row.sessionsWithCheckout, 0)} sessions
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        {formatPercent(row.clickToPurchaseRate)}
                        <div className="text-xs text-gray-500">
                          {toNumber(row.sessionsWithPurchase, 0)} sessions
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="text-xs text-gray-700">
                          {toNumber(row.guestClickedSessions, 0)} / {toNumber(row.loggedInClickedSessions, 0)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Purchase: {toNumber(row.guestPurchaseSessions, 0)} / {toNumber(row.loggedInPurchaseSessions, 0)}
                        </div>
                      </td>
                      <td className="py-2 pr-3">{formatDuration(row.avgPreClickDwellMs || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyHint text="No rows match current conversion filters." />
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xl font-semibold text-gray-900">Session Explorer</h2>
          <p className="text-sm text-gray-600 mt-1">Browse guest and logged-in sessions, then open one for full drilldown.</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              {["all", "guest", "logged_in"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSessionExplorerType(type);
                    setSessionExplorerPage(1);
                  }}
                  className={`px-4 py-2 text-sm font-semibold ${
                    sessionExplorerType === type ? "bg-blue-600 text-white" : "bg-white text-gray-700"
                  }`}
                >
                  {type === "all" ? "All" : type === "guest" ? "Guest" : "Logged In"}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={sessionExplorerSearchInput}
              onChange={(event) => setSessionExplorerSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleApplySessionSearch();
              }}
              placeholder="Search session ID or user ID"
              className="border border-gray-300 rounded-lg px-3 py-2 w-full md:w-[320px]"
            />

            <button
              type="button"
              onClick={handleApplySessionSearch}
              disabled={sessionExplorerLoading}
              className="bg-slate-800 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
            >
              {sessionExplorerLoading ? "Loading..." : "Apply"}
            </button>
          </div>

          <div className="mt-3 text-xs text-gray-600">
            Sessions: {sessionExplorer?.totals?.all || 0} | Guest: {sessionExplorer?.totals?.guest || 0} | Logged In: {sessionExplorer?.totals?.loggedIn || 0}
          </div>

          <div className="mt-4 overflow-auto">
            {(sessionExplorer?.items || []).length > 0 ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Session</th>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Intent</th>
                    <th className="py-2 pr-3">Started</th>
                    <th className="py-2 pr-3">Last Seen</th>
                    <th className="py-2 pr-3">Events</th>
                    <th className="py-2 pr-3">Page Views</th>
                    <th className="py-2 pr-3">Active Time</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(sessionExplorer?.items || []).map((session) => {
                    const intent = getSessionIntent(session);
                    return (
                      <tr key={session.sessionId} className="border-b border-gray-100 text-gray-700">
                        <td className="py-2 pr-3 break-all">{session.sessionId || "-"}</td>
                        <td className="py-2 pr-3 break-all">{session.userId || "-"}</td>
                        <td className="py-2 pr-3">{session.userId ? "Logged In" : "Guest"}</td>
                        <td className="py-2 pr-3"><StatusPill label={intent.label} className={intent.className} /></td>
                        <td className="py-2 pr-3">{formatDateTime(session.startedAt)}</td>
                        <td className="py-2 pr-3">{formatDateTime(session.lastSeenAt)}</td>
                        <td className="py-2 pr-3">{session.eventCount || 0}</td>
                        <td className="py-2 pr-3">{session.pageViews || 0}</td>
                        <td className="py-2 pr-3">{formatDuration(session.totalActiveTime || 0)}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => handleOpenSession(session.sessionId)} className="px-2.5 py-1 rounded-md bg-blue-600 text-white text-xs font-semibold">Open Session</button>
                            {session.userId ? <button type="button" onClick={() => handleOpenUser(session.userId)} className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs font-semibold">Open User</button> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyHint text="No sessions found for current filters." />
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              Page {sessionExplorer?.pagination?.page || 1} of{" "}
              {sessionExplorer?.pagination?.totalPages || 1}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSessionExplorerPage((prev) => Math.max(prev - 1, 1))}
                disabled={!sessionExplorer?.pagination?.hasPrev || sessionExplorerLoading}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setSessionExplorerPage((prev) => prev + 1)}
                disabled={!sessionExplorer?.pagination?.hasNext || sessionExplorerLoading}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xl font-semibold text-gray-900">User Activity Viewer</h2>
          <p className="text-sm text-gray-600 mt-1">Inspect timeline and top page/section/product behavior for a user or session.</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              <button type="button" onClick={() => setLookupMode("user")} className={`px-4 py-2 text-sm font-semibold ${lookupMode === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}>User ID</button>
              <button type="button" onClick={() => setLookupMode("session")} className={`px-4 py-2 text-sm font-semibold ${lookupMode === "session" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}>Session ID</button>
            </div>

            <input
              type="text"
              value={lookupValue}
              onChange={(event) => setLookupValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") fetchUserView();
              }}
              placeholder={lookupMode === "user" ? "Enter user ID" : "Enter session ID"}
              className="border border-gray-300 rounded-lg px-3 py-2 w-full md:w-[380px]"
            />

            <button type="button" onClick={fetchUserView} disabled={userViewLoading} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60">
              {userViewLoading ? "Loading..." : "Load Activity"}
            </button>

            <input
              type="text"
              value={productIdInput}
              onChange={(event) => setProductIdInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") fetchProductJourney();
              }}
              placeholder="Enter product ID (Mongo _id)"
              className="border border-gray-300 rounded-lg px-3 py-2 w-full md:w-[280px]"
            />

            <button type="button" onClick={fetchProductJourney} disabled={productJourneyLoading} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60">
              {productJourneyLoading ? "Loading..." : "Load Product Journey"}
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Use the product `_id` from your products collection or from `/product/:id` URL.
          </div>

          {(userView.timeline || []).length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-6">
                <MiniMetricCard title="Events" value={timelineInsights.totalEvents} />
                <MiniMetricCard title="Unique Pages" value={timelineInsights.uniquePages} />
                <MiniMetricCard title="Unique Sections" value={timelineInsights.uniqueSections} />
                <MiniMetricCard title="Unique Products" value={timelineInsights.uniqueProducts} />
                <MiniMetricCard title="Add To Cart" value={timelineInsights.addToCart} />
                <MiniMetricCard title="Checkout" value={timelineInsights.checkoutStarted} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
                <InsightCard title="Top Event Types" rows={timelineInsights.eventTypes.slice(0, 10).map((row) => `${row.eventType}: ${row.count}`)} />
                <InsightCard title="Top Pages" rows={timelineInsights.pages.slice(0, 10).map((row) => `${row.path} (${row.events})`)} />
                <InsightCard title="Top Sections" rows={timelineInsights.sections.slice(0, 10).map((row) => `${row.sectionName} (${row.events}, ${formatDuration(row.durationMs)})`)} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                <InsightCard title="Top Click Targets" rows={timelineInsights.clickTargets.slice(0, 10).map((row) => `${row.target} (${row.clicks})`)} />
                <InsightCard title="Sections By Time" rows={timelineInsights.sectionsByDuration.slice(0, 10).map((row) => `${row.sectionName} (${formatDuration(row.durationMs)})`)} />
              </div>

              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Timeline</h3>
                <div className="max-h-80 overflow-auto space-y-2">
                  {(userView.timeline || []).map((event) => {
                    const metadata = event?.metadata || {};
                    const sectionName = resolveEventSectionName(event);
                    const sectionDuration = Math.max(toNumber(metadata?.durationMs, 0), 0);
                    const clickTarget = resolveClickTarget(metadata);
                    const productId = resolveEventProductId(event);
                    const activeTimeMs = Math.max(
                      toNumber(metadata?.activeTimeMs ?? metadata?.pageActiveMs, 0),
                      0,
                    );

                    return (
                      <div key={event.eventId} className="bg-white rounded-md border border-gray-200 p-3">
                        <div className="text-xs text-gray-500">{formatDateTime(event.timestamp)}</div>
                        <div className="text-sm font-semibold text-gray-800">{event.eventType}</div>
                        <div className="text-xs text-gray-600 break-all">Session: {event.sessionId || "-"}</div>
                        {event.pageUrl ? <div className="text-xs text-gray-600 break-all">Page: {normalizePath(event.pageUrl)}</div> : null}

                        {(sectionName || clickTarget || productId || activeTimeMs > 0 || sectionDuration > 0) ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {sectionName ? <EventMetaPill label={`Section: ${sectionName}`} /> : null}
                            {sectionDuration > 0 ? <EventMetaPill label={`Section Time: ${formatDuration(sectionDuration)}`} /> : null}
                            {clickTarget ? <EventMetaPill label={`Click: ${clickTarget}`} /> : null}
                            {activeTimeMs > 0 ? <EventMetaPill label={`Active: ${formatDuration(activeTimeMs)}`} /> : null}
                            {productId ? <EventMetaPill label={`Product: ${productId}`} /> : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Session Summary</h3>
                  {userView.sessionSummary ? (
                    <div className="bg-white rounded-md border border-gray-200 p-3 text-xs text-gray-700 space-y-1">
                      <div className="break-all">{userView.sessionSummary.sessionId || "-"}</div>
                      <div>Started: {formatDateTime(userView.sessionSummary.startedAt)}</div>
                      <div>Last Seen: {formatDateTime(userView.sessionSummary.lastSeenAt)}</div>
                      <div>Active Time: {formatDuration(userView.sessionSummary.totalActiveTime || 0)}</div>
                      <div>
                        Events: {userView.sessionSummary.eventCount || 0} | Page Views:{" "}
                        {userView.sessionSummary.pageViews || 0}
                      </div>
                    </div>
                  ) : (
                    <EmptyHint text="No session summary loaded." />
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Purchase History</h3>
                  {(userView.purchaseHistory || []).length > 0 ? (
                    <div className="max-h-48 overflow-auto space-y-2">
                      {(userView.purchaseHistory || []).map((purchase, index) => (
                        <div
                          key={purchase.eventId || `${purchase.orderId}-${index}`}
                          className="bg-white rounded-md border border-gray-200 p-3 text-xs text-gray-700"
                        >
                          <div>{formatDateTime(purchase.timestamp)}</div>
                          <div className="break-all">Order: {purchase.orderId || "-"}</div>
                          <div>Amount: {formatCurrency(purchase.amount || 0)}</div>
                          <div>Method: {purchase.paymentMethod || "-"}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyHint text="No purchase events for this lookup." />
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-6">
              <EmptyHint text="Open a session/user from Session Explorer or enter an ID to load behavior." />
            </div>
          )}

          {productJourney?.summary ? (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Product Journey</h3>
                  <p className="text-sm text-gray-600">Product: {productJourney?.product?.productName || productJourney?.product?.productId || "-"}</p>
                </div>
                <StatusPill
                  label={productJourney.summary.roamingWithoutCart ? "Roaming Without Cart" : "Has Conversion Signals"}
                  className={
                    productJourney.summary.roamingWithoutCart
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : "bg-emerald-100 text-emerald-800 border-emerald-200"
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <MiniMetricCard title="Product Views" value={productJourney.summary.productViews || 0} />
                <MiniMetricCard title="Unique Sessions" value={productJourney.summary.uniqueSessions || 0} />
                <MiniMetricCard title="Add To Cart" value={productJourney.summary.addToCartCount || 0} />
                <MiniMetricCard title="Purchases" value={productJourney.summary.purchaseCount || 0} />
                <MiniMetricCard title="Avg Hover Time" value={formatDuration(productJourney.summary.avgHoverDurationMs || 0)} />
                <MiniMetricCard title="Total Hover" value={formatDuration(productJourney.summary.totalHoverDurationMs || 0)} />
                <MiniMetricCard title="Checkout Started" value={productJourney.summary.checkoutStartedCount || 0} />
                <MiniMetricCard title="Revenue" value={formatCurrency(productJourney.summary.attributedRevenue || 0)} />
              </div>
            </div>
          ) : null}
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

function UserTypeBehaviorCard({ title, stats, conversionRate, badgeClassName = "" }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-semibold text-gray-900">{title}</div>
        <StatusPill
          label={`Conv ${formatPercent(conversionRate)}`}
          className={badgeClassName}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <MiniMetricCard title="Sessions" value={toNumber(stats?.sessions, 0)} />
        <MiniMetricCard title="Events" value={toNumber(stats?.events, 0)} />
        <MiniMetricCard title="Add To Cart" value={toNumber(stats?.addToCart, 0)} />
        <MiniMetricCard title="Purchases" value={toNumber(stats?.purchases, 0)} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <MiniMetricCard title="Checkout" value={toNumber(stats?.checkoutStarted, 0)} />
        <MiniMetricCard title="Click Events" value={toNumber(stats?.clickEvents, 0)} />
        <MiniMetricCard title="Rage Clicks" value={toNumber(stats?.rageClicks, 0)} />
        <MiniMetricCard title="Avg Session Active" value={formatDuration(stats?.avgSessionActiveTimeMs || 0)} />
      </div>
      <div className="text-xs text-gray-500 mt-3">
        Avg page active at heartbeat: {formatDuration(stats?.avgPageActiveMs || 0)}
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
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

function StatusPill({ label, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function EventMetaPill({ label }) {
  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
      {label}
    </span>
  );
}

function InsightCard({ title, rows = [] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-base font-semibold text-gray-900 mb-3">{title}</h3>
      {rows.length > 0 ? (
        <div className="max-h-60 overflow-auto space-y-2">
          {rows.map((row, index) => (
            <div key={`${title}-${index}`} className="text-sm text-gray-700 bg-gray-50 rounded-md border border-gray-200 px-3 py-2">
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
