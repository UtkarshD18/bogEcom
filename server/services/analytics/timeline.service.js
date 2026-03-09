import { getAnalyticsDb } from "./analyticsDb.service.js";
import { getAnalyticsCollection } from "./collectionResolver.service.js";

const toPositiveInt = (value, fallback, max = 5000) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const candidate = new Date(value);
  if (Number.isNaN(candidate.getTime())) return null;
  return candidate;
};

const parseTimelineWindow = (options = {}) => {
  const from = toDateOrNull(options.from);
  const to = toDateOrNull(options.to);

  if (from && to && from > to) {
    return { from: to, to: from };
  }

  return { from, to };
};

const sanitizeTimelineEvent = (event) => ({
  eventId: String(event?.eventId || ""),
  eventType: String(event?.eventType || ""),
  sessionId: String(event?.sessionId || ""),
  userId: event?.userId || null,
  timestamp: event?.timestamp,
  pageUrl: String(event?.pageUrl || ""),
  referrer: String(event?.referrer || ""),
  metadata: event?.metadata || {},
});

const buildFilter = ({ userId = null, sessionId = null, from = null, to = null, eventTypes = [] } = {}) => {
  const filter = {};

  if (userId) {
    filter.userId = String(userId).trim();
  }

  if (sessionId) {
    filter.sessionId = String(sessionId).trim();
  }

  if (from || to) {
    filter.timestamp = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  if (Array.isArray(eventTypes) && eventTypes.length > 0) {
    filter.eventType = { $in: eventTypes.map((item) => String(item || "").trim()).filter(Boolean) };
  }

  return filter;
};

const getEventsCollection = async (db) =>
  getAnalyticsCollection(db, "events_raw", ["events"]);

const getSessionsCollection = async (db) =>
  getAnalyticsCollection(db, "sessions", ["user_sessions"]);

const getPurchasesCollection = async (db) =>
  getAnalyticsCollection(db, "purchases", []);

const getProductEventsCollection = async (db) =>
  getAnalyticsCollection(db, "product_events", ["product_views"]);

export const getUserTimeline = async (userId, options = {}) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw new Error("userId is required");
  }

  const db = options.db || (await getAnalyticsDb());
  const eventsCollection = await getEventsCollection(db);
  const { from, to } = parseTimelineWindow(options);
  const limit = toPositiveInt(options.limit, 1000, 20_000);

  const events = await eventsCollection
    .find(
      buildFilter({
        userId: normalizedUserId,
        from,
        to,
        eventTypes: options.eventTypes || [],
      }),
    )
    .sort({ timestamp: 1 })
    .limit(limit)
    .toArray();

  return events.map(sanitizeTimelineEvent);
};

export const getSessionTimeline = async (sessionId, options = {}) => {
  const normalizedSessionId = String(sessionId || "").trim();
  if (!normalizedSessionId) {
    throw new Error("sessionId is required");
  }

  const db = options.db || (await getAnalyticsDb());
  const eventsCollection = await getEventsCollection(db);
  const { from, to } = parseTimelineWindow(options);
  const limit = toPositiveInt(options.limit, 1000, 20_000);

  const events = await eventsCollection
    .find(
      buildFilter({
        sessionId: normalizedSessionId,
        from,
        to,
        eventTypes: options.eventTypes || [],
      }),
    )
    .sort({ timestamp: 1 })
    .limit(limit)
    .toArray();

  return events.map(sanitizeTimelineEvent);
};

export const getUserSessionHistory = async (userId, options = {}) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw new Error("userId is required");
  }

  const db = options.db || (await getAnalyticsDb());
  const sessionsCollection = await getSessionsCollection(db);
  const limit = toPositiveInt(options.limit, 100, 5000);

  return sessionsCollection
    .find({ userId: normalizedUserId })
    .sort({ startedAt: -1 })
    .limit(limit)
    .toArray();
};

export const getSessionSummary = async (sessionId, options = {}) => {
  const normalizedSessionId = String(sessionId || "").trim();
  if (!normalizedSessionId) {
    throw new Error("sessionId is required");
  }

  const db = options.db || (await getAnalyticsDb());
  const sessionsCollection = await getSessionsCollection(db);

  return sessionsCollection.findOne({ sessionId: normalizedSessionId });
};

export const getUserPurchaseHistory = async (userId, options = {}) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw new Error("userId is required");
  }

  const db = options.db || (await getAnalyticsDb());
  const purchasesCollection = await getPurchasesCollection(db);
  const limit = toPositiveInt(options.limit, 100, 5000);

  return purchasesCollection
    .find({ userId: normalizedUserId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
};

export const getSessionProductInteractions = async (sessionId, options = {}) => {
  const normalizedSessionId = String(sessionId || "").trim();
  if (!normalizedSessionId) {
    throw new Error("sessionId is required");
  }

  const db = options.db || (await getAnalyticsDb());
  const productEventsCollection = await getProductEventsCollection(db);
  const limit = toPositiveInt(options.limit, 500, 10_000);

  return productEventsCollection
    .find({ sessionId: normalizedSessionId })
    .sort({ timestamp: 1 })
    .limit(limit)
    .toArray();
};
