import { ensureAnalyticsIndexes, getAnalyticsDb } from "../services/analytics/analyticsDb.service.js";
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
  const defaultStart = new Date(now.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
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

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  startedAt: session?.startedAt || null,
  endedAt: session?.endedAt || null,
  lastSeenAt: session?.lastSeenAt || null,
  totalActiveTime: toFiniteNumber(session?.totalActiveTime ?? session?.durationMs, 0),
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
  const { sessions, purchases } = await resolveCollections(db);

  const activeThreshold = new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000);
  const [sessionOverviewRows, purchasesDistinctSessions, revenueAggregation] = await Promise.all([
    sessions
      .aggregate([
        {
          $addFields: {
            startedAtDate: toDateExpression("$startedAt"),
            endedAtDate: toDateExpression("$endedAt"),
            lastSeenAtDate: toDateExpression("$lastSeenAt"),
            totalActiveTimeValue: toNumberExpression("$totalActiveTime", 0),
            durationMsValue: toNumberExpression("$durationMs", 0),
            pageViewsValue: toNumberExpression("$pageViews", 0),
            eventCountValue: toNumberExpression("$eventCount", 0),
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
          $project: {
            userId: 1,
            isActive: 1,
            lastSeenAtDate: 1,
            isBounce: {
              $or: [{ $lte: ["$pageViewsValue", 1] }, { $lte: ["$eventCountValue", 1] }],
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
                              $max: [{ $subtract: ["$$endDate", "$startedAtDate"] }, 0],
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
  ]);

  const overviewRow = sessionOverviewRows?.[0] || {};
  const totalSessions = Number(overviewRow.totalSessions || 0);
  const activeUsers = Number(overviewRow.activeUsers || 0);
  const bounceSessions = Number(overviewRow.bounceSessions || 0);
  const avgActiveTimeMs = Number(overviewRow.avgActiveTimeMs || 0);
  const sessionsWithPurchase = Number(purchasesDistinctSessions?.[0]?.count || 0);
  const revenue = Number(revenueAggregation?.[0]?.revenue || 0);
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
  };
};

const getChartData = async (db, from, to, interval = "day") => {
  const { sessions, purchases, productEvents, searchEvents, events } = await resolveCollections(db);
  const bucketFormat = toBucketFormat(interval);
  const productCollectionName = productEvents.collectionName;

  const visitorsOverTime = await sessions
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
  const { events, sectionViews, productEvents, sessions } = await resolveCollections(db);

  const resolveClickTargetFromRow = (row = {}) => {
    const trackName = String(row?.trackName || "")
      .trim()
      .toLowerCase();
    if (trackName) return trackName;

    const text = String(row?.text || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 120);
    if (text) return text;

    const id = String(row?.elementId || "").trim();
    if (id) return `#${id}`;

    const className = String(row?.className || "")
      .trim()
      .replace(/\s+/g, ".")
      .replace(/^\.+/, "");
    if (className) return `.${className.slice(0, 100)}`;

    const tagName = String(row?.tagName || "").trim().toLowerCase();
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

  const [avgScrollDepthAgg, rageClickCount, sectionHeatmap, avgProductHoverAgg, rawClickTargets, userTypeEvents, userTypeSessions, rawButtonClickSessions, rawProductConversionSessions] =
    await Promise.all([
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
              eventType: { $in: ["click_event", "rage_click"] },
            },
          },
          {
            $project: {
              eventType: 1,
              userType: 1,
              pageActiveMs: toNumberExpression("$metadata.pageActiveMs", 0),
              trackName: { $ifNull: ["$metadata.trackName", ""] },
              text: { $ifNull: ["$metadata.text", ""] },
              elementId: { $ifNull: ["$metadata.id", ""] },
              className: { $ifNull: ["$metadata.className", ""] },
              tagName: { $ifNull: ["$metadata.tagName", ""] },
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
                text: "$text",
                elementId: "$elementId",
                className: "$className",
                tagName: "$tagName",
              },
              clickEvents: {
                $sum: {
                  $cond: [{ $eq: ["$eventType", "click_event"] }, 1, 0],
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
                  $cond: [{ $eq: ["$eventType", "click_event"] }, 1, 0],
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
              startedAtDate: toDateExpression("$startedAt"),
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
                    $cond: [{ $gt: ["$$totalActive", 0] }, "$$totalActive", "$$duration"],
                  },
                },
              },
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
              $or: [{ eventType: "click_event" }, { eventType: { $regex: /^product_cta_/i } }],
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
              text: { $ifNull: ["$metadata.text", ""] },
              elementId: { $ifNull: ["$metadata.id", ""] },
              className: { $ifNull: ["$metadata.className", ""] },
              tagName: { $ifNull: ["$metadata.tagName", ""] },
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
                text: "$text",
                elementId: "$elementId",
                className: "$className",
                tagName: "$tagName",
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
              eventType: { $in: ["add_to_cart", "checkout_started", "purchase_completed"] },
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
    userTypeMatrix[key].checkoutStarted = toFiniteNumber(row?.checkoutStarted, 0);
    userTypeMatrix[key].purchases = toFiniteNumber(row?.purchases, 0);
    userTypeMatrix[key].clickEvents = toFiniteNumber(row?.clickEvents, 0);
    userTypeMatrix[key].rageClicks = toFiniteNumber(row?.rageClicks, 0);
    userTypeMatrix[key].avgPageActiveMs = toFiniteNumber(row?.avgPageActiveMs, 0);
  }

  for (const row of userTypeSessions || []) {
    const key = row?._id === "logged_in" ? "logged_in" : "guest";
    userTypeMatrix[key].sessions = toFiniteNumber(row?.sessions, 0);
    userTypeMatrix[key].avgSessionActiveTimeMs = toFiniteNumber(row?.avgActiveTimeMs, 0);
  }

  const attractiveButtons = (rawClickTargets || [])
    .map((row) => {
      const target = resolveClickTargetFromRow({
        trackName: row?._id?.trackName,
        text: row?._id?.text,
        elementId: row?._id?.elementId,
        className: row?._id?.className,
        tagName: row?._id?.tagName,
      });

      const clickEvents = toFiniteNumber(row?.clickEvents, 0);
      const rageClicksCount = toFiniteNumber(row?.rageClicks, 0);
      const avgPreClickDwellMs = toFiniteNumber(row?.avgPreClickDwellMs, 0);
      const totalInteractions = clickEvents + rageClicksCount;
      const score = Number(
        (clickEvents + rageClicksCount * 1.8 + avgPreClickDwellMs / 10000).toFixed(2),
      );

      return {
        target,
        score,
        totalInteractions,
        clickEvents,
        rageClicks: rageClicksCount,
        avgPreClickDwellMs,
        guestInteractions: toFiniteNumber(row?.guestEvents, 0),
        loggedInInteractions: toFiniteNumber(row?.loggedInEvents, 0),
        topSections: Array.isArray(row?.sections)
          ? row.sections.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 3)
          : [],
        topProducts: Array.isArray(row?.products)
          ? row.products.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 3)
          : [],
      };
    })
    .filter((row) => row.totalInteractions > 0)
    .sort((a, b) => b.score - a.score)
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
      trackName: row?._id?.trackName,
      text: row?._id?.text,
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
    aggregateRow.avgPreClickDwellMsSum += toFiniteNumber(row?.avgPreClickDwellMs, 0);

    const isGuestClick = toFiniteNumber(row?.guestClicks, 0) > 0;
    const isLoggedInClick = toFiniteNumber(row?.loggedInClicks, 0) > 0;
    if (isGuestClick) aggregateRow.guestClickedSessions += 1;
    if (isLoggedInClick) aggregateRow.loggedInClickedSessions += 1;

    const conversion = conversionBySessionProduct.get(`${sessionId}::${productId}`);
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
      const sessionsClicked = Math.max(toFiniteNumber(row?.sessionsClicked, 0), 0);
      const sessionsWithAddToCart = Math.max(toFiniteNumber(row?.sessionsWithAddToCart, 0), 0);
      const sessionsWithCheckout = Math.max(toFiniteNumber(row?.sessionsWithCheckout, 0), 0);
      const sessionsWithPurchase = Math.max(toFiniteNumber(row?.sessionsWithPurchase, 0), 0);
      const avgPreClickDwellMs = sessionsClicked
        ? row.avgPreClickDwellMsSum / sessionsClicked
        : 0;

      const clickToCartRate = sessionsClicked > 0 ? (sessionsWithAddToCart / sessionsClicked) * 100 : 0;
      const cartToCheckoutRate = sessionsWithAddToCart > 0 ? (sessionsWithCheckout / sessionsWithAddToCart) * 100 : 0;
      const clickToPurchaseRate = sessionsClicked > 0 ? (sessionsWithPurchase / sessionsClicked) * 100 : 0;

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
        loggedInPurchaseSessions: toFiniteNumber(row.loggedInPurchaseSessions, 0),
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
    topConvertingButtonsByProduct,
    userTypeMatrix,
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

  const healthyWorkers = normalizedWorkers.filter((worker) => !worker.stale).length;
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
    return res.status(500).json(buildErrorResponse("Failed to load analytics overview", error));
  }
};

export const getAdminAnalyticsCharts = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();
    const { from, to } = resolveDateRange(req.query);
    const interval = String(req.query.interval || "day").trim().toLowerCase();

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
    return res.status(500).json(buildErrorResponse("Failed to load analytics charts", error));
  }
};

