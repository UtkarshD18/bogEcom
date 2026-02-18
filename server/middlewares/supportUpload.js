import fs from "fs";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { UPLOAD_ROOT } from "./upload.js";

const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_SIZE = MAX_VIDEO_FILE_SIZE;
const MAX_IMAGE_COUNT = 5;
const MAX_VIDEO_COUNT = 3;

const IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm",
  "video/mpeg",
  "video/3gpp",
  "video/3gpp2",
  "video/x-m4v",
  "video/mp2t",
  "video/h264",
  "video/mjpeg",
  "video/x-motion-jpeg",
];

const supportImagesDir = path.join(UPLOAD_ROOT, "support", "images");
const supportVideosDir = path.join(UPLOAD_ROOT, "support", "videos");

[supportImagesDir, supportVideosDir].forEach((dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "images") {
      cb(null, supportImagesDir);
      return;
    }

    if (file.fieldname === "videos") {
      cb(null, supportVideosDir);
      return;
    }

    cb(new Error("Invalid upload field"));
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${randomUUID()}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "images" && IMAGE_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  if (file.fieldname === "videos" && VIDEO_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(
    new Error(
      "Unsupported file type. Allowed images: JPG, JPEG, PNG, WEBP. Allowed videos: MP4 (H.264), MOV, AVI, MKV, WEBM, MPEG, 3GP, M4V.",
    ),
    false,
  );
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_IMAGE_COUNT + MAX_VIDEO_COUNT,
  },
});

export const supportUploadFields = upload.fields([
  { name: "images", maxCount: MAX_IMAGE_COUNT },
  { name: "videos", maxCount: MAX_VIDEO_COUNT },
]);

const cleanupRejectedFiles = (files = []) => {
  files.forEach((file) => {
    try {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch {
      // Ignore cleanup errors while returning validation response.
    }
  });
};

export const validateSupportUploadedFileSizes = (req, res, next) => {
  const images = Array.isArray(req.files?.images) ? req.files.images : [];
  const videos = Array.isArray(req.files?.videos) ? req.files.videos : [];

  const oversizedImage = images.find(
    (file) => Number(file?.size || 0) > MAX_IMAGE_FILE_SIZE,
  );
  if (oversizedImage) {
    cleanupRejectedFiles([...images, ...videos]);
    return res.status(400).json({
      success: false,
      message: `Image file too large: ${oversizedImage.originalname}. Max allowed size is 10MB per image.`,
      data: {},
    });
  }

  const oversizedVideo = videos.find(
    (file) => Number(file?.size || 0) > MAX_VIDEO_FILE_SIZE,
  );
  if (oversizedVideo) {
    cleanupRejectedFiles([...images, ...videos]);
    return res.status(400).json({
      success: false,
      message: `Video file too large: ${oversizedVideo.originalname}. Max allowed size is 50MB per video.`,
      data: {},
    });
  }

  next();
};

export const handleSupportUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message:
          "File too large. Max allowed size is 10MB per image and 50MB per video.",
        data: {},
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Too many files uploaded. Max 5 images and 3 videos.",
        data: {},
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || "File upload failed.",
      data: {},
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Invalid upload payload.",
      data: {},
    });
  }

  next();
};

export const supportUploadConfig = {
  MAX_FILE_SIZE,
  MAX_IMAGE_FILE_SIZE,
  MAX_VIDEO_FILE_SIZE,
  MAX_IMAGE_COUNT,
  MAX_VIDEO_COUNT,
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
};
