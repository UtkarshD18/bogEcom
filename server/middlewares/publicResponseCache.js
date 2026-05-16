import { getRedisClient } from "../config/redisClient.js";

const DEFAULT_CACHE_KEY_PREFIX = "public-response-cache";
const localResponseCache = new Map();
const localNamespaceVersions = new Map();

const toBoolean = (value, fallback = false) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizePath = (value) => {
  const normalized = String(value || "")
    .split("?")[0]
    .trim()
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "");
  return normalized || "/";
};

const normalizeNamespaces = (value) => {
  const list = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      list
        .map((entry) => String(entry || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
};

const hasAuthContext = (req) => {
  const authorizationHeader = String(req.headers?.authorization || "").trim();
  if (authorizationHeader) return true;

  const cookieHeader = String(req.headers?.cookie || "");
  if (!cookieHeader) return false;

  return /(?:^|;\s*)(?:accessToken|refreshToken)=/i.test(cookieHeader);
};

const getCacheKeyPrefix = () =>
  String(
    process.env.PERF_RESPONSE_CACHE_KEY_PREFIX || DEFAULT_CACHE_KEY_PREFIX,
  ).trim() || DEFAULT_CACHE_KEY_PREFIX;

const getNamespaceVersionStorageKey = (namespace) =>
  `${getCacheKeyPrefix()}:namespace:${namespace}:version`;

const getResponseStorageKey = (versionSignature, requestSignature) =>
  `${getCacheKeyPrefix()}:response:${versionSignature}:${requestSignature}`;

const getLocalNamespaceVersion = (namespace) =>
  Math.max(Number(localNamespaceVersions.get(namespace) || 1), 1);

const getRequestSignature = (req) => {
  const requestUrl = new URL(
    String(req.originalUrl || req.url || "/"),
    "http://localhost",
  );
  const entries = Array.from(requestUrl.searchParams.entries()).sort(
    ([keyA, valueA], [keyB, valueB]) =>
      keyA.localeCompare(keyB) || valueA.localeCompare(valueB),
  );
  const canonicalParams = new URLSearchParams();
  for (const [key, value] of entries) {
    canonicalParams.append(key, value);
  }

  const normalizedPath = normalizePath(requestUrl.pathname);
  const query = canonicalParams.toString();
  return `${String(req.method || "GET").trim().toUpperCase()}:${normalizedPath}${query ? `?${query}` : ""}`;
};

const getResolvedNamespaceVersions = async (namespaces) => {
  const normalizedNamespaces = normalizeNamespaces(namespaces);
  if (!normalizedNamespaces.length) {
    return [];
  }

  const redis = getRedisClient();
  if (!redis) {
    return normalizedNamespaces.map((namespace) => [
      namespace,
      getLocalNamespaceVersion(namespace),
    ]);
  }

  try {
    const values = await redis.mget(
      normalizedNamespaces.map(getNamespaceVersionStorageKey),
    );
    return normalizedNamespaces.map((namespace, index) => {
      const parsed = Number.parseInt(String(values?.[index] || ""), 10);
      return [
        namespace,
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : getLocalNamespaceVersion(namespace),
      ];
    });
  } catch (error) {
    console.warn(
      "Public response cache namespace lookup failed:",
      error?.message || error,
    );
    return normalizedNamespaces.map((namespace) => [
      namespace,
      getLocalNamespaceVersion(namespace),
    ]);
  }
};

const buildCacheDescriptor = async ({ namespaces, requestSignature }) => {
  const versionPairs = await getResolvedNamespaceVersions(namespaces);
  if (!versionPairs.length) {
    return null;
  }

  const versionSignature = versionPairs
    .map(([namespace, version]) => `${namespace}:v${version}`)
    .join("|");

  return {
    cacheKey: getResponseStorageKey(versionSignature, requestSignature),
  };
};

const readLocalResponseCache = (cacheKey) => {
  const cached = localResponseCache.get(cacheKey);
  if (!cached) return null;

  if (Date.now() >= Number(cached.expiresAt || 0)) {
    localResponseCache.delete(cacheKey);
    return null;
  }

  return cached.payload || null;
};

const writeLocalResponseCache = (cacheKey, payload, ttlSeconds) => {
  localResponseCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
};

const readPublicResponseCacheEntry = async (cacheKey) => {
  const redis = getRedisClient();
  if (redis) {
    try {
      const serialized = await redis.get(cacheKey);
      if (serialized) {
        return JSON.parse(serialized);
      }
    } catch (error) {
      console.warn(
        "Public response cache read failed:",
        error?.message || error,
      );
    }
  }

  return readLocalResponseCache(cacheKey);
};

const writePublicResponseCacheEntry = async ({
  cacheKey,
  payload,
  ttlSeconds,
}) => {
  writeLocalResponseCache(cacheKey, payload, ttlSeconds);

  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await redis.set(cacheKey, JSON.stringify(payload), "EX", ttlSeconds);
  } catch (error) {
    console.warn(
      "Public response cache write failed:",
      error?.message || error,
    );
  }
};

const fireAndForget = (work) => {
  if (typeof work !== "function") return;
  Promise.resolve()
    .then(work)
    .catch((error) => {
      console.warn(
        "Public response cache side-effect failed:",
        error?.message || error,
      );
    });
};

export const getPublicResponseCacheTtlSeconds = (envKey, fallback) =>
  toPositiveInteger(process.env[envKey], fallback);

export const invalidatePublicResponseCache = async (namespaces = []) => {
  const normalizedNamespaces = normalizeNamespaces(namespaces);
  if (!normalizedNamespaces.length) {
    return;
  }

  localResponseCache.clear();
  for (const namespace of normalizedNamespaces) {
    localNamespaceVersions.set(
      namespace,
      getLocalNamespaceVersion(namespace) + 1,
    );
  }

  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    const pipeline = redis.multi();
    for (const namespace of normalizedNamespaces) {
      pipeline.incr(getNamespaceVersionStorageKey(namespace));
    }
    await pipeline.exec();
  } catch (error) {
    console.warn(
      "Public response cache invalidation failed:",
      error?.message || error,
    );
  }
};

