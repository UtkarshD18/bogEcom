import mongoose from "mongoose";

let analyticsConnection = null;
let connectPromise = null;
let indexPromise = null;
let indexesInitialized = false;

const normalizeEnvValue = (value) => {
  let normalized = String(value || "").trim();

  const wrappedInDoubleQuotes =
    normalized.startsWith('"') && normalized.endsWith('"');
  const wrappedInSingleQuotes =
    normalized.startsWith("'") && normalized.endsWith("'");

  if (wrappedInDoubleQuotes || wrappedInSingleQuotes) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
};

const resolveAnalyticsMongoUri = () => {
  const analyticsUri = normalizeEnvValue(process.env.ANALYTICS_MONGO_URI);
  if (analyticsUri) {
    return analyticsUri;
  }

  const mainUri = normalizeEnvValue(process.env.MONGO_URI || process.env.MONGODB_URI);
  if (!mainUri) {
    throw new Error(
      "Analytics DB URI missing. Set ANALYTICS_MONGO_URI or MONGO_URI/MONGODB_URI.",
    );
  }

  return mainUri;
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

const resolveDbName = () => {
  const explicit = normalizeEnvValue(process.env.ANALYTICS_DB_NAME);
  if (explicit) {
    return explicit;
  }

  const analyticsUri = normalizeEnvValue(process.env.ANALYTICS_MONGO_URI);
  const mainUri = normalizeEnvValue(process.env.MONGO_URI || process.env.MONGODB_URI);
  const derived = deriveDbNameFromMongoUri(analyticsUri || mainUri);

  // Fallback to the primary app database name when analytics DB name is not explicitly set.
  // This avoids auth failures for Mongo users scoped to a single database.
  return derived || "analytics";
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const buildConnectionOptions = () => ({
  dbName: resolveDbName(),
  maxPoolSize: toPositiveInt(process.env.ANALYTICS_DB_MAX_POOL_SIZE, 30),
  minPoolSize: toPositiveInt(process.env.ANALYTICS_DB_MIN_POOL_SIZE, 3),
  serverSelectionTimeoutMS: toPositiveInt(
    process.env.ANALYTICS_DB_SERVER_SELECTION_TIMEOUT_MS,
    5000,
  ),
});

const isAuthorizationError = (error) => {
  const code = Number(error?.code);
  const message = String(error?.message || "").toLowerCase();
  return code === 13 || message.includes("not authorized") || message.includes("auth");
};

const ensureConnected = async () => {
  if (analyticsConnection?.readyState === 1) {
    return analyticsConnection;
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      const uri = resolveAnalyticsMongoUri();
      const options = buildConnectionOptions();
      let connection = null;

      try {
        connection = await mongoose.createConnection(uri, options).asPromise();
      } catch (error) {
        const derivedDbName = deriveDbNameFromMongoUri(uri);
        const canRetryWithDerived =
          isAuthorizationError(error) &&
          derivedDbName &&
          derivedDbName !== options.dbName;

        if (!canRetryWithDerived) {
          throw error;
        }

        const retryOptions = { ...options, dbName: derivedDbName };
        connection = await mongoose.createConnection(uri, retryOptions).asPromise();
      }

      analyticsConnection = connection;

      connection.on("error", (error) => {
        console.error("[analytics-db] connection error:", error?.message || error);
      });

      return analyticsConnection;
    })().finally(() => {
      connectPromise = null;
    });
  }

  return connectPromise;
};

const rawEventsTtlDays = toPositiveInt(process.env.ANALYTICS_RAW_EVENTS_TTL_DAYS, 90);

