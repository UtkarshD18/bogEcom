"use client";

export const parseJsonSafely = async (response) => {
  if (!response) return null;

  const contentType = response.headers?.get?.("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }

    const textBody = await response.text();
    if (!textBody) return null;

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

