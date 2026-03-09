const collectionsCacheByDb = new Map();

const buildDbKey = (db) => `${String(db?.databaseName || "analytics")}:${String(db?.namespace || "default")}`;

export const refreshAnalyticsCollectionCache = async (db) => {
  const collectionCursor = db.listCollections({}, { nameOnly: true });
  const collectionDocs = await collectionCursor.toArray();
  const names = new Set(collectionDocs.map((item) => String(item?.name || "").trim()).filter(Boolean));

  collectionsCacheByDb.set(buildDbKey(db), {
    names,
    refreshedAt: Date.now(),
  });

  return names;
};

const getCachedCollectionNames = async (db) => {
  const dbKey = buildDbKey(db);
  const cached = collectionsCacheByDb.get(dbKey);

  if (cached && Date.now() - cached.refreshedAt < 60_000) {
    return cached.names;
  }

  return refreshAnalyticsCollectionCache(db);
};

export const resolveAnalyticsCollectionName = async (db, preferred, fallbacks = []) => {
  const preferredName = String(preferred || "").trim();
  if (!preferredName) {
    throw new Error("Preferred collection name is required");
  }

  const fallbackList = Array.isArray(fallbacks)
    ? fallbacks.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  const available = await getCachedCollectionNames(db);

  if (available.has(preferredName)) {
    return preferredName;
  }

  for (const fallbackName of fallbackList) {
    if (available.has(fallbackName)) {
      return fallbackName;
    }
  }

  return preferredName;
};

export const getAnalyticsCollection = async (db, preferred, fallbacks = []) => {
  const resolvedName = await resolveAnalyticsCollectionName(db, preferred, fallbacks);
  return db.collection(resolvedName);
};
