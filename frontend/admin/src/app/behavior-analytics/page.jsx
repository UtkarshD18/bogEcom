"use client";

import { useAdmin } from "@/context/AdminContext";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useLiveRefreshSetting } from "@/hooks/useLiveRefreshSetting";
import { getBlobData, getData } from "@/utils/api";
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

const LIVE_BUTTON_FEED_LIMIT = 40;
const LIVE_BUTTON_EVENT_TYPES = new Set([
  "click_event",
  "product_click",
  "banner_click",
  "rage_click",
  "button_hover_start",
  "button_focus",
  "button_blur",
]);

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeString = (value) => String(value || "").trim();

const formatCurrency = (value) =>
  `Rs ${toNumber(value, 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const formatDuration = (milliseconds) => {
  const totalSeconds = Math.max(
    Math.floor(toNumber(milliseconds, 0) / 1000),
    0,
  );
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
      metadata?.buttonLabel ||
      metadata?.targetId ||
      metadata?.target_id ||
      metadata?.text ||
      metadata?.id ||
      metadata?.className ||
      metadata?.tagName ||
      "",
  );

const resolvePreviewTarget = (event = {}) =>
  safeString(
    event?.metadata?.buttonLabel ||
      event?.metadata?.targetId ||
      event?.metadata?.target_id ||
      event?.metadata?.trackName ||
      event?.metadata?.text ||
      event?.metadata?.id ||
      "unknown_target",
  );

const normalizeLiveButtonFeedEntry = (event = {}, index = 0) => {
  const sessionId = safeString(event?.sessionId) || "-";
  const timestamp = event?.timestamp || new Date().toISOString();

  return {
    id:
      safeString(event?.id) ||
      `${sessionId}-${safeString(timestamp) || Date.now()}-${index}`,
    eventType: safeString(event?.eventType || "unknown"),
    target: resolvePreviewTarget(event),
    page: normalizePath(event?.pageUrl || event?.page),
    timestamp,
    sessionId,
    userType: safeString(event?.userId) ? "Logged In" : "Guest",
  };
};

const mergeLiveButtonFeedEntries = (incoming = [], existing = []) => {
  const seen = new Set();
  const merged = [];

  for (const row of [...incoming, ...existing]) {
    const key =
      safeString(row?.id) ||
      `${safeString(row?.eventType)}|${safeString(row?.timestamp)}|${safeString(row?.sessionId)}|${safeString(row?.target)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
    if (merged.length >= LIVE_BUTTON_FEED_LIMIT) break;
  }

  return merged.slice(0, LIVE_BUTTON_FEED_LIMIT);
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const normalizePresetDays = (value, fallback = 30) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const buildRangeQuery = (days) => {
  const normalizedDays = normalizePresetDays(days, 30);
  const todayUtcStart = new Date();
  todayUtcStart.setUTCHours(0, 0, 0, 0);

  const daySpan = Math.max(normalizedDays, 1);
  const from = new Date(todayUtcStart.getTime() - (daySpan - 1) * DAY_IN_MS);
  const to = new Date(todayUtcStart.getTime() + DAY_IN_MS - 1);

  return { from: from.toISOString(), to: to.toISOString(), days: daySpan };
};

const formatDateInput = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const buildRangeFromDates = (startInput, endInput, fallbackDays = 30) => {
  const fallback = buildRangeQuery(fallbackDays);
  const fallbackFrom = new Date(fallback.from);
  const fallbackTo = new Date(fallback.to);

  const start = startInput
    ? new Date(`${startInput}T00:00:00.000Z`)
    : fallbackFrom;
  const end = endInput ? new Date(`${endInput}T23:59:59.999Z`) : fallbackTo;

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return {
      from: fallback.from,
      to: fallback.to,
      days: fallbackDays,
    };
  }

  const days = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );

  return {
    from: start.toISOString(),
    to: end.toISOString(),
    days,
  };
};

const buildYearRange = (year) => {
  const normalizedYear = Number(year);
  if (!Number.isFinite(normalizedYear)) {
    const fallback = buildRangeQuery(30);
    return {
      startDate: formatDateInput(fallback.from),
      endDate: formatDateInput(fallback.to),
    };
  }
  return {
    startDate: formatDateInput(new Date(Date.UTC(normalizedYear, 0, 1))),
    endDate: formatDateInput(new Date(Date.UTC(normalizedYear, 11, 31))),
  };
};

const buildBehaviorAllTimeRange = () => ({
  startDate: "2015-01-01",
  endDate: formatDateInput(new Date()),
});

const getApiErrorMessage = (response, fallback) =>
  [response?.message, response?.details].filter(Boolean).join(" - ") ||
  fallback;

const extractFileNameFromContentDisposition = (headerValue = "") => {
  const raw = String(headerValue || "").trim();
  if (!raw) return "";

  const utf8Match = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }

  const plainMatch = raw.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ? plainMatch[1].trim() : "";
};

