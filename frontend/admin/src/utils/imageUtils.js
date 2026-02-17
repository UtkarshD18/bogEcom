/**
 * Image Utilities for Admin Panel
 *
 * Handles image URL resolution for:
 * - Cloudinary URLs (https://res.cloudinary.com/...)
 * - Local server URLs (/uploads/...)
 * - Placeholder fallbacks
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
  /\/+$/,
  "",
);

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

/**
 * Get the proper image URL for display
 * @param {string|object} imageUrl - The image URL from database
 * @param {string} fallback - Fallback image path
 * @returns {string} - Resolved image URL
 */
export const getImageUrl = (imageUrl, fallback = "/placeholder.png") => {
  const normalizedValue = normalizeImageInput(imageUrl);
  if (!normalizedValue) return fallback;

  const normalizedPath = normalizedValue.replace(/\\/g, "/");

  // Data URI
  if (normalizedPath.startsWith("data:")) {
    return normalizedPath;
  }

  // Protocol-relative URL
  if (normalizedPath.startsWith("//")) {
    return `https:${normalizedPath}`;
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
    return normalizedPath;
  }

  // Fallback for values like "product_1.png"
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
  { width = 400, height = 400, quality = "auto", format = "auto" } = {},
) => {
  if (!imageUrl) return "/placeholder.png";

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
