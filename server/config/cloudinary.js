import { v2 as cloudinary } from "cloudinary";
import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure environment variables are loaded from server root
dotenv.config({ path: path.join(__dirname, "../.env") });
const isProduction = process.env.NODE_ENV === "production";
const mediaStorageProvider = String(
  process.env.MEDIA_STORAGE_PROVIDER || "cloudinary",
)
  .trim()
  .toLowerCase();
const useGcsMediaStorage = ["gcs", "google-cloud-storage", "google_storage"].includes(
  mediaStorageProvider,
);
const gcsMediaBucketName = String(
  process.env.GCS_MEDIA_BUCKET ||
    process.env.GOOGLE_CLOUD_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    "",
)
  .trim()
  .replace(/^gs:\/\//i, "");
const gcsPublicBaseUrl = String(process.env.GCS_MEDIA_PUBLIC_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");
const gcsMakePublic =
  String(process.env.GCS_MEDIA_MAKE_PUBLIC || "false").toLowerCase() === "true";
const gcsStorage = useGcsMediaStorage ? new Storage() : null;
// Debug-only logging to keep production output clean
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

/**
 * Cloudinary Configuration
 *
 * Handles image uploads to Cloudinary CDN
 * Benefits:
 * - Automatic image optimization
 * - Global CDN delivery
 * - Image transformations on-the-fly
 * - No local storage needed
 */

// Debug: Log Cloudinary config status
debugLog("Cloudinary Config:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? "✓ Set" : "✗ Missing",
  api_key: process.env.CLOUDINARY_API_KEY ? "✓ Set" : "✗ Missing",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "✓ Set" : "✗ Missing",
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MIME_EXTENSION_MAP = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const normalizeFolder = (folder = "buyonegram") =>
  String(folder || "buyonegram")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\\/g, "/");

const bufferFromUploadInput = (file) => {
  if (Buffer.isBuffer(file)) return file;
  const raw = String(file || "");
  const dataUriMatch = raw.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUriMatch) return Buffer.from(dataUriMatch[2], "base64");
  return Buffer.from(raw, "base64");
};

const getGcsPublicUrl = (objectPath) => {
  const encodedPath = objectPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  if (gcsPublicBaseUrl) return `${gcsPublicBaseUrl}/${encodedPath}`;
  return `https://storage.googleapis.com/${gcsMediaBucketName}/${encodedPath}`;
};

const extractGcsObjectPath = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (!/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/^\/+/, "");
  }

  try {
    const parsed = new URL(normalized);
    const pathname = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    if (parsed.hostname === "storage.googleapis.com") {
      const [bucket, ...objectParts] = pathname.split("/");
      return bucket === gcsMediaBucketName ? objectParts.join("/") : "";
    }
    if (gcsPublicBaseUrl && normalized.startsWith(`${gcsPublicBaseUrl}/`)) {
      return decodeURIComponent(normalized.slice(gcsPublicBaseUrl.length + 1));
    }
  } catch {
    return "";
  }

  return "";
};

