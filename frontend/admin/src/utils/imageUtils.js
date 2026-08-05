/**
 * Image Utilities for Admin Panel
 *
 * Handles image URL resolution for:
 * - Cloudinary URLs (https://res.cloudinary.com/...)
 * - Local server URLs (/uploads/...)
 * - Placeholder fallbacks
 */

import { API_BASE_URL } from "@/utils/api";
import { withAdminBasePath } from "@/utils/basePath";
import {
  ADMIN_PLACEHOLDER_IMAGE,
  resolveLegacyLocalMedia,
} from "@/utils/mediaDefaults";

const API_URL = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL;
const FIREBASE_STORAGE_BUCKET = String(
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_GCS_MEDIA_BUCKET ||
    "",
)
  .trim()
  .replace(/^gs:\/\//i, "");
const sanitizeBaseUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "");
const STORE_PUBLIC_BASE_URL =
  sanitizeBaseUrl(process.env.NEXT_PUBLIC_CLIENT_URL) ||
  sanitizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
  "";

const normalizeImageInput = (imageValue) => {
  if (!imageValue) return "";

  if (typeof imageValue === "string") {
    return imageValue.trim();
  }

  // Accept common API object formats: { url }, { secure_url }, { src }
  if (typeof imageValue === "object") {
    if (typeof imageValue.url === "string") return imageValue.url.trim();
    if (typeof imageValue.secure_url === "string") {
      return imageValue.secure_url.trim();
    }
    if (typeof imageValue.src === "string") return imageValue.src.trim();
  }

  return "";
};

const isAllowedMediaObjectPath = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  return Boolean(normalized && !normalized.includes("..") && /^buyonegram\//i.test(normalized));
};

const buildMediaProxyUrl = (objectPath = "") => {
  const normalized = String(objectPath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!isAllowedMediaObjectPath(normalized)) return "";
  return `${API_URL}/api/media/gcs?path=${encodeURIComponent(normalized)}`;
};

const isMediaProxyPath = (value = "") =>
  /^\/?api\/media\/gcs(?:\?|$)/i.test(String(value || "").trim());

const resolveFirebaseMediaProxyUrl = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  if (isAllowedMediaObjectPath(normalized)) {
    return buildMediaProxyUrl(normalized);
  }

  try {
    const parsed = new URL(normalized);
    const pathname = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

    if (parsed.hostname === "firebasestorage.googleapis.com") {
      const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/i);
      if (!match) return "";
      const [, bucket, objectPath] = match;
      if (FIREBASE_STORAGE_BUCKET && bucket !== FIREBASE_STORAGE_BUCKET) {
        return "";
      }
      return buildMediaProxyUrl(decodeURIComponent(objectPath));
    }

    if (parsed.hostname === "storage.googleapis.com") {
      const [bucket, ...objectParts] = pathname.split("/");
      if (FIREBASE_STORAGE_BUCKET && bucket !== FIREBASE_STORAGE_BUCKET) {
        return "";
      }
      return buildMediaProxyUrl(objectParts.join("/"));
    }
  } catch {
    return "";
  }

  return "";
};

const resolveFallbackMediaUrl = (value = "") => {
  const normalized = String(value || "").trim().replace(/\\/g, "/");
  if (!normalized) return "";

  const firebaseMediaProxyUrl = resolveFirebaseMediaProxyUrl(normalized);
  if (firebaseMediaProxyUrl) return firebaseMediaProxyUrl;

  if (isMediaProxyPath(normalized)) {
    return normalized.startsWith("/")
      ? `${API_URL}${normalized}`
      : `${API_URL}/${normalized}`;
  }

  return normalized;
};

/**
 * Get the proper image URL for display
 * @param {string|object} imageUrl - The image URL from database
 * @param {string} fallback - Fallback image path
 * @returns {string} - Resolved image URL
 */
