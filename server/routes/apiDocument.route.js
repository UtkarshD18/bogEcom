import fs from "fs";
import multer from "multer";
import path from "path";
import express from "express";
import {
  createApiDocument,
  deleteApiDocument,
  getAdminApiDocuments,
  getPublicApiDocumentBySlug,
  getPublicApiDocuments,
  updateApiDocument,
} from "../controllers/apiDocument.controller.js";
import auth from "../middlewares/auth.js";
import admin from "../middlewares/admin.js";

const router = express.Router();

const docsDir = path.resolve(process.cwd(), "uploads", "api-docs");
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, docsDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(String(file?.originalname || "")).toLowerCase();
    const safeExt = extension === ".pdf" ? ".pdf" : ".pdf";
    cb(null, `api-doc-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const mime = String(file?.mimetype || "").toLowerCase();
    const ext = path.extname(String(file?.originalname || "")).toLowerCase();

    if (mime === "application/pdf" || ext === ".pdf") {
      cb(null, true);
      return;
    }

    cb(new Error("Only PDF files are allowed."));
  },
});

const handleUploadError = (err, _req, res, next) => {
  if (!err) return next();

  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "PDF is too large. Maximum size is 20MB.",
    });
  }

  return res.status(400).json({
    success: false,
    message: err.message || "Invalid upload",
  });
};

router.get("/public", getPublicApiDocuments);
router.get("/public/:slug", getPublicApiDocumentBySlug);

router.get("/admin/all", auth, admin, getAdminApiDocuments);
router.post(
  "/admin/create",
  auth,
  admin,
  upload.single("pdf"),
  handleUploadError,
  createApiDocument,
);
router.put("/admin/:id", auth, admin, updateApiDocument);
router.delete("/admin/:id", auth, admin, deleteApiDocument);

export default router;
