import PDFDocument from "pdfkit";
import {
  ensureAnalyticsIndexes,
  getAnalyticsDb,
} from "../services/analytics/analyticsDb.service.js";
import { getAnalyticsCollection } from "../services/analytics/collectionResolver.service.js";
import {
  getSessionProductInteractions,
  getSessionSummary,
  getSessionTimeline,
  getUserPurchaseHistory,
  getUserSessionHistory,
  getUserTimeline,
} from "../services/analytics/timeline.service.js";

const DEFAULT_RANGE_DAYS = 30;
const ACTIVE_WINDOW_MINUTES = 5;
const isProduction = process.env.NODE_ENV === "production";
const CLICK_INTERACTION_EVENT_TYPES = [
  "click_event",
  "banner_click",
  "product_click",
];
const CLICK_INTERACTION_EVENT_REGEX = /_click$/i;

const buildErrorResponse = (message, error) => ({
  success: false,
  error: true,
  message,
  ...(isProduction
    ? {}
    : {
        details: String(error?.message || error || "unknown error"),
      }),
});

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPositiveInt = (value, fallback, max = 5000) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
};

const parseDateInput = (value, fallbackDate) => {
  if (!value) return fallbackDate;
  const candidate = new Date(value);
  if (Number.isNaN(candidate.getTime())) {
    return fallbackDate;
  }
  return candidate;
};

const resolveDateRange = (query = {}) => {
  const now = new Date();
  const defaultStart = new Date(
    now.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000,
  );
  const from = parseDateInput(query.from, defaultStart);
  const to = parseDateInput(query.to, now);

  if (from > to) {
    return { from: to, to: from };
  }

  return { from, to };
};

const normalizeUserId = (value) => {
  const candidate = String(value || "").trim();
  return candidate || "";
};

const normalizeSessionId = (value) => {
  const candidate = String(value || "").trim();
  return candidate || "";
};

const normalizeProductId = (value) => {
  const candidate = String(value || "").trim();
  return candidate || "";
};

