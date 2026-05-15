import {
  ensureAnalyticsIndexes,
  getAnalyticsDb,
} from "./analyticsDb.service.js";

const RAW_EVENTS_TTL_DAYS = Math.max(
  Number(process.env.ANALYTICS_RAW_EVENTS_TTL_DAYS || 90),
  1,
);

const toDate = (value) => {
  const parsed = new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
};

const toSafeString = (value, fallback = "") => String(value ?? fallback).trim();

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const shouldTrackAsPageView = (eventType) =>
  String(eventType || "")
    .trim()
    .toLowerCase() === "page_view_started";

const shouldPersistPageViewRecord = (eventType) =>
  String(eventType || "")
    .trim()
    .toLowerCase() === "page_view_ended";

const shouldPersistSectionViewRecord = (eventType) =>
  String(eventType || "")
    .trim()
    .toLowerCase() === "section_visible_duration";

const shouldTrackAsProductEvent = (eventType) => {
  const normalized = String(eventType || "")
    .trim()
    .toLowerCase();
  return ["product_view", "hover_duration", "product_click"].includes(
    normalized,
  );
};

const shouldTrackAsCartEvent = (eventType) => {
  const normalized = String(eventType || "")
    .trim()
    .toLowerCase();
  return ["add_to_cart", "remove_from_cart", "checkout_started"].includes(
    normalized,
  );
};

const shouldTrackAsPurchase = (eventType) =>
  String(eventType || "")
    .trim()
    .toLowerCase() === "purchase_completed";

const shouldTrackAsSearchEvent = (eventType) =>
  ["search", "search_query"].includes(
    String(eventType || "")
      .trim()
      .toLowerCase(),
  );

const toNullableString = (value, maxLength = 2048) => {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
};

const toNonNegativeNumber = (value, fallback = 0) =>
  Math.max(toFiniteNumber(value, fallback), 0);

