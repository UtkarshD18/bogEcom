/**
 * Image Utilities for Client Frontend
 *
 * Handles image URL resolution for:
 * - Cloudinary URLs (https://res.cloudinary.com/...)
 * - Local server URLs (/uploads/...)
 * - Placeholder fallbacks
 */

import { API_BASE_URL } from "@/utils/api";

const API_URL = API_BASE_URL;
const DEFAULT_PLACEHOLDER = "/placeholder.png";

const normalizeImageInput = (imageValue) => {
  if (!imageValue) return "";

  if (typeof imageValue === "string") {
    return imageValue.trim();
  }

  if (typeof imageValue === "object") {
    if (typeof imageValue.url === "string") return imageValue.url.trim();
    if (typeof imageValue.secure_url === "string") {
      return imageValue.secure_url.trim();
    }
    if (typeof imageValue.src === "string") return imageValue.src.trim();
  }

  return "";
};

const buildCloudinaryUrl = (imageUrl, transformations = []) => {
  const normalizedUrl = normalizeImageInput(imageUrl);
  if (!normalizedUrl || !normalizedUrl.includes("res.cloudinary.com")) {
    return normalizedUrl;
  }

  const parts = normalizedUrl.split("/upload/");
  if (parts.length !== 2) {
    return normalizedUrl;
  }

  const serializedTransforms = transformations.filter(Boolean).join(",");
  if (!serializedTransforms) {
    return normalizedUrl;
  }

  return `${parts[0]}/upload/${serializedTransforms}/${parts[1]}`;
};

/**
 * Get the proper image URL for display
 * @param {string} imageUrl - The image URL from database
 * @param {string} fallback - Fallback image path
 * @returns {string} - Resolved image URL
 */
export const getImageUrl = (imageUrl, fallback = DEFAULT_PLACEHOLDER) => {
  const normalizedValue = normalizeImageInput(imageUrl);
  if (!normalizedValue) return fallback;

  const normalizedPath = normalizedValue.replace(/\\/g, "/");

  if (normalizedPath.startsWith("data:")) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("//")) {
    return `https:${normalizedPath}`;
  }

  // Already a full URL (Cloudinary or external)
  if (
    normalizedPath.startsWith("http://") ||
    normalizedPath.startsWith("https://")
  ) {
    if (normalizedPath.includes("res.cloudinary.com")) {
      return buildCloudinaryUrl(normalizedPath, [
        "f_auto",
        "q_auto:good",
        "dpr_auto",
      ]);
    }
    return normalizedPath;
  }

  // Local server uploads
  if (normalizedPath.startsWith("/uploads/")) {
    return `${API_URL}${normalizedPath}`;
  }

  if (normalizedPath.startsWith("uploads/")) {
    return `${API_URL}/${normalizedPath}`;
  }

  // Local public folder image (like /product_1.png)
  if (normalizedPath.startsWith("/")) {
    return normalizedPath;
  }

  if (!normalizedPath.includes("/")) {
    return `/${normalizedPath}`;
  }

  return fallback;
};

/**
 * Get optimized Cloudinary URL with transformations
 * @param {string} imageUrl - Cloudinary image URL
 * @param {object} options - Transformation options
 * @returns {string} - Optimized URL
 */
export const getOptimizedImageUrl = (
  imageUrl,
  {
    width = 400,
    height = 400,
    quality = "auto:good",
    format = "auto",
    crop,
    gravity = "",
    dpr = "auto",
  } = {},
) => {
  const normalizedUrl = normalizeImageInput(imageUrl);
  if (!normalizedUrl) return DEFAULT_PLACEHOLDER;

  // Only apply transformations to Cloudinary URLs
  if (normalizedUrl.includes("res.cloudinary.com")) {
    const safeWidth = Number(width);
    const safeHeight = Number(height);
    const resolvedCrop =
      crop ||
      (Number.isFinite(safeWidth) && Number.isFinite(safeHeight)
        ? "fill"
        : "limit");

    const transformations = [
      Number.isFinite(safeWidth) && safeWidth > 0 ? `w_${Math.round(safeWidth)}` : "",
      Number.isFinite(safeHeight) && safeHeight > 0
        ? `h_${Math.round(safeHeight)}`
        : "",
      resolvedCrop ? `c_${resolvedCrop}` : "",
      gravity ? `g_${gravity}` : "",
      quality ? `q_${quality}` : "",
      format ? `f_${format}` : "",
      dpr ? `dpr_${dpr}` : "",
    ];

    return buildCloudinaryUrl(normalizedUrl, transformations);
  }

  return getImageUrl(normalizedUrl);
};

/**
 * Get thumbnail URL for product cards
 * @param {string} imageUrl - Original image URL
 * @returns {string} - Thumbnail URL
 */
export const getThumbnailUrl = (imageUrl) => {
  return getOptimizedImageUrl(imageUrl, {
    width: 420,
    height: 420,
    crop: "limit",
  });
};

/**
 * Get product detail image URL (larger)
 * @param {string} imageUrl - Original image URL
 * @returns {string} - High quality image URL
 */
export const getProductImageUrl = (imageUrl) => {
  return getOptimizedImageUrl(imageUrl, {
    width: 900,
    height: 900,
    crop: "limit",
  });
};

/**
 * Get banner image URL (full width)
 * @param {string} imageUrl - Original image URL
 * @returns {string} - Banner optimized URL
 */
export const getBannerImageUrl = (imageUrl) => {
  return getOptimizedImageUrl(imageUrl, {
    width: 1600,
    height: 720,
    crop: "fill",
    gravity: "auto",
  });
};

export const getHeroImageUrl = (imageUrl) =>
  getOptimizedImageUrl(imageUrl, {
    width: 1800,
    height: 1200,
    crop: "fill",
    gravity: "auto",
  });

export const getCategoryImageUrl = (imageUrl) =>
  getOptimizedImageUrl(imageUrl, {
    width: 320,
    height: 320,
    crop: "limit",
  });

export const getProductCardImageUrl = (imageUrl) =>
  getOptimizedImageUrl(imageUrl, {
    width: 520,
    height: 520,
    crop: "limit",
  });

/**
 * Check if an image URL is a Cloudinary URL
 * @param {string} imageUrl - Image URL to check
 * @returns {boolean}
 */
export const isCloudinaryUrl = (imageUrl) => {
  return imageUrl && imageUrl.includes("res.cloudinary.com");
};

export default {
  getImageUrl,
  getOptimizedImageUrl,
  getThumbnailUrl,
  getProductImageUrl,
  getBannerImageUrl,
  getHeroImageUrl,
  getCategoryImageUrl,
  getProductCardImageUrl,
  isCloudinaryUrl,
};
