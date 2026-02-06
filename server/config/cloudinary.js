import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure environment variables are loaded from server root
dotenv.config({ path: path.join(__dirname, "../.env") });
const isProduction = process.env.NODE_ENV === "production";
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

/**
 * Upload image to Cloudinary
 * @param {Buffer|string} file - File buffer or base64 string
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<object>} Upload result with url, public_id, etc.
 */
export const uploadToCloudinary = async (file, folder = "buyonegram") => {
  try {
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

    const options = {
      folder: folder,
      resource_type: "image",
      transformation: [
        { quality: "auto:best" }, // Auto optimize quality
        { fetch_format: "auto" }, // Auto format (webp, etc.)
      ],
    };

    // If file is a buffer, convert to base64
    let uploadStr = file;
    if (Buffer.isBuffer(file)) {
      uploadStr = `data:image/jpeg;base64,${file.toString("base64")}`;
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
    const uploadPromises = files.map((file) =>
      uploadToCloudinary(file, folder),
    );
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
) => {
  try {
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