const resolveHostname = (value) => {
  const candidate = String(value || "").trim();
  if (!candidate) return "";

  try {
    const parsed = new URL(candidate, "https://tracking.local");
    return String(parsed.hostname || "")
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
};

export const resolveSourceDomain = (event = {}) => {
  const metadata =
    event?.metadata && typeof event.metadata === "object" ? event.metadata : {};
  const explicitSourceDomain = toSafeString(
    event.sourceDomain || metadata.sourceDomain || "",
  ).toLowerCase();

  if (explicitSourceDomain) {
    return explicitSourceDomain;
  }

  const referrerDomain = resolveHostname(event.referrer);
  return referrerDomain || "direct";
};

const resolveSearchKeyword = (metadata = {}) =>
  toSafeString(
    metadata.keyword ||
      metadata.query ||
      metadata.searchTerm ||
      metadata.term ||
      "",
  );

const resolveSearchResultsCount = (metadata = {}) =>
  toNonNegativeNumber(
    metadata.resultsCount ?? metadata.count ?? metadata.totalResults ?? 0,
    0,
  );

const resolvePageViewDoc = (event = {}) => {
  const metadata =
    event?.metadata && typeof event.metadata === "object" ? event.metadata : {};
  const endedAt = toDate(metadata.endedAt || event.timestamp);
  const durationMs = toNonNegativeNumber(
    metadata.durationMs ??
      metadata.activeTimeMs ??
      metadata.pageActiveMs ??
      0,
    0,
  );
  const startedAt = toDate(
    metadata.startedAt || new Date(endedAt.getTime() - durationMs),
  );

  return {
    eventId: event.eventId,
    pageViewId: toNullableString(metadata.pageViewId, 128),
    sessionId: event.sessionId,
    userId: event.userId,
    pageUrl: toSafeString(event.pageUrl || ""),
    path: toNullableString(metadata.path, 1024),
    title: toNullableString(metadata.title, 256),
    startedAt,
    endedAt,
    durationMs,
    activeTimeMs: toNonNegativeNumber(
      metadata.activeTimeMs ?? metadata.pageActiveMs ?? durationMs,
      durationMs,
    ),
    maxScrollDepth: toNonNegativeNumber(metadata.maxScrollDepth ?? 0, 0),
    reason: toNullableString(metadata.reason, 64),
    metadata,
    createdAt: endedAt,
    updatedAt: endedAt,
  };
};

const resolveSectionViewDoc = (event = {}) => {
  const metadata =
    event?.metadata && typeof event.metadata === "object" ? event.metadata : {};
  const endedAt = toDate(event.timestamp);
  const durationMs = toNonNegativeNumber(metadata.durationMs ?? 0, 0);
  const startedAt = toDate(
    metadata.startedAt || new Date(endedAt.getTime() - durationMs),
  );
  const sectionName = toSafeString(
    metadata.sectionName || metadata.section || metadata.sectionKey || "",
  );

  if (!sectionName) {
    return null;
  }

  return {
    eventId: event.eventId,
    sessionId: event.sessionId,
    userId: event.userId,
    pageUrl: toSafeString(event.pageUrl || ""),
    sectionName,
    sectionKey: toNullableString(metadata.sectionKey, 180),
    pageViewId: toNullableString(metadata.pageViewId, 128),
    startedAt,
    endedAt,
    durationMs,
    reason: toNullableString(metadata.reason, 64),
    metadata,
    createdAt: endedAt,
    updatedAt: endedAt,
  };
};

export const resolveSessionSummaryPatch = (event = {}) => {
  const metadata =
    event?.metadata && typeof event.metadata === "object" ? event.metadata : {};

  const visitorId = toNullableString(
    metadata.visitorId ?? metadata.visitor_id,
    128,
  );
  const sessionActiveMs = toNonNegativeNumber(
    metadata.sessionActiveMs ?? metadata.totalActiveTime,
    0,
  );
  const pageActiveMs = toNonNegativeNumber(
    metadata.pageActiveMs ?? metadata.activeTimeMs,
    0,
  );
  const totalActiveTime = Math.max(sessionActiveMs, pageActiveMs, 0);
  const maxScrollDepth = toNonNegativeNumber(
    metadata.maxScrollDepth ?? metadata.depthPercent,
    0,
  );
  const endedAt =
    String(event?.eventType || "").trim().toLowerCase() === "session_end"
      ? toDate(metadata.endedAt || event.timestamp)
      : null;

  return {
    visitorId,
    totalActiveTime,
    maxScrollDepth,
    endedAt,
    isActive:
      String(event?.eventType || "").trim().toLowerCase() !== "session_end",
  };
};

export const normalizeEvent = (event = {}) => {
  const timestamp = toDate(event.timestamp);
  const eventType = toSafeString(
    event.eventType || event.event_name,
  ).toLowerCase();
  const metadata =
    event?.metadata && typeof event.metadata === "object" ? event.metadata : {};
  const visitorId = toNullableString(
    metadata.visitorId ?? metadata.visitor_id,
    128,
  );

  const productId =
    toSafeString(
      metadata.productId ||
        metadata.product_id ||
        metadata.id ||
        metadata?.product?._id ||
        metadata?.product?.id,
    ) || null;
  const productName =
    toSafeString(
      metadata.productName || metadata.name || metadata?.product?.name,
    ) || null;

  return {
    eventId: toSafeString(event.eventId),
    eventType,
    sessionId: toSafeString(event.sessionId || event.session_id),
    userId: toSafeString(event.userId || event.user_id) || null,
    visitorId,
    timestamp,
    pageUrl: toSafeString(event.pageUrl || event.page || ""),
    referrer: toSafeString(event.referrer || ""),
    ipAddress: toSafeString(event.ipAddress || "unknown"),
    userAgent: toSafeString(event.userAgent || "unknown"),
    deviceType: toSafeString(event.deviceType || "desktop"),
    browser: toSafeString(event.browser || "Other"),
    sourceDomain: resolveSourceDomain(event),
    location:
      event?.location && typeof event.location === "object"
        ? {
            country:
              toSafeString(event.location.country || "unknown") || "unknown",
            city: toSafeString(event.location.city || "unknown") || "unknown",
          }
        : { country: "unknown", city: "unknown" },
    metadata,
    productId,
    productName,
    hoverTarget: toSafeString(metadata.hoverTarget || "") || null,
    hoverDurationMs: toNonNegativeNumber(
      metadata.hoverDurationMs ?? metadata.durationMs ?? 0,
      0,
    ),
    orderId: toSafeString(metadata.orderId || "") || null,
    amount: toFiniteNumber(
      metadata.revenue ?? metadata.total ?? metadata.amount,
      0,
    ),
    quantity: toFiniteNumber(metadata.quantity, 0),
  };
};

export const persistTrackingBatchDirect = async ({
  sessionId,
  events = [],
  source = "tracking_api",
  consent = "unknown",
}) => {
  if (!Array.isArray(events) || events.length === 0) {
    return { insertedEvents: 0, duplicateEvents: 0, mode: "direct" };
  }

  await ensureAnalyticsIndexes();
  const db = await getAnalyticsDb();

  const processedAt = new Date();
  const expireAt = new Date(
    processedAt.getTime() + RAW_EVENTS_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const normalizedEvents = events.map((event) =>
    normalizeEvent({ ...event, sessionId }),
  );

  const rawOps = normalizedEvents.map((event) => ({
    updateOne: {
      filter: { eventId: event.eventId },
      update: {
        $setOnInsert: {
          eventId: event.eventId,
          eventType: event.eventType,
          sessionId: event.sessionId,
          userId: event.userId,
          visitorId: event.visitorId,
          timestamp: event.timestamp,
          pageUrl: event.pageUrl,
          referrer: event.referrer,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          deviceType: event.deviceType,
          browser: event.browser,
          location: event.location,
          sourceDomain: event.sourceDomain,
          metadata: event.metadata,
          consent,
          source,
          expiresAt: expireAt,
          createdAt: processedAt,
        },
        $set: {
          updatedAt: processedAt,
        },
      },
      upsert: true,
    },
  }));

  const writeResult = await db.collection("events_raw").bulkWrite(rawOps, {
    ordered: false,
  });

  const upsertedIndexes = new Set(
    Object.keys(writeResult?.upsertedIds || {}).map((key) => Number(key)),
  );
  const freshEvents = normalizedEvents.filter((_, index) =>
    upsertedIndexes.has(index),
  );
  const duplicateEvents = Math.max(
    normalizedEvents.length - freshEvents.length,
    0,
  );

  if (freshEvents.length === 0) {
    return { insertedEvents: 0, duplicateEvents, mode: "direct" };
  }

  const sessionOps = [];
  const pageViewOps = [];
  const sectionViewOps = [];
  const productOps = [];
  const cartOps = [];
  const purchaseOps = [];
  const searchOps = [];

  for (const event of freshEvents) {
    const sessionPatch = resolveSessionSummaryPatch(event);
    sessionOps.push({
      updateOne: {
        filter: { sessionId: event.sessionId },
        update: {
          $setOnInsert: {
            sessionId: event.sessionId,
            createdAt: processedAt,
          },
          $set: {
            updatedAt: processedAt,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            deviceType: event.deviceType,
            browser: event.browser,
            location: event.location,
            isActive: sessionPatch.isActive,
            ...(event.userId ? { userId: event.userId } : {}),
            ...(sessionPatch.visitorId
              ? { visitorId: sessionPatch.visitorId }
              : {}),
            ...(sessionPatch.endedAt ? { endedAt: sessionPatch.endedAt } : {}),
          },
          $min: { startedAt: event.timestamp },
          $max: { lastSeenAt: event.timestamp },
          $inc: {
            eventCount: 1,
            pageViews: shouldTrackAsPageView(event.eventType) ? 1 : 0,
          },
        },
        upsert: true,
      },
    });

    if (sessionPatch.totalActiveTime > 0 || sessionPatch.maxScrollDepth > 0) {
      const update = sessionOps[sessionOps.length - 1]?.updateOne?.update;
      update.$max = {
        ...(update.$max || {}),
        ...(sessionPatch.totalActiveTime > 0
          ? {
              totalActiveTime: sessionPatch.totalActiveTime,
              durationMs: sessionPatch.totalActiveTime,
            }
          : {}),
        ...(sessionPatch.maxScrollDepth > 0
          ? {
              maxScrollDepth: sessionPatch.maxScrollDepth,
            }
          : {}),
      };
    }

    if (shouldPersistPageViewRecord(event.eventType)) {
      const pageViewDoc = resolvePageViewDoc(event);
      pageViewOps.push({
        updateOne: {
          filter: { eventId: event.eventId },
          update: {
            $setOnInsert: pageViewDoc,
          },
          upsert: true,
        },
      });
    }

    if (shouldPersistSectionViewRecord(event.eventType)) {
      const sectionViewDoc = resolveSectionViewDoc(event);
      if (sectionViewDoc) {
        sectionViewOps.push({
          updateOne: {
            filter: { eventId: event.eventId },
            update: {
              $setOnInsert: sectionViewDoc,
            },
            upsert: true,
          },
        });
      }
    }

    if (shouldTrackAsProductEvent(event.eventType)) {
      productOps.push({
        updateOne: {
          filter: { eventId: event.eventId },
          update: {
            $setOnInsert: {
              eventId: event.eventId,
              eventType: event.eventType,
              sessionId: event.sessionId,
              userId: event.userId,
              timestamp: event.timestamp,
              pageUrl: event.pageUrl,
              metadata: event.metadata,
              productId: event.productId,
              productName: event.productName,
              hoverTarget: event.hoverTarget,
              hoverDurationMs: event.hoverDurationMs,
              createdAt: processedAt,
              updatedAt: processedAt,
            },
          },
          upsert: true,
        },
      });
    }

    if (shouldTrackAsCartEvent(event.eventType)) {
      cartOps.push({
        updateOne: {
          filter: { eventId: event.eventId },
          update: {
            $setOnInsert: {
              eventId: event.eventId,
              eventType: event.eventType,
              sessionId: event.sessionId,
              userId: event.userId,
              timestamp: event.timestamp,
              pageUrl: event.pageUrl,
              metadata: event.metadata,
              productId: event.productId,
              productName: event.productName,
              quantity: event.quantity,
              createdAt: processedAt,
              updatedAt: processedAt,
            },
          },
          upsert: true,
        },
      });
    }

    if (shouldTrackAsPurchase(event.eventType)) {
      purchaseOps.push({
        updateOne: {
          filter: { eventId: event.eventId },
          update: {
            $setOnInsert: {
              eventId: event.eventId,
              sessionId: event.sessionId,
              userId: event.userId,
              timestamp: event.timestamp,
              orderId: event.orderId,
              amount: event.amount,
              currency:
                toSafeString(event.metadata?.currency || "INR") || "INR",
              paymentMethod:
                toSafeString(event.metadata?.paymentMethod || "unknown") ||
                "unknown",
              products: Array.isArray(event.metadata?.items)
                ? event.metadata.items.slice(0, 200)
                : [],
              createdAt: processedAt,
              updatedAt: processedAt,
            },
          },
          upsert: true,
        },
      });
    }

    if (shouldTrackAsSearchEvent(event.eventType)) {
      const keyword = resolveSearchKeyword(event.metadata || {});
      if (keyword) {
        searchOps.push({
          updateOne: {
            filter: { eventId: event.eventId },
            update: {
              $setOnInsert: {
                eventId: event.eventId,
                sessionId: event.sessionId,
                userId: event.userId,
                timestamp: event.timestamp,
                keyword,
                resultsCount: resolveSearchResultsCount(event.metadata || {}),
                pageUrl: event.pageUrl,
                metadata: event.metadata,
                createdAt: processedAt,
                updatedAt: processedAt,
              },
            },
            upsert: true,
          },
        });
      }
    }
  }

  if (sessionOps.length) {
    await db.collection("sessions").bulkWrite(sessionOps, { ordered: false });
  }
  if (pageViewOps.length) {
    await db.collection("page_views").bulkWrite(pageViewOps, { ordered: false });
  }
  if (sectionViewOps.length) {
    await db
      .collection("section_views")
      .bulkWrite(sectionViewOps, { ordered: false });
  }
  if (productOps.length) {
    await db
      .collection("product_events")
      .bulkWrite(productOps, { ordered: false });
  }
  if (cartOps.length) {
    await db.collection("cart_events").bulkWrite(cartOps, { ordered: false });
  }
  if (purchaseOps.length) {
    await db.collection("purchases").bulkWrite(purchaseOps, { ordered: false });
  }
  if (searchOps.length) {
    await db
      .collection("search_events")
      .bulkWrite(searchOps, { ordered: false });
  }

  return {
    insertedEvents: freshEvents.length,
    duplicateEvents,
    mode: "direct",
  };
};

export const hasActiveAnalyticsWorker = async ({
  staleThresholdMs = 60_000,
} = {}) => {
  await ensureAnalyticsIndexes();
  const db = await getAnalyticsDb();

  const activeThreshold = new Date(
    Date.now() - Math.max(Number(staleThresholdMs) || 60_000, 1_000),
  );
  const count = await db.collection("worker_health").countDocuments({
    updatedAt: { $gte: activeThreshold },
  });

  return count > 0;
};