const uploadToGcsMediaStorage = async (
  file,
  folder = "buyonegram",
  { mimeType = "image/jpeg" } = {},
) => {
  if (!gcsMediaBucketName) {
    return {
      success: false,
      error:
        "GCS media storage selected but GCS_MEDIA_BUCKET is not configured",
    };
  }

  const normalizedMimeType = String(mimeType || "application/octet-stream")
    .trim()
    .toLowerCase();
  const extension = MIME_EXTENSION_MAP[normalizedMimeType] || "bin";
  const objectPath = `${normalizeFolder(folder)}/${Date.now()}-${randomUUID()}.${extension}`;
  const bucket = gcsStorage.bucket(gcsMediaBucketName);
  const targetFile = bucket.file(objectPath);
  const buffer = bufferFromUploadInput(file);

  await targetFile.save(buffer, {
    resumable: false,
    metadata: {
      contentType: normalizedMimeType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  if (gcsMakePublic) {
    await targetFile.makePublic();
  }

  return {
    success: true,
    url: getGcsPublicUrl(objectPath),
    publicId: objectPath,
    width: null,
    height: null,
    format: extension,
    size: buffer.length,
  };
};

/**
 * Upload image to Cloudinary
 * @param {Buffer|string} file - File buffer or base64 string
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<object>} Upload result with url, public_id, etc.
 */
export const uploadToCloudinary = async (
  file,
  folder = "buyonegram",
  { mimeType = "image/jpeg", resourceType = "", preserveQuality = false } = {},
) => {
  try {
    if (useGcsMediaStorage) {
      return await uploadToGcsMediaStorage(file, folder, { mimeType });
    }

    // Verify Cloudinary is configured
    const config = cloudinary.config();
    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      console.error("Cloudinary not configured properly:", {
        cloud_name: !!config.cloud_name,
        api_key: !!config.api_key,
        api_secret: !!config.api_secret,
      });
      return {
        success: false,
        error: "Cloudinary credentials not configured",
      };
    }

    const normalizedMimeType = String(mimeType || "image/jpeg").trim().toLowerCase();
    const normalizedResourceType = String(
      resourceType || (normalizedMimeType.startsWith("video/") ? "video" : "image"),
    )
      .trim()
      .toLowerCase();

    const options = {
      folder: folder,
      resource_type: normalizedResourceType,
      ...(!preserveQuality && normalizedResourceType === "image"
        ? {
            transformation: [
              { quality: "auto:best" }, // Auto optimize quality
              { fetch_format: "auto" }, // Auto format (webp, etc.)
            ],
          }
        : {}),
    };

    // If file is a buffer, convert to base64
    let uploadStr = file;
    if (Buffer.isBuffer(file)) {
      uploadStr = `data:${normalizedMimeType};base64,${file.toString("base64")}`;
    }

    debugLog("Uploading to Cloudinary folder:", folder);
    const result = await cloudinary.uploader.upload(uploadStr, options);
    debugLog("Cloudinary upload success:", result.public_id);

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error.message);
    console.error("Cloudinary error details:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Upload multiple images to Cloudinary
 * @param {Array} files - Array of file buffers
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<Array>} Array of upload results
 */
export const uploadMultipleToCloudinary = async (
  files,
  folder = "buyonegram",
) => {
  try {
    const uploadPromises = files.map((file) => {
      if (Buffer.isBuffer(file) || typeof file === "string") {
        return uploadToCloudinary(file, folder);
      }

      const resolvedBuffer = file?.buffer || file;
      return uploadToCloudinary(resolvedBuffer, folder, {
        mimeType: file?.mimetype || "image/jpeg",
      });
    });
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    console.error("Cloudinary multiple upload error:", error);
    return [];
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public_id of the image
 * @returns {Promise<object>} Deletion result
 */
/**
 * Upload video to Cloudinary
 * @param {Buffer|string} file - File buffer or base64 string
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<object>} Upload result with url, public_id, etc.
 */
export const uploadVideoToCloudinary = async (
  file,
  folder = "buyonegram/videos",
  { mimeType = "video/mp4" } = {},
) => {
  try {
    if (useGcsMediaStorage) {
      return await uploadToGcsMediaStorage(file, folder, {
        mimeType,
      });
    }

    // Verify Cloudinary is configured
    const config = cloudinary.config();
    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      return {
        success: false,
        error: "Cloudinary credentials not configured",
      };
    }

    debugLog("Uploading video to Cloudinary folder:", folder);

    // Use upload_stream for video buffers (handles large files better)
    return new Promise((resolve) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: "video",
          chunk_size: 6000000,
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary video upload error:", error.message);
            resolve({
              success: false,
              error: error.message,
            });
          } else {
            debugLog("Cloudinary video upload success:", result.public_id);
            resolve({
              success: true,
              url: result.secure_url,
              publicId: result.public_id,
              width: result.width,
              height: result.height,
              format: result.format,
              duration: result.duration,
              size: result.bytes,
            });
          }
        },
      );

      // Write buffer to stream
      if (Buffer.isBuffer(file)) {
        uploadStream.end(file);
      } else {
        // If it's a string/path, pipe it
        uploadStream.end(Buffer.from(file, "base64"));
      }
    });
  } catch (error) {
    console.error("Cloudinary video upload error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

export const deleteFromCloudinary = async (publicId) => {
  try {
    if (useGcsMediaStorage) {
      const objectPath = extractGcsObjectPath(publicId);
      if (!objectPath || !gcsMediaBucketName) {
        return { success: false, error: "Could not determine GCS object path" };
      }

      await gcsStorage
        .bucket(gcsMediaBucketName)
        .file(objectPath)
        .delete({ ignoreNotFound: true });

      return { success: true, result: "ok" };
    }

    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === "ok",
      result: result.result,
    };
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get optimized image URL with transformations
 * @param {string} publicId - Cloudinary public_id
 * @param {object} options - Transformation options
 * @returns {string} Optimized image URL
 */
export const getOptimizedUrl = (publicId, options = {}) => {
  const {
    width = null,
    height = null,
    crop = "fill",
    quality = "auto",
    format = "auto",
  } = options;

  const transformations = [];

  if (width) transformations.push({ width });
  if (height) transformations.push({ height });
  if (width || height) transformations.push({ crop });
  transformations.push({ quality });
  transformations.push({ fetch_format: format });

  return cloudinary.url(publicId, {
    transformation: transformations,
    secure: true,
  });
};

export default cloudinary;
