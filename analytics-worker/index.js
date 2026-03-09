import dotenv from "dotenv";
import { PubSub } from "@google-cloud/pubsub";
import mongoose from "mongoose";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnvFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return;
    dotenv.config({ path: filePath, override: false });
  } catch {
    // Ignore invalid/missing env files.
  }
};

// Load envs in priority order so local worker works out-of-the-box.
loadEnvFile(path.resolve(process.cwd(), ".env"));
loadEnvFile(path.resolve(process.cwd(), "server", ".env"));
loadEnvFile(path.resolve(__dirname, ".env"));
loadEnvFile(path.resolve(__dirname, "..", "server", ".env"));

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const normalizeEnvValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim();
  }

  return raw;
};

const normalizePrivateKey = (value) => normalizeEnvValue(value).replace(/\\n/g, "\n");

const resolveProjectId = () =>
  normalizeEnvValue(
    process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      process.env.FIREBASE_PROJECT_ID ||
      "",
  );

const resolvePubSubCredentials = () => {
  const clientEmail = normalizeEnvValue(
    process.env.GOOGLE_CLIENT_EMAIL ||
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      process.env.FIREBASE_CLIENT_EMAIL ||
      "",
  );

  const privateKey = normalizePrivateKey(
    process.env.GOOGLE_PRIVATE_KEY ||
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
      process.env.FIREBASE_PRIVATE_KEY ||
      "",
  );

  if (!clientEmail || !privateKey) {
    return null;
  }

  return {
    client_email: clientEmail,
    private_key: privateKey,
  };
};

