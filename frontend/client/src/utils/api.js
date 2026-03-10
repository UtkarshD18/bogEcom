import axios from "axios";
import Cookies from "js-cookie";

const HEALTHY_ONE_GRAM_HOSTS = new Set([
  "healthyonegram.com",
  "www.healthyonegram.com",
]);

const LOCAL_API_FALLBACK = "http://localhost:8000";

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

const resolveApiBaseUrl = () => {
  const envCandidates = [
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
      if (envBaseUrl && isLocalhostUrl(envBaseUrl)) {
        return envBaseUrl;
      }
      return LOCAL_API_FALLBACK;
    }

    if (HEALTHY_ONE_GRAM_HOSTS.has(hostname)) {
      return origin;
    }

    if (envBaseUrl) {
      return envBaseUrl;
    }

    return origin || LOCAL_API_FALLBACK;
  }

  if (envBaseUrl) {
    return envBaseUrl;
  }

  if (process.env.NODE_ENV === "production") {
    return "https://healthyonegram.com";
  }

  return LOCAL_API_FALLBACK;
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

const requestWithRetry = async (config, fallbackMessage) => {
  try {
    const response = await axiosClient.request(config);
    return response.data;
  } catch (error) {
    const originalRequest = config;
    if (error?.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        try {
          const retryResponse = await axiosClient.request(originalRequest);
          return retryResponse.data;
        } catch (retryError) {
          return handleApiError(retryError, fallbackMessage);
        }
      }
    }
    return handleApiError(error, fallbackMessage);
  }
};

export const postData = async (url, formData) =>
  requestWithRetry(
    {
      method: "post",
      url: normalizePath(url),
      data: formData,
    },
    "Failed to submit request",
  );

export const fetchDataFromApi = async (url) =>
  requestWithRetry(
    {
      method: "get",
      url: normalizePath(url),
    },
    "Failed to fetch data",
  );

export const putData = async (url, formData) =>
  requestWithRetry(
    {
      method: "put",
      url: normalizePath(url),
      data: formData,
    },
    "Failed to update data",
  );

export const deleteData = async (url) =>
  requestWithRetry(
    {
      method: "delete",
      url: normalizePath(url),
    },
    "Failed to delete data",
  );