export const getAdminUserActivity = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();

    const userId = normalizeUserId(req.params?.userId || req.query.userId || "");
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
    console.error("[admin-analytics] user activity error:", error?.message || error);
    return res.status(500).json(buildErrorResponse("Failed to load user activity", error));
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
    console.error("[behavior-analytics] overview error:", error?.message || error);
    return res.status(500).json(buildErrorResponse("Failed to load behavior overview", error));
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
    console.error("[behavior-analytics] engagement error:", error?.message || error);
    return res
      .status(500)
      .json(buildErrorResponse("Failed to load behavior engagement data", error));
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
    console.error("[behavior-analytics] performance error:", error?.message || error);
    return res
      .status(500)
      .json(buildErrorResponse("Failed to load behavior performance data", error));
  }
};

export const getBehaviorAnalyticsUserActivity = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();

    const userId = normalizeUserId(req.query.userId || req.params?.userId || "");
    const sessionId = normalizeSessionId(req.query.sessionId || req.params?.sessionId || "");

    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Either userId or sessionId is required",
      });
    }

    const limit = toPositiveInt(req.query.limit, 1500, 20_000);

    if (sessionId) {
      const [timeline, sessionSummary, productInteractions, purchases] = await Promise.all([
        getSessionTimeline(sessionId, { db, limit }),
        getSessionSummary(sessionId, { db }),
        getSessionProductInteractions(sessionId, { db, limit: 2000 }),
        (async () => {
          const purchasesCollection = await getAnalyticsCollection(db, "purchases", []);
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
          sessionSummary: sessionSummary ? sanitizeSessionSummary(sessionSummary) : null,
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
    console.error("[behavior-analytics] user activity error:", error?.message || error);
    return res
      .status(500)
      .json(buildErrorResponse("Failed to load behavior user activity", error));
  }
};

export const getBehaviorProductJourney = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();

    const userId = normalizeUserId(req.query.userId || req.params?.userId || "");
    const sessionId = normalizeSessionId(req.query.sessionId || req.params?.sessionId || "");
    const productId = normalizeProductId(req.query.productId || req.params?.productId || "");
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

    const { productEvents, cartEvents, purchases, events } = await resolveCollections(db);

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
                  $ifNull: ["$metadata.maxScrollDepth", "$metadata.depthPercent"],
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
      ? productSummary.productNames.find((value) => String(value || "").trim()) || null
      : null;

    const hoverBySession = new Map(
      hoverBySessionRows.map((row) => [String(row?._id || ""), toFiniteNumber(row?.hoverDurationMs)]),
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
    console.error("[behavior-analytics] product journey error:", error?.message || error);
    return res
      .status(500)
      .json(buildErrorResponse("Failed to load product journey", error));
  }
};

export const getBehaviorSessions = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();
    const sessionsCollection = await getAnalyticsCollection(db, "sessions", ["user_sessions"]);

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

    const toSessionRangeMatch = (filter = {}) => ({
      startedAtDate: {
        $gte: from,
        $lte: to,
      },
      ...filter,
    });

    const [items, totalRows, guestRows, loggedInRows] = await Promise.all([
      sessionsCollection
        .aggregate([
          {
            $addFields: {
              startedAtDate: toDateExpression("$startedAt"),
              endedAtDate: toDateExpression("$endedAt"),
              lastSeenAtDate: toDateExpression("$lastSeenAt"),
              totalActiveTimeValue: toNumberExpression("$totalActiveTime", 0),
              durationMsValue: toNumberExpression("$durationMs", 0),
              pageViewsValue: toNumberExpression("$pageViews", 0),
              eventCountValue: toNumberExpression("$eventCount", 0),
              maxScrollDepthValue: toNumberExpression("$maxScrollDepth", 0),
            },
          },
          {
            $match: toSessionRangeMatch(queryFilter),
          },
          { $sort: { startedAtDate: -1 } },
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
              location: 1,
            },
          },
        ])
        .toArray(),
      sessionsCollection
        .aggregate([
          {
            $addFields: {
              startedAtDate: toDateExpression("$startedAt"),
            },
          },
          {
            $match: toSessionRangeMatch(queryFilter),
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
              startedAtDate: toDateExpression("$startedAt"),
            },
          },
          {
            $match: toSessionRangeMatch(buildSessionTypeFilter("guest")),
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
              startedAtDate: toDateExpression("$startedAt"),
            },
          },
          {
            $match: toSessionRangeMatch(buildSessionTypeFilter("logged_in")),
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
    console.error("[behavior-analytics] sessions list error:", error?.message || error);
    return res
      .status(500)
      .json(buildErrorResponse("Failed to load behavior sessions", error));
  }
};

export const getBehaviorTimeline = async (req, res) => {
  try {
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();

    const userId = normalizeUserId(req.query.userId || req.params?.userId || "");
    const sessionId = normalizeSessionId(req.query.sessionId || req.params?.sessionId || "");
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
    console.error("[behavior-analytics] timeline error:", error?.message || error);
    return res.status(500).json(buildErrorResponse("Failed to load timeline", error));
  }
};

export default {
  getAdminAnalyticsOverview,
  getAdminAnalyticsCharts,
  getAdminUserActivity,
  getBehaviorAnalyticsOverview,
  getBehaviorAnalyticsEngagement,
  getBehaviorAnalyticsPerformance,
  getBehaviorAnalyticsUserActivity,
  getBehaviorProductJourney,
  getBehaviorSessions,
  getBehaviorTimeline,
};