const collectionIndexes = {
  // Required behavior analytics collections
  sessions: [
    [{ sessionId: 1 }, { unique: true }],
    [{ userId: 1 }],
    [{ startedAt: -1 }],
    [{ isActive: 1, lastSeenAt: -1 }],
  ],
  events_raw: [
    [{ eventId: 1 }, { unique: true }],
    [{ sessionId: 1, timestamp: -1 }],
    [{ userId: 1, timestamp: -1 }],
    [{ eventType: 1, timestamp: -1 }],
    [{ timestamp: -1 }],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
  ],
  page_views: [
    [{ eventId: 1 }, { unique: true }],
    [{ sessionId: 1, startedAt: -1 }],
    [{ pageUrl: 1, startedAt: -1 }],
    [{ userId: 1, startedAt: -1 }],
  ],
  section_views: [
    [{ eventId: 1 }, { unique: true }],
    [{ sessionId: 1, sectionName: 1, startedAt: -1 }],
    [{ userId: 1, sectionName: 1, startedAt: -1 }],
    [{ sectionName: 1, startedAt: -1 }],
  ],
  product_events: [
    [{ eventId: 1 }, { unique: true }],
    [{ productId: 1, timestamp: -1 }],
    [{ eventType: 1, timestamp: -1 }],
    [{ sessionId: 1, timestamp: -1 }],
    [{ userId: 1, timestamp: -1 }],
  ],
  cart_events: [
    [{ eventId: 1 }, { unique: true }],
    [{ eventType: 1, timestamp: -1 }],
    [{ productId: 1, timestamp: -1 }],
    [{ sessionId: 1, timestamp: -1 }],
    [{ userId: 1, timestamp: -1 }],
  ],
  combo_events: [
    [{ eventId: 1 }, { unique: true }],
    [{ comboId: 1, timestamp: -1 }],
    [{ eventType: 1, timestamp: -1 }],
    [{ sessionId: 1, timestamp: -1 }],
    [{ userId: 1, timestamp: -1 }],
  ],
  purchases: [
    [{ eventId: 1 }, { unique: true }],
    [{ orderId: 1 }, { sparse: true }],
    [{ userId: 1, timestamp: -1 }],
    [{ sessionId: 1, timestamp: -1 }],
    [{ timestamp: -1 }],
  ],
  search_events: [
    [{ eventId: 1 }, { unique: true }],
    [{ keyword: 1, timestamp: -1 }],
    [{ userId: 1, timestamp: -1 }],
    [{ sessionId: 1, timestamp: -1 }],
  ],
  worker_health: [
    [{ workerId: 1 }, { unique: true }],
    [{ updatedAt: -1 }],
  ],

  // Legacy collection compatibility
  user_sessions: [
    [{ sessionId: 1 }, { unique: true }],
    [{ userId: 1 }],
    [{ startedAt: -1 }],
    [{ lastSeenAt: -1 }],
  ],
  events: [
    [{ eventId: 1 }, { unique: true }],
    [{ userId: 1, timestamp: -1 }],
    [{ sessionId: 1, timestamp: -1 }],
    [{ eventType: 1, timestamp: -1 }],
  ],
  product_views: [
    [{ eventId: 1 }, { unique: true }],
    [{ productId: 1, timestamp: -1 }],
    [{ userId: 1, timestamp: -1 }],
    [{ sessionId: 1, timestamp: -1 }],
  ],
};

const isNonFatalIndexError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const code = Number(error?.code);

  return (
    code === 11000 ||
    message.includes("duplicate key") ||
    message.includes("index options conflict") ||
    message.includes("already exists with different options")
  );
};

export const ensureAnalyticsIndexes = async () => {
  if (indexesInitialized) {
    return true;
  }

  if (indexPromise) {
    return indexPromise;
  }

  indexPromise = (async () => {
    const connection = await ensureConnected();
    const db = connection.db;

    for (const [collectionName, definitions] of Object.entries(collectionIndexes)) {
      const collection = db.collection(collectionName);
      for (const [keys, options = {}] of definitions) {
        try {
          await collection.createIndex(keys, options);
        } catch (error) {
          if (isNonFatalIndexError(error)) {
            console.warn(
              `[analytics-db] Non-fatal index issue on ${collectionName}:`,
              error?.message || error,
            );
            continue;
          }
          throw error;
        }
      }
    }

    // Ensure TTL is effectively configured even if documents are inserted without expiresAt.
    if (rawEventsTtlDays > 0) {
      try {
        await db.collection("events_raw").updateMany(
          { expiresAt: { $exists: false } },
          {
            $set: {
              expiresAt: new Date(Date.now() + rawEventsTtlDays * 24 * 60 * 60 * 1000),
            },
          },
        );
      } catch (error) {
        console.warn(
          "[analytics-db] Non-fatal TTL backfill issue on events_raw:",
          error?.message || error,
        );
      }
    }

    indexesInitialized = true;
    return true;
  })().finally(() => {
    indexPromise = null;
  });

  return indexPromise;
};

export const getAnalyticsDb = async () => {
  const connection = await ensureConnected();
  return connection.db;
};

export const getAnalyticsConnection = async () => ensureConnected();
