import axios from "axios";
import Cookies from "js-cookie";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const normalizePath = (url) => (url?.startsWith("/") ? url : `/${url}`);

const clearAuthCookies = () => {
  Cookies.remove("accessToken");
  Cookies.remove("refreshToken");
  Cookies.remove("userName");
  Cookies.remove("userEmail");
  Cookies.remove("userPhoto");
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

      const response = await axios.post(
        `${API_BASE_URL}/api/user/refresh-token`,
        { refreshToken },
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        },
      );

      const token = response?.data?.data?.accessToken || null;
      if (token) {
        Cookies.set("accessToken", token, { expires: 7 });
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
  const accessToken = Cookies.get("accessToken");
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
