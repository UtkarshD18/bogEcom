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
const DEFAULT_PLACEHOLDER = "/product_1.webp";
const CLOUDINARY_TRANSFORM_TOKEN_PATTERN =
  /(?:^|,)(?:c|w|h|g|q|f|dpr|ar|x|y|z|bo|e|fl)_[^,/]+/i;

const RESPONSIVE_IMAGE_PROFILES = {
  thumb: {
    widths: [96, 144, 196, 256],
    width: 256,
    height: 256,
    crop: "limit",
    quality: "auto:good",
    sizes: "96px",
  },
  card: {
    widths: [240, 320, 420, 520, 680],
    width: 680,
    height: 680,
    crop: "limit",
    quality: "auto:good",
    sizes:
      "(max-width: 640px) 44vw, (max-width: 1024px) 28vw, (max-width: 1536px) 20vw, 320px",
  },
  gallery: {
    widths: [480, 720, 960, 1280, 1600],
    width: 1600,
    height: 1600,
    crop: "limit",
    quality: "auto:best",
    sizes: "(max-width: 768px) 92vw, (max-width: 1280px) 54vw, 720px",
  },
  content: {
    widths: [480, 720, 960, 1280, 1600],
    width: 1600,
    crop: "limit",
    quality: "auto:good",
    sizes: "(max-width: 768px) 92vw, (max-width: 1280px) 64vw, 920px",
  },
  zoom: {
    widths: [720, 1080, 1440, 1800, 2200],
    width: 2200,
    height: 2200,
    crop: "limit",
    quality: "auto:best",
    sizes: "92vw",
  },
};

const normalizeImageInput = (imageValue) => {
  if (!imageValue) return "";

  if (typeof imageValue === "string") {
    const normalized = imageValue.trim();
    if (!normalized) return "";
    const lowered = normalized.toLowerCase();
    if (
      lowered === "undefined" ||
      lowered === "null" ||
      lowered === "nan" ||
      lowered === "[object object]"
    ) {
      return "";
    }
    return normalized;
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

  const uploadPathSegments = String(parts[1] || "").split("/");
  const [firstSegment, ...remainingSegments] = uploadPathSegments;
  const hasExistingTransformations =
    firstSegment &&
    !/^v\d+$/i.test(firstSegment) &&
    CLOUDINARY_TRANSFORM_TOKEN_PATTERN.test(firstSegment);
  const normalizedUploadPath = hasExistingTransformations
    ? remainingSegments.join("/")
    : parts[1];

  return `${parts[0]}/upload/${serializedTransforms}/${normalizedUploadPath}`;
};

const resolveBaseImageUrl = (imageUrl, fallback = DEFAULT_PLACEHOLDER) => {
  const normalizedValue = normalizeImageInput(imageUrl);
  if (!normalizedValue) return fallback;

  const normalizedPath = normalizedValue.replace(/\\/g, "/");

  if (normalizedPath.startsWith("data:")) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("//")) {
    return `https:${normalizedPath}`;
  }

  if (normalizedPath.startsWith("res.cloudinary.com/")) {
    return `https://${normalizedPath}`;
  }

  if (
    normalizedPath.startsWith("http://") ||
    normalizedPath.startsWith("https://")
  ) {
    if (
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/uploads\//i.test(
        normalizedPath,
      )
    ) {
      const uploadPath = normalizedPath.replace(
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i,
        "",
      );
      return `${API_URL}${uploadPath}`;
    }

    return normalizedPath;
  }

  if (normalizedPath.startsWith("/uploads/")) {
    return `${API_URL}${normalizedPath}`;
  }

  if (normalizedPath.startsWith("uploads/")) {
    return `${API_URL}/${normalizedPath}`;
  }

  if (normalizedPath.startsWith("/")) {
    return normalizedPath;
  }

  if (!normalizedPath.includes("/")) {
    return `/${normalizedPath}`;
  }

  return fallback;
};

/**
 * Get the proper image URL for display
 * @param {string} imageUrl - The image URL from database
 * @param {string} fallback - Fallback image path
 * @returns {string} - Resolved image URL
 */
export const getImageUrl = (imageUrl, fallback = DEFAULT_PLACEHOLDER) => {
  const baseUrl = resolveBaseImageUrl(imageUrl, fallback);
  if (baseUrl.includes("res.cloudinary.com")) {
    return buildCloudinaryUrl(baseUrl, ["f_auto", "q_auto:good", "dpr_auto"]);
  }
  return baseUrl;
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
      Number.isFinite(safeWidth) && safeWidth > 0
        ? `w_${Math.round(safeWidth)}`
        : "",
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
    width: 1920,
    height: 400,
    crop: "fill",
    gravity: "auto",
  });
};

export const getMobileBannerImageUrl = (imageUrl) => {
  return getOptimizedImageUrl(imageUrl, {
    width: 960,
    height: 540,
    crop: "fill",
    gravity: "auto",
  });
};

export const getHeroImageUrl = (imageUrl) =>
  getOptimizedImageUrl(imageUrl, {
    width: 1920,
    height: 1080,
    crop: "fit",
  });

export const getHeroMobileImageUrl = (imageUrl) =>
  getOptimizedImageUrl(imageUrl, {
    width: 1280,
    height: 720,
    crop: "fit",
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

export const getResponsiveImageSet = (
  imageUrl,
  { profile = "gallery", sizes = "" } = {},
) => {
  const selectedProfile =
    RESPONSIVE_IMAGE_PROFILES[profile] || RESPONSIVE_IMAGE_PROFILES.gallery;
  const baseUrl = resolveBaseImageUrl(imageUrl, DEFAULT_PLACEHOLDER);

  if (!baseUrl.includes("res.cloudinary.com")) {
    return {
      src: getImageUrl(baseUrl),
      srcSet: undefined,
      sizes: sizes || selectedProfile.sizes,
    };
  }

  const widths =
    Array.isArray(selectedProfile.widths) && selectedProfile.widths.length > 0
      ? selectedProfile.widths
      : [selectedProfile.width].filter(Boolean);
  const imageOptions = {
    height: selectedProfile.height,
    crop: selectedProfile.crop || "limit",
    quality: selectedProfile.quality || "auto:good",
    format: "auto",
    dpr: "auto",
  };

  const srcSet = widths
    .map((width) => {
      const candidate = getOptimizedImageUrl(baseUrl, {
        ...imageOptions,
        width,
      });
      return candidate ? `${candidate} ${width}w` : "";
    })
    .filter(Boolean)
    .join(", ");

  return {
    src: getOptimizedImageUrl(baseUrl, {
      ...imageOptions,
      width: selectedProfile.width || widths[widths.length - 1],
    }),
    srcSet: srcSet || undefined,
    sizes: sizes || selectedProfile.sizes,
  };
};

/**
 * Check if an image URL is a Cloudinary URL
 * @param {string} imageUrl - Image URL to check
 * @returns {boolean}
 */
export const isCloudinaryUrl = (imageUrl) => {
  return imageUrl && imageUrl.includes("res.cloudinary.com");
};

const imageUtils = {
  getImageUrl,
  getOptimizedImageUrl,
  getThumbnailUrl,
  getProductImageUrl,
  getBannerImageUrl,
  getMobileBannerImageUrl,
  getHeroImageUrl,
  getHeroMobileImageUrl,
  getCategoryImageUrl,
  getProductCardImageUrl,
  getResponsiveImageSet,
  isCloudinaryUrl,
};

export default imageUtils;