const getSessionIntent = (session) => {
  const events = toNumber(session?.eventCount, 0);
  const pages = toNumber(session?.pageViews, 0);
  const activeTime = toNumber(session?.totalActiveTime, 0);

  if (events >= 15 || pages >= 4 || activeTime >= 120000) {
    return {
      label: "High",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (events >= 5 || pages >= 2 || activeTime >= 30000) {
    return {
      label: "Medium",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  return {
    label: "Low",
    className: "bg-slate-50 text-slate-700 border-slate-200",
  };
};

const getWorkerState = (performance) => {
  const total = toNumber(performance?.workerHealth?.totalWorkers, 0);
  const healthy = toNumber(performance?.workerHealth?.healthyWorkers, 0);

  if (!total)
    return {
      label: "No workers",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  if (healthy === total)
    return {
      label: "Healthy",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  if (healthy === 0)
    return {
      label: "Critical",
      className: "bg-rose-50 text-rose-700 border-rose-200",
    };
  return {
    label: "Degraded",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  };
};

const getIngestionState = (performance) => {
  const total = toNumber(performance?.workerHealth?.totalWorkers, 0);
  const healthy = toNumber(performance?.workerHealth?.healthyWorkers, 0);

  if (total > 0 && healthy > 0) {
    return null;
  }

  return {
    label: "Worker inactive, using direct ingestion",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  };
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
      const section = sectionMap.get(sectionName) || {
        sectionName,
        events: 0,
        durationMs: 0,
      };
      section.events += 1;
      section.durationMs += Math.max(toNumber(metadata.durationMs, 0), 0);
      sectionMap.set(sectionName, section);
    }

    const productKey = safeString(
      metadata.productName || resolveEventProductId(event),
    );

    if (
      productKey ||
      [
        "product_view",
        "add_to_cart",
        "checkout_started",
        "purchase_completed",
      ].includes(type)
    ) {
      const key = productKey || "unknown_product";
      const product = productMap.get(key) || { key, events: 0 };
      product.events += 1;
      productMap.set(key, product);
    }

    if (["click_event", "rage_click"].includes(type)) {
      const clickTarget = resolveClickTarget(metadata);
      if (clickTarget) {
        const click = clickTargetMap.get(clickTarget) || {
          target: clickTarget,
          clicks: 0,
        };
        click.clicks += 1;
        clickTargetMap.set(clickTarget, click);
      }
    }
  }

  for (const interaction of productInteractions || []) {
    const key = safeString(
      interaction?.productName || interaction?.productId || "unknown_product",
    );
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
    eventTypes: Array.from(eventTypeMap.entries())
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count),
    pages: Array.from(pageMap.values()).sort((a, b) => b.events - a.events),
    sections: Array.from(sectionMap.values()).sort(
      (a, b) => b.events - a.events,
    ),
    sectionsByDuration: Array.from(sectionMap.values()).sort(
      (a, b) => b.durationMs - a.durationMs,
    ),
    clickTargets: Array.from(clickTargetMap.values()).sort(
      (a, b) => b.clicks - a.clicks,
    ),
    products: Array.from(productMap.values()).sort(
      (a, b) => b.events - a.events,
    ),
  };
};

const buildPlainLanguageSummary = ({
  overview,
  engagement,
  timelineInsights,
}) => {
  const conversionRate = toNumber(overview?.conversionRate, 0);
  const bounceRate = toNumber(overview?.bounceRate, 0);
  const rageClicks = toNumber(engagement?.rageClickCount, 0);
  const addToCart = toNumber(timelineInsights?.addToCart, 0);
  const checkoutStarted = toNumber(timelineInsights?.checkoutStarted, 0);
  const purchases = toNumber(timelineInsights?.purchases, 0);

  const topPage = timelineInsights?.pages?.[0]?.path || "No dominant page yet";
  const topSection =
    timelineInsights?.sections?.[0]?.sectionName || "No dominant section yet";
  const topButton =
    timelineInsights?.clickTargets?.[0]?.target || "No dominant button yet";

  const highlights = [
    `Top customer path: ${topPage}`,
    `Most active section: ${topSection}`,
    `Most clicked button: ${topButton}`,
  ];

  const recommendations = [];
  if (bounceRate >= 55) {
    recommendations.push(
      "Bounce rate is high. Simplify landing content and show a stronger first CTA.",
    );
  }
  if (rageClicks >= 10) {
    recommendations.push(
      "Rage clicks are high. Review button visibility, response speed, and click targets.",
    );
  }
  if (checkoutStarted > addToCart) {
    recommendations.push(
      "Checkout starts exceed add-to-cart. Validate event instrumentation for cart and checkout.",
    );
  }
  if (checkoutStarted > 0 && purchases === 0) {
    recommendations.push(
      "Customers start checkout but do not finish. Audit payment and delivery messaging on checkout.",
    );
  }
  if (conversionRate < 1 && addToCart > 0) {
    recommendations.push(
      "Add-to-cart exists but conversion is low. Test trust badges, delivery promise, and payment clarity.",
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Current flow is stable. Focus next on improving top performing pages and buttons.",
    );
  }

  return {
    highlights,
    recommendations,
  };
};

export default function BehaviorAnalyticsPage() {
  const { token, isAuthenticated, loading: authLoading } = useAdmin();
  const router = useRouter();

  const [rangeDays, setRangeDays] = useState(30);
  const defaultRange = useMemo(() => buildRangeQuery(30), []);
  const [startDate, setStartDate] = useState(
    formatDateInput(defaultRange.from),
  );
  const [endDate, setEndDate] = useState(formatDateInput(defaultRange.to));
  const [yearJump, setYearJump] = useState(String(new Date().getFullYear()));
  const [overview, setOverview] = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(true);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const { intervalMs } = useLiveRefreshSetting();
  const analyticsRefreshConfig = useMemo(
    () => ({
      minIntervalMs: Math.max(intervalMs, 5000),
      fallbackIntervalMs: Math.max(intervalMs * 20, 60000),
    }),
    [intervalMs],
  );
  const sessionsRefreshConfig = useMemo(
    () => ({
      minIntervalMs: Math.max(intervalMs * 3, 15000),
      fallbackIntervalMs: Math.max(intervalMs * 8, 120000),
    }),
    [intervalMs],
  );

  const [lookupMode, setLookupMode] = useState("user");
  const [lookupValue, setLookupValue] = useState("");
  const [productIdInput, setProductIdInput] = useState("");
  const [userViewLoading, setUserViewLoading] = useState(false);
  const [userView, setUserView] = useState(defaultUserViewState);

  const [sessionExplorerType, setSessionExplorerType] = useState("all");
  const [sessionExplorerSearchInput, setSessionExplorerSearchInput] =
    useState("");
  const [sessionExplorerSearch, setSessionExplorerSearch] = useState("");
  const [sessionExplorerPage, setSessionExplorerPage] = useState(1);
  const [sessionExplorerLoading, setSessionExplorerLoading] = useState(false);
  const [sessionExplorer, setSessionExplorer] = useState(
    defaultSessionsExplorerState,
  );

  const [productJourneyLoading, setProductJourneyLoading] = useState(false);
  const [productJourney, setProductJourney] = useState(
    defaultProductJourneyState,
  );
  const [liveButtonFeed, setLiveButtonFeed] = useState([]);
  const [funnelTypeFilter, setFunnelTypeFilter] = useState("all");
  const [funnelMinSessionsInput, setFunnelMinSessionsInput] = useState("1");
  const [funnelSearchInput, setFunnelSearchInput] = useState("");

  const workerState = useMemo(() => getWorkerState(performance), [performance]);
  const ingestionState = useMemo(
    () => getIngestionState(performance),
    [performance],
  );
  const timelineInsights = useMemo(
    () =>
      buildTimelineInsights(
        userView.timeline || [],
        userView.productInteractions || [],
      ),
    [userView.timeline, userView.productInteractions],
  );
  const guestStats = useMemo(
    () => resolveUserTypeStats(engagement, "guest"),
    [engagement],
  );
  const loggedInStats = useMemo(
    () => resolveUserTypeStats(engagement, "logged_in"),
    [engagement],
  );
  const attractiveButtons = useMemo(
    () =>
      Array.isArray(engagement?.attractiveButtons)
        ? engagement.attractiveButtons
        : [],
    [engagement],
  );
  const bannerPerformance = useMemo(
    () =>
      Array.isArray(engagement?.bannerPerformance)
        ? engagement.bannerPerformance
        : [],
    [engagement],
  );
  const topConvertingButtonsByProduct = useMemo(
    () =>
      Array.isArray(engagement?.topConvertingButtonsByProduct)
        ? engagement.topConvertingButtonsByProduct
        : [],
    [engagement],
  );
  const movementByEvent = useMemo(
    () => engagement?.movementByEvent || {},
    [engagement],
  );
  const movementRows = useMemo(
    () =>
      Object.entries(movementByEvent || {}).map(([eventName, value]) => ({
        eventName,
        total: toNumber(value?.total, 0),
        guest: toNumber(value?.guest, 0),
        loggedIn: toNumber(value?.loggedIn, 0),
        avgDurationMs: toNumber(value?.avgDurationMs, 0),
      })),
    [movementByEvent],
  );
  const movementTargets = useMemo(
    () =>
      Array.isArray(engagement?.movementTargets)
        ? engagement.movementTargets
        : [],
    [engagement],
  );
  const filteredTopConvertingButtonsByProduct = useMemo(() => {
    const minSessions = Math.max(
      Math.floor(toNumber(funnelMinSessionsInput, 1)),
      1,
    );
    const search = safeString(funnelSearchInput).toLowerCase();

    return topConvertingButtonsByProduct.filter((row) => {
      if (toNumber(row?.sessionsClicked, 0) < minSessions) {
        return false;
      }

      if (
        funnelTypeFilter === "guest" &&
        toNumber(row?.guestClickedSessions, 0) <= 0
      ) {
        return false;
      }

      if (
        funnelTypeFilter === "logged_in" &&
        toNumber(row?.loggedInClickedSessions, 0) <= 0
      ) {
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
  const plainLanguageSummary = useMemo(
    () => buildPlainLanguageSummary({ overview, engagement, timelineInsights }),
    [overview, engagement, timelineInsights],
  );
  const selectedRange = useMemo(
    () => buildRangeFromDates(startDate, endDate, rangeDays),
    [startDate, endDate, rangeDays],
  );
  const behaviorRangePresets = useMemo(
    () => [
      { label: "Today", type: "days", value: 0 },
      { label: "7D", type: "days", value: 7 },
      { label: "30D", type: "days", value: 30 },
      { label: "90D", type: "days", value: 90 },
      { label: "1Y", type: "days", value: 365 },
      { label: "2Y", type: "days", value: 730 },
      { label: "This Year", type: "year", value: new Date().getFullYear() },
      { label: "Last Year", type: "year", value: new Date().getFullYear() - 1 },
      { label: "All Time", type: "allTime", value: null },
    ],
    [],
  );
  const yearOptions = useMemo(() => {
    const years = [];
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 2015; year -= 1)
      years.push(String(year));
    return years;
  }, []);

  const applyBehaviorRange = useCallback((range) => {
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }, []);

  const applyBehaviorPreset = useCallback(
    (preset) => {
      if (!preset) return;
      if (preset.type === "allTime") {
        applyBehaviorRange(buildBehaviorAllTimeRange());
        setRangeDays(3650);
        return;
      }
      if (preset.type === "year") {
        const year = String(preset.value || "");
        setYearJump(year);
        applyBehaviorRange(buildYearRange(year));
        setRangeDays(365);
        return;
      }
      const presetDays = normalizePresetDays(preset.value, 30);
      const nextRange = buildRangeQuery(presetDays);
      applyBehaviorRange({
        startDate: formatDateInput(nextRange.from),
        endDate: formatDateInput(nextRange.to),
      });
      setRangeDays(presetDays);
    },
    [applyBehaviorRange],
  );

  const fetchAnalytics = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError("");
      } else {
        setRefreshing(true);
      }

      const nextRange = selectedRange;
      const params = `from=${encodeURIComponent(nextRange.from)}&to=${encodeURIComponent(nextRange.to)}`;

      try {
        const [overviewRes, engagementRes, performanceRes] = await Promise.all([
          getData(`/api/admin/analytics/behavior/overview?${params}`, token),
          getData(`/api/admin/analytics/behavior/engagement?${params}`, token),
          getData(`/api/admin/analytics/behavior/performance`, token),
        ]);

        const failures = [];

        if (overviewRes?.success) {
          setOverview(overviewRes.data);
        } else {
          failures.push(
            getApiErrorMessage(overviewRes, "Failed to load behavior overview"),
          );
        }

        if (engagementRes?.success) {
          setEngagement(engagementRes.data);
        } else {
          failures.push(
            getApiErrorMessage(
              engagementRes,
              "Failed to load behavior engagement data",
            ),
          );
        }

        if (performanceRes?.success) {
          setPerformance(performanceRes.data);
          if (Array.isArray(performanceRes.data?.recentButtonEvents)) {
            const mappedRecentEvents = performanceRes.data.recentButtonEvents
              .slice()
              .reverse()
              .map((event, index) =>
                normalizeLiveButtonFeedEntry(event, index),
              );
            setLiveButtonFeed((prev) =>
              mergeLiveButtonFeedEntries(mappedRecentEvents, prev),
            );
          }
        } else {
          failures.push(
            getApiErrorMessage(
              performanceRes,
              "Failed to load behavior performance",
            ),
          );
        }

        // Keep existing data rendered when one endpoint has a transient issue.
        if (failures.length === 3) {
          setError(failures[0]);
        } else {
          setError("");
        }
      } catch (requestError) {
        setError(requestError?.message || "Failed to load behavior analytics");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedRange, token],
  );

  const refreshLiveSections = useCallback(() => {
    fetchAnalytics({ silent: true });
  }, [fetchAnalytics]);

  const fetchSessionExplorer = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setSessionExplorerLoading(true);
        setError("");
      }

      const nextRange = selectedRange;
      const params = new URLSearchParams({
        from: nextRange.from,
        to: nextRange.to,
        type: sessionExplorerType,
        page: String(sessionExplorerPage),
        limit: "25",
      });

      if (sessionExplorerSearch) params.set("q", sessionExplorerSearch);

      try {
        const response = await getData(
          `/api/admin/analytics/behavior/sessions?${params.toString()}`,
          token,
        );
        if (!response?.success) {
          throw new Error(
            getApiErrorMessage(response, "Failed to load sessions"),
          );
        }
        setSessionExplorer({
          ...defaultSessionsExplorerState,
          ...response.data,
        });
      } catch (requestError) {
        setError(requestError?.message || "Failed to load sessions");
        setSessionExplorer(defaultSessionsExplorerState);
      } finally {
        if (!silent) {
          setSessionExplorerLoading(false);
        }
      }
    },
    [
      selectedRange,
      sessionExplorerType,
      sessionExplorerPage,
      sessionExplorerSearch,
      token,
    ],
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) fetchAnalytics();
  }, [fetchAnalytics, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) fetchSessionExplorer();
  }, [fetchSessionExplorer, isAuthenticated]);

  const { trigger: triggerAnalyticsRefresh } = useLiveRefresh(
    () => fetchAnalytics({ silent: true }),
    analyticsRefreshConfig,
  );

  const { trigger: triggerSessionsRefresh } = useLiveRefresh(
    () => fetchSessionExplorer({ silent: true }),
    sessionsRefreshConfig,
  );

  const handleAnalyticsBatch = useCallback(
    (payload = {}) => {
      const previewEvents = Array.isArray(payload?.eventsPreview)
        ? payload.eventsPreview
        : [];
      if (previewEvents.length > 0) {
        const mapped = previewEvents
          .slice()
          .reverse()
          .filter((event) =>
            LIVE_BUTTON_EVENT_TYPES.has(safeString(event?.eventType)),
          )
          .map((event, index) => normalizeLiveButtonFeedEntry(event, index));

        if (mapped.length > 0) {
          setLiveButtonFeed((prev) => mergeLiveButtonFeedEntries(mapped, prev));
        }
      }

      triggerAnalyticsRefresh();
      triggerSessionsRefresh();
    },
    [triggerAnalyticsRefresh, triggerSessionsRefresh],
  );

  useAdminRealtime({ token, onAnalyticsBatch: handleAnalyticsBatch });

  const fetchUserViewByLookup = async (mode, rawLookupValue) => {
    const normalizedMode = mode === "session" ? "session" : "user";
    const normalizedLookup = safeString(rawLookupValue);

    if (!normalizedLookup) {
      setError(
        `${normalizedMode === "user" ? "User ID" : "Session ID"} is required`,
      );
      return;
    }

    setUserViewLoading(true);
    setError("");

    const query =
      normalizedMode === "user"
        ? `userId=${encodeURIComponent(normalizedLookup)}`
        : `sessionId=${encodeURIComponent(normalizedLookup)}`;

    try {
      const response = await getData(
        `/api/admin/analytics/behavior/user-activity?${query}&limit=3000`,
        token,
      );
      if (!response?.success) {
        throw new Error(
          getApiErrorMessage(response, "Failed to load user activity"),
        );
      }
      setUserView({ ...defaultUserViewState, ...response.data });
    } catch (requestError) {
      setError(requestError?.message || "Failed to load user activity");
      setUserView(defaultUserViewState);
    } finally {
      setUserViewLoading(false);
    }
  };

  const fetchUserView = async () =>
    fetchUserViewByLookup(lookupMode, lookupValue);

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
      setError(
        `${lookupMode === "user" ? "User ID" : "Session ID"} is required`,
      );
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

    const nextRange = selectedRange;
    const rangeParams = `from=${encodeURIComponent(nextRange.from)}&to=${encodeURIComponent(nextRange.to)}`;

    try {
      const response = await getData(
        `/api/admin/analytics/behavior/product-journey?${identityQuery}&productId=${encodeURIComponent(normalizedProductId)}&${rangeParams}&limit=2000`,
        token,
      );

      if (!response?.success) {
        throw new Error(
          getApiErrorMessage(response, "Failed to load product journey"),
        );
      }

      setProductJourney({ ...defaultProductJourneyState, ...response.data });
    } catch (requestError) {
      setError(requestError?.message || "Failed to load product journey");
      setProductJourney(defaultProductJourneyState);
    } finally {
      setProductJourneyLoading(false);
    }
  };

  const handleDownloadObservationPdf = async () => {
    setDownloadingReport(true);
    setError("");

    try {
      const query = new URLSearchParams({
        from: selectedRange.from,
        to: selectedRange.to,
      });

      const response = await getBlobData(
        `/api/admin/analytics/behavior/export-report?${query.toString()}`,
        token,
      );

      if (!response?.success || !response?.blob) {
        throw new Error(
          response?.message || "Failed to download behavior analytics PDF",
        );
      }

      const contentDisposition =
        response?.headers?.["content-disposition"] || "";
      const fileNameFromHeader =
        extractFileNameFromContentDisposition(contentDisposition);
      const fallbackFileName = `behavior-analytics-observations-${startDate || "from"}-to-${endDate || "to"}.pdf`;
      const fileName = fileNameFromHeader || fallbackFileName;

      const blobUrl = window.URL.createObjectURL(response.blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (downloadError) {
      setError(
        downloadError?.message || "Failed to download behavior analytics PDF",
      );
    } finally {
      setDownloadingReport(false);
    }
  };

  if (authLoading || loading) return <LoadingSpinner />;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Customer Behavior Insights
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Understand where shoppers engage, where they drop, and what to
              improve next.
            </p>
            <div className="mt-3">
              <StatusPill
                label={`Worker: ${workerState.label}`}
                className={workerState.className}
              />
              {ingestionState ? (
                <StatusPill
                  label={ingestionState.label}
                  className={`ml-2 ${ingestionState.className}`}
                />
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2 justify-end">
              {behaviorRangePresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyBehaviorPreset(preset)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold transition bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                }}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                }}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
              />
              <select
                value={yearJump}
                onChange={(event) => {
                  const year = String(event.target.value || "");
                  setYearJump(year);
                  applyBehaviorRange(buildYearRange(year));
                }}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500">
                {selectedRange.days} days
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Download Traffic Observation PDF
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Download observation report for current behavior date range with
            visitor count, time spent, top clicked button, and top interacted
            product.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-gray-600">
              From: {startDate || "-"} | To: {endDate || "-"}
            </div>
            <button
              type="button"
              onClick={handleDownloadObservationPdf}
              disabled={downloadingReport}
              className="bg-slate-900 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
            >
              {downloadingReport
                ? "Preparing PDF..."
                : "Download Observation PDF"}
            </button>
          </div>
        </div>

        {refreshing ? (
          <div className="text-xs text-gray-500">Refreshing live data...</div>
        ) : null}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Quick Guide</h2>
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
                  "Total sessions and active users show how much quality traffic you have.",
                  "Bounce and conversion tell you whether visitors are moving toward purchase.",
                ]}
              />
              <GuideCard
                title="Session Explorer"
                lines={[
                  "Filter by All, Guest, or Logged In to compare behavior quickly.",
                  "Open any session to see the exact journey step by step.",
                ]}
              />
              <GuideCard
                title="Pages, Buttons, Products"
                lines={[
                  "Use timeline cards to find top pages and sections.",
                  "Use top button reports to identify strongest call-to-action placements.",
                  "Use product conversion funnel to find winning and weak product CTAs.",
                  "Load Product Journey to understand one product end-to-end.",
                ]}
              />
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <PlainLanguageCard
            title="What Happened"
            rows={plainLanguageSummary.highlights}
          />
          <PlainLanguageCard
            title="What To Do Next"
            rows={plainLanguageSummary.recommendations}
          />
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <MetricCard
            title="Total Sessions"
            value={overview?.totalSessions || 0}
            hint="Guest + logged-in sessions with meaningful tracked activity."
          />
          <MetricCard
            title="Active Users"
            value={overview?.activeUsers || 0}
            hint="Recently active logged-in users."
          />
          <MetricCard
            title="Average Active Time"
            value={formatDuration(overview?.avgActiveTimeMs || 0)}
            hint="Active time, not idle open tab time."
          />
          <MetricCard
            title="Bounce Rate"
            value={`${toNumber(overview?.bounceRate, 0).toFixed(2)}%`}
            hint="Lower is better."
          />
          <MetricCard
            title="Conversion Rate"
            value={`${toNumber(overview?.conversionRate, 0).toFixed(2)}%`}
            hint="Share of sessions that completed a purchase."
          />
          <MetricCard
            title="Revenue"
            value={formatCurrency(overview?.revenue || 0)}
            hint="Tracked purchase amount."
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <MetricCard
            title="Avg Time Per Product"
            value={formatDuration(engagement?.avgTimePerProductMs || 0)}
            hint="Hover/product interaction depth."
          />
          <MetricCard
            title="Avg Scroll Depth"
            value={`${toNumber(engagement?.avgScrollDepth, 0).toFixed(1)}%`}
            hint="How far users scroll."
          />
          <MetricCard
            title="Rage Click Count"
            value={engagement?.rageClickCount || 0}
            hint="Possible UX friction."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Drop-Off Rate"
            value={`${toNumber(engagement?.dropOffRate ?? engagement?.drop_off_rate, 0).toFixed(2)}%`}
            hint="Sessions that did not reach purchase."
          />
          <MetricCard
            title="Guest Drop-Off"
            value={`${toNumber(engagement?.dropOffRateGuest, 0).toFixed(2)}%`}
            hint="Guest-only session drop-off."
          />
          <MetricCard
            title="Logged-In Drop-Off"
            value={`${toNumber(engagement?.dropOffRateLoggedIn, 0).toFixed(2)}%`}
            hint="Logged-in session drop-off."
          />
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
          <ChartCard
            title="Events Per Minute (Last 60 Minutes)"
            actions={
              <button
                type="button"
                onClick={refreshLiveSections}
                disabled={refreshing}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-sm font-semibold text-gray-700 disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            }
          >
            {(performance?.eventsPerMinute || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={performance?.eventsPerMinute || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="minute" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="events"
                    stroke="#2563eb"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyHint text="No events in the last 60 minutes." />
            )}
          </ChartCard>

          <ChartCard title="Section Engagement (Top)">
            {(engagement?.sectionEngagementHeatmap || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={(engagement?.sectionEngagementHeatmap || []).slice(
                    0,
                    12,
                  )}
                >
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
              <h2 className="text-xl font-semibold text-gray-900">
                Most Interacted Buttons
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Button-level view of where users click, hover, and focus most.
              </p>
            </div>
            <button
              type="button"
              onClick={refreshLiveSections}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm font-semibold text-gray-700 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {movementTargets.length > 0 ? (
            <div className="mt-4 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Button Target</th>
                    <th className="py-2 pr-3">Total Movement Events</th>
                    <th className="py-2 pr-3">Guest</th>
                    <th className="py-2 pr-3">Logged In</th>
                  </tr>
                </thead>
                <tbody>
                  {movementTargets.map((row) => (
                    <tr
                      key={`${row.target}-${row.total}`}
                      className="border-b border-gray-100 text-gray-700"
                    >
                      <td className="py-2 pr-3 font-medium break-all">
                        {row.target}
                      </td>
                      <td className="py-2 pr-3">{toNumber(row.total, 0)}</td>
                      <td className="py-2 pr-3">{toNumber(row.guest, 0)}</td>
                      <td className="py-2 pr-3">{toNumber(row.loggedIn, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyHint text="No per-button movement targets captured for this range." />
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Live Button Activity Feed
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Real-time click, hover, and focus activity from current
                sessions.
              </p>
            </div>
            <button
              type="button"
              onClick={refreshLiveSections}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm font-semibold text-gray-700 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {liveButtonFeed.length > 0 ? (
            <div className="mt-4 overflow-auto max-h-96">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Event</th>
                    <th className="py-2 pr-3">Button Target</th>
                    <th className="py-2 pr-3">User Type</th>
                    <th className="py-2 pr-3">Session</th>
                    <th className="py-2 pr-3">Page</th>
                  </tr>
                </thead>
                <tbody>
                  {liveButtonFeed.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 text-gray-700 align-top"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatDateTime(row.timestamp)}
                      </td>
                      <td className="py-2 pr-3 font-medium">{row.eventType}</td>
                      <td className="py-2 pr-3 break-all">{row.target}</td>
                      <td className="py-2 pr-3">{row.userType}</td>
                      <td className="py-2 pr-3 break-all">{row.sessionId}</td>
                      <td className="py-2 pr-3 break-all">{row.page}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyHint text="Live feed will populate as users click, hover, or focus buttons." />
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Button Movement Events
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Hover and focus activity split by guest and logged-in users.
              </p>
            </div>
          </div>

          {movementRows.length > 0 ? (
            <div className="mt-4 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Event</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Guest</th>
                    <th className="py-2 pr-3">Logged In</th>
                    <th className="py-2 pr-3">Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {movementRows.map((row) => (
                    <tr
                      key={row.eventName}
                      className="border-b border-gray-100 text-gray-700"
                    >
                      <td className="py-2 pr-3 font-medium">{row.eventName}</td>
                      <td className="py-2 pr-3">{toNumber(row.total, 0)}</td>
                      <td className="py-2 pr-3">{toNumber(row.guest, 0)}</td>
                      <td className="py-2 pr-3">{toNumber(row.loggedIn, 0)}</td>
                      <td className="py-2 pr-3">
                        {formatDuration(row.avgDurationMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyHint text="No movement events captured for this range." />
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Most Attractive Buttons
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Ranked by interaction quality: clicks, rage clicks, and
                attention time.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Range: {selectedRange.days} days
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
                    <tr
                      key={`${row.target}-${row.score}`}
                      className="border-b border-gray-100 text-gray-700 align-top"
                    >
                      <td className="py-2 pr-3">
                        <div className="font-semibold break-all">
                          {row.target}
                        </div>
                        <div className="text-xs text-gray-500">
                          Score: {toNumber(row.score, 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        {toNumber(row.totalInteractions, 0)}
                      </td>
                      <td className="py-2 pr-3">
                        {formatDuration(row.avgPreClickDwellMs || 0)}
                      </td>
                      <td className="py-2 pr-3">
                        {toNumber(row.rageClicks, 0)}
                      </td>
                      <td className="py-2 pr-3">
                        {toNumber(row.guestInteractions, 0)}
                      </td>
                      <td className="py-2 pr-3">
                        {toNumber(row.loggedInInteractions, 0)}
                      </td>
                      <td className="py-2 pr-3">
                        {(row.topSections || []).length > 0 ? (
                          <div className="space-y-1">
                            {row.topSections.map((section) => (
                              <div
                                key={`${row.target}-${section}`}
                                className="text-xs text-gray-700 break-all"
                              >
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
                              <div
                                key={`${row.target}-${product}`}
                                className="text-xs text-gray-700 break-all"
                              >
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
              <h2 className="text-xl font-semibold text-gray-900">
                Banner Performance
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Banner click engagement split by guest and logged-in visitors.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Range: {selectedRange.days} days
            </div>
          </div>

          {bannerPerformance.length > 0 ? (
            <div className="mt-4 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Banner</th>
                    <th className="py-2 pr-3">Campaign / Position</th>
                    <th className="py-2 pr-3">Interactions</th>
                    <th className="py-2 pr-3">Clicks</th>
                    <th className="py-2 pr-3">Rage Clicks</th>
                    <th className="py-2 pr-3">Guest</th>
                    <th className="py-2 pr-3">Logged In</th>
                    <th className="py-2 pr-3">Avg Pre-Click Dwell</th>
                  </tr>
                </thead>
                <tbody>
                  {bannerPerformance.slice(0, 20).map((row) => (
                    <tr
                      key={`${row.bannerId || row.bannerName || "banner"}-${row.bannerPosition || ""}`}
                      className="border-b border-gray-100 text-gray-700 align-top"
                    >
                      <td className="py-2 pr-3">
                        <div className="font-semibold break-all">
                          {row.bannerName || row.bannerId || "-"}
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {row.bannerId || "-"}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="text-xs text-gray-700 break-all">
                          {row.bannerCampaign || "-"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {row.bannerPosition || "-"}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        {toNumber(row.totalInteractions, 0)}
                      </td>
                      <td className="py-2 pr-3">{toNumber(row.clicks, 0)}</td>
                      <td className="py-2 pr-3">
                        {toNumber(row.rageClicks, 0)}
                      </td>
                      <td className="py-2 pr-3">
                        {toNumber(row.guestInteractions, 0)}
                      </td>
                      <td className="py-2 pr-3">
                        {toNumber(row.loggedInInteractions, 0)}
                      </td>
                      <td className="py-2 pr-3">
                        {formatDuration(row.avgPreClickDwellMs || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyHint text="No banner click interactions available for this range." />
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Top Converting Button By Product
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Product-wise funnel from click to add-to-cart to checkout to
                purchase.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Range: {selectedRange.days} days
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
                  {type === "all"
                    ? "All"
                    : type === "guest"
                      ? "Guest"
                      : "Logged In"}
                </button>
              ))}
            </div>

            <input
              type="number"
              min={1}
              step={1}
              value={funnelMinSessionsInput}
              onChange={(event) =>
                setFunnelMinSessionsInput(event.target.value)
              }
              placeholder="Min clicked sessions"
              className="border border-gray-300 rounded-lg px-3 py-2 w-42.5"
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
            Showing {filteredTopConvertingButtonsByProduct.length} of{" "}
            {topConvertingButtonsByProduct.length} rows
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
                  {filteredTopConvertingButtonsByProduct
                    .slice(0, 25)
                    .map((row) => (
                      <tr
                        key={`${row.target}-${row.productId}`}
                        className="border-b border-gray-100 text-gray-700 align-top"
                      >
                        <td className="py-2 pr-3">
                          <div className="font-semibold break-all">
                            {row.target || "-"}
                          </div>
                          <div className="text-xs text-gray-500">
                            Clicks: {toNumber(row.totalClickEvents, 0)}
                          </div>
                        </td>
                        <td className="py-2 pr-3 break-all">
                          {row.productId || "-"}
                        </td>
                        <td className="py-2 pr-3">
                          {toNumber(row.sessionsClicked, 0)}
                        </td>
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
                            {toNumber(row.guestClickedSessions, 0)} /{" "}
                            {toNumber(row.loggedInClickedSessions, 0)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Purchase: {toNumber(row.guestPurchaseSessions, 0)} /{" "}
                            {toNumber(row.loggedInPurchaseSessions, 0)}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          {formatDuration(row.avgPreClickDwellMs || 0)}
                        </td>
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
          <h2 className="text-xl font-semibold text-gray-900">
            Session Explorer
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Browse guest and logged-in sessions, then open one for full
            drilldown.
          </p>

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
                    sessionExplorerType === type
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700"
                  }`}
                >
                  {type === "all"
                    ? "All"
                    : type === "guest"
                      ? "Guest"
                      : "Logged In"}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={sessionExplorerSearchInput}
              onChange={(event) =>
                setSessionExplorerSearchInput(event.target.value)
              }
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
            Sessions: {sessionExplorer?.totals?.all || 0} | Guest:{" "}
            {sessionExplorer?.totals?.guest || 0} | Logged In:{" "}
            {sessionExplorer?.totals?.loggedIn || 0}
          </div>

          <div className="mt-4 overflow-auto">
            {(sessionExplorer?.items || []).length > 0 ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Session</th>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">IP</th>
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
                      <tr
                        key={session.sessionId}
                        className="border-b border-gray-100 text-gray-700"
                      >
                        <td className="py-2 pr-3 break-all">
                          {session.sessionId || "-"}
                        </td>
                        <td className="py-2 pr-3 break-all">
                          {session.userId || "-"}
                        </td>
                        <td className="py-2 pr-3 break-all text-xs">
                          {session.ipAddress || "-"}
                        </td>
                        <td className="py-2 pr-3">
                          {session.userId ? "Logged In" : "Guest"}
                        </td>
                        <td className="py-2 pr-3">
                          <StatusPill
                            label={intent.label}
                            className={intent.className}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          {formatDateTime(session.startedAt)}
                        </td>
                        <td className="py-2 pr-3">
                          {formatDateTime(session.lastSeenAt)}
                        </td>
                        <td className="py-2 pr-3">{session.eventCount || 0}</td>
                        <td className="py-2 pr-3">{session.pageViews || 0}</td>
                        <td className="py-2 pr-3">
                          {formatDuration(session.totalActiveTime || 0)}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenSession(session.sessionId)
                              }
                              className="px-2.5 py-1 rounded-md bg-blue-600 text-white text-xs font-semibold"
                            >
                              Open Session
                            </button>
                            {session.userId ? (
                              <button
                                type="button"
                                onClick={() => handleOpenUser(session.userId)}
                                className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs font-semibold"
                              >
                                Open User
                              </button>
                            ) : null}
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
                onClick={() =>
                  setSessionExplorerPage((prev) => Math.max(prev - 1, 1))
                }
                disabled={
                  !sessionExplorer?.pagination?.hasPrev ||
                  sessionExplorerLoading
                }
                className="px-3 py-1.5 rounded-md border border-gray-300 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setSessionExplorerPage((prev) => prev + 1)}
                disabled={
                  !sessionExplorer?.pagination?.hasNext ||
                  sessionExplorerLoading
                }
                className="px-3 py-1.5 rounded-md border border-gray-300 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xl font-semibold text-gray-900">
            User Activity Viewer
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Inspect timeline and top page/section/product behavior for a user or
            session.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setLookupMode("user")}
                className={`px-4 py-2 text-sm font-semibold ${lookupMode === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
              >
                User ID
              </button>
              <button
                type="button"
                onClick={() => setLookupMode("session")}
                className={`px-4 py-2 text-sm font-semibold ${lookupMode === "session" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
              >
                Session ID
              </button>
            </div>

            <input
              type="text"
              value={lookupValue}
              onChange={(event) => setLookupValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") fetchUserView();
              }}
              placeholder={
                lookupMode === "user" ? "Enter user ID" : "Enter session ID"
              }
              className="border border-gray-300 rounded-lg px-3 py-2 w-full md:w-95"
            />

            <button
              type="button"
              onClick={fetchUserView}
              disabled={userViewLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
            >
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
              className="border border-gray-300 rounded-lg px-3 py-2 w-full md:w-70"
            />

            <button
              type="button"
              onClick={fetchProductJourney}
              disabled={productJourneyLoading}
              className="bg-slate-800 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
            >
              {productJourneyLoading ? "Loading..." : "Load Product Journey"}
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Use the product `_id` from your products collection or from
            `/product/:id` URL.
          </div>

          {(userView.timeline || []).length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-6">
                <MiniMetricCard
                  title="Events"
                  value={timelineInsights.totalEvents}
                />
                <MiniMetricCard
                  title="Unique Pages"
                  value={timelineInsights.uniquePages}
                />
                <MiniMetricCard
                  title="Unique Sections"
                  value={timelineInsights.uniqueSections}
                />
                <MiniMetricCard
                  title="Unique Products"
                  value={timelineInsights.uniqueProducts}
                />
                <MiniMetricCard
                  title="Added To Cart"
                  value={timelineInsights.addToCart}
                />
                <MiniMetricCard
                  title="Checkout Started"
                  value={timelineInsights.checkoutStarted}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
                <InsightCard
                  title="Most Common Actions"
                  rows={timelineInsights.eventTypes
                    .slice(0, 10)
                    .map((row) => `${row.eventType}: ${row.count}`)}
                />
                <InsightCard
                  title="Most Visited Pages"
                  rows={timelineInsights.pages
                    .slice(0, 10)
                    .map((row) => `${row.path} (${row.events})`)}
                />
                <InsightCard
                  title="Most Active Sections"
                  rows={timelineInsights.sections
                    .slice(0, 10)
                    .map(
                      (row) =>
                        `${row.sectionName} (${row.events}, ${formatDuration(row.durationMs)})`,
                    )}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                <InsightCard
                  title="Most Clicked Targets"
                  rows={timelineInsights.clickTargets
                    .slice(0, 10)
                    .map((row) => `${row.target} (${row.clicks})`)}
                />
                <InsightCard
                  title="Sections With Highest Time Spent"
                  rows={timelineInsights.sectionsByDuration
                    .slice(0, 10)
                    .map(
                      (row) =>
                        `${row.sectionName} (${formatDuration(row.durationMs)})`,
                    )}
                />
              </div>

              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Timeline</h3>
                <div className="max-h-80 overflow-auto space-y-2">
                  {(userView.timeline || []).map((event) => {
                    const metadata = event?.metadata || {};
                    const sectionName = resolveEventSectionName(event);
                    const sectionDuration = Math.max(
                      toNumber(metadata?.durationMs, 0),
                      0,
                    );
                    const clickTarget = resolveClickTarget(metadata);
                    const productId = resolveEventProductId(event);
                    const activeTimeMs = Math.max(
                      toNumber(
                        metadata?.activeTimeMs ?? metadata?.pageActiveMs,
                        0,
                      ),
                      0,
                    );

                    return (
                      <div
                        key={event.eventId}
                        className="bg-white rounded-md border border-gray-200 p-3"
                      >
                        <div className="text-xs text-gray-500">
                          {formatDateTime(event.timestamp)}
                        </div>
                        <div className="text-sm font-semibold text-gray-800">
                          {event.eventType}
                        </div>
                        <div className="text-xs text-gray-600 break-all">
                          Session: {event.sessionId || "-"}
                        </div>
                        {event.pageUrl ? (
                          <div className="text-xs text-gray-600 break-all">
                            Page: {normalizePath(event.pageUrl)}
                          </div>
                        ) : null}

                        {sectionName ||
                        clickTarget ||
                        productId ||
                        activeTimeMs > 0 ||
                        sectionDuration > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {sectionName ? (
                              <EventMetaPill
                                label={`Section: ${sectionName}`}
                              />
                            ) : null}
                            {sectionDuration > 0 ? (
                              <EventMetaPill
                                label={`Section Time: ${formatDuration(sectionDuration)}`}
                              />
                            ) : null}
                            {clickTarget ? (
                              <EventMetaPill label={`Click: ${clickTarget}`} />
                            ) : null}
                            {activeTimeMs > 0 ? (
                              <EventMetaPill
                                label={`Active: ${formatDuration(activeTimeMs)}`}
                              />
                            ) : null}
                            {productId ? (
                              <EventMetaPill label={`Product: ${productId}`} />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Session Snapshot
                  </h3>
                  {userView.sessionSummary ? (
                    <div className="bg-white rounded-md border border-gray-200 p-3 text-xs text-gray-700 space-y-1">
                      <div className="break-all">
                        {userView.sessionSummary.sessionId || "-"}
                      </div>
                      <div>
                        Started:{" "}
                        {formatDateTime(userView.sessionSummary.startedAt)}
                      </div>
                      <div>
                        Last Seen:{" "}
                        {formatDateTime(userView.sessionSummary.lastSeenAt)}
                      </div>
                      <div>
                        Active Time:{" "}
                        {formatDuration(
                          userView.sessionSummary.totalActiveTime || 0,
                        )}
                      </div>
                      <div>
                        Events: {userView.sessionSummary.eventCount || 0} | Page
                        Views: {userView.sessionSummary.pageViews || 0}
                      </div>
                    </div>
                  ) : (
                    <EmptyHint text="No session summary loaded." />
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Purchase History
                  </h3>
                  {(userView.purchaseHistory || []).length > 0 ? (
                    <div className="max-h-48 overflow-auto space-y-2">
                      {(userView.purchaseHistory || []).map(
                        (purchase, index) => (
                          <div
                            key={
                              purchase.eventId || `${purchase.orderId}-${index}`
                            }
                            className="bg-white rounded-md border border-gray-200 p-3 text-xs text-gray-700"
                          >
                            <div>{formatDateTime(purchase.timestamp)}</div>
                            <div className="break-all">
                              Order: {purchase.orderId || "-"}
                            </div>
                            <div>
                              Amount: {formatCurrency(purchase.amount || 0)}
                            </div>
                            <div>Method: {purchase.paymentMethod || "-"}</div>
                          </div>
                        ),
                      )}
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
                  <h3 className="text-lg font-semibold text-gray-900">
                    Product Interest Journey
                  </h3>
                  <p className="text-sm text-gray-600">
                    Product:{" "}
                    {productJourney?.product?.productName ||
                      productJourney?.product?.productId ||
                      "-"}
                  </p>
                </div>
                <StatusPill
                  label={
                    productJourney.summary.roamingWithoutCart
                      ? "Roaming Without Cart"
                      : "Has Conversion Signals"
                  }
                  className={
                    productJourney.summary.roamingWithoutCart
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : "bg-emerald-100 text-emerald-800 border-emerald-200"
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <MiniMetricCard
                  title="Product Views"
                  value={productJourney.summary.productViews || 0}
                />
                <MiniMetricCard
                  title="Unique Sessions"
                  value={productJourney.summary.uniqueSessions || 0}
                />
                <MiniMetricCard
                  title="Add To Cart"
                  value={productJourney.summary.addToCartCount || 0}
                />
                <MiniMetricCard
                  title="Purchases"
                  value={productJourney.summary.purchaseCount || 0}
                />
                <MiniMetricCard
                  title="Avg Hover Time"
                  value={formatDuration(
                    productJourney.summary.avgHoverDurationMs || 0,
                  )}
                />
                <MiniMetricCard
                  title="Total Hover"
                  value={formatDuration(
                    productJourney.summary.totalHoverDurationMs || 0,
                  )}
                />
                <MiniMetricCard
                  title="Checkout Started"
                  value={productJourney.summary.checkoutStartedCount || 0}
                />
                <MiniMetricCard
                  title="Revenue"
                  value={formatCurrency(
                    productJourney.summary.attributedRevenue || 0,
                  )}
                />
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

function UserTypeBehaviorCard({
  title,
  stats,
  conversionRate,
  badgeClassName = "",
}) {
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
        <MiniMetricCard
          title="Add To Cart"
          value={toNumber(stats?.addToCart, 0)}
        />
        <MiniMetricCard
          title="Purchases"
          value={toNumber(stats?.purchases, 0)}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <MiniMetricCard
          title="Checkout"
          value={toNumber(stats?.checkoutStarted, 0)}
        />
        <MiniMetricCard
          title="Click Events"
          value={toNumber(stats?.clickEvents, 0)}
        />
        <MiniMetricCard
          title="Rage Clicks"
          value={toNumber(stats?.rageClicks, 0)}
        />
        <MiniMetricCard
          title="Avg Session Active"
          value={formatDuration(stats?.avgSessionActiveTimeMs || 0)}
        />
      </div>
      <div className="text-xs text-gray-500 mt-3">
        Avg page active at heartbeat:{" "}
        {formatDuration(stats?.avgPageActiveMs || 0)}
      </div>
    </div>
  );
}

function ChartCard({ title, children, actions = null }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {actions}
      </div>
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

function PlainLanguageCard({ title, rows = [] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div
            key={`${title}-${row}`}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
          >
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ label, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
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
