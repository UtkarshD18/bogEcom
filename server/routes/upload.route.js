import express from "express";
import multer from "multer";
import sharp from "sharp";
import {
  deleteFromCloudinary,
  uploadMultipleToCloudinary,
  uploadToCloudinary,
  uploadVideoToCloudinary,
} from "../config/cloudinary.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();
const isProduction = process.env.NODE_ENV === "production";
// Debug-only logging to keep production output clean
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

const WEBP_DEFAULT_QUALITY = 82;
const WEBP_PRESERVE_QUALITY = 90;

const shouldConvertToWebp = (mimeType = "") => {
  const normalized = String(mimeType || "").toLowerCase();
  if (!normalized.startsWith("image/")) return false;
  if (normalized === "image/webp") return false;
  if (normalized === "image/svg+xml") return false;
  return true;
};

const convertBufferToWebp = async (
  buffer,
  mimeType = "image/jpeg",
  preserveQuality = false,
) => {
  const quality = preserveQuality ? WEBP_PRESERVE_QUALITY : WEBP_DEFAULT_QUALITY;
  return sharp(buffer, {
    animated: String(mimeType || "").toLowerCase() === "image/gif",
  })
    .webp({ quality })
    .toBuffer();
};

/**
 * Upload Routes with managed media storage
 *
 * Handles file uploads to Firebase Storage / GCS or Cloudinary fallback
 * Benefits: Auto-optimization, CDN-friendly delivery, transformations
 */

// Multer config for memory storage (files go to media storage, not disk)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const allowedVideoTypes = ["video/mp4", "video/webm"];
  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, GIF, WebP, MP4, WebM allowed.",
      ),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10,
  },
});

// Error handler for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: true,
        success: false,
        message: "File too large. Maximum size is 100MB.",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Too many files. Maximum is 10 files.",
      });
    }
  }
  if (err) {
    return res.status(400).json({
      error: true,
      success: false,
      message: err.message,
    });
  }
  next();
};

/**
 * Upload single image to media storage
 * @route POST /api/upload/single
 */
router.post(
  "/single",
  auth,
  admin,
  upload.single("image"),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "No file uploaded",
        });
      }

      // Determine folder based on request
      let folder = "buyonegram/general";
      const referer = req.get("referer") || "";
      const preserveQuality =
        req.body.preserveQuality === true ||
        req.body.preserveQuality === "true" ||
        req.body.folder === "blogs" ||
        referer.includes("blogs");

      if (referer.includes("products") || req.body.folder === "products") {
        folder = "buyonegram/products";
      } else if (
        referer.includes("categories") ||
        req.body.folder === "categories"
      ) {
        folder = "buyonegram/categories";
      } else if (referer.includes("banners") || req.body.folder === "banners") {
        folder = "buyonegram/banners";
      } else if (
        referer.includes("slides") ||
        referer.includes("home-slides") ||
        req.body.folder === "slides"
      ) {
        folder = "buyonegram/slides";
      } else if (referer.includes("users") || req.body.folder === "users") {
        folder = "buyonegram/users";
      }

      let uploadBuffer = req.file.buffer;
      let uploadMimeType = req.file.mimetype;

      if (shouldConvertToWebp(uploadMimeType)) {
        uploadBuffer = await convertBufferToWebp(
          uploadBuffer,
          uploadMimeType,
          preserveQuality,
        );
        uploadMimeType = "image/webp";
      }

      // Upload to configured media storage provider
      const result = await uploadToCloudinary(uploadBuffer, folder, {
        mimeType: uploadMimeType,
        preserveQuality,
      });

      if (!result.success) {
        return res.status(500).json({
          error: true,
          success: false,
          message: result.error || "Media upload failed",
        });
      }

      res.status(200).json({
        error: false,
        success: true,
        message: "File uploaded successfully",
        data: {
          url: result.url,
          publicId: result.publicId,
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.size,
          filename: req.file.originalname,
          originalname: req.file.originalname,
          mimetype: uploadMimeType,
          originalMimetype: req.file.mimetype,
        },
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        error: true,
        success: false,
        message: "Upload failed: " + error.message,
      });
    }
  },
);

/**
 * Upload multiple images to media storage
 * @route POST /api/upload/multiple
 */
