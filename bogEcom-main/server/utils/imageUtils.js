/**
 * Image Utilities
 * Helper functions for image handling and cleanup
 */

/**
 * Extract Cloudinary publicId from URL
 * @param {string} url - Full Cloudinary URL
 * @returns {string|null} Public ID or null if invalid
 *
 * Example:
 * Input: "https://res.cloudinary.com/cloud/image/upload/v123/buyonegram/banners/uuid.jpg"
 * Output: "buyonegram/banners/uuid"
 */
export const extractPublicIdFromUrl = (url) => {
  if (!url || typeof url !== "string") {
    return null;
  }

  try {
    // Match: /upload/[v123/]buyonegram/folder/filename
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
    return matches && matches[1] ? matches[1] : null;
  } catch (error) {
    console.error("Error extracting publicId from URL:", error);
    return null;
  }
};

/**
 * Check if URL is a valid Cloudinary URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid Cloudinary URL
 */
export const isValidCloudinaryUrl = (url) => {
  if (!url || typeof url !== "string") {
    return false;
  }
  return url.includes("res.cloudinary.com");
};

/**
 * Extract multiple publicIds from array of URLs
 * @param {array} urls - Array of image URLs
 * @returns {array} Array of publicIds
 */
export const extractMultiplePublicIds = (urls) => {
  if (!Array.isArray(urls)) {
    return [];
  }

  return urls
    .map((url) => extractPublicIdFromUrl(url))
    .filter((id) => id !== null);
};

export default {
  extractPublicIdFromUrl,
  isValidCloudinaryUrl,
  extractMultiplePublicIds,
};