export const createPublicResponseCacheMiddleware = ({
  namespaces = [],
  ttlSeconds = 60,
  requireNoAuth = true,
  shouldCache = null,
  onHit = null,
} = {}) => {
  const resolvedNamespaces = normalizeNamespaces(namespaces);

  return async (req, res, next) => {
    const cacheEnabled = toBoolean(
      process.env.PERF_RESPONSE_CACHE_ENABLED,
      true,
    );
    const method = String(req.method || "")
      .trim()
      .toUpperCase();
    const resolvedTtlSeconds =
      typeof ttlSeconds === "function"
        ? Number(ttlSeconds(req))
        : Number(ttlSeconds);

    if (
      !cacheEnabled ||
      method !== "GET" ||
      !resolvedNamespaces.length ||
      !Number.isFinite(resolvedTtlSeconds) ||
      resolvedTtlSeconds <= 0 ||
      (requireNoAuth && hasAuthContext(req)) ||
      (typeof shouldCache === "function" && shouldCache(req) === false)
    ) {
      return next();
    }

    try {
      const requestSignature = getRequestSignature(req);
      const descriptor = await buildCacheDescriptor({
        namespaces: resolvedNamespaces,
        requestSignature,
      });

      if (!descriptor?.cacheKey) {
        return next();
      }

      const cached = await readPublicResponseCacheEntry(descriptor.cacheKey);
      if (cached) {
        res.set("X-Response-Cache", "HIT");
        fireAndForget(() => onHit?.(req, res));
        return res.status(Number(cached.statusCode || 200)).json(cached.body);
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        const isSuccess =
          res.statusCode >= 200 &&
          res.statusCode < 300 &&
          body &&
          body.error !== true;

        res.set("X-Response-Cache", isSuccess ? "MISS" : "SKIP");

        if (isSuccess) {
          void writePublicResponseCacheEntry({
            cacheKey: descriptor.cacheKey,
            payload: {
              statusCode: res.statusCode,
              body,
            },
            ttlSeconds: resolvedTtlSeconds,
          });
        }

        return originalJson(body);
      };

      return next();
    } catch (error) {
      console.warn(
        "Public response cache middleware failed, falling through:",
        error?.message || error,
      );
      return next();
    }
  };
};

export const __resetPublicResponseCacheForTests = () => {
  localResponseCache.clear();
  localNamespaceVersions.clear();
};

export default createPublicResponseCacheMiddleware;