router.post(
  "/multiple",
  auth,
  admin,
  upload.array("images", 10),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "No files uploaded",
        });
      }

      // Determine folder
      let folder = "buyonegram/products";
      if (req.body.folder) {
        folder = `buyonegram/${req.body.folder}`;
      }

      const preserveQuality =
        req.body.preserveQuality === true ||
        req.body.preserveQuality === "true";

      const processedFiles = await Promise.all(
        req.files.map(async (file) => {
          let uploadBuffer = file.buffer;
          let uploadMimeType = file.mimetype;
          if (shouldConvertToWebp(uploadMimeType)) {
            uploadBuffer = await convertBufferToWebp(
              uploadBuffer,
              uploadMimeType,
              preserveQuality,
            );
            uploadMimeType = "image/webp";
          }
          return { ...file, buffer: uploadBuffer, mimetype: uploadMimeType };
        }),
      );

      // Upload all files to configured media storage provider
      const results = await uploadMultipleToCloudinary(processedFiles, folder);

      const successfulUploads = results.filter((r) => r.success);
      const failedUploads = results.filter((r) => !r.success);

      if (successfulUploads.length === 0) {
        return res.status(500).json({
          error: true,
          success: false,
          message: "All uploads failed",
        });
      }

      const files = successfulUploads.map((result, index) => ({
        url: result.url,
        publicId: result.publicId,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.size,
        filename: req.files[index]?.originalname,
        originalname: req.files[index]?.originalname,
        mimetype: processedFiles[index]?.mimetype,
      }));

      res.status(200).json({
        error: false,
        success: true,
        message: `${files.length} files uploaded successfully${failedUploads.length > 0 ? `, ${failedUploads.length} failed` : ""}`,
        data: files,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        error: true,
        success: false,
        message: "Upload failed: " + error.message,
      });
    }
  },
);

/**
 * Upload video to media storage
 * @route POST /api/upload/video
 */
router.post(
  "/video",
  auth,
  admin,
  upload.single("video"),
  handleUploadError,
  async (req, res) => {
    try {
      debugLog("Video upload request received");
      debugLog(
        "File received:",
        req.file
          ? {
              fieldname: req.file.fieldname,
              originalname: req.file.originalname,
              mimetype: req.file.mimetype,
              size: req.file.size,
            }
          : "No file",
      );

      if (!req.file) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "No video file uploaded",
        });
      }

      // Validate video type
      const allowedVideoTypes = ["video/mp4", "video/webm"];
      if (!allowedVideoTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Invalid video type. Only MP4 and WebM allowed.",
        });
      }

      debugLog("Uploading video to configured media storage...");
      // Upload to configured media storage provider as video
      const result = await uploadVideoToCloudinary(
        req.file.buffer,
        "buyonegram/videos",
        { mimeType: req.file.mimetype },
      );

      debugLog("Media upload result:", result);

      if (!result.success) {
        return res.status(500).json({
          error: true,
          success: false,
          message: result.error || "Video upload failed",
        });
      }

      res.status(200).json({
        error: false,
        success: true,
        message: "Video uploaded successfully",
        data: {
          url: result.url,
          publicId: result.publicId,
          width: result.width,
          height: result.height,
          format: result.format,
          duration: result.duration,
          size: result.size,
          filename: req.file.originalname,
        },
      });
    } catch (error) {
      console.error("Video upload error:", error);
      res.status(500).json({
        error: true,
        success: false,
        message: "Video upload failed: " + error.message,
      });
    }
  },
);

/**
 * Delete image from media storage
 * @route DELETE /api/upload
 */
router.delete("/", auth, admin, async (req, res) => {
  try {
    const { publicId, url } = req.body;

    if (!publicId && !url) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "publicId or url is required",
      });
    }

    // Extract publicId from URL if not provided
    let idToDelete = publicId;
    if (!idToDelete && url) {
      // Extract public ID from URL
      // URL format: https://res.cloudinary.com/cloud_name/image/upload/v123/folder/filename.jpg
      const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
      if (matches && matches[1]) {
        idToDelete = matches[1];
      } else if (
        [
          "firebase",
          "firebase-storage",
          "firebase_storage",
          "gcs",
          "google-cloud-storage",
          "google_storage",
        ].includes(
          String(process.env.MEDIA_STORAGE_PROVIDER || "")
            .trim()
            .toLowerCase(),
        )
      ) {
        idToDelete = url;
      }
    }

    if (!idToDelete) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Could not determine image to delete",
      });
    }

    const result = await deleteFromCloudinary(idToDelete);

    if (result.success) {
      res.status(200).json({
        error: false,
        success: true,
        message: "File deleted successfully",
      });
    } else {
      res.status(404).json({
        error: true,
        success: false,
        message: "File not found or already deleted",
      });
    }
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Delete failed: " + error.message,
    });
  }
});

export default router;