const normalizeSessionType = (value) => {
  const normalized = String(value || "all")
    .trim()
    .toLowerCase();

  if (["all", "guest", "logged_in"].includes(normalized)) {
    return normalized;
  }

  return "all";
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildIdentityFilter = ({ userId = "", sessionId = "" } = {}) => ({
  ...(userId ? { userId } : {}),
  ...(sessionId ? { sessionId } : {}),
});

const buildSessionTypeFilter = (type) => {
  if (type === "guest") {
    return { userId: { $in: [null, ""] } };
  }
  if (type === "logged_in") {
    return { userId: { $nin: [null, ""] } };
  }
  return {};
};

const buildBehaviorSessionQualityMatch = () => ({
  $or: [
    { pageViewsValue: { $gt: 0 } },
    { totalActiveTimeValue: { $gt: 0 } },
    { eventCountValue: { $gt: 1 } },
  ],
});

const withTimestampRange = (from, to, field = "timestamp") => ({
  [field]: {
    $gte: from,
    $lte: to,
  },
});

const toDateExpression = (fieldExpression) => ({
  $convert: {
    input: fieldExpression,
    to: "date",
    onError: null,
    onNull: null,
  },
});

const toNumberExpression = (fieldExpression, fallback = 0) => ({
  $convert: {
    input: fieldExpression,
    to: "double",
    onError: fallback,
    onNull: fallback,
  },
});

const toTrimmedStringExpression = (fieldExpression) => ({
  $trim: {
    input: {
      $ifNull: [
        {
          $convert: {
            input: fieldExpression,
            to: "string",
            onError: "",
            onNull: "",
          },
        },
        "",
      ],
    },
  },
});

const buildBehaviorSessionBaseFields = () => ({
  startedAtDate: toDateExpression("$startedAt"),
  endedAtDate: toDateExpression("$endedAt"),
  lastSeenAtDate: toDateExpression("$lastSeenAt"),
  totalActiveTimeValue: toNumberExpression("$totalActiveTime", 0),
  durationMsValue: toNumberExpression("$durationMs", 0),
  pageViewsValue: toNumberExpression("$pageViews", 0),
  eventCountValue: toNumberExpression("$eventCount", 0),
});

const buildSessionOverlapFields = () => ({
  sessionStartDate: {
    $ifNull: ["$startedAtDate", "$lastSeenAtDate"],
  },
  sessionEndDate: {
    $ifNull: [
      "$endedAtDate",
      {
        $ifNull: ["$lastSeenAtDate", "$startedAtDate"],
      },
    ],
  },
});

const buildSessionOverlapMatch = (from, to, extra = {}) => ({
  ...extra,
  sessionStartDate: {
    $ne: null,
    $lte: to,
  },
  sessionEndDate: {
    $ne: null,
    $gte: from,
  },
});

const buildVisitorKeyExpression = ({
  userIdField = "$userIdText",
  visitorIdField = "$visitorIdText",
  sessionIdField = "$sessionIdText",
} = {}) => ({
  $cond: [
    { $ne: [userIdField, ""] },
    { $concat: ["u:", userIdField] },
    {
      $cond: [
        { $ne: [visitorIdField, ""] },
        { $concat: ["v:", visitorIdField] },
        {
          $cond: [
            { $ne: [sessionIdField, ""] },
            { $concat: ["s:", sessionIdField] },
            "",
          ],
        },
      ],
    },
  ],
});

const toBucketFormat = (interval = "day") => {
  const normalized = String(interval || "day").toLowerCase();
  if (normalized === "hour") return "%Y-%m-%d %H:00";
  if (normalized === "week") return "%G-W%V";
  if (normalized === "month") return "%Y-%m";
  return "%Y-%m-%d";
};

const toPercent = (numerator, denominator) => {
  if (!denominator || denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
};

const formatCount = (value) => Number(value || 0).toLocaleString("en-IN");

const formatPercent = (value) => `${toFiniteNumber(value, 0).toFixed(2)}%`;

const formatDurationFromSeconds = (value) => {
  const totalSeconds = Math.max(Math.floor(toFiniteNumber(value, 0)), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};

const toDateFileKey = (value) => {
  const candidate = new Date(value);
  if (Number.isNaN(candidate.getTime())) return "unknown";
  return candidate.toISOString().slice(0, 10);
};

const ensurePdfSpace = (doc, requiredHeight = 80) => {
  if (doc.y + requiredHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
};

const writePdfSection = (doc, title) => {
  ensurePdfSpace(doc, 45);
  doc.moveDown(0.7);
  doc.fontSize(14).fillColor("#0f172a").text(title, { underline: true });
  doc.moveDown(0.25);
};

const writePdfList = (doc, items = []) => {
  const rows = (items || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (!rows.length) {
    ensurePdfSpace(doc, 25);
    doc.fontSize(11).fillColor("#475569").text("No data available.");
    return;
  }

  for (const row of rows) {
    ensurePdfSpace(doc, 24);
    doc.fontSize(11).fillColor("#111827").text(`- ${row}`);
  }
};

const buildAnalyticsObservations = ({
  overview,
  chartData,
  engagement,
  from,
  to,
}) => {
  const totalVisitors = toFiniteNumber(overview?.totalSessions, 0);
  const avgSessionDurationSeconds = toFiniteNumber(
    overview?.avgSessionDurationSeconds,
    0,
  );
  const estimatedTotalEngagedSeconds =
    totalVisitors * avgSessionDurationSeconds;
  const newVisitors = toFiniteNumber(overview?.newVisitors, 0);
  const returningVisitors = toFiniteNumber(overview?.returningVisitors, 0);
  const visitorIdentityTotal = newVisitors + returningVisitors;
  const returningShare = toPercent(returningVisitors, visitorIdentityTotal);

  const topClickedButton =
    String(
      engagement?.attractiveButtons?.[0]?.target ||
        engagement?.movementTargets?.[0]?.target ||
        "",
    ).trim() || "No clear button data";
  const topClickedCount = toFiniteNumber(
    engagement?.attractiveButtons?.[0]?.totalInteractions ||
      engagement?.movementTargets?.[0]?.total,
    0,
  );

  const topProductName =
    String(chartData?.topProductsViewed?.[0]?.productName || "").trim() ||
    "No product interaction data";
  const topProductViews = toFiniteNumber(
    chartData?.topProductsViewed?.[0]?.views,
    0,
  );

  const topSource = String(chartData?.trafficSources?.[0]?.source || "").trim();
  const topSourceVisits = toFiniteNumber(
    chartData?.trafficSources?.[0]?.visits,
    0,
  );

  const fromIso = new Date(from).toISOString();
  const toIso = new Date(to).toISOString();

  return [
    `This report covers traffic from ${fromIso} to ${toIso}.`,
    `Total visitors (quality sessions) were ${formatCount(totalVisitors)}.`,
    `Average time spent per session was ${formatDurationFromSeconds(avgSessionDurationSeconds)}.`,
    `Estimated total engaged time was ${formatDurationFromSeconds(estimatedTotalEngagedSeconds)}.`,
    `New visitors were ${formatCount(newVisitors)}, returning visitors were ${formatCount(returningVisitors)} (${formatPercent(returningShare)} returning share).`,
    `Most clicked button/target was "${topClickedButton}" with ${formatCount(topClickedCount)} interactions.`,
    `Most interacted product was "${topProductName}" with ${formatCount(topProductViews)} tracked views.`,
    topSource
      ? `Top traffic source was ${topSource} with ${formatCount(topSourceVisits)} visits.`
      : "Traffic source split is not available for this range.",
    `Conversion rate was ${formatPercent(overview?.conversionRate)} and bounce rate was ${formatPercent(overview?.bounceRate)}.`,
  ];
};

const buildBehaviorObservations = ({
  overview,
  engagement,
  performance,
  from,
  to,
}) => {
  const totalSessions = toFiniteNumber(overview?.totalSessions, 0);
  const avgActiveTimeMs = toFiniteNumber(overview?.avgActiveTimeMs, 0);
  const avgActiveSeconds = avgActiveTimeMs / 1000;
  const estimatedTotalActiveSeconds = (totalSessions * avgActiveTimeMs) / 1000;
  const rageClicks = toFiniteNumber(engagement?.rageClickCount, 0);
  const dropOffRate = toFiniteNumber(
    engagement?.dropOffRate ?? engagement?.drop_off_rate,
    0,
  );

  const topButtonRow =
    engagement?.attractiveButtons?.[0] ||
    engagement?.movementTargets?.[0] ||
    null;
  const topButtonTarget =
    String(topButtonRow?.target || "").trim() || "No clear button data";
  const topButtonInteractions = toFiniteNumber(
    topButtonRow?.totalInteractions ?? topButtonRow?.total,
    0,
  );

  const topConvertingPath =
    engagement?.topConvertingButtonsByProduct?.[0] || null;
  const topProductId =
    String(topConvertingPath?.productId || "").trim() ||
    "No product conversion path data";
  const topConvertingButton =
    String(topConvertingPath?.target || "").trim() ||
    "No top converting button";
  const topConvertingRate = toFiniteNumber(
    topConvertingPath?.clickToPurchaseRate,
    0,
  );

  const guestSessions = toFiniteNumber(
    engagement?.userTypeMatrix?.guest?.sessions,
    0,
  );
  const loggedInSessions = toFiniteNumber(
    engagement?.userTypeMatrix?.logged_in?.sessions,
    0,
  );

  const peakThroughputRow = Array.isArray(performance?.eventsPerMinute)
    ? performance.eventsPerMinute.reduce(
        (peak, row) => {
          const events = toFiniteNumber(row?.events, 0);
          if (events > peak.events) {
            return {
              minute: String(row?.minute || "unknown"),
              events,
            };
          }
          return peak;
        },
        { minute: "unknown", events: 0 },
      )
    : { minute: "unknown", events: 0 };

  const fromIso = new Date(from).toISOString();
  const toIso = new Date(to).toISOString();

  return [
    `This behavior report covers ${fromIso} to ${toIso}.`,
    `Total quality sessions were ${formatCount(totalSessions)}.`,
    `Average active time per session was ${formatDurationFromSeconds(avgActiveSeconds)}.`,
    `Estimated total active engagement time was ${formatDurationFromSeconds(estimatedTotalActiveSeconds)}.`,
    `Guest sessions were ${formatCount(guestSessions)} and logged-in sessions were ${formatCount(loggedInSessions)}.`,
    `Drop-off rate was ${formatPercent(dropOffRate)} and rage clicks were ${formatCount(rageClicks)}.`,
    `Most interacted button/target was "${topButtonTarget}" with ${formatCount(topButtonInteractions)} interactions.`,
    `Top converting button-product path was "${topConvertingButton}" -> ${topProductId} at ${formatPercent(topConvertingRate)} click-to-purchase.`,
    `Peak event throughput was ${formatCount(peakThroughputRow.events)} events/min at ${peakThroughputRow.minute}.`,
  ];
};

const sanitizeTimelineEvent = (event) => ({
  eventId: String(event?.eventId || ""),
  eventType: String(event?.eventType || ""),
  userId: event?.userId || null,
  sessionId: String(event?.sessionId || ""),
  timestamp: event?.timestamp,
  pageUrl: String(event?.pageUrl || ""),
  referrer: String(event?.referrer || ""),
  metadata: event?.metadata || {},
});

const sanitizeSessionSummary = (session) => ({
  sessionId: String(session?.sessionId || ""),
  userId: session?.userId || null,
  ipAddress: String(session?.ipAddress || ""),
  startedAt: session?.startedAt || null,
  endedAt: session?.endedAt || null,
  lastSeenAt: session?.lastSeenAt || null,
  totalActiveTime: toFiniteNumber(
    session?.totalActiveTime ?? session?.durationMs,
    0,
  ),
  isActive: Boolean(session?.isActive),
  pageViews: toFiniteNumber(session?.pageViews, 0),
  eventCount: toFiniteNumber(session?.eventCount, 0),
  maxScrollDepth: toFiniteNumber(session?.maxScrollDepth, 0),
  deviceType: String(session?.deviceType || "unknown"),
  browser: String(session?.browser || "unknown"),
  location: session?.location || { country: "unknown", city: "unknown" },
});

const resolveCollections = async (db) => {
  const [
    sessions,
    events,
    pageViews,
    sectionViews,
    productEvents,
    cartEvents,
    purchases,
    searchEvents,
    workerHealth,
  ] = await Promise.all([
    getAnalyticsCollection(db, "sessions", ["user_sessions"]),
    getAnalyticsCollection(db, "events_raw", ["events"]),
    getAnalyticsCollection(db, "page_views", []),
    getAnalyticsCollection(db, "section_views", []),
    getAnalyticsCollection(db, "product_events", ["product_views"]),
    getAnalyticsCollection(db, "cart_events", []),
    getAnalyticsCollection(db, "purchases", []),
    getAnalyticsCollection(db, "search_events", []),
    getAnalyticsCollection(db, "worker_health", []),
  ]);

  return {
    sessions,
    events,
    pageViews,
    sectionViews,
    productEvents,
    cartEvents,
    purchases,
    searchEvents,
    workerHealth,
  };
};

const getOverviewData = async (db, from, to) => {
  const { sessions, purchases, pageViews } = await resolveCollections(db);

  const activeThreshold = new Date(
    Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000,
  );
  const [
    sessionOverviewRows,
    purchasesDistinctSessions,
    revenueAggregation,
    totalPageViewRows,
    visitorSegmentRows,
  ] = await Promise.all([
    sessions
      .aggregate([
        {
          $addFields: {
            ...buildBehaviorSessionBaseFields(),
            ...buildSessionOverlapFields(),
          },
        },
        {
          $match: buildSessionOverlapMatch(
            from,
            to,
            buildBehaviorSessionQualityMatch(),
          ),
        },
        {
          $project: {
            userId: 1,
            isActive: 1,
            lastSeenAtDate: 1,
            isBounce: {
              $or: [
                { $lte: ["$pageViewsValue", 1] },
                { $lte: ["$eventCountValue", 1] },
              ],
            },
            activeTimeMs: {
              $let: {
                vars: {
                  endDate: { $ifNull: ["$endedAtDate", "$lastSeenAtDate"] },
                },
                in: {
                  $cond: [
                    { $gt: ["$totalActiveTimeValue", 0] },
                    "$totalActiveTimeValue",
                    {
                      $cond: [
                        { $gt: ["$durationMsValue", 0] },
                        "$durationMsValue",
                        {
                          $cond: [
                            {
                              $and: [
                                { $ne: ["$startedAtDate", null] },
                                { $ne: ["$$endDate", null] },
                              ],
                            },
                            {
                              $max: [
                                {
                                  $subtract: ["$$endDate", "$startedAtDate"],
                                },
                                0,
                              ],
                            },
                            0,
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            bounceSessions: {
              $sum: {
                $cond: ["$isBounce", 1, 0],
              },
            },
            avgActiveTimeMs: { $avg: "$activeTimeMs" },
            activeUsersSet: {
              $addToSet: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$isActive", true] },
                      { $gte: ["$lastSeenAtDate", activeThreshold] },
                      {
                        $not: [
                          {
                            $in: ["$userId", [null, ""]],
                          },
                        ],
                      },
                    ],
                  },
                  "$userId",
                  null,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalSessions: 1,
            bounceSessions: 1,
            avgActiveTimeMs: { $ifNull: ["$avgActiveTimeMs", 0] },
            activeUsers: {
              $size: {
                $filter: {
                  input: "$activeUsersSet",
                  as: "uid",
                  cond: {
                    $not: [
                      {
                        $in: ["$$uid", [null, ""]],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      ])
      .toArray(),
    purchases
      .aggregate([
        {
          $addFields: {
            timestampDate: toDateExpression("$timestamp"),
          },
        },
        {
          $match: {
            timestampDate: {
              $gte: from,
              $lte: to,
            },
            sessionId: { $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id: "$sessionId",
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    purchases
      .aggregate([
        {
          $addFields: {
            timestampDate: toDateExpression("$timestamp"),
            amountValue: toNumberExpression("$amount", 0),
          },
        },
        {
          $match: {
            timestampDate: {
              $gte: from,
              $lte: to,
            },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$amountValue" },
          },
        },
      ])
      .toArray(),
    pageViews
      .aggregate([
        {
          $addFields: {
            startedAtDate: toDateExpression("$startedAt"),
            endedAtDate: toDateExpression("$endedAt"),
            pageViewStartDate: {
              $ifNull: ["$startedAtDate", "$endedAtDate"],
            },
            pageViewEndDate: {
              $ifNull: ["$endedAtDate", "$startedAtDate"],
            },
          },
        },
        {
          $match: {
            pageViewStartDate: {
              $ne: null,
              $lte: to,
            },
            pageViewEndDate: {
              $ne: null,
              $gte: from,
            },
          },
        },
        {
          $count: "count",
        },
      ])
      .toArray(),
    sessions
      .aggregate([
        {
          $addFields: {
            ...buildBehaviorSessionBaseFields(),
            userIdText: toTrimmedStringExpression("$userId"),
            visitorIdText: toTrimmedStringExpression("$visitorId"),
            sessionIdText: toTrimmedStringExpression("$sessionId"),
            ...buildSessionOverlapFields(),
          },
        },
        {
          $match: {
            ...buildBehaviorSessionQualityMatch(),
          },
        },
        {
          $addFields: {
            visitorKey: buildVisitorKeyExpression(),
          },
        },
        {
          $match: buildSessionOverlapMatch(from, to, {
            visitorKey: { $ne: "" },
          }),
        },
        {
          $group: {
            _id: "$visitorKey",
            firstSeenAt: { $min: "$sessionStartDate" },
            hasInRangeSession: {
              $max: {
                $cond: [
                  {
                    $and: [
                      { $lte: ["$sessionStartDate", to] },
                      { $gte: ["$sessionEndDate", from] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $match: {
            hasInRangeSession: 1,
          },
        },
        {
          $group: {
            _id: null,
            newVisitors: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$firstSeenAt", from] },
                      { $lte: ["$firstSeenAt", to] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            returningVisitors: {
              $sum: {
                $cond: [{ $lt: ["$firstSeenAt", from] }, 1, 0],
              },
            },
            totalVisitorIdentities: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            newVisitors: 1,
            returningVisitors: 1,
            totalVisitorIdentities: 1,
          },
        },
      ])
      .toArray(),
  ]);

  const overviewRow = sessionOverviewRows?.[0] || {};
  const totalSessions = Number(overviewRow.totalSessions || 0);
  const activeUsers = Number(overviewRow.activeUsers || 0);
  const bounceSessions = Number(overviewRow.bounceSessions || 0);
  const avgActiveTimeMs = Number(overviewRow.avgActiveTimeMs || 0);
  const sessionsWithPurchase = Number(
    purchasesDistinctSessions?.[0]?.count || 0,
  );
  const revenue = Number(revenueAggregation?.[0]?.revenue || 0);
  const totalPageViews = Number(totalPageViewRows?.[0]?.count || 0);
  const newVisitors = Number(visitorSegmentRows?.[0]?.newVisitors || 0);
  const returningVisitors = Number(
    visitorSegmentRows?.[0]?.returningVisitors || 0,
  );
  const totalVisitorIdentities = Number(
    visitorSegmentRows?.[0]?.totalVisitorIdentities || 0,
  );
  const conversionRate = toPercent(sessionsWithPurchase, totalSessions);
  const bounceRate = toPercent(bounceSessions, totalSessions);

  return {
    totalSessions,
    activeUsers,
    avgActiveTimeMs,
    avgSessionDurationSeconds: Number((avgActiveTimeMs / 1000).toFixed(2)),
    bounceRate,
    conversionRate,
    revenue,
    totalPageViews,
    newVisitors,
    returningVisitors,
    totalVisitorIdentities,
  };
};

const getChartData = async (db, from, to, interval = "day") => {
  const { sessions, purchases, productEvents, searchEvents, events } =
    await resolveCollections(db);
  const bucketFormat = toBucketFormat(interval);
  const productCollectionName = productEvents.collectionName;

  const visitorsOverTime = await sessions
    .aggregate([
      {
        $addFields: {
          ...buildBehaviorSessionBaseFields(),
        },
      },
      {
        $match: {
          startedAtDate: {
            $gte: from,
            $lte: to,
          },
          ...buildBehaviorSessionQualityMatch(),
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: bucketFormat,
              date: "$startedAtDate",
            },
          },
          visitors: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  const revenueOverTime = await purchases
    .aggregate([
      {
        $addFields: {
          timestampDate: toDateExpression("$timestamp"),
          amountValue: toNumberExpression("$amount", 0),
        },
      },
      {
        $match: {
          timestampDate: {
            $gte: from,
            $lte: to,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: bucketFormat,
              date: "$timestampDate",
            },
          },
          revenue: { $sum: "$amountValue" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  const topProductsViewed = await productEvents
    .aggregate([
      {
        $addFields: {
          timestampDate: toDateExpression("$timestamp"),
        },
      },
      {
        $match: {
          timestampDate: {
            $gte: from,
            $lte: to,
          },
          ...(productCollectionName === "product_events"
            ? {
                eventType: "product_view",
              }
            : {}),
        },
      },
      {
        $group: {
          _id: {
            productId: "$productId",
            productName: "$productName",
          },
          views: { $sum: 1 },
        },
      },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ])
    .toArray();

  const topSearchedKeywords = await searchEvents
    .aggregate([
      {
        $addFields: {
          timestampDate: toDateExpression("$timestamp"),
        },
      },
      {
        $match: {
          timestampDate: {
            $gte: from,
            $lte: to,
          },
        },
      },
      {
        $group: {
          _id: "$keyword",
          searches: { $sum: 1 },
        },
      },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { searches: -1 } },
      { $limit: 15 },
    ])
    .toArray();

  const trafficSources = await events
    .aggregate([
      {
        $addFields: {
          timestampDate: toDateExpression("$timestamp"),
        },
      },
      {
        $match: {
          timestampDate: {
            $gte: from,
            $lte: to,
          },
          eventType: {
            $in: ["page_view_started", "page_view_ended", "page_view"],
          },
        },
      },
      {
        $group: {
          _id: "$sourceDomain",
          visits: { $sum: 1 },
        },
      },
      { $match: { _id: { $nin: [null, "", "direct"] } } },
      { $sort: { visits: -1 } },
      { $limit: 10 },
    ])
    .toArray();

  return {
    visitorsOverTime: visitorsOverTime.map((item) => ({
      bucket: item._id,
      visitors: item.visitors,
    })),
    revenueOverTime: revenueOverTime.map((item) => ({
      bucket: item._id,
      revenue: Number(item.revenue || 0),
      orders: Number(item.orders || 0),
    })),
    topProductsViewed: topProductsViewed.map((item) => ({
      productId: item._id?.productId || "unknown",
      productName: item._id?.productName || "Unknown Product",
      views: item.views,
    })),
    topSearchedKeywords: topSearchedKeywords.map((item) => ({
      keyword: item._id,
      searches: item.searches,
    })),
    trafficSources: trafficSources.map((item) => ({
      source: item._id,
      visits: item.visits,
    })),
  };
};

const getUserActivityData = async (db, userId, limit = 1000) => {
  const timelineLimit = toPositiveInt(limit, 1000, 20_000);

  const [timeline, sessions, purchases] = await Promise.all([
    getUserTimeline(userId, { db, limit: timelineLimit }),
    getUserSessionHistory(userId, { db, limit: 250 }),
    getUserPurchaseHistory(userId, { db, limit: 250 }),
  ]);

  return {
    timeline: timeline.map(sanitizeTimelineEvent),
    sessions: sessions.map(sanitizeSessionSummary),
    purchases: purchases.map((purchase) => ({
      eventId: purchase.eventId,
      orderId: purchase.orderId,
      amount: toFiniteNumber(purchase.amount),
      currency: purchase.currency || "INR",
      timestamp: purchase.timestamp,
      paymentMethod: purchase.paymentMethod || "unknown",
      products: Array.isArray(purchase.products) ? purchase.products : [],
    })),
  };
};

const getEngagementData = async (db, from, to) => {
  const { events, sectionViews, productEvents, sessions } =
    await resolveCollections(db);

  const isRedactedLikeTarget = (value = "") =>
    /\[\s*redacted\s*\]/i.test(String(value || ""));

  const cleanTargetText = (value = "", maxLength = 140) => {
    const normalized = String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, maxLength);
    if (!normalized || isRedactedLikeTarget(normalized)) {
      return "";
    }
    return normalized;
  };

  const humanizeTrackName = (value = "") => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();

    const labels = {
      product_cta_add_to_cart: "Add to Cart",
      product_cta_buy_now: "Buy Now",
      product_cta_wishlist: "Add to Wishlist",
      product_cta_share: "Share Product",
      product_cta_reviews: "View Reviews",
      product_variant_select: "Select Variant",
      product_click: "Product Click",
      combo_click: "Combo Click",
      banner_click: "Banner Click",
      search_click: "Search",
      click_event: "General Click",
      login: "Log In",
      signup: "Sign Up",
      logout: "Log Out",
    };

    if (labels[normalized]) {
      return labels[normalized];
    }

    if (!normalized || isRedactedLikeTarget(normalized)) {
      return "";
    }

    return normalized
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .slice(0, 120);
  };

  const resolveHrefLabel = (value = "") => {
    const href = String(value || "").trim();
    if (!href || isRedactedLikeTarget(href)) {
      return "";
    }

    try {
      const parsed = new URL(href, "https://analytics.local");
      const pathname = String(parsed.pathname || "")
        .trim()
        .replace(/\/+$/, "")
        .toLowerCase();
      if (!pathname || pathname === "/") {
        return "Homepage Navigation";
      }
      return `Open ${pathname}`.slice(0, 140);
    } catch {
      return "";
    }
  };

  const resolveClickTargetFromRow = (row = {}) => {
    const bannerName = cleanTargetText(row?.bannerName, 140);
    if (bannerName) return `banner:${bannerName}`;

    const bannerId = cleanTargetText(row?.bannerId, 120);
    if (bannerId) return `banner#${bannerId.slice(0, 120)}`;

    const trackName = humanizeTrackName(row?.trackName);
    if (trackName) return trackName;

    const buttonLabel = cleanTargetText(row?.buttonLabel, 140);
    if (buttonLabel) return buttonLabel;

    const targetId = cleanTargetText(row?.targetId || row?.target_id, 140);
    if (targetId) return targetId;

    const hrefLabel = resolveHrefLabel(row?.href);
    if (hrefLabel) return hrefLabel;

    const text = cleanTargetText(row?.text, 120);
    if (text) return text;

    const id = cleanTargetText(row?.elementId, 120);
    if (id) return `#${id}`;

    const tagName = String(row?.tagName || "")
      .trim()
      .toLowerCase();
    if (tagName) return tagName;

    return "unknown_target";
  };

  const productIdExpression = {
    $ifNull: [
      "$metadata.productId",
      {
        $ifNull: [
          "$metadata.product_id",
          {
            $ifNull: [
              "$metadata.product._id",
              {
                $ifNull: ["$metadata.product.id", "$metadata.id"],
              },
            ],
          },
        ],
      },
    ],
  };

  const clickFamilyMatch = {
    $or: [
      { eventType: "rage_click" },
      { eventType: { $in: CLICK_INTERACTION_EVENT_TYPES } },
      { eventType: { $regex: CLICK_INTERACTION_EVENT_REGEX } },
    ],
  };

  const nonRageClickExpression = {
    $and: [
      { $ne: ["$eventType", "rage_click"] },
      {
        $or: [
          { $in: ["$eventType", CLICK_INTERACTION_EVENT_TYPES] },
          {
            $regexMatch: {
              input: "$eventType",
              regex: CLICK_INTERACTION_EVENT_REGEX,
            },
          },
        ],
      },
    ],
  };

  const [
    avgScrollDepthAgg,
    rageClickCount,
    sectionHeatmap,
    avgProductHoverAgg,
    rawClickTargets,
    userTypeEvents,
    userTypeSessions,
    rawButtonClickSessions,
    rawProductConversionSessions,
  ] = await Promise.all([
    events
      .aggregate([
        {
          $addFields: {
            timestampDate: toDateExpression("$timestamp"),
          },
        },
        {
          $match: {
            timestampDate: {
              $gte: from,
              $lte: to,
            },
            eventType: "scroll_depth",
          },
        },
        {
          $project: {
            scrollDepth: {
              $ifNull: ["$metadata.maxScrollDepth", "$metadata.depthPercent"],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgScrollDepth: { $avg: "$scrollDepth" },
            maxScrollDepth: { $max: "$scrollDepth" },
          },
        },
      ])
      .toArray(),
    events.countDocuments({
      ...withTimestampRange(from, to),
      eventType: "rage_click",
    }),
    sectionViews
      .aggregate([
        {
          $addFields: {
            startedAtDate: toDateExpression("$startedAt"),
          },
        },
        {
          $match: {
            startedAtDate: {
              $gte: from,
              $lte: to,
            },
          },
        },
        {
          $group: {
            _id: {
              sectionName: "$sectionName",
              pageUrl: "$pageUrl",
            },
            views: { $sum: 1 },
            avgDurationMs: { $avg: "$durationMs" },
            totalDurationMs: { $sum: "$durationMs" },
          },
        },
        { $sort: { views: -1, totalDurationMs: -1 } },
        { $limit: 100 },
      ])
      .toArray(),
    productEvents
      .aggregate([
        {
          $addFields: {
            timestampDate: toDateExpression("$timestamp"),
          },
        },
        {
          $match: {
            timestampDate: {
              $gte: from,
              $lte: to,
            },
            eventType: "hover_duration",
            hoverDurationMs: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            avgDurationMs: { $avg: "$hoverDurationMs" },
          },
        },
      ])
      .toArray(),
    events
      .aggregate([
        {
          $addFields: {
            timestampDate: toDateExpression("$timestamp"),
            userType: {
              $cond: [
                {
                  $eq: [{ $ifNull: ["$userId", ""] }, ""],
                },
                "guest",
                "logged_in",
              ],
            },
          },
        },
        {
          $match: {
            timestampDate: {
              $gte: from,
              $lte: to,
            },
            ...clickFamilyMatch,
          },
        },
        {
          $project: {
            eventType: 1,
            userType: 1,
            pageActiveMs: toNumberExpression("$metadata.pageActiveMs", 0),
            trackName: { $ifNull: ["$metadata.trackName", ""] },
            buttonLabel: {
              $ifNull: [
                "$metadata.buttonLabel",
                {
                  $ifNull: [
                    "$metadata.ariaLabel",
                    {
                      $ifNull: ["$metadata.title", ""],
                    },
                  ],
                },
              ],
            },
            targetId: {
              $ifNull: [
                "$metadata.targetId",
                {
                  $ifNull: [
                    "$metadata.target_id",
                    {
                      $ifNull: ["$target_id", ""],
                    },
                  ],
                },
              ],
            },
            text: { $ifNull: ["$metadata.text", ""] },
            href: { $ifNull: ["$metadata.href", ""] },
            elementId: { $ifNull: ["$metadata.id", ""] },
            className: { $ifNull: ["$metadata.className", ""] },
            tagName: { $ifNull: ["$metadata.tagName", ""] },
            bannerId: {
              $ifNull: [
                "$metadata.bannerId",
                { $ifNull: ["$metadata.banner_id", ""] },
              ],
            },
            bannerName: {
              $ifNull: [
                "$metadata.bannerName",
                { $ifNull: ["$metadata.banner_name", ""] },
              ],
            },
            bannerPosition: {
              $ifNull: [
                "$metadata.bannerPosition",
                { $ifNull: ["$metadata.banner_position", ""] },
              ],
            },
            bannerCampaign: {
              $ifNull: [
                "$metadata.bannerCampaign",
                { $ifNull: ["$metadata.banner_campaign", ""] },
              ],
            },
            sectionName: {
              $ifNull: [
                "$metadata.sectionName",
                { $ifNull: ["$metadata.section", "$metadata.sectionKey"] },
              ],
            },
            productId: productIdExpression,
          },
        },
        {
          $group: {
            _id: {
              trackName: "$trackName",
              buttonLabel: "$buttonLabel",
              targetId: "$targetId",
              text: "$text",
              href: "$href",
              elementId: "$elementId",
              className: "$className",
              tagName: "$tagName",
              bannerId: "$bannerId",
              bannerName: "$bannerName",
              bannerPosition: "$bannerPosition",
              bannerCampaign: "$bannerCampaign",
            },
            clickEvents: {
              $sum: {
                $cond: [nonRageClickExpression, 1, 0],
              },
            },
            rageClicks: {
              $sum: {
                $cond: [{ $eq: ["$eventType", "rage_click"] }, 1, 0],
              },
            },
            avgPreClickDwellMs: { $avg: "$pageActiveMs" },
            guestEvents: {
              $sum: {
                $cond: [{ $eq: ["$userType", "guest"] }, 1, 0],
              },
            },
            loggedInEvents: {
              $sum: {
                $cond: [{ $eq: ["$userType", "logged_in"] }, 1, 0],
              },
            },
            sections: { $addToSet: "$sectionName" },
            products: { $addToSet: "$productId" },
          },
        },
        { $sort: { clickEvents: -1, rageClicks: -1 } },
        { $limit: 200 },
      ])
      .toArray(),
    events
      .aggregate([
        {
          $addFields: {
            timestampDate: toDateExpression("$timestamp"),
            userType: {
              $cond: [
                {
                  $eq: [{ $ifNull: ["$userId", ""] }, ""],
                },
                "guest",
                "logged_in",
              ],
            },
          },
        },
        {
          $match: {
            timestampDate: {
              $gte: from,
              $lte: to,
            },
          },
        },
        {
          $group: {
            _id: "$userType",
            events: { $sum: 1 },
            addToCart: {
              $sum: {
                $cond: [{ $eq: ["$eventType", "add_to_cart"] }, 1, 0],
              },
            },
            checkoutStarted: {
              $sum: {
                $cond: [{ $eq: ["$eventType", "checkout_started"] }, 1, 0],
              },
            },
            purchases: {
              $sum: {
                $cond: [{ $eq: ["$eventType", "purchase_completed"] }, 1, 0],
              },
            },
            clickEvents: {
              $sum: {
                $cond: [nonRageClickExpression, 1, 0],
              },
            },
            rageClicks: {
              $sum: {
                $cond: [{ $eq: ["$eventType", "rage_click"] }, 1, 0],
              },
            },
            avgPageActiveMs: {
              $avg: {
                $cond: [
                  { $eq: ["$eventType", "active_heartbeat"] },
                  toNumberExpression("$metadata.pageActiveMs", 0),
                  null,
                ],
              },
            },
          },
        },
      ])
      .toArray(),
    sessions
      .aggregate([
        {
          $addFields: {
            ...buildBehaviorSessionBaseFields(),
            userType: {
              $cond: [
                {
                  $eq: [{ $ifNull: ["$userId", ""] }, ""],
                },
                "guest",
                "logged_in",
              ],
            },
            activeTimeMsValue: {
              $let: {
                vars: {
                  totalActive: toNumberExpression("$totalActiveTime", 0),
                  duration: toNumberExpression("$durationMs", 0),
                },
                in: {
                  $cond: [
                    { $gt: ["$$totalActive", 0] },
                    "$$totalActive",
                    "$$duration",
                  ],
                },
              },
            },
            ...buildSessionOverlapFields(),
          },
        },
        {
          $match: buildSessionOverlapMatch(
            from,
            to,
            buildBehaviorSessionQualityMatch(),
          ),
        },
        {
          $group: {
            _id: "$userType",
            sessions: { $sum: 1 },
            avgActiveTimeMs: { $avg: "$activeTimeMsValue" },
          },
        },
      ])
      .toArray(),
    events
      .aggregate([
        {
          $addFields: {
            timestampDate: toDateExpression("$timestamp"),
            userType: {
              $cond: [
                {
                  $eq: [{ $ifNull: ["$userId", ""] }, ""],
                },
                "guest",
                "logged_in",
              ],
            },
          },
        },
        {
          $match: {
            timestampDate: {
              $gte: from,
              $lte: to,
            },
            $and: [
              { eventType: { $ne: "rage_click" } },
              {
                $or: [
                  { eventType: { $in: CLICK_INTERACTION_EVENT_TYPES } },
                  { eventType: { $regex: CLICK_INTERACTION_EVENT_REGEX } },
                  { eventType: { $regex: /^product_cta_/i } },
                ],
              },
            ],
          },
        },
        {
          $project: {
            sessionId: 1,
            eventType: 1,
            userType: 1,
            pageActiveMs: toNumberExpression("$metadata.pageActiveMs", 0),
            productId: productIdExpression,
            trackName: { $ifNull: ["$metadata.trackName", ""] },
            buttonLabel: {
              $ifNull: [
                "$metadata.buttonLabel",
                {
                  $ifNull: [
                    "$metadata.ariaLabel",
                    {
                      $ifNull: ["$metadata.title", ""],
                    },
                  ],
                },
              ],
            },
            targetId: {
              $ifNull: [
                "$metadata.targetId",
                {
                  $ifNull: [
                    "$metadata.target_id",
                    {
                      $ifNull: ["$target_id", ""],
                    },
                  ],
                },
              ],
            },
            text: { $ifNull: ["$metadata.text", ""] },
            href: { $ifNull: ["$metadata.href", ""] },
            elementId: { $ifNull: ["$metadata.id", ""] },
            className: { $ifNull: ["$metadata.className", ""] },
            tagName: { $ifNull: ["$metadata.tagName", ""] },
            bannerId: {
              $ifNull: [
                "$metadata.bannerId",
                { $ifNull: ["$metadata.banner_id", ""] },
              ],
            },
            bannerName: {
              $ifNull: [
                "$metadata.bannerName",
                { $ifNull: ["$metadata.banner_name", ""] },
              ],
            },
            bannerPosition: {
              $ifNull: [
                "$metadata.bannerPosition",
                { $ifNull: ["$metadata.banner_position", ""] },
              ],
            },
            bannerCampaign: {
              $ifNull: [
                "$metadata.bannerCampaign",
                { $ifNull: ["$metadata.banner_campaign", ""] },
              ],
            },
          },
        },
        {
          $match: {
            sessionId: { $nin: [null, ""] },
            productId: { $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id: {
              sessionId: "$sessionId",
              productId: "$productId",
              trackName: "$trackName",
              buttonLabel: "$buttonLabel",
              targetId: "$targetId",
              text: "$text",
              href: "$href",
              elementId: "$elementId",
              className: "$className",
              tagName: "$tagName",
              bannerId: "$bannerId",
              bannerName: "$bannerName",
              bannerPosition: "$bannerPosition",
              bannerCampaign: "$bannerCampaign",
            },
            clickEvents: { $sum: 1 },
            avgPreClickDwellMs: { $avg: "$pageActiveMs" },
            guestClicks: {
              $sum: {
                $cond: [{ $eq: ["$userType", "guest"] }, 1, 0],
              },
            },
            loggedInClicks: {
              $sum: {
                $cond: [{ $eq: ["$userType", "logged_in"] }, 1, 0],
              },
            },
          },
        },
        { $sort: { clickEvents: -1 } },
        { $limit: 20_000 },
      ])
      .toArray(),
    events
      .aggregate([
        {
          $addFields: {
            timestampDate: toDateExpression("$timestamp"),
            userType: {
              $cond: [
                {
                  $eq: [{ $ifNull: ["$userId", ""] }, ""],
                },
                "guest",
                "logged_in",
              ],
            },
            productId: productIdExpression,
          },
        },
        {
          $match: {
            timestampDate: {
              $gte: from,
              $lte: to,
            },
            eventType: {
              $in: ["add_to_cart", "checkout_started", "purchase_completed"],
            },
            sessionId: { $nin: [null, ""] },
            productId: { $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id: {
              sessionId: "$sessionId",
              productId: "$productId",
            },
            addToCart: {
              $sum: {
                $cond: [{ $eq: ["$eventType", "add_to_cart"] }, 1, 0],
              },
            },
            checkoutStarted: {
              $sum: {
                $cond: [{ $eq: ["$eventType", "checkout_started"] }, 1, 0],
              },
            },
            purchases: {
              $sum: {
                $cond: [{ $eq: ["$eventType", "purchase_completed"] }, 1, 0],
              },
            },
            guestEvents: {
              $sum: {
                $cond: [{ $eq: ["$userType", "guest"] }, 1, 0],
              },
            },
            loggedInEvents: {
              $sum: {
                $cond: [{ $eq: ["$userType", "logged_in"] }, 1, 0],
              },
            },
          },
        },
        { $limit: 30_000 },
      ])
      .toArray(),
  ]);

  const movementEventRows = await events
    .aggregate([
      {
        $addFields: {
          timestampDate: toDateExpression("$timestamp"),
          userType: {
            $cond: [
              {
                $eq: [{ $ifNull: ["$userId", ""] }, ""],
              },
              "guest",
              "logged_in",
            ],
          },
        },
      },
      {
        $match: {
          timestampDate: {
            $gte: from,
            $lte: to,
          },
          eventType: {
            $in: [
              "button_hover_start",
              "button_hover_end",
              "button_hover_duration",
              "button_focus",
              "button_blur",
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            eventType: "$eventType",
            userType: "$userType",
          },
          count: { $sum: 1 },
          avgDurationMs: {
            $avg: {
              $ifNull: ["$metadata.durationMs", 0],
            },
          },
        },
      },
    ])
    .toArray();

  const movementTargetRows = await events
    .aggregate([
      {
        $addFields: {
          timestampDate: toDateExpression("$timestamp"),
          userType: {
            $cond: [
              {
                $eq: [{ $ifNull: ["$userId", ""] }, ""],
              },
              "guest",
              "logged_in",
            ],
          },
          targetLabel: {
            $ifNull: [
              "$metadata.buttonLabel",
              {
                $ifNull: [
                  "$metadata.targetId",
                  {
                    $ifNull: [
                      "$metadata.target_id",
                      {
                        $ifNull: [
                          "$metadata.trackName",
                          {
                            $ifNull: [
                              "$metadata.text",
                              {
                                $ifNull: [
                                  "$metadata.id",
                                  {
                                    $ifNull: ["$target_id", "unknown_target"],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        $match: {
          timestampDate: {
            $gte: from,
            $lte: to,
          },
          eventType: {
            $in: [
              "button_hover_start",
              "button_hover_end",
              "button_hover_duration",
              "button_focus",
              "button_blur",
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            targetLabel: "$targetLabel",
            userType: "$userType",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.targetLabel",
          total: { $sum: "$count" },
          guest: {
            $sum: {
              $cond: [{ $eq: ["$_id.userType", "guest"] }, "$count", 0],
            },
          },
          loggedIn: {
            $sum: {
              $cond: [{ $eq: ["$_id.userType", "logged_in"] }, "$count", 0],
            },
          },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 20 },
    ])
    .toArray();

  const userTypeMatrix = {
    guest: {
      sessions: 0,
      events: 0,
      addToCart: 0,
      checkoutStarted: 0,
      purchases: 0,
      clickEvents: 0,
      rageClicks: 0,
      avgSessionActiveTimeMs: 0,
      avgPageActiveMs: 0,
    },
    logged_in: {
      sessions: 0,
      events: 0,
      addToCart: 0,
      checkoutStarted: 0,
      purchases: 0,
      clickEvents: 0,
      rageClicks: 0,
      avgSessionActiveTimeMs: 0,
      avgPageActiveMs: 0,
    },
  };

  for (const row of userTypeEvents || []) {
    const key = row?._id === "logged_in" ? "logged_in" : "guest";
    userTypeMatrix[key].events = toFiniteNumber(row?.events, 0);
    userTypeMatrix[key].addToCart = toFiniteNumber(row?.addToCart, 0);
    userTypeMatrix[key].checkoutStarted = toFiniteNumber(
      row?.checkoutStarted,
      0,
    );
    userTypeMatrix[key].purchases = toFiniteNumber(row?.purchases, 0);
    userTypeMatrix[key].clickEvents = toFiniteNumber(row?.clickEvents, 0);
    userTypeMatrix[key].rageClicks = toFiniteNumber(row?.rageClicks, 0);
    userTypeMatrix[key].avgPageActiveMs = toFiniteNumber(
      row?.avgPageActiveMs,
      0,
    );
  }

  for (const row of userTypeSessions || []) {
    const key = row?._id === "logged_in" ? "logged_in" : "guest";
    userTypeMatrix[key].sessions = toFiniteNumber(row?.sessions, 0);
    userTypeMatrix[key].avgSessionActiveTimeMs = toFiniteNumber(
      row?.avgActiveTimeMs,
      0,
    );
  }

  const attractiveButtons = (rawClickTargets || [])
    .map((row) => {
      const target = resolveClickTargetFromRow({
        bannerId: row?._id?.bannerId,
        bannerName: row?._id?.bannerName,
        trackName: row?._id?.trackName,
        buttonLabel: row?._id?.buttonLabel,
        targetId: row?._id?.targetId,
        text: row?._id?.text,
        href: row?._id?.href,
        elementId: row?._id?.elementId,
        className: row?._id?.className,
        tagName: row?._id?.tagName,
      });

      const clickEvents = toFiniteNumber(row?.clickEvents, 0);
      const rageClicksCount = toFiniteNumber(row?.rageClicks, 0);
      const avgPreClickDwellMs = toFiniteNumber(row?.avgPreClickDwellMs, 0);
      const totalInteractions = clickEvents + rageClicksCount;
      const score = Number(
        (
          clickEvents +
          rageClicksCount * 1.8 +
          avgPreClickDwellMs / 10000
        ).toFixed(2),
      );

      return {
        target,
        score,
        totalInteractions,
        clickEvents,
        rageClicks: rageClicksCount,
        avgPreClickDwellMs,
        bannerId: String(row?._id?.bannerId || "").trim() || null,
        bannerName: String(row?._id?.bannerName || "").trim() || null,
        bannerPosition: String(row?._id?.bannerPosition || "").trim() || null,
        bannerCampaign: String(row?._id?.bannerCampaign || "").trim() || null,
        guestInteractions: toFiniteNumber(row?.guestEvents, 0),
        loggedInInteractions: toFiniteNumber(row?.loggedInEvents, 0),
        topSections: Array.isArray(row?.sections)
          ? row.sections
              .map((value) => String(value || "").trim())
              .filter(Boolean)
              .slice(0, 3)
          : [],
        topProducts: Array.isArray(row?.products)
          ? row.products
              .map((value) => String(value || "").trim())
              .filter(Boolean)
              .slice(0, 3)
          : [],
      };
    })
    .filter((row) => row.totalInteractions > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const bannerPerformanceMap = new Map();
  for (const row of rawClickTargets || []) {
    const bannerId = String(row?._id?.bannerId || "").trim();
    const bannerName = String(row?._id?.bannerName || "").trim();
    if (!bannerId && !bannerName) continue;

    const key = bannerId || bannerName.toLowerCase();
    const existing = bannerPerformanceMap.get(key) || {
      bannerId: bannerId || null,
      bannerName: bannerName || null,
      bannerPosition: String(row?._id?.bannerPosition || "").trim() || null,
      bannerCampaign: String(row?._id?.bannerCampaign || "").trim() || null,
      clicks: 0,
      rageClicks: 0,
      guestInteractions: 0,
      loggedInInteractions: 0,
      weightedDwellMs: 0,
      interactionWeight: 0,
    };

    const clicks = toFiniteNumber(row?.clickEvents, 0);
    const rageClicks = toFiniteNumber(row?.rageClicks, 0);
    const interactions = clicks + rageClicks;

    existing.bannerId = existing.bannerId || bannerId || null;
    existing.bannerName = existing.bannerName || bannerName || null;
    existing.bannerPosition =
      existing.bannerPosition ||
      String(row?._id?.bannerPosition || "").trim() ||
      null;
    existing.bannerCampaign =
      existing.bannerCampaign ||
      String(row?._id?.bannerCampaign || "").trim() ||
      null;
    existing.clicks += clicks;
    existing.rageClicks += rageClicks;
    existing.guestInteractions += toFiniteNumber(row?.guestEvents, 0);
    existing.loggedInInteractions += toFiniteNumber(row?.loggedInEvents, 0);
    existing.weightedDwellMs +=
      toFiniteNumber(row?.avgPreClickDwellMs, 0) * interactions;
    existing.interactionWeight += interactions;

    bannerPerformanceMap.set(key, existing);
  }

  const bannerPerformance = Array.from(bannerPerformanceMap.values())
    .map((row) => {
      const totalInteractions = row.clicks + row.rageClicks;
      const avgPreClickDwellMs = row.interactionWeight
        ? row.weightedDwellMs / row.interactionWeight
        : 0;

      return {
        bannerId: row.bannerId,
        bannerName: row.bannerName,
        bannerPosition: row.bannerPosition,
        bannerCampaign: row.bannerCampaign,
        clicks: row.clicks,
        rageClicks: row.rageClicks,
        totalInteractions,
        guestInteractions: row.guestInteractions,
        loggedInInteractions: row.loggedInInteractions,
        avgPreClickDwellMs: Number(avgPreClickDwellMs.toFixed(2)),
      };
    })
    .sort((a, b) => {
      if (b.totalInteractions !== a.totalInteractions) {
        return b.totalInteractions - a.totalInteractions;
      }
      return b.clicks - a.clicks;
    })
    .slice(0, 20);

  const conversionBySessionProduct = new Map();
  for (const row of rawProductConversionSessions || []) {
    const sessionId = String(row?._id?.sessionId || "").trim();
    const productId = String(row?._id?.productId || "").trim();
    if (!sessionId || !productId) continue;

    conversionBySessionProduct.set(`${sessionId}::${productId}`, {
      addToCart: toFiniteNumber(row?.addToCart, 0),
      checkoutStarted: toFiniteNumber(row?.checkoutStarted, 0),
      purchases: toFiniteNumber(row?.purchases, 0),
      guestEvents: toFiniteNumber(row?.guestEvents, 0),
      loggedInEvents: toFiniteNumber(row?.loggedInEvents, 0),
    });
  }

  const buttonProductMap = new Map();
  for (const row of rawButtonClickSessions || []) {
    const sessionId = String(row?._id?.sessionId || "").trim();
    const productId = String(row?._id?.productId || "").trim();
    if (!sessionId || !productId) continue;

    const target = resolveClickTargetFromRow({
      bannerId: row?._id?.bannerId,
      bannerName: row?._id?.bannerName,
      trackName: row?._id?.trackName,
      buttonLabel: row?._id?.buttonLabel,
      targetId: row?._id?.targetId,
      text: row?._id?.text,
      href: row?._id?.href,
      elementId: row?._id?.elementId,
      className: row?._id?.className,
      tagName: row?._id?.tagName,
    });

    const mapKey = `${target}::${productId}`;
    const aggregateRow = buttonProductMap.get(mapKey) || {
      target,
      productId,
      sessionsClicked: 0,
      totalClickEvents: 0,
      avgPreClickDwellMsSum: 0,
      guestClickedSessions: 0,
      loggedInClickedSessions: 0,
      sessionsWithAddToCart: 0,
      sessionsWithCheckout: 0,
      sessionsWithPurchase: 0,
      guestPurchaseSessions: 0,
      loggedInPurchaseSessions: 0,
    };

    aggregateRow.sessionsClicked += 1;
    aggregateRow.totalClickEvents += toFiniteNumber(row?.clickEvents, 0);
    aggregateRow.avgPreClickDwellMsSum += toFiniteNumber(
      row?.avgPreClickDwellMs,
      0,
    );

    const isGuestClick = toFiniteNumber(row?.guestClicks, 0) > 0;
    const isLoggedInClick = toFiniteNumber(row?.loggedInClicks, 0) > 0;
    if (isGuestClick) aggregateRow.guestClickedSessions += 1;
    if (isLoggedInClick) aggregateRow.loggedInClickedSessions += 1;

    const conversion = conversionBySessionProduct.get(
      `${sessionId}::${productId}`,
    );
    if (conversion) {
      const hasAddToCart = conversion.addToCart > 0;
      const hasCheckout = conversion.checkoutStarted > 0;
      const hasPurchase = conversion.purchases > 0;

      if (hasAddToCart) aggregateRow.sessionsWithAddToCart += 1;
      if (hasCheckout) aggregateRow.sessionsWithCheckout += 1;
      if (hasPurchase) {
        aggregateRow.sessionsWithPurchase += 1;
        if (isGuestClick || conversion.guestEvents > 0) {
          aggregateRow.guestPurchaseSessions += 1;
        }
        if (isLoggedInClick || conversion.loggedInEvents > 0) {
          aggregateRow.loggedInPurchaseSessions += 1;
        }
      }
    }

    buttonProductMap.set(mapKey, aggregateRow);
  }

  const topConvertingButtonsByProduct = Array.from(buttonProductMap.values())
    .map((row) => {
      const sessionsClicked = Math.max(
        toFiniteNumber(row?.sessionsClicked, 0),
        0,
      );
      const sessionsWithAddToCart = Math.max(
        toFiniteNumber(row?.sessionsWithAddToCart, 0),
        0,
      );
      const sessionsWithCheckout = Math.max(
        toFiniteNumber(row?.sessionsWithCheckout, 0),
        0,
      );
      const sessionsWithPurchase = Math.max(
        toFiniteNumber(row?.sessionsWithPurchase, 0),
        0,
      );
      const avgPreClickDwellMs = sessionsClicked
        ? row.avgPreClickDwellMsSum / sessionsClicked
        : 0;

      const clickToCartRate =
        sessionsClicked > 0
          ? (sessionsWithAddToCart / sessionsClicked) * 100
          : 0;
      const cartToCheckoutRate =
        sessionsWithAddToCart > 0
          ? (sessionsWithCheckout / sessionsWithAddToCart) * 100
          : 0;
      const clickToPurchaseRate =
        sessionsClicked > 0
          ? (sessionsWithPurchase / sessionsClicked) * 100
          : 0;

      return {
        target: row.target,
        productId: row.productId,
        sessionsClicked,
        totalClickEvents: toFiniteNumber(row.totalClickEvents, 0),
        sessionsWithAddToCart,
        sessionsWithCheckout,
        sessionsWithPurchase,
        clickToCartRate: Number(clickToCartRate.toFixed(2)),
        cartToCheckoutRate: Number(cartToCheckoutRate.toFixed(2)),
        clickToPurchaseRate: Number(clickToPurchaseRate.toFixed(2)),
        avgPreClickDwellMs: Number(avgPreClickDwellMs.toFixed(2)),
        guestClickedSessions: toFiniteNumber(row.guestClickedSessions, 0),
        loggedInClickedSessions: toFiniteNumber(row.loggedInClickedSessions, 0),
        guestPurchaseSessions: toFiniteNumber(row.guestPurchaseSessions, 0),
        loggedInPurchaseSessions: toFiniteNumber(
          row.loggedInPurchaseSessions,
          0,
        ),
      };
    })
    .filter((row) => row.sessionsClicked > 0)
    .sort((a, b) => {
      if (b.clickToPurchaseRate !== a.clickToPurchaseRate) {
        return b.clickToPurchaseRate - a.clickToPurchaseRate;
      }
      if (b.sessionsWithPurchase !== a.sessionsWithPurchase) {
        return b.sessionsWithPurchase - a.sessionsWithPurchase;
      }
      return b.sessionsClicked - a.sessionsClicked;
    })
    .slice(0, 25);

  const movementByEvent = {
    button_hover_start: { total: 0, guest: 0, loggedIn: 0, avgDurationMs: 0 },
    button_hover_end: { total: 0, guest: 0, loggedIn: 0, avgDurationMs: 0 },
    button_hover_duration: {
      total: 0,
      guest: 0,
      loggedIn: 0,
      avgDurationMs: 0,
    },
    button_focus: { total: 0, guest: 0, loggedIn: 0, avgDurationMs: 0 },
    button_blur: { total: 0, guest: 0, loggedIn: 0, avgDurationMs: 0 },
  };

  for (const row of movementEventRows || []) {
    const eventType = String(row?._id?.eventType || "").trim();
    if (!movementByEvent[eventType]) continue;

    const userType = row?._id?.userType === "logged_in" ? "loggedIn" : "guest";
    const count = toFiniteNumber(row?.count, 0);
    movementByEvent[eventType].total += count;
    movementByEvent[eventType][userType] += count;
    if (eventType === "button_hover_duration" || eventType === "button_blur") {
      movementByEvent[eventType].avgDurationMs = Number(
        toFiniteNumber(row?.avgDurationMs, 0).toFixed(2),
      );
    }
  }

  const movementTargets = (movementTargetRows || []).map((row) => ({
    target: String(row?._id || "unknown_target").trim() || "unknown_target",
    total: toFiniteNumber(row?.total, 0),
    guest: toFiniteNumber(row?.guest, 0),
    loggedIn: toFiniteNumber(row?.loggedIn, 0),
  }));

  const totalSessions =
    toFiniteNumber(userTypeMatrix.guest.sessions, 0) +
    toFiniteNumber(userTypeMatrix.logged_in.sessions, 0);
  const totalPurchaseSessions =
    toFiniteNumber(userTypeMatrix.guest.purchases, 0) +
    toFiniteNumber(userTypeMatrix.logged_in.purchases, 0);

  const dropOffRate = toPercent(
    Math.max(totalSessions - totalPurchaseSessions, 0),
    totalSessions,
  );
  const dropOffRateGuest = toPercent(
    Math.max(userTypeMatrix.guest.sessions - userTypeMatrix.guest.purchases, 0),
    userTypeMatrix.guest.sessions,
  );
  const dropOffRateLoggedIn = toPercent(
    Math.max(
      userTypeMatrix.logged_in.sessions - userTypeMatrix.logged_in.purchases,
      0,
    ),
    userTypeMatrix.logged_in.sessions,
  );

  return {
    avgTimePerProductMs: Number(avgProductHoverAgg?.[0]?.avgDurationMs || 0),
    avgScrollDepth: Number(avgScrollDepthAgg?.[0]?.avgScrollDepth || 0),
    maxScrollDepth: Number(avgScrollDepthAgg?.[0]?.maxScrollDepth || 0),
    rageClickCount,
    sectionEngagementHeatmap: sectionHeatmap.map((row) => ({
      sectionName: row._id?.sectionName || "unknown",
      pageUrl: row._id?.pageUrl || "",
      views: row.views,
      avgDurationMs: Number(row.avgDurationMs || 0),
      totalDurationMs: Number(row.totalDurationMs || 0),
    })),
    attractiveButtons,
    bannerPerformance,
    topConvertingButtonsByProduct,
    userTypeMatrix,
    movementByEvent,
    movementTargets,
    drop_off_rate: dropOffRate,
    dropOffRate,
    dropOffRateGuest,
    dropOffRateLoggedIn,
  };
};

const getPerformanceData = async (db) => {
  const { events, workerHealth } = await resolveCollections(db);
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const [eventsPerMinute, workerDocs] = await Promise.all([
    events
      .aggregate([
        {
          $addFields: {
            timestampDate: toDateExpression("$timestamp"),
          },
        },
        {
          $match: {
            timestampDate: {
              $gte: hourAgo,
              $lte: now,
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d %H:%M",
                date: "$timestampDate",
              },
            },
            events: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    workerHealth.find({}).sort({ updatedAt: -1 }).limit(25).toArray(),
  ]);

  const staleThresholdMs = toPositiveInt(
    process.env.ANALYTICS_WORKER_STALE_THRESHOLD_MS,
    60_000,
    24 * 60 * 60 * 1000,
  );

  const normalizedWorkers = workerDocs.map((doc) => {
    const updatedAt = doc?.updatedAt ? new Date(doc.updatedAt) : null;
    const stale =
      !updatedAt || Number.isNaN(updatedAt.getTime())
        ? true
        : now.getTime() - updatedAt.getTime() > staleThresholdMs;

    return {
      workerId: doc?.workerId || "unknown",
      queueDepth: toFiniteNumber(doc?.queueDepth, 0),
      isFlushing: Boolean(doc?.isFlushing),
      updatedAt,
      stale,
      stats: doc?.stats || {},
    };
  });

  const healthyWorkers = normalizedWorkers.filter(
    (worker) => !worker.stale,
  ).length;
  const estimatedBacklog = normalizedWorkers.reduce(
    (sum, worker) => sum + toFiniteNumber(worker.queueDepth, 0),
    0,
  );

  return {
    eventsPerMinute: eventsPerMinute.map((point) => ({
      minute: point._id,
      events: point.events,
    })),
    pubSubBacklog: {
      estimatedMessages: estimatedBacklog,
      source: "worker_queue_depth_estimate",
    },
    workerHealth: {
      totalWorkers: normalizedWorkers.length,
      healthyWorkers,
      unhealthyWorkers: Math.max(normalizedWorkers.length - healthyWorkers, 0),
      workers: normalizedWorkers,
      staleThresholdMs,
    },
  };
};

export const getAdminAnalyticsOverview = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();
    const { from, to } = resolveDateRange(req.query);

    const overview = await getOverviewData(db, from, to);

    return res.status(200).json({
      success: true,
      error: false,
      data: {
        ...overview,
        totalVisitors: overview.totalSessions,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });
  } catch (error) {
    console.error("[admin-analytics] overview error:", error?.message || error);
    return res
      .status(500)
      .json(buildErrorResponse("Failed to load analytics overview", error));
  }
};

export const getAdminAnalyticsCharts = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();
    const { from, to } = resolveDateRange(req.query);
    const interval = String(req.query.interval || "day")
      .trim()
      .toLowerCase();

    const chartData = await getChartData(db, from, to, interval);

    return res.status(200).json({
      success: true,
      error: false,
      data: {
        ...chartData,
        interval,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });
  } catch (error) {
    console.error("[admin-analytics] charts error:", error?.message || error);
    return res
      .status(500)
      .json(buildErrorResponse("Failed to load analytics charts", error));
  }
};

export const exportAdminAnalyticsPdfReport = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();
    const { from, to } = resolveDateRange(req.query);

    const [overview, chartData, engagement] = await Promise.all([
      getOverviewData(db, from, to),
      getChartData(db, from, to, "day"),
      getEngagementData(db, from, to),
    ]);

    const topClickedButton =
      String(
        engagement?.attractiveButtons?.[0]?.target ||
          engagement?.movementTargets?.[0]?.target ||
          "",
      ).trim() || "No clear button data";
    const topClickedCount = toFiniteNumber(
      engagement?.attractiveButtons?.[0]?.totalInteractions ||
        engagement?.movementTargets?.[0]?.total,
      0,
    );

    const topProductName =
      String(chartData?.topProductsViewed?.[0]?.productName || "").trim() ||
      "No product interaction data";
    const topProductViews = toFiniteNumber(
      chartData?.topProductsViewed?.[0]?.views,
      0,
    );

    const observations = buildAnalyticsObservations({
      overview,
      chartData,
      engagement,
      from,
      to,
    });

    const fromKey = toDateFileKey(from);
    const toKey = toDateFileKey(to);
    const fileName = `admin-analytics-observations-${fromKey}-to-${toKey}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"${fileName}\"`,
    );

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    doc
      .fontSize(22)
      .fillColor("#0f172a")
      .text("Admin Analytics Observation Report", { align: "left" });

    doc.moveDown(0.4);
    doc
      .fontSize(11)
      .fillColor("#334155")
      .text(`From: ${new Date(from).toISOString()}`)
      .text(`To: ${new Date(to).toISOString()}`)
      .text(`Generated At: ${new Date().toISOString()}`);

    writePdfSection(doc, "Traffic Overview");
    writePdfList(doc, [
      `Total visitors: ${formatCount(overview?.totalSessions)}`,
      `New visitors: ${formatCount(overview?.newVisitors)}`,
      `Returning visitors: ${formatCount(overview?.returningVisitors)}`,
      `Active users: ${formatCount(overview?.activeUsers)}`,
      `Average session duration: ${formatDurationFromSeconds(
        overview?.avgSessionDurationSeconds,
      )}`,
      `Conversion rate: ${formatPercent(overview?.conversionRate)}`,
      `Bounce rate: ${formatPercent(overview?.bounceRate)}`,
      `Revenue: Rs ${Number(overview?.revenue || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
      })}`,
    ]);

    writePdfSection(doc, "Interaction Highlights");
    writePdfList(doc, [
      `Most clicked button/target: ${topClickedButton} (${formatCount(topClickedCount)} interactions)`,
      `Most interacted product: ${topProductName} (${formatCount(topProductViews)} views)`,
    ]);

    writePdfSection(doc, "Simple Observations");
    writePdfList(doc, observations);

    writePdfSection(doc, "Visitors Over Time");
    writePdfList(
      doc,
      (chartData?.visitorsOverTime || []).map(
        (item) => `${item.bucket}: ${formatCount(item.visitors)} visitors`,
      ),
    );

    writePdfSection(doc, "Top Products");
    writePdfList(
      doc,
      (chartData?.topProductsViewed || []).map(
        (item) => `${item.productName}: ${formatCount(item.views)} views`,
      ),
    );

    doc.end();
  } catch (error) {
    console.error(
      "[admin-analytics] export pdf error:",
      error?.message || error,
    );

    if (!res.headersSent) {
      return res
        .status(500)
        .json(
          buildErrorResponse("Failed to export analytics PDF report", error),
        );
    }

    return res.end();
  }
};

export const exportBehaviorAnalyticsPdfReport = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();
    const { from, to } = resolveDateRange(req.query);

    const [overview, engagement, performance] = await Promise.all([
      getOverviewData(db, from, to),
      getEngagementData(db, from, to),
      getPerformanceData(db),
    ]);

    const topButtonRow =
      engagement?.attractiveButtons?.[0] ||
      engagement?.movementTargets?.[0] ||
      null;
    const topButtonTarget =
      String(topButtonRow?.target || "").trim() || "No clear button data";
    const topButtonInteractions = toFiniteNumber(
      topButtonRow?.totalInteractions ?? topButtonRow?.total,
      0,
    );

    const topConvertingPath =
      engagement?.topConvertingButtonsByProduct?.[0] || null;
    const topConvertingPathLabel = topConvertingPath
      ? `${topConvertingPath.target || "unknown_button"} -> ${topConvertingPath.productId || "unknown_product"}`
      : "No conversion path data";

    const observations = buildBehaviorObservations({
      overview,
      engagement,
      performance,
      from,
      to,
    });

    const fromKey = toDateFileKey(from);
    const toKey = toDateFileKey(to);
    const fileName = `behavior-analytics-observations-${fromKey}-to-${toKey}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"${fileName}\"`,
    );

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    doc
      .fontSize(22)
      .fillColor("#0f172a")
      .text("Behavior Analytics Observation Report", { align: "left" });

    doc.moveDown(0.4);
    doc
      .fontSize(11)
      .fillColor("#334155")
      .text(`From: ${new Date(from).toISOString()}`)
      .text(`To: ${new Date(to).toISOString()}`)
      .text(`Generated At: ${new Date().toISOString()}`);

    writePdfSection(doc, "Behavior Overview");
    writePdfList(doc, [
      `Total sessions: ${formatCount(overview?.totalSessions)}`,
      `Average active time: ${formatDurationFromSeconds(
        toFiniteNumber(overview?.avgActiveTimeMs, 0) / 1000,
      )}`,
      `Bounce rate: ${formatPercent(overview?.bounceRate)}`,
      `Conversion rate: ${formatPercent(overview?.conversionRate)}`,
      `Drop-off rate: ${formatPercent(
        engagement?.dropOffRate ?? engagement?.drop_off_rate,
      )}`,
      `Rage clicks: ${formatCount(engagement?.rageClickCount)}`,
    ]);

    writePdfSection(doc, "Interaction Highlights");
    writePdfList(doc, [
      `Most interacted button/target: ${topButtonTarget} (${formatCount(topButtonInteractions)} interactions)`,
      `Top converting path: ${topConvertingPathLabel}`,
      `Top path click-to-purchase: ${formatPercent(
        topConvertingPath?.clickToPurchaseRate,
      )}`,
    ]);

    writePdfSection(doc, "User Type Breakdown");
    writePdfList(doc, [
      `Guest sessions: ${formatCount(engagement?.userTypeMatrix?.guest?.sessions)}`,
      `Guest events: ${formatCount(engagement?.userTypeMatrix?.guest?.events)}`,
      `Guest purchases: ${formatCount(
        engagement?.userTypeMatrix?.guest?.purchases,
      )}`,
      `Logged-in sessions: ${formatCount(
        engagement?.userTypeMatrix?.logged_in?.sessions,
      )}`,
      `Logged-in events: ${formatCount(
        engagement?.userTypeMatrix?.logged_in?.events,
      )}`,
      `Logged-in purchases: ${formatCount(
        engagement?.userTypeMatrix?.logged_in?.purchases,
      )}`,
    ]);

    writePdfSection(doc, "Simple Behavior Observations");
    writePdfList(doc, observations);

    writePdfSection(doc, "Top Movement Targets");
    writePdfList(
      doc,
      (engagement?.movementTargets || [])
        .slice(0, 12)
        .map(
          (item) =>
            `${item.target}: ${formatCount(item.total)} events (Guest ${formatCount(item.guest)}, Logged ${formatCount(item.loggedIn)})`,
        ),
    );

    writePdfSection(doc, "Top Converting Buttons By Product");
    writePdfList(
      doc,
      (engagement?.topConvertingButtonsByProduct || [])
        .slice(0, 12)
        .map(
          (item) =>
            `${item.target || "unknown_button"} -> ${item.productId || "unknown_product"}: ${formatCount(item.sessionsClicked)} clicked sessions, ${formatPercent(item.clickToPurchaseRate)} click-to-purchase`,
        ),
    );

    writePdfSection(doc, "System Throughput Snapshot");
    writePdfList(doc, [
      `Workers healthy: ${formatCount(performance?.workerHealth?.healthyWorkers)} / ${formatCount(performance?.workerHealth?.totalWorkers)}`,
      `Estimated backlog messages: ${formatCount(
        performance?.pubSubBacklog?.estimatedMessages,
      )}`,
      `Latest events/min datapoints: ${formatCount(
        performance?.eventsPerMinute?.length,
      )}`,
    ]);

    doc.end();
  } catch (error) {
    console.error(
      "[behavior-analytics] export pdf error:",
      error?.message || error,
    );

    if (!res.headersSent) {
      return res
        .status(500)
        .json(
          buildErrorResponse("Failed to export behavior PDF report", error),
        );
    }

    return res.end();
  }
};

export const getAdminUserActivity = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();

    const userId = normalizeUserId(
      req.params?.userId || req.query.userId || "",
    );
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "userId is required",
      });
    }

    const limit = toPositiveInt(req.query.limit, 1000, 20_000);
    const activity = await getUserActivityData(db, userId, limit);

    return res.status(200).json({
      success: true,
      error: false,
      data: {
        userId,
        ...activity,
      },
    });
  } catch (error) {
    console.error(
      "[admin-analytics] user activity error:",
      error?.message || error,
    );
    return res
      .status(500)
      .json(buildErrorResponse("Failed to load user activity", error));
  }
};

export const getBehaviorAnalyticsOverview = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();
    const { from, to } = resolveDateRange(req.query);

    const overview = await getOverviewData(db, from, to);

    return res.status(200).json({
      success: true,
      error: false,
      data: {
        ...overview,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "[behavior-analytics] overview error:",
      error?.message || error,
    );
    return res
      .status(500)
      .json(buildErrorResponse("Failed to load behavior overview", error));
  }
};

export const getBehaviorAnalyticsEngagement = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();
    const { from, to } = resolveDateRange(req.query);

    const engagement = await getEngagementData(db, from, to);

    return res.status(200).json({
      success: true,
      error: false,
      data: {
        ...engagement,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "[behavior-analytics] engagement error:",
      error?.message || error,
    );
    return res
      .status(500)
      .json(
        buildErrorResponse("Failed to load behavior engagement data", error),
      );
  }
};

export const getBehaviorAnalyticsPerformance = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();

    const performance = await getPerformanceData(db);

    return res.status(200).json({
      success: true,
      error: false,
      data: performance,
    });
  } catch (error) {
    console.error(
      "[behavior-analytics] performance error:",
      error?.message || error,
    );
    return res
      .status(500)
      .json(
        buildErrorResponse("Failed to load behavior performance data", error),
      );
  }
};

export const getBehaviorAnalyticsUserActivity = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();

    const userId = normalizeUserId(
      req.query.userId || req.params?.userId || "",
    );
    const sessionId = normalizeSessionId(
      req.query.sessionId || req.params?.sessionId || "",
    );

    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Either userId or sessionId is required",
      });
    }

    const limit = toPositiveInt(req.query.limit, 1500, 20_000);

    if (sessionId) {
      const [timeline, sessionSummary, productInteractions, purchases] =
        await Promise.all([
          getSessionTimeline(sessionId, { db, limit }),
          getSessionSummary(sessionId, { db }),
          getSessionProductInteractions(sessionId, { db, limit: 2000 }),
          (async () => {
            const purchasesCollection = await getAnalyticsCollection(
              db,
              "purchases",
              [],
            );
            return purchasesCollection
              .find({ sessionId })
              .sort({ timestamp: -1 })
              .limit(250)
              .toArray();
          })(),
        ]);

      return res.status(200).json({
        success: true,
        error: false,
        data: {
          sessionId,
          sessionSummary: sessionSummary
            ? sanitizeSessionSummary(sessionSummary)
            : null,
          timeline: timeline.map(sanitizeTimelineEvent),
          productInteractions,
          purchases,
        },
      });
    }

    const [timeline, sessions, purchases] = await Promise.all([
      getUserTimeline(userId, { db, limit }),
      getUserSessionHistory(userId, { db, limit: 500 }),
      getUserPurchaseHistory(userId, { db, limit: 500 }),
    ]);

    return res.status(200).json({
      success: true,
      error: false,
      data: {
        userId,
        timeline,
        sessionHistory: sessions.map(sanitizeSessionSummary),
        purchaseHistory: purchases,
      },
    });
  } catch (error) {
    console.error(
      "[behavior-analytics] user activity error:",
      error?.message || error,
    );
    return res
      .status(500)
      .json(buildErrorResponse("Failed to load behavior user activity", error));
  }
};

export const getBehaviorProductJourney = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();

    const userId = normalizeUserId(
      req.query.userId || req.params?.userId || "",
    );
    const sessionId = normalizeSessionId(
      req.query.sessionId || req.params?.sessionId || "",
    );
    const productId = normalizeProductId(
      req.query.productId || req.params?.productId || "",
    );
    const limit = toPositiveInt(req.query.limit, 1000, 20_000);
    const { from, to } = resolveDateRange(req.query);

    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Either userId or sessionId is required",
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "productId is required",
      });
    }

    const identityFilter = buildIdentityFilter({ userId, sessionId });
    const urlMatchPattern = `/product/${escapeRegex(productId)}(?:$|[/?#])`;

    const timelineProductMatch = {
      $or: [
        { "metadata.productId": productId },
        { "metadata.product_id": productId },
        { "metadata.id": productId },
        { "metadata.product._id": productId },
        { "metadata.product.id": productId },
        { "metadata.productSlug": productId },
        {
          pageUrl: {
            $regex: urlMatchPattern,
            $options: "i",
          },
        },
      ],
    };

    const purchaseItemMatch = {
      $or: [
        { "products.productId": productId },
        { "products.product_id": productId },
        { "products.id": productId },
        { "products._id": productId },
      ],
    };

    const { productEvents, cartEvents, purchases, events } =
      await resolveCollections(db);

    const [
      productSummaryRows,
      cartSummaryRows,
      purchaseSummaryRows,
      timelineDocs,
      sessionRows,
      hoverBySessionRows,
      purchaseBySessionRows,
    ] = await Promise.all([
      productEvents
        .aggregate([
          {
            $match: {
              ...identityFilter,
              ...withTimestampRange(from, to),
              productId,
            },
          },
          {
            $group: {
              _id: null,
              views: {
                $sum: {
                  $cond: [{ $eq: ["$eventType", "product_view"] }, 1, 0],
                },
              },
              hoverEvents: {
                $sum: {
                  $cond: [{ $eq: ["$eventType", "hover_duration"] }, 1, 0],
                },
              },
              totalHoverDurationMs: {
                $sum: {
                  $cond: [
                    { $eq: ["$eventType", "hover_duration"] },
                    { $ifNull: ["$hoverDurationMs", 0] },
                    0,
                  ],
                },
              },
              firstViewedAt: { $min: "$timestamp" },
              lastViewedAt: { $max: "$timestamp" },
              uniqueSessions: { $addToSet: "$sessionId" },
              productNames: { $addToSet: "$productName" },
            },
          },
          {
            $project: {
              _id: 0,
              views: 1,
              hoverEvents: 1,
              totalHoverDurationMs: 1,
              avgHoverDurationMs: {
                $cond: [
                  { $gt: ["$hoverEvents", 0] },
                  {
                    $divide: ["$totalHoverDurationMs", "$hoverEvents"],
                  },
                  0,
                ],
              },
              firstViewedAt: 1,
              lastViewedAt: 1,
              uniqueSessionCount: { $size: "$uniqueSessions" },
              productNames: 1,
            },
          },
        ])
        .toArray(),
      cartEvents
        .aggregate([
          {
            $match: {
              ...identityFilter,
              ...withTimestampRange(from, to),
              productId,
            },
          },
          {
            $group: {
              _id: null,
              addToCartCount: {
                $sum: {
                  $cond: [{ $eq: ["$eventType", "add_to_cart"] }, 1, 0],
                },
              },
              removeFromCartCount: {
                $sum: {
                  $cond: [{ $eq: ["$eventType", "remove_from_cart"] }, 1, 0],
                },
              },
              checkoutStartedCount: {
                $sum: {
                  $cond: [{ $eq: ["$eventType", "checkout_started"] }, 1, 0],
                },
              },
              uniqueSessions: { $addToSet: "$sessionId" },
              lastCartEventAt: { $max: "$timestamp" },
            },
          },
          {
            $project: {
              _id: 0,
              addToCartCount: 1,
              removeFromCartCount: 1,
              checkoutStartedCount: 1,
              uniqueSessionCount: { $size: "$uniqueSessions" },
              lastCartEventAt: 1,
            },
          },
        ])
        .toArray(),
      purchases
        .aggregate([
          {
            $match: {
              ...identityFilter,
              ...withTimestampRange(from, to),
              ...purchaseItemMatch,
            },
          },
          { $unwind: "$products" },
          {
            $match: {
              $or: [
                { "products.productId": productId },
                { "products.product_id": productId },
                { "products.id": productId },
                { "products._id": productId },
              ],
            },
          },
          {
            $group: {
              _id: null,
              purchaseOrders: {
                $addToSet: {
                  $ifNull: ["$orderId", { $toString: "$_id" }],
                },
              },
              purchaseEvents: { $addToSet: "$eventId" },
              uniqueSessions: { $addToSet: "$sessionId" },
              attributedRevenue: {
                $sum: {
                  $ifNull: [
                    "$products.subTotal",
                    {
                      $multiply: [
                        { $ifNull: ["$products.price", 0] },
                        { $ifNull: ["$products.quantity", 0] },
                      ],
                    },
                  ],
                },
              },
              lastPurchasedAt: { $max: "$timestamp" },
            },
          },
          {
            $project: {
              _id: 0,
              purchaseCount: { $size: "$purchaseOrders" },
              purchaseEventCount: { $size: "$purchaseEvents" },
              uniqueSessionCount: { $size: "$uniqueSessions" },
              attributedRevenue: 1,
              lastPurchasedAt: 1,
            },
          },
        ])
        .toArray(),
      events
        .find({
          ...identityFilter,
          ...withTimestampRange(from, to),
          ...timelineProductMatch,
        })
        .sort({ timestamp: 1 })
        .limit(limit)
        .toArray(),
      events
        .aggregate([
          {
            $match: {
              ...identityFilter,
              ...withTimestampRange(from, to),
              ...timelineProductMatch,
            },
          },
          {
            $group: {
              _id: "$sessionId",
              firstSeenAt: { $min: "$timestamp" },
              lastSeenAt: { $max: "$timestamp" },
              eventCount: { $sum: 1 },
              productViewCount: {
                $sum: {
                  $cond: [{ $eq: ["$eventType", "product_view"] }, 1, 0],
                },
              },
              addToCartCount: {
                $sum: {
                  $cond: [{ $eq: ["$eventType", "add_to_cart"] }, 1, 0],
                },
              },
              checkoutStartedCount: {
                $sum: {
                  $cond: [{ $eq: ["$eventType", "checkout_started"] }, 1, 0],
                },
              },
              maxScrollDepth: {
                $max: {
                  $ifNull: [
                    "$metadata.maxScrollDepth",
                    "$metadata.depthPercent",
                  ],
                },
              },
            },
          },
          { $sort: { lastSeenAt: -1 } },
          { $limit: 200 },
        ])
        .toArray(),
      productEvents
        .aggregate([
          {
            $match: {
              ...identityFilter,
              ...withTimestampRange(from, to),
              productId,
              eventType: "hover_duration",
            },
          },
          {
            $group: {
              _id: "$sessionId",
              hoverDurationMs: { $sum: "$hoverDurationMs" },
            },
          },
        ])
        .toArray(),
      purchases
        .aggregate([
          {
            $match: {
              ...identityFilter,
              ...withTimestampRange(from, to),
              ...purchaseItemMatch,
            },
          },
          { $unwind: "$products" },
          {
            $match: {
              $or: [
                { "products.productId": productId },
                { "products.product_id": productId },
                { "products.id": productId },
                { "products._id": productId },
              ],
            },
          },
          {
            $group: {
              _id: "$sessionId",
              purchaseOrders: {
                $addToSet: {
                  $ifNull: ["$orderId", { $toString: "$_id" }],
                },
              },
              attributedRevenue: {
                $sum: {
                  $ifNull: [
                    "$products.subTotal",
                    {
                      $multiply: [
                        { $ifNull: ["$products.price", 0] },
                        { $ifNull: ["$products.quantity", 0] },
                      ],
                    },
                  ],
                },
              },
              lastPurchasedAt: { $max: "$timestamp" },
            },
          },
          {
            $project: {
              _id: 1,
              purchaseCount: { $size: "$purchaseOrders" },
              attributedRevenue: 1,
              lastPurchasedAt: 1,
            },
          },
        ])
        .toArray(),
    ]);

    const productSummary = productSummaryRows[0] || {};
    const cartSummary = cartSummaryRows[0] || {};
    const purchaseSummary = purchaseSummaryRows[0] || {};

    const productName = Array.isArray(productSummary.productNames)
      ? productSummary.productNames.find((value) =>
          String(value || "").trim(),
        ) || null
      : null;

    const hoverBySession = new Map(
      hoverBySessionRows.map((row) => [
        String(row?._id || ""),
        toFiniteNumber(row?.hoverDurationMs),
      ]),
    );

    const purchasesBySession = new Map(
      purchaseBySessionRows.map((row) => [
        String(row?._id || ""),
        {
          purchaseCount: toFiniteNumber(row?.purchaseCount),
          attributedRevenue: toFiniteNumber(row?.attributedRevenue),
          lastPurchasedAt: row?.lastPurchasedAt || null,
        },
      ]),
    );

    const sessions = sessionRows.map((row) => {
      const currentSessionId = String(row?._id || "");
      const purchaseRow = purchasesBySession.get(currentSessionId) || {
        purchaseCount: 0,
        attributedRevenue: 0,
        lastPurchasedAt: null,
      };

      return {
        sessionId: currentSessionId,
        firstSeenAt: row?.firstSeenAt || null,
        lastSeenAt: row?.lastSeenAt || null,
        eventCount: toFiniteNumber(row?.eventCount),
        productViewCount: toFiniteNumber(row?.productViewCount),
        addToCartCount: toFiniteNumber(row?.addToCartCount),
        checkoutStartedCount: toFiniteNumber(row?.checkoutStartedCount),
        maxScrollDepth: toFiniteNumber(row?.maxScrollDepth),
        hoverDurationMs: hoverBySession.get(currentSessionId) || 0,
        purchaseCount: purchaseRow.purchaseCount,
        attributedRevenue: purchaseRow.attributedRevenue,
        lastPurchasedAt: purchaseRow.lastPurchasedAt,
      };
    });

    const summary = {
      productViews: toFiniteNumber(productSummary.views),
      uniqueSessions: toFiniteNumber(productSummary.uniqueSessionCount),
      firstViewedAt: productSummary.firstViewedAt || null,
      lastViewedAt: productSummary.lastViewedAt || null,
      hoverEvents: toFiniteNumber(productSummary.hoverEvents),
      avgHoverDurationMs: toFiniteNumber(productSummary.avgHoverDurationMs),
      totalHoverDurationMs: toFiniteNumber(productSummary.totalHoverDurationMs),
      addToCartCount: toFiniteNumber(cartSummary.addToCartCount),
      removeFromCartCount: toFiniteNumber(cartSummary.removeFromCartCount),
      checkoutStartedCount: toFiniteNumber(cartSummary.checkoutStartedCount),
      purchaseCount: toFiniteNumber(purchaseSummary.purchaseCount),
      purchaseEventCount: toFiniteNumber(purchaseSummary.purchaseEventCount),
      purchaseSessionCount: toFiniteNumber(purchaseSummary.uniqueSessionCount),
      attributedRevenue: toFiniteNumber(purchaseSummary.attributedRevenue),
      lastPurchasedAt: purchaseSummary.lastPurchasedAt || null,
      converted: toFiniteNumber(purchaseSummary.purchaseCount) > 0,
      roamingWithoutCart:
        toFiniteNumber(productSummary.views) > 0 &&
        toFiniteNumber(cartSummary.addToCartCount) === 0 &&
        toFiniteNumber(purchaseSummary.purchaseCount) === 0,
    };

    return res.status(200).json({
      success: true,
      error: false,
      data: {
        scope: {
          userId: userId || null,
          sessionId: sessionId || null,
          productId,
          from: from.toISOString(),
          to: to.toISOString(),
        },
        product: {
          productId,
          productName,
        },
        summary,
        sessions,
        timeline: timelineDocs.map(sanitizeTimelineEvent),
      },
    });
  } catch (error) {
    console.error(
      "[behavior-analytics] product journey error:",
      error?.message || error,
    );
    return res
      .status(500)
      .json(buildErrorResponse("Failed to load product journey", error));
  }
};

export const getBehaviorSessions = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();
    const sessionsCollection = await getAnalyticsCollection(db, "sessions", [
      "user_sessions",
    ]);

    const { from, to } = resolveDateRange(req.query);
    const type = normalizeSessionType(req.query.type);
    const searchQuery = String(req.query.q || "").trim();
    const page = toPositiveInt(req.query.page, 1, 100_000);
    const limit = toPositiveInt(req.query.limit, 25, 250);
    const skip = Math.max((page - 1) * limit, 0);

    const baseFilter = {};

    const queryFilter = {
      ...baseFilter,
      ...buildSessionTypeFilter(type),
    };

    if (searchQuery) {
      const regex = new RegExp(escapeRegex(searchQuery), "i");
      queryFilter.$or = [{ sessionId: regex }, { userId: regex }];
    }

    const toSessionRangeMatch = (filter = {}) =>
      buildSessionOverlapMatch(from, to, filter);

    const [items, totalRows, guestRows, loggedInRows] = await Promise.all([
      sessionsCollection
        .aggregate([
          {
            $addFields: {
              ...buildBehaviorSessionBaseFields(),
              maxScrollDepthValue: toNumberExpression("$maxScrollDepth", 0),
              ...buildSessionOverlapFields(),
            },
          },
          {
            $match: toSessionRangeMatch(queryFilter),
          },
          {
            $match: buildBehaviorSessionQualityMatch(),
          },
          { $sort: { sessionEndDate: -1, startedAtDate: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              sessionId: 1,
              userId: 1,
              startedAt: { $ifNull: ["$startedAtDate", null] },
              endedAt: { $ifNull: ["$endedAtDate", null] },
              lastSeenAt: { $ifNull: ["$lastSeenAtDate", null] },
              totalActiveTime: {
                $cond: [
                  { $gt: ["$totalActiveTimeValue", 0] },
                  "$totalActiveTimeValue",
                  "$durationMsValue",
                ],
              },
              isActive: 1,
              pageViews: "$pageViewsValue",
              eventCount: "$eventCountValue",
              maxScrollDepth: "$maxScrollDepthValue",
              deviceType: 1,
              browser: 1,
              ipAddress: { $ifNull: ["$ipAddress", ""] },
              location: 1,
            },
          },
        ])
        .toArray(),
      sessionsCollection
        .aggregate([
          {
            $addFields: {
              ...buildBehaviorSessionBaseFields(),
              ...buildSessionOverlapFields(),
            },
          },
          {
            $match: toSessionRangeMatch(queryFilter),
          },
          {
            $match: buildBehaviorSessionQualityMatch(),
          },
          {
            $count: "count",
          },
        ])
        .toArray(),
      sessionsCollection
        .aggregate([
          {
            $addFields: {
              ...buildBehaviorSessionBaseFields(),
              ...buildSessionOverlapFields(),
            },
          },
          {
            $match: toSessionRangeMatch(buildSessionTypeFilter("guest")),
          },
          {
            $match: buildBehaviorSessionQualityMatch(),
          },
          {
            $count: "count",
          },
        ])
        .toArray(),
      sessionsCollection
        .aggregate([
          {
            $addFields: {
              ...buildBehaviorSessionBaseFields(),
              ...buildSessionOverlapFields(),
            },
          },
          {
            $match: toSessionRangeMatch(buildSessionTypeFilter("logged_in")),
          },
          {
            $match: buildBehaviorSessionQualityMatch(),
          },
          {
            $count: "count",
          },
        ])
        .toArray(),
    ]);

    const total = Number(totalRows?.[0]?.count || 0);
    const guestCount = Number(guestRows?.[0]?.count || 0);
    const loggedInCount = Number(loggedInRows?.[0]?.count || 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return res.status(200).json({
      success: true,
      error: false,
      data: {
        items: items.map(sanitizeSessionSummary),
        filter: {
          type,
          q: searchQuery || "",
          from: from.toISOString(),
          to: to.toISOString(),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasPrev: page > 1,
          hasNext: page < totalPages,
        },
        totals: {
          all: guestCount + loggedInCount,
          guest: guestCount,
          loggedIn: loggedInCount,
        },
      },
    });
  } catch (error) {
    console.error(
      "[behavior-analytics] sessions list error:",
      error?.message || error,
    );
    return res
      .status(500)
      .json(buildErrorResponse("Failed to load behavior sessions", error));
  }
};

export const getBehaviorTimeline = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();

    const userId = normalizeUserId(
      req.query.userId || req.params?.userId || "",
    );
    const sessionId = normalizeSessionId(
      req.query.sessionId || req.params?.sessionId || "",
    );
    const limit = toPositiveInt(req.query.limit, 1000, 20_000);

    const { from, to } = resolveDateRange(req.query);

    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Either userId or sessionId is required",
      });
    }

    if (sessionId) {
      const timeline = await getSessionTimeline(sessionId, {
        db,
        limit,
        from,
        to,
      });

      return res.status(200).json({
        success: true,
        error: false,
        data: {
          type: "session",
          sessionId,
          timeline,
        },
      });
    }

    const timeline = await getUserTimeline(userId, {
      db,
      limit,
      from,
      to,
    });

    return res.status(200).json({
      success: true,
      error: false,
      data: {
        type: "user",
        userId,
        timeline,
      },
    });
  } catch (error) {
    console.error(
      "[behavior-analytics] timeline error:",
      error?.message || error,
    );
    return res
      .status(500)
      .json(buildErrorResponse("Failed to load timeline", error));
  }
};

export default {
  getAdminAnalyticsOverview,
  getAdminAnalyticsCharts,
  exportAdminAnalyticsPdfReport,
  exportBehaviorAnalyticsPdfReport,
  getAdminUserActivity,
  getBehaviorAnalyticsOverview,
  getBehaviorAnalyticsEngagement,
  getBehaviorAnalyticsPerformance,
  getBehaviorAnalyticsUserActivity,
  getBehaviorProductJourney,
  getBehaviorSessions,
  getBehaviorTimeline,
};
