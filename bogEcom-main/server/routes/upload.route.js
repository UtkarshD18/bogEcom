import express from "express";
import multer from "multer";
import {
  deleteFromCloudinary,
  uploadMultipleToCloudinary,
  uploadToCloudinary,
  uploadVideoToCloudinary,
} from "../config/cloudinary.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/**
 * Upload Routes with Cloudinary
 *
 * Handles file uploads to Cloudinary CDN
 * Benefits: Auto-optimization, global CDN, transformations
 */

// Multer config for memory storage (files go to Cloudinary, not disk)
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
    fileSize: 50 * 1024 * 1024, // 50MB limit
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
        message: "File too large. Maximum size is 50MB.",
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
 * Upload single image to Cloudinary
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

      // Upload to Cloudinary
      const result = await uploadToCloudinary(req.file.buffer, folder);

      if (!result.success) {
        return res.status(500).json({
          error: true,
          success: false,
          message: result.error || "Upload to Cloudinary failed",
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
          mimetype: req.file.mimetype,
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
 * Upload multiple images to Cloudinary
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

      // Upload all files to Cloudinary
      const buffers = req.files.map((file) => file.buffer);
      const results = await uploadMultipleToCloudinary(buffers, folder);

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
 * Upload video to Cloudinary
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
      console.log("Video upload request received");
      console.log(
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

      console.log("Uploading to Cloudinary...");
      // Upload to Cloudinary as video
      const result = await uploadVideoToCloudinary(
        req.file.buffer,
        "buyonegram/videos",
      );

      console.log("Cloudinary result:", result);

      if (!result.success) {
        return res.status(500).json({
          error: true,
          success: false,
          message: result.error || "Video upload to Cloudinary failed",
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
 * Delete image from Cloudinary
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
      // Extract public_id from Cloudinary URL
      // URL format: https://res.cloudinary.com/cloud_name/image/upload/v123/folder/filename.jpg
      const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
      if (matches && matches[1]) {
        idToDelete = matches[1];
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