const deriveDbNameFromMongoUri = (uri) => {
  const value = String(uri || "").trim();
  if (!value) return "";

  try {
    const normalized = value.startsWith("mongodb+srv://")
      ? value.replace(/^mongodb\+srv:\/\//i, "https://")
      : value.replace(/^mongodb:\/\//i, "http://");

    const parsed = new URL(normalized);
    const dbName = String(parsed.pathname || "").replace(/^\/+/, "").trim();
    return dbName || "";
  } catch {
    return "";
  }
};

const resolvedMongoUri = String(
  process.env.ANALYTICS_MONGO_URI || process.env.MONGO_URI || process.env.MONGODB_URI || "",
).trim();

const resolvedDbName =
  String(process.env.ANALYTICS_DB_NAME || "").trim() || deriveDbNameFromMongoUri(resolvedMongoUri) || "analytics";

const config = {
  projectId: resolveProjectId() || undefined,
  topicName: String(process.env.ANALYTICS_PUBSUB_TOPIC || "user-behavior-events").trim() || "user-behavior-events",
  subscriptionName:
    String(process.env.ANALYTICS_PUBSUB_SUBSCRIPTION || "user-behavior-events-sub").trim() ||
    "user-behavior-events-sub",
  deadLetterTopicName:
    String(process.env.ANALYTICS_PUBSUB_DEAD_LETTER_TOPIC || "user-behavior-events-dead-letter")
      .trim() || "user-behavior-events-dead-letter",
  publishDeadLetter: ["true", "1", "yes", "on"].includes(
    String(process.env.ANALYTICS_PUBLISH_DEAD_LETTER || "true").trim().toLowerCase(),
  ),
  mongoUri: resolvedMongoUri,
  dbName: resolvedDbName,
  dbMaxPoolSize: toPositiveInt(process.env.ANALYTICS_DB_MAX_POOL_SIZE, 40),
  dbMinPoolSize: toPositiveInt(process.env.ANALYTICS_DB_MIN_POOL_SIZE, 5),
  batchSize: toPositiveInt(process.env.ANALYTICS_WORKER_BATCH_SIZE, 1000),
  flushIntervalMs: toPositiveInt(process.env.ANALYTICS_WORKER_FLUSH_INTERVAL_MS, 2000),
  maxMessages: toPositiveInt(process.env.ANALYTICS_WORKER_MAX_MESSAGES, 2000),
  rawEventsTtlDays: toPositiveInt(process.env.ANALYTICS_RAW_EVENTS_TTL_DAYS, 90),
  healthCollection: String(process.env.ANALYTICS_WORKER_HEALTH_COLLECTION || "worker_health").trim() || "worker_health",
  healthIntervalMs: toPositiveInt(process.env.ANALYTICS_WORKER_HEALTH_INTERVAL_MS, 10000),
};

const isAuthorizationError = (error) => {
  const code = Number(error?.code);
  const message = String(error?.message || "").toLowerCase();
  return code === 13 || message.includes("not authorized") || message.includes("auth");
};

if (!config.mongoUri) {
  throw new Error("Analytics worker requires ANALYTICS_MONGO_URI or MONGO_URI/MONGODB_URI.");
}

const locationSchema = z
  .object({
    country: z.string().max(128).optional(),
    city: z.string().max(128).optional(),
  })
  .default({});

const eventSchema = z.object({
  eventId: z.string().min(8).max(128),
  eventType: z.string().min(2).max(64),
  sessionId: z.string().min(8).max(128),
  userId: z.string().max(128).nullable(),
  timestamp: z.string().datetime(),
  pageUrl: z.string().max(2048).default(""),
  referrer: z.string().max(2048).default(""),
  ipAddress: z.string().max(128),
  deviceType: z.string().max(64),
  browser: z.string().max(128),
  userAgent: z.string().max(2048).default("unknown"),
  location: locationSchema,
  metadata: z.record(z.unknown()).default({}),
});

const payloadSchema = z.object({
  sessionId: z.string().min(8).max(128),
  events: z.array(eventSchema).min(1).max(5000),
  source: z.string().max(64).optional(),
  consent: z.string().max(32).optional(),
  publishedAt: z.string().datetime().optional(),
});

let connection = null;
let db = null;
let subscription = null;
let pubSubClient = null;
let deadLetterTopic = null;

const pendingRecords = [];
let flushTimeout = null;
let isFlushing = false;
let isShuttingDown = false;
let healthInterval = null;

const workerStats = {
  startedAt: new Date(),
  receivedMessages: 0,
  receivedEvents: 0,
  persistedEvents: 0,
  duplicateEvents: 0,
  invalidMessages: 0,
  invalidEvents: 0,
  failedBatches: 0,
  lastFlushAt: null,
  lastFlushDurationMs: 0,
};

const isTruthy = (value) =>
  ["true", "1", "yes", "on"].includes(String(value || "").trim().toLowerCase());

const toDate = (value) => {
  const candidate = new Date(value);
  if (Number.isNaN(candidate.getTime())) {
    return new Date();
  }
  return candidate;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveDomain = (url) => {
  const value = String(url || "").trim();
  if (!value) return "direct";

  try {
    const parsed = new URL(value, "https://tracking.local");
    if (parsed.hostname === "tracking.local") return "direct";
    return parsed.hostname;
  } catch {
    return "direct";
  }
};

const toSafeString = (value, max = 256, fallback = "") =>
  String(value ?? fallback)
    .trim()
    .slice(0, max);

const normalizeEvent = (rawEvent) => {
  const parsed = eventSchema.parse(rawEvent);
  const timestamp = toDate(parsed.timestamp);
  const metadata = parsed.metadata || {};

  return {
    ...parsed,
    userId: parsed.userId || null,
    timestamp,
    pageUrl: toSafeString(parsed.pageUrl, 2048, ""),
    referrer: toSafeString(parsed.referrer, 2048, ""),
    sourceDomain: resolveDomain(parsed.referrer),
    location: {
      country: toSafeString(parsed.location?.country || "unknown", 128, "unknown") || "unknown",
      city: toSafeString(parsed.location?.city || "unknown", 128, "unknown") || "unknown",
    },
    metadata,
    searchKeyword: toSafeString(
      metadata.query || metadata.keyword || metadata.searchTerm || "",
      256,
      "",
    ),
    searchResultsCount: toNumber(metadata.resultsCount ?? metadata.resultCount, 0),
    orderId: toSafeString(metadata.orderId || "", 128, "") || null,
    amount: toNumber(metadata.revenue ?? metadata.total ?? metadata.amount, 0),
    currency: toSafeString(metadata.currency || "INR", 12, "INR") || "INR",
    paymentMethod: toSafeString(metadata.paymentMethod || "unknown", 64, "unknown") || "unknown",
    productId: toSafeString(
      metadata.productId || metadata.id || metadata.product?._id || metadata.product?.id || "",
      128,
      "",
    ) || null,
    productName:
      toSafeString(metadata.productName || metadata.name || metadata.product?.name || "", 256, "") ||
      null,
    quantity: toNumber(metadata.quantity, 0),
    sectionName: toSafeString(metadata.sectionName || "", 128, "") || null,
    sectionKey: toSafeString(metadata.sectionKey || "", 180, "") || null,
    activeTimeMs: toNumber(metadata.activeTimeMs ?? metadata.sessionActiveMs, 0),
    pageActiveMs: toNumber(metadata.pageActiveMs, 0),
    maxScrollDepth: toNumber(metadata.maxScrollDepth ?? metadata.depthPercent, 0),
  };
};

const getSharedFields = (event, processedAt) => ({
  eventId: event.eventId,
  eventType: event.eventType,
  sessionId: event.sessionId,
  userId: event.userId,
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
  createdAt: processedAt,
  updatedAt: processedAt,
});

const getPubSubClient = () => {
  if (pubSubClient) return pubSubClient;
  const options = {};
  if (config.projectId) {
    options.projectId = config.projectId;
  }
  const credentials = resolvePubSubCredentials();
  if (credentials) {
    options.credentials = credentials;
  }
  pubSubClient = new PubSub(options);
  return pubSubClient;
};

const getDeadLetterTopic = () => {
  if (deadLetterTopic) return deadLetterTopic;
  deadLetterTopic = getPubSubClient().topic(config.deadLetterTopicName);
  return deadLetterTopic;
};

const publishDeadLetter = async ({ message, reason, payload = null, error = null }) => {
  if (!config.publishDeadLetter) return;

  try {
    const envelope = {
      reason: toSafeString(reason, 120, "unknown"),
      subscription: config.subscriptionName,
      topic: config.topicName,
      workerReceivedAt: new Date().toISOString(),
      messageId: message?.id || null,
      attributes: message?.attributes || {},
      payload,
      error: error ? toSafeString(error.message || error, 2000, "unknown") : null,
    };

    await getDeadLetterTopic().publishMessage({
      data: Buffer.from(JSON.stringify(envelope)),
      attributes: {
        reason: envelope.reason,
        sourceSubscription: config.subscriptionName,
      },
    });
  } catch (publishError) {
    console.error("[analytics-worker] dead-letter publish failed:", publishError?.message || publishError);
  }
};

const ensureIndexes = async () => {
  const indexDefinitions = {
    events_raw: [
      [{ eventId: 1 }, { unique: true }],
      [{ sessionId: 1, timestamp: -1 }],
      [{ userId: 1, timestamp: -1 }],
      [{ eventType: 1, timestamp: -1 }],
      [{ timestamp: -1 }],
      [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
    ],
    sessions: [
      [{ sessionId: 1 }, { unique: true }],
      [{ userId: 1, startedAt: -1 }],
      [{ startedAt: -1 }],
      [{ isActive: 1, lastSeenAt: -1 }],
    ],
    page_views: [
      [{ eventId: 1 }, { unique: true }],
      [{ sessionId: 1, startedAt: -1 }],
      [{ userId: 1, startedAt: -1 }],
      [{ pageUrl: 1, startedAt: -1 }],
    ],
    section_views: [
      [{ eventId: 1 }, { unique: true }],
      [{ sessionId: 1, sectionName: 1, startedAt: -1 }],
      [{ userId: 1, sectionName: 1, startedAt: -1 }],
      [{ pageUrl: 1, sectionName: 1, startedAt: -1 }],
    ],
    product_events: [
      [{ eventId: 1 }, { unique: true }],
      [{ sessionId: 1, timestamp: -1 }],
      [{ userId: 1, timestamp: -1 }],
      [{ productId: 1, timestamp: -1 }],
      [{ eventType: 1, timestamp: -1 }],
    ],
    cart_events: [
      [{ eventId: 1 }, { unique: true }],
      [{ sessionId: 1, timestamp: -1 }],
      [{ userId: 1, timestamp: -1 }],
      [{ productId: 1, timestamp: -1 }],
      [{ eventType: 1, timestamp: -1 }],
    ],
    purchases: [
      [{ eventId: 1 }, { unique: true }],
      [{ orderId: 1 }, { sparse: true }],
      [{ sessionId: 1, timestamp: -1 }],
      [{ userId: 1, timestamp: -1 }],
      [{ amount: -1 }],
    ],
    search_events: [
      [{ eventId: 1 }, { unique: true }],
      [{ sessionId: 1, timestamp: -1 }],
      [{ userId: 1, timestamp: -1 }],
      [{ keyword: 1, timestamp: -1 }],
    ],
    worker_health: [
      [{ workerId: 1 }, { unique: true }],
      [{ updatedAt: -1 }],
    ],
  };

  for (const [collectionName, definitions] of Object.entries(indexDefinitions)) {
    const collection = db.collection(collectionName);
    for (const [keys, options = {}] of definitions) {
      await collection.createIndex(keys, options);
    }
  }
};

const persistEventsBatch = async (events, { consent = "unknown", source = "tracking_api" } = {}) => {
  if (events.length === 0) {
    return { insertedEvents: 0, duplicateEvents: 0 };
  }

  const processedAt = new Date();
  const expireAt = new Date(processedAt.getTime() + config.rawEventsTtlDays * 24 * 60 * 60 * 1000);

  const rawOps = events.map((event) => {
    const sharedFields = getSharedFields(event, processedAt);
    const { updatedAt: _ignoredUpdatedAt, ...insertSharedFields } = sharedFields;

    return {
      updateOne: {
        filter: { eventId: event.eventId },
        update: {
          $setOnInsert: {
            ...insertSharedFields,
            consent: event._consent || consent,
            source: event._source || source,
            expiresAt: expireAt,
          },
          $set: {
            updatedAt: processedAt,
          },
        },
        upsert: true,
      },
    };
  });

  const writeResult = await db.collection("events_raw").bulkWrite(rawOps, {
    ordered: false,
  });

  const upsertedIndexes = new Set(
    Object.keys(writeResult?.upsertedIds || {}).map((key) => Number(key)),
  );

  const freshEvents = events.filter((_, index) => upsertedIndexes.has(index));
  const duplicateEvents = Math.max(events.length - freshEvents.length, 0);

  if (freshEvents.length === 0) {
    return { insertedEvents: 0, duplicateEvents };
  }

  const sessionOps = [];
  const pageViewOps = [];
  const sectionViewOps = [];
  const productEventOps = [];
  const cartEventOps = [];
  const purchaseOps = [];
  const searchOps = [];
  const sessionOwnershipMerges = new Map();

  for (const event of freshEvents) {
    const shared = getSharedFields(event, processedAt);

    const sessionSet = {
      updatedAt: processedAt,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      deviceType: event.deviceType,
      browser: event.browser,
      location: event.location,
      isActive: event.eventType !== "session_end",
    };

    if (event.userId) {
      sessionSet.userId = event.userId;
    }

    if (event.eventType === "session_end") {
      sessionSet.endedAt = event.timestamp;
      sessionSet.totalActiveTime = Math.max(
        toNumber(event.metadata?.totalActiveTime ?? event.metadata?.activeTimeMs, 0),
        0,
      );
    }

    sessionOps.push({
      updateOne: {
        filter: { sessionId: event.sessionId },
        update: {
          $setOnInsert: {
            sessionId: event.sessionId,
            createdAt: processedAt,
          },
          $set: sessionSet,
          $min: { startedAt: event.timestamp },
          $max: {
            lastSeenAt: event.timestamp,
            maxScrollDepth: Math.max(toNumber(event.maxScrollDepth, 0), 0),
          },
          $inc: {
            eventCount: 1,
            pageViews: event.eventType === "page_view_started" ? 1 : 0,
          },
        },
        upsert: true,
      },
    });

    if (event.eventType === "login" && event.userId) {
      sessionOwnershipMerges.set(event.sessionId, event.userId);
    }

    if (event.eventType === "signup" && event.userId) {
      sessionOwnershipMerges.set(event.sessionId, event.userId);
    }

    if (event.eventType === "page_view_ended") {
      const startedAt = toDate(event.metadata?.startedAt || event.timestamp);
      const endedAt = toDate(event.metadata?.endedAt || event.timestamp);
      const activeTimeMs = Math.max(toNumber(event.metadata?.activeTimeMs, 0), 0);

      pageViewOps.push({
        updateOne: {
          filter: { eventId: event.eventId },
          update: {
            $setOnInsert: {
              ...shared,
              pageViewId: toSafeString(event.metadata?.pageViewId || "", 128, "") || null,
              path: toSafeString(event.metadata?.path || "", 1024, "") || null,
              title: toSafeString(event.metadata?.title || "", 256, "") || null,
              startedAt,
              endedAt,
              activeTimeMs,
              durationMs: Math.max(endedAt.getTime() - startedAt.getTime(), 0),
              maxScrollDepth: Math.max(toNumber(event.metadata?.maxScrollDepth, 0), 0),
              reason: toSafeString(event.metadata?.reason || "", 64, "") || null,
            },
          },
          upsert: true,
        },
      });
    }

    if (event.eventType === "section_visible_duration") {
      const startedAt = toDate(event.metadata?.startedAt || event.timestamp);
      const durationMs = Math.max(toNumber(event.metadata?.durationMs, 0), 0);
      const endedAt = new Date(startedAt.getTime() + durationMs);

      sectionViewOps.push({
        updateOne: {
          filter: { eventId: event.eventId },
          update: {
            $setOnInsert: {
              ...shared,
              sectionName: event.sectionName,
              sectionKey: event.sectionKey,
              pageViewId: toSafeString(event.metadata?.pageViewId || "", 128, "") || null,
              startedAt,
              endedAt,
              durationMs,
              reason: toSafeString(event.metadata?.reason || "", 64, "") || null,
            },
          },
          upsert: true,
        },
      });
    }

    if (["product_view", "hover_duration"].includes(event.eventType)) {
      productEventOps.push({
        updateOne: {
          filter: { eventId: event.eventId },
          update: {
            $setOnInsert: {
              ...shared,
              productId: event.productId,
              productName: event.productName,
              eventType: event.eventType,
              hoverTarget: toSafeString(event.metadata?.hoverTarget || "", 80, "") || null,
              hoverDurationMs: Math.max(toNumber(event.metadata?.durationMs, 0), 0),
            },
          },
          upsert: true,
        },
      });
    }

    if (["add_to_cart", "remove_from_cart", "checkout_started"].includes(event.eventType)) {
      cartEventOps.push({
        updateOne: {
          filter: { eventId: event.eventId },
          update: {
            $setOnInsert: {
              ...shared,
              productId: event.productId,
              productName: event.productName,
              quantity: event.quantity,
              cartValue: toNumber(event.metadata?.cartValue ?? event.metadata?.total, 0),
              eventType: event.eventType,
            },
          },
          upsert: true,
        },
      });
    }

    if (event.eventType === "purchase_completed") {
      purchaseOps.push({
        updateOne: {
          filter: { eventId: event.eventId },
          update: {
            $setOnInsert: {
              ...shared,
              orderId: event.orderId,
              amount: event.amount,
              currency: event.currency,
              paymentMethod: event.paymentMethod,
              products: Array.isArray(event.metadata?.items)
                ? event.metadata.items.slice(0, 200)
                : [],
            },
          },
          upsert: true,
        },
      });
    }

    if (["search_query", "search", "results_count"].includes(event.eventType)) {
      searchOps.push({
        updateOne: {
          filter: { eventId: event.eventId },
          update: {
            $setOnInsert: {
              ...shared,
              keyword: event.searchKeyword,
              resultsCount: event.searchResultsCount,
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (sessionOps.length > 0) {
    await db.collection("sessions").bulkWrite(sessionOps, { ordered: false });
  }
  if (pageViewOps.length > 0) {
    await db.collection("page_views").bulkWrite(pageViewOps, { ordered: false });
  }
  if (sectionViewOps.length > 0) {
    await db.collection("section_views").bulkWrite(sectionViewOps, { ordered: false });
  }
  if (productEventOps.length > 0) {
    await db.collection("product_events").bulkWrite(productEventOps, { ordered: false });
  }
  if (cartEventOps.length > 0) {
    await db.collection("cart_events").bulkWrite(cartEventOps, { ordered: false });
  }
  if (purchaseOps.length > 0) {
    await db.collection("purchases").bulkWrite(purchaseOps, { ordered: false });
  }
  if (searchOps.length > 0) {
    await db.collection("search_events").bulkWrite(searchOps, { ordered: false });
  }

  if (sessionOwnershipMerges.size > 0) {
    for (const [sessionId, userId] of sessionOwnershipMerges.entries()) {
      const mergeFilter = { sessionId, userId: null };
      const mergeUpdate = { $set: { userId, updatedAt: processedAt } };

      await Promise.all([
        db.collection("events_raw").updateMany(mergeFilter, mergeUpdate),
        db.collection("sessions").updateMany(mergeFilter, mergeUpdate),
        db.collection("page_views").updateMany(mergeFilter, mergeUpdate),
        db.collection("section_views").updateMany(mergeFilter, mergeUpdate),
        db.collection("product_events").updateMany(mergeFilter, mergeUpdate),
        db.collection("cart_events").updateMany(mergeFilter, mergeUpdate),
        db.collection("purchases").updateMany(mergeFilter, mergeUpdate),
        db.collection("search_events").updateMany(mergeFilter, mergeUpdate),
      ]);
    }
  }

  return { insertedEvents: freshEvents.length, duplicateEvents };
};

const scheduleFlush = () => {
  if (flushTimeout || isFlushing) {
    return;
  }

  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushQueue().catch((error) => {
      console.error("[analytics-worker] scheduled flush error:", error?.message || error);
    });
  }, config.flushIntervalMs);

  flushTimeout.unref?.();
};

const flushQueue = async ({ force = false } = {}) => {
  if (isFlushing) return;
  if (!force && pendingRecords.length === 0) return;

  isFlushing = true;
  const flushStartedAt = Date.now();

  try {
    while (pendingRecords.length > 0) {
      const batch = pendingRecords.splice(0, config.batchSize);

      const normalizedEvents = [];
      for (const record of batch) {
        for (const event of record.events) {
          normalizedEvents.push({
            ...event,
            _consent: record.consent,
            _source: record.source,
          });
        }
      }

      try {
        const { insertedEvents, duplicateEvents } = await persistEventsBatch(normalizedEvents);

        workerStats.persistedEvents += insertedEvents;
        workerStats.duplicateEvents += duplicateEvents;

        for (const record of batch) {
          record.message.ack();
        }
      } catch (error) {
        workerStats.failedBatches += 1;
        console.error("[analytics-worker] batch process failed:", error?.message || error);
        for (const record of batch) {
          record.message.nack();
        }
      }

      if (!force && batch.length < config.batchSize) {
        break;
      }
    }
  } finally {
    isFlushing = false;
    workerStats.lastFlushAt = new Date();
    workerStats.lastFlushDurationMs = Date.now() - flushStartedAt;

    if (pendingRecords.length > 0 && !isShuttingDown) {
      scheduleFlush();
    }
  }
};

const enqueueRecord = (record) => {
  pendingRecords.push(record);

  if (pendingRecords.length >= config.batchSize) {
    flushQueue().catch((error) => {
      console.error("[analytics-worker] immediate flush failed:", error?.message || error);
    });
    return;
  }

  scheduleFlush();
};

const parseMessagePayload = (message) => {
  const raw = JSON.parse(Buffer.from(message.data).toString("utf8"));
  const parsed = payloadSchema.parse(raw);

  const events = [];
  for (const event of parsed.events) {
    try {
      const normalizedEvent = normalizeEvent(event);
      events.push(normalizedEvent);
    } catch (error) {
      workerStats.invalidEvents += 1;
      console.error("[analytics-worker] invalid event in batch:", {
        messageId: message.id,
        error: error?.message || error,
      });
    }
  }

  if (events.length === 0) {
    throw new Error("All events in payload were invalid");
  }

  return {
    sessionId: parsed.sessionId,
    events,
    consent: String(parsed.consent || "unknown").trim() || "unknown",
    source: String(parsed.source || "tracking_api").trim() || "tracking_api",
  };
};

const handleMessage = async (message) => {
  if (isShuttingDown) {
    message.nack();
    return;
  }

  workerStats.receivedMessages += 1;

  let payload;
  try {
    payload = parseMessagePayload(message);
  } catch (error) {
    workerStats.invalidMessages += 1;
    console.error("[analytics-worker] invalid payload:", {
      messageId: message.id,
      error: error?.message || error,
    });

    await publishDeadLetter({
      message,
      reason: "payload_validation_failed",
      payload: null,
      error,
    });

    message.ack();
    return;
  }

  workerStats.receivedEvents += payload.events.length;

  enqueueRecord({
    message,
    events: payload.events,
    consent: payload.consent,
    source: payload.source,
  });
};

const writeWorkerHealth = async () => {
  if (!db) return;

  const workerId = `${process.env.HOSTNAME || "analytics-worker"}:${process.pid}`;
  const now = new Date();
  const startedAt = workerStats.startedAt;
  const uptimeSeconds = Math.max(Math.floor((now.getTime() - startedAt.getTime()) / 1000), 0);

  const throughputPerMinute =
    uptimeSeconds > 0 ? Number(((workerStats.persistedEvents / uptimeSeconds) * 60).toFixed(2)) : 0;

  const healthDoc = {
    workerId,
    topic: config.topicName,
    subscription: config.subscriptionName,
    queueDepth: pendingRecords.length,
    isFlushing,
    uptimeSeconds,
    startedAt,
    updatedAt: now,
    stats: {
      receivedMessages: workerStats.receivedMessages,
      receivedEvents: workerStats.receivedEvents,
      persistedEvents: workerStats.persistedEvents,
      duplicateEvents: workerStats.duplicateEvents,
      invalidMessages: workerStats.invalidMessages,
      invalidEvents: workerStats.invalidEvents,
      failedBatches: workerStats.failedBatches,
      throughputPerMinute,
      lastFlushAt: workerStats.lastFlushAt,
      lastFlushDurationMs: workerStats.lastFlushDurationMs,
    },
  };

  await db.collection(config.healthCollection).updateOne(
    { workerId },
    {
      $set: healthDoc,
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
};

const startHealthReporter = () => {
  if (healthInterval) return;

  healthInterval = setInterval(() => {
    writeWorkerHealth().catch((error) => {
      console.error("[analytics-worker] health write failed:", error?.message || error);
    });
  }, config.healthIntervalMs);

  healthInterval.unref?.();
};

const stopHealthReporter = () => {
  if (!healthInterval) return;
  clearInterval(healthInterval);
  healthInterval = null;
};

const connectDatabase = async () => {
  const baseOptions = {
    dbName: config.dbName,
    maxPoolSize: config.dbMaxPoolSize,
    minPoolSize: config.dbMinPoolSize,
    serverSelectionTimeoutMS: 5000,
  };

  try {
    connection = await mongoose.createConnection(config.mongoUri, baseOptions).asPromise();
  } catch (error) {
    const derivedDbName = deriveDbNameFromMongoUri(config.mongoUri);
    const canRetryWithDerived =
      isAuthorizationError(error) &&
      derivedDbName &&
      derivedDbName !== baseOptions.dbName;

    if (!canRetryWithDerived) {
      throw error;
    }

    connection = await mongoose
      .createConnection(config.mongoUri, {
        ...baseOptions,
        dbName: derivedDbName,
      })
      .asPromise();
  }

  connection.on("error", (error) => {
    console.error("[analytics-worker] database error:", error?.message || error);
  });

  db = connection.db;
  await ensureIndexes();
};

const startSubscriber = async () => {
  const pubSub = getPubSubClient();
  subscription = pubSub.subscription(config.subscriptionName, {
    flowControl: {
      maxMessages: config.maxMessages,
      allowExcessMessages: false,
    },
  });

  subscription.on("message", (message) => {
    handleMessage(message).catch((error) => {
      console.error("[analytics-worker] message handler crash:", error?.message || error);
      message.nack();
    });
  });

  subscription.on("error", (error) => {
    console.error("[analytics-worker] subscription error:", error?.message || error);
  });

  console.log("[analytics-worker] listening", {
    topic: config.topicName,
    subscription: config.subscriptionName,
    batchSize: config.batchSize,
    flushIntervalMs: config.flushIntervalMs,
    dbName: config.dbName,
    deadLetterTopic: config.deadLetterTopicName,
  });
};

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[analytics-worker] received ${signal}, shutting down...`);

  try {
    stopHealthReporter();

    if (subscription) {
      subscription.removeAllListeners("message");
      subscription.removeAllListeners("error");
    }

    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }

    await flushQueue({ force: true });
    await writeWorkerHealth();

    if (connection) {
      await connection.close();
      connection = null;
      db = null;
    }

    process.exit(0);
  } catch (error) {
    console.error("[analytics-worker] shutdown failed:", error?.message || error);
    process.exit(1);
  }
};

const main = async () => {
  await connectDatabase();
  await startSubscriber();
  startHealthReporter();
};

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

main().catch((error) => {
  console.error("[analytics-worker] startup failed:", error?.message || error);
  process.exit(1);
});
