"use client";

export const parseJsonSafely = async (response) => {
  if (!response) return null;

  if (response.status === 204 || response.status === 205) {
    return {
      success: response.ok,
      status: response.status,
    };
  }

  const contentType = response.headers?.get?.("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      try {
        return await response.json();
      } catch {
        return {
          success: response.ok,
          status: response.status,
          message: response.ok ? "" : response.statusText || "Request failed",
        };
      }
    }

    const textBody = await response.text();
    if (!textBody) {
      return {
        success: response.ok,
        status: response.status,
        message: response.ok ? "" : response.statusText || "Request failed",
      };
    }

    try {
      return JSON.parse(textBody);
    } catch {
      return {
        success: false,
        error: true,
        message: textBody,
      };
    }
  } catch {
    return null;
  }
};

export const getResponseErrorMessage = (payload, fallback) =>
  payload?.message || payload?.error?.message || payload?.error || fallback;
