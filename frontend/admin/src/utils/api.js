import axios from "axios";

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

let refreshPromise = null;

const getStoredAdminToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminToken");
};

const setStoredAdminToken = (token) => {
  if (typeof window === "undefined" || !token) return;
  localStorage.setItem("adminToken", token);
  window.dispatchEvent(new CustomEvent("adminTokenRefreshed", { detail: token }));
};

const refreshAdminToken = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/user/refresh-token`,
        {},
        { withCredentials: true },
      );
      const token = response?.data?.data?.accessToken || null;
      setStoredAdminToken(token);
      return token;
    } catch (error) {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

const buildHeaders = (token, extraHeaders = {}) => {
  const resolvedToken = token || getStoredAdminToken();
  return {
    ...extraHeaders,
    ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
  };
};

const toErrorPayload = (error, fallbackMessage) => {
  const message =
    error?.response?.data?.message || error?.message || fallbackMessage;
  return { error: true, success: false, message };
};

const requestWithRetry = async ({
  method,
  url,
  data,
  token = null,
  headers = {},
  fallbackMessage = "Request failed",
}) => {
  const requestConfig = {
    method,
    url: normalizePath(url),
    data,
    headers: buildHeaders(token, headers),
  };

  try {
    const response = await axiosClient.request(requestConfig);
    return response.data;
  } catch (error) {
    if (error?.response?.status === 401 && !requestConfig._retry) {
      requestConfig._retry = true;
      const newToken = await refreshAdminToken();
      if (newToken) {
        requestConfig.headers = buildHeaders(newToken, headers);
        try {
          const retryResponse = await axiosClient.request(requestConfig);
          return retryResponse.data;
        } catch (retryError) {
          return toErrorPayload(retryError, fallbackMessage);
        }
      }
    }
    return toErrorPayload(error, fallbackMessage);
  }
};

export const postData = async (url, formData, token = null) =>
  requestWithRetry({
    method: "post",
    url,
    data: formData,
    token,
    fallbackMessage: "Failed to submit request",
  });

export const getData = async (url, token = null) =>
  requestWithRetry({
    method: "get",
    url,
    token,
    fallbackMessage: "Failed to fetch data",
  });

export const putData = async (url, formData, token = null) =>
  requestWithRetry({
    method: "put",
    url,
    data: formData,
    token,
    fallbackMessage: "Failed to update data",
  });

export const deleteData = async (url, token = null) =>
  requestWithRetry({
    method: "delete",
    url,
    token,
    fallbackMessage: "Failed to delete data",
  });

export const patchData = async (url, formData, token = null) =>
  requestWithRetry({
    method: "patch",
    url,
    data: formData,
    token,
    fallbackMessage: "Failed to update data",
  });

export const uploadFile = async (file, token) => {
  const formData = new FormData();
  formData.append("image", file);
  return requestWithRetry({
    method: "post",
    url: "/api/upload/single",
    data: formData,
    token,
    headers: { "Content-Type": "multipart/form-data" },
    fallbackMessage: "Failed to upload file",
  });
};

export const uploadVideoFile = async (file, token) => {
  const formData = new FormData();
  formData.append("video", file);
  return requestWithRetry({
    method: "post",
    url: "/api/upload/video",
    data: formData,
    token,
    headers: { "Content-Type": "multipart/form-data" },
    fallbackMessage: "Failed to upload video",
  });
};

export const uploadFiles = async (files, token) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));
  return requestWithRetry({
    method: "post",
    url: "/api/upload/multiple",
    data: formData,
    token,
    headers: { "Content-Type": "multipart/form-data" },
    fallbackMessage: "Failed to upload files",
  });
};

export const getDashboardStats = async (token) =>
  requestWithRetry({
    method: "get",
    url: "/api/statistics/dashboard",
    token,
    fallbackMessage: "Failed to fetch dashboard stats",
  });
