import fs from "fs";
import multer from "multer";
import os from "os";
import path from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * Image Upload Middleware
 *
 * Handles image uploads for products, categories, banners, etc.
 * Supports multiple file uploads.
 */

export const UPLOAD_ROOT =
  process.env.UPLOAD_DIR && String(process.env.UPLOAD_DIR).trim()
    ? String(process.env.UPLOAD_DIR).trim()
    : process.env.NODE_ENV === "production"
      ? path.join(os.tmpdir(), "uploads")
      : path.join(process.cwd(), "uploads");

const getUploadDir = (subDir = "") => path.join(UPLOAD_ROOT, subDir);

// Ensure upload directories exist
const uploadDirs = ["", "products", "categories", "banners", "slides", "users"];

uploadDirs.forEach((subDir) => {
  const dir = getUploadDir(subDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine folder based on route or fieldname
    let folder = "";

    if (
      req.baseUrl.includes("products") ||
      file.fieldname === "productImages"
    ) {
      folder = "products";
    } else if (
      req.baseUrl.includes("categories") ||
      file.fieldname === "categoryImage"
    ) {
      folder = "categories";
    } else if (
      req.baseUrl.includes("banners") ||
      file.fieldname === "bannerImage"
    ) {
      folder = "banners";
    } else if (
      req.baseUrl.includes("slides") ||
      req.baseUrl.includes("home-slides") ||
      file.fieldname === "slideImage"
    ) {
      folder = "slides";
    } else if (req.baseUrl.includes("users") || file.fieldname === "avatar") {
      folder = "users";
    }

    cb(null, getUploadDir(folder));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.",
      ),
      false,
    );
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10, // Max 10 files at once
  },
});

// Single image upload
export const uploadSingle = (fieldName = "image") => upload.single(fieldName);

// Multiple images upload
export const uploadMultiple = (fieldName = "images", maxCount = 10) =>
  upload.array(fieldName, maxCount);

// Multiple fields upload
export const uploadFields = (fields) => upload.fields(fields);

// Error handler middleware
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: true,
        success: false,
        message: "File too large. Maximum size is 5MB.",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Too many files. Maximum is 10 files.",
      });
    }
    return res.status(400).json({
      error: true,
      success: false,
      message: err.message,
    });
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

// Helper to get file URLs
export const getFileUrl = (req, filename, folder = "") => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}/uploads/${folder}/${filename}`
    .replace(/\/+/g, "/")
    .replace(":/", "://");
};

// Delete file helper
export const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting file:", error);
    return false;
  }
};

export default upload;