export const getImageUrl = (
  imageUrl,
  fallback = ADMIN_PLACEHOLDER_IMAGE,
) => {
  const normalizedValue = normalizeImageInput(imageUrl);
  if (!normalizedValue) {
    return resolveFallbackMediaUrl(resolveLegacyLocalMedia(fallback) || fallback);
  }

  const normalizedPath = normalizedValue.replace(/\\/g, "/");

  const decodedPath = (() => {
    try {
      return decodeURIComponent(normalizedPath);
    } catch {
      return normalizedPath;
    }
  })();

  const CLIENT_BASE_URL = STORE_PUBLIC_BASE_URL || "http://localhost:3000";

  // Intercept system default image paths and map to local self-contained storefront demo assets
  if (decodedPath.includes("buyonegram/system/product-default.webp") || decodedPath.includes("product_placeholder.png")) {
    return `${CLIENT_BASE_URL}/demo/products/default.webp`;
  }
  if (decodedPath.includes("buyonegram/system/home-slide-default-1.webp")) {
    return `${CLIENT_BASE_URL}/demo/hero/slide-1.webp`;
  }
  if (decodedPath.includes("buyonegram/system/home-slide-default-2.webp")) {
    return `${CLIENT_BASE_URL}/demo/hero/slide-2.webp`;
  }
  if (decodedPath.includes("buyonegram/system/home-slide-default-3.webp")) {
    return `${CLIENT_BASE_URL}/demo/hero/slide-3.webp`;
  }
  if (decodedPath.includes("buyonegram/system/banner-default-1.webp")) {
    return `${CLIENT_BASE_URL}/demo/banners/banner-1.webp`;
  }
  if (decodedPath.includes("buyonegram/system/banner-default-2.webp")) {
    return `${CLIENT_BASE_URL}/demo/banners/banner-2.webp`;
  }
  if (decodedPath.includes("buyonegram/system/banner-default-3.webp")) {
    return `${CLIENT_BASE_URL}/demo/banners/banner-3.webp`;
  }

  const resolvedLegacyMedia = resolveLegacyLocalMedia(normalizedPath);
  if (resolvedLegacyMedia) {
    return resolveFallbackMediaUrl(resolvedLegacyMedia);
  }

  const firebaseMediaProxyUrl = resolveFirebaseMediaProxyUrl(normalizedPath);
  if (firebaseMediaProxyUrl) {
    return firebaseMediaProxyUrl;
  }

  // Data URI
  if (normalizedPath.startsWith("data:")) {
    return normalizedPath;
  }

  // Protocol-relative URL
  if (normalizedPath.startsWith("//")) {
    return `https:${normalizedPath}`;
  }

  if (normalizedPath.startsWith("res.cloudinary.com/")) {
    return `https://${normalizedPath}`;
  }

  if (isMediaProxyPath(normalizedPath)) {
    return normalizedPath.startsWith("/")
      ? `${API_URL}${normalizedPath}`
      : `${API_URL}/${normalizedPath}`;
  }

  // Already a full URL (Cloudinary or external)
  if (
    normalizedPath.startsWith("http://") ||
    normalizedPath.startsWith("https://")
  ) {
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
    if (STORE_PUBLIC_BASE_URL) {
      return `${STORE_PUBLIC_BASE_URL}${normalizedPath}`;
    }
    return resolveLegacyLocalMedia(normalizedPath) || withAdminBasePath(normalizedPath);
  }

  // Fallback for values like "product_1.png"
  if (!normalizedPath.includes("/")) {
    return (
      resolveLegacyLocalMedia(normalizedPath) ||
      withAdminBasePath(`/${normalizedPath}`)
    );
  }

  return resolveFallbackMediaUrl(resolveLegacyLocalMedia(fallback) || fallback);
};

/**
 * Get optimized Cloudinary URL with transformations
 * @param {string} imageUrl - Cloudinary image URL
 * @param {object} options - Transformation options
 * @returns {string} - Optimized URL
 */
export const getOptimizedImageUrl = (
  imageUrl,
  { width = 400, height = 400, quality = "auto", format = "auto" } = {},
) => {
  if (!imageUrl) return ADMIN_PLACEHOLDER_IMAGE;

  // Only apply transformations to Cloudinary URLs
  if (imageUrl.includes("res.cloudinary.com")) {
    // Insert transformation parameters before /upload/
    const parts = imageUrl.split("/upload/");
    if (parts.length === 2) {
      const transformations = `w_${width},h_${height},c_fill,q_${quality},f_${format}`;
      return `${parts[0]}/upload/${transformations}/${parts[1]}`;
    }
  }

  return getImageUrl(imageUrl);
};

/**
 * Get thumbnail URL for product listings
 * @param {string} imageUrl - Original image URL
 * @returns {string} - Thumbnail URL
 */
export const getThumbnailUrl = (imageUrl) => {
  return getOptimizedImageUrl(imageUrl, {
    width: 100,
    height: 100,
    quality: "auto",
    format: "auto",
  });
};

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
  isCloudinaryUrl,
};
