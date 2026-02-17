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

/**
 * Get the proper image URL for display
 * @param {string} imageUrl - The image URL from database
 * @param {string} fallback - Fallback image path
 * @returns {string} - Resolved image URL
 */
export const getImageUrl = (imageUrl, fallback = "/placeholder.png") => {
  if (!imageUrl) return fallback;

  // Already a full URL (Cloudinary or external)
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  // Local server uploads
  if (imageUrl.startsWith("/uploads/")) {
    return `${API_URL}${imageUrl}`;
  }

  // Local public folder image (like /product_1.png)
  if (imageUrl.startsWith("/")) {
    return imageUrl;
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
 * Get thumbnail URL for product cards
 * @param {string} imageUrl - Original image URL
 * @returns {string} - Thumbnail URL
 */
export const getThumbnailUrl = (imageUrl) => {
  return getOptimizedImageUrl(imageUrl, {
    width: 300,
    height: 300,
    quality: "auto",
    format: "auto",
  });
};

/**
 * Get product detail image URL (larger)
 * @param {string} imageUrl - Original image URL
 * @returns {string} - High quality image URL
 */
export const getProductImageUrl = (imageUrl) => {
  return getOptimizedImageUrl(imageUrl, {
    width: 800,
    height: 800,
    quality: "auto",
    format: "auto",
  });
};

/**
 * Get banner image URL (full width)
 * @param {string} imageUrl - Original image URL
 * @returns {string} - Banner optimized URL
 */
export const getBannerImageUrl = (imageUrl) => {
  return getOptimizedImageUrl(imageUrl, {
    width: 1920,
    height: 600,
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
  getProductImageUrl,
  getBannerImageUrl,
  isCloudinaryUrl,
};
