import axios from "axios";
import Cookies from "js-cookie";

const HEALTHY_ONE_GRAM_HOSTS = new Set([
  "healthyonegram.com",
  "www.healthyonegram.com",
]);

const LOCAL_API_FALLBACKS = [
  "http://127.0.0.1:8000",
  "http://127.0.0.1:8001",
  "http://127.0.0.1:8002",
  "http://localhost:8000",
  "http://localhost:8001",
  "http://localhost:8002",
];

const DEFAULT_PUBLIC_GET_CACHE_TTL_MS = Math.max(
  Number.parseInt(
    String(process.env.NEXT_PUBLIC_PUBLIC_GET_CACHE_TTL_MS ?? "15000"),
    10,
  ) || 15000,
  0,
);
const DEFAULT_HOMEPAGE_HOT_PATH_CACHE_TTL_MS = Math.max(
  Number.parseInt(
    String(process.env.NEXT_PUBLIC_HOMEPAGE_CACHE_TTL_MS ?? "120000"),
    10,
  ) || 120000,
  0,
);

const PUBLIC_GET_CACHE_PATH_REGEX =
  /^\/api\/(?:products|categories|banners|home-slides|combos|settings\/public)(?:\/|\?|$)/i;
const HOMEPAGE_HOT_PATH_CACHE_REGEX =
  /^\/api\/(?:banners|home-slides|settings\/maintenance-status)(?:\/|\?|$)/i;

const publicGetCacheStore = new Map();
const inflightGetRequests = new Map();
let preferredApiBaseUrl = "";

const sanitizeBaseUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "");

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const isLocalhostUrl = (value) => {
  try {
    const parsed = new URL(String(value || ""));
    return (
      parsed.hostname.toLowerCase() === "localhost" ||
      parsed.hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
};

const normalizeLocalFallbacks = () =>
  LOCAL_API_FALLBACKS.map(sanitizeBaseUrl).filter(Boolean);

const getGetCacheKey = (url) => `GET:${String(url || "").trim()}`;

const getDefaultPublicGetCacheTtlMs = (url) => {
  const normalizedUrl = String(url || "").trim();
  if (HOMEPAGE_HOT_PATH_CACHE_REGEX.test(normalizedUrl)) {
    return DEFAULT_HOMEPAGE_HOT_PATH_CACHE_TTL_MS;
  }

  if (PUBLIC_GET_CACHE_PATH_REGEX.test(normalizedUrl)) {
    return DEFAULT_PUBLIC_GET_CACHE_TTL_MS;
  }

  return 0;
};

const getCachedGetResponse = (cacheKey) => {
  const cached = publicGetCacheStore.get(cacheKey);
  if (!cached) return null;
  if (Date.now() >= Number(cached.expiresAt || 0)) {
    publicGetCacheStore.delete(cacheKey);
    return null;
  }
  return cached.data;
};

const setCachedGetResponse = (cacheKey, data, ttlMs) => {
  if (!cacheKey || !ttlMs || ttlMs <= 0) return;
  publicGetCacheStore.set(cacheKey, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
};

const clearPublicGetCache = () => {
  publicGetCacheStore.clear();
};

export const invalidatePublicGetCache = () => {
  clearPublicGetCache();
};

const resolveApiBaseUrl = () => {
  const localDevBaseUrl = sanitizeBaseUrl(
    process.env.NEXT_PUBLIC_LOCAL_API_URL,
  );
  const preferredLocalFallback =
    normalizeLocalFallbacks().find((candidate) => candidate.endsWith(":8001")) ||
    normalizeLocalFallbacks()[0] ||
    "";
  const envCandidates = [
    localDevBaseUrl,
    process.env.NEXT_PUBLIC_APP_API_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ]
    .map(sanitizeBaseUrl)
    .filter(Boolean);

  const envBaseUrl = envCandidates.find(isHttpUrl) || "";

  if (typeof window !== "undefined") {
    const hostname = String(window.location.hostname || "").toLowerCase();
    const origin = sanitizeBaseUrl(window.location.origin);
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

    if (isLocalhost) {
      // When the client is running on localhost, honor an explicit API URL
      // from env first. Falling back to the Next.js origin only works when
      // dev rewrites are intentionally configured for that backend.
      if (envBaseUrl) {
        return envBaseUrl || origin || preferredLocalFallback || "";
      }
      return envBaseUrl || origin || preferredLocalFallback || "";
    }

    if (HEALTHY_ONE_GRAM_HOSTS.has(hostname)) {
      return origin;
    }

    if (envBaseUrl) {
      return envBaseUrl;
    }

    return origin || normalizeLocalFallbacks()[0] || "http://localhost:8001";
  }

  if (envBaseUrl) {
    return envBaseUrl;
  }

  if (process.env.NODE_ENV === "production") {
    return "https://healthyonegram.com";
  }

  return preferredLocalFallback || "http://localhost:8001";
};

export const API_BASE_URL = resolveApiBaseUrl();

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const BASE_HAS_API_SUFFIX = /\/api$/i.test(String(API_BASE_URL || ""));

const normalizePath = (url) => {
  const normalized = url?.startsWith("/") ? url : `/${url}`;
  if (!BASE_HAS_API_SUFFIX) return normalized;
  if (/^\/api(\/|$)/i.test(normalized)) {
    return normalized.replace(/^\/api/i, "");
  }
  return normalized;
};
export const getStoredAccessToken = () => {
  const cookieToken = Cookies.get("accessToken");
  if (cookieToken) return cookieToken;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken") || localStorage.getItem("token");
};

const clearAuthCookies = () => {
  Cookies.remove("accessToken");
  Cookies.remove("refreshToken");
  Cookies.remove("userName");
  Cookies.remove("userEmail");
  Cookies.remove("userPhoto");
  if (typeof window !== "undefined") {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userPhoto");
  }
};

let refreshPromise = null;

const refreshAccessToken = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = Cookies.get("refreshToken");
      if (!refreshToken) {
        clearAuthCookies();
        return null;
      }

      const response = await axiosClient.post(
        normalizePath("/api/user/refresh-token"),
        { refreshToken },
        {
          headers: { "Content-Type": "application/json" },
        },
      );

      const token = response?.data?.data?.accessToken || null;
      if (token) {
        Cookies.set("accessToken", token, { expires: 365 });
        if (typeof window !== "undefined") {
          localStorage.setItem("accessToken", token);
          localStorage.setItem("token", token);
        }
      } else {
        clearAuthCookies();
      }
      return token;
    } catch (error) {
      clearAuthCookies();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

axiosClient.interceptors.request.use((config) => {
  const accessToken = getStoredAccessToken();
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

const handleApiError = (error, fallbackMessage) => {
  const message =
    error?.response?.data?.message || error?.message || fallbackMessage;
  return { error: true, success: false, message };
};

const getApiBaseCandidates = () => {
  const preferred = sanitizeBaseUrl(preferredApiBaseUrl);
  const resolvedBase = sanitizeBaseUrl(API_BASE_URL);
  const localDevBase = sanitizeBaseUrl(process.env.NEXT_PUBLIC_LOCAL_API_URL);
  const candidates = [];

  if (typeof window !== "undefined") {
    const hostname = String(window.location.hostname || "").toLowerCase();
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    if (isLocalhost) {
      // On local dev, prefer local API targets first to avoid remote CORS/network failures.
      if (preferred && isLocalhostUrl(preferred)) {
        candidates.push(preferred);
      }
      if (localDevBase) {
        candidates.push(localDevBase);
      }
      candidates.push(...normalizeLocalFallbacks());

      // Keep remote bases as final fallback candidates.
      if (preferred && !isLocalhostUrl(preferred)) {
        candidates.push(preferred);
      }
      if (resolvedBase && !isLocalhostUrl(resolvedBase)) {
        candidates.push(resolvedBase);
      }

      return [...new Set(candidates.filter(Boolean))];
    }
  }

  if (preferred) {
    candidates.push(preferred);
  }

  candidates.push(resolvedBase);

  return [...new Set(candidates.filter(Boolean))];
};

const requestWithRetry = async (config, fallbackMessage) => {
  const baseCandidates = getApiBaseCandidates();
  let lastError = null;

  for (let i = 0; i < baseCandidates.length; i += 1) {
    const baseURL = baseCandidates[i];
    const isLastCandidate = i === baseCandidates.length - 1;
    const requestConfig = {
      ...config,
      baseURL,
      headers: {
        ...(config?.headers || {}),
      },
    };

    try {
      const response = await axiosClient.request(requestConfig);
      if (baseURL) {
        preferredApiBaseUrl = sanitizeBaseUrl(baseURL);
      }
      return response.data;
    } catch (error) {
      if (error?.response?.status === 401 && !requestConfig._retry) {
        requestConfig._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          requestConfig.headers.Authorization = `Bearer ${newToken}`;
          try {
            const retryResponse = await axiosClient.request(requestConfig);
            return retryResponse.data;
          } catch (retryError) {
            error = retryError;
          }
        }
      }

      lastError = error;
      const status = Number(error?.response?.status || 0);
      const shouldTryNextBase = !isLastCandidate && (!status || status >= 500);
      if (shouldTryNextBase) {
        continue;
      }

      return handleApiError(error, fallbackMessage);
    }
  }

  return handleApiError(lastError, fallbackMessage);
};

export const postData = async (url, formData, requestOptions = {}) => {
  const { headers = {}, ...restOptions } =
    requestOptions && typeof requestOptions === "object" ? requestOptions : {};

  const result = await requestWithRetry(
    {
      method: "post",
      url: normalizePath(url),
      data: formData,
      headers,
      ...restOptions,
    },
    "Failed to submit request",
  );
  if (result?.error !== true) {
    clearPublicGetCache();
  }
  return result;
};

export const fetchDataFromApi = async (url, options = {}) => {
  const normalizedUrl = normalizePath(url);
  const cacheKey = getGetCacheKey(normalizedUrl);

  const configuredTtl = Number.parseInt(
    String(options?.cacheTtlMs ?? "").trim(),
    10,
  );
  const cacheTtlMs = Number.isFinite(configuredTtl)
    ? Math.max(configuredTtl, 0)
    : getDefaultPublicGetCacheTtlMs(normalizedUrl);

  const shouldUseCache = cacheTtlMs > 0 && options?.skipCache !== true;
  if (shouldUseCache) {
    const cached = getCachedGetResponse(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const shouldDedupe = options?.dedupe !== false;
  if (shouldDedupe) {
    const pending = inflightGetRequests.get(cacheKey);
    if (pending) {
      return pending;
    }
  }

  const requestPromise = requestWithRetry(
    {
      method: "get",
      url: normalizedUrl,
    },
    "Failed to fetch data",
  )
    .then((result) => {
      if (shouldUseCache && result?.error !== true) {
        setCachedGetResponse(cacheKey, result, cacheTtlMs);
      }
      return result;
    })
    .finally(() => {
      inflightGetRequests.delete(cacheKey);
    });

  if (shouldDedupe) {
    inflightGetRequests.set(cacheKey, requestPromise);
  }

  return requestPromise;
};

export const putData = async (url, formData) => {
  const result = await requestWithRetry(
    {
      method: "put",
      url: normalizePath(url),
      data: formData,
    },
    "Failed to update data",
  );
  if (result?.error !== true) {
    clearPublicGetCache();
  }
  return result;
};

export const deleteData = async (url) => {
  const result = await requestWithRetry(
    {
      method: "delete",
      url: normalizePath(url),
    },
    "Failed to delete data",
  );
  if (result?.error !== true) {
    clearPublicGetCache();
  }
  return result;
};
