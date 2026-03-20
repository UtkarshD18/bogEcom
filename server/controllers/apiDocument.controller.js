import fs from "fs";
import path from "path";
import ApiDocument from "../models/apiDocument.model.js";

const toSlug = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

const toBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const buildAbsoluteUrl = (req, relativePath = "") => {
  const base = `${req.protocol}://${req.get("host")}`;
  const normalizedPath = `/${String(relativePath || "").replace(/^\/+/, "")}`;
  return `${base}${normalizedPath}`;
};

const toPublicPayload = (req, doc) => {
  const fileUrl = buildAbsoluteUrl(req, doc.filePath);
  const shareUrl = buildAbsoluteUrl(req, `/api/api-docs/public/${doc.slug}`);

  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description || "",
    slug: doc.slug,
    isPublic: Boolean(doc.isPublic),
    originalFileName: doc.originalFileName,
    mimeType: doc.mimeType,
    fileSize: Number(doc.fileSize || 0),
    fileUrl,
    shareUrl,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const ensureUniqueSlug = async (baseSlug) => {
  const cleanBase = baseSlug || `api-doc-${Date.now()}`;
  let slug = cleanBase;
  let counter = 1;

  while (await ApiDocument.exists({ slug })) {
    counter += 1;
    slug = `${cleanBase}-${counter}`;
  }

  return slug;
};

export const getAdminApiDocuments = async (req, res) => {
  try {
    const docs = await ApiDocument.find({})
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: docs.map((doc) => toPublicPayload(req, doc)),
    });
  } catch (error) {
    console.error("Get admin API docs error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch API PDF documents",
    });
  }
};

export const createApiDocument = async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const description = String(req.body?.description || "").trim();
    const isPublic = toBoolean(req.body?.isPublic, true);

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "PDF file is required",
      });
    }

    const baseSlug = toSlug(title) || `api-doc-${Date.now()}`;
    const slug = await ensureUniqueSlug(baseSlug);

    const filePath = `/uploads/api-docs/${req.file.filename}`;

    const doc = await ApiDocument.create({
      title,
      description,
      slug,
      isPublic,
      filePath,
      originalFileName: req.file.originalname,
      storageFileName: req.file.filename,
      mimeType: req.file.mimetype || "application/pdf",
      fileSize: Number(req.file.size || 0),
      uploadedBy: req.user?._id || req.user || null,
    });

    return res.status(201).json({
      success: true,
      message: "API PDF uploaded successfully",
      data: toPublicPayload(req, doc),
    });
  } catch (error) {
    console.error("Create API doc error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload API PDF",
    });
  }
};

export const updateApiDocument = async (req, res) => {
  try {
    const docId = String(req.params?.id || "").trim();
    const update = {};

    if (req.body?.title !== undefined) {
      const nextTitle = String(req.body.title || "").trim();
      if (!nextTitle) {
        return res.status(400).json({
          success: false,
          message: "Title cannot be empty",
        });
      }
      update.title = nextTitle;
    }

    if (req.body?.description !== undefined) {
      update.description = String(req.body.description || "").trim();
    }

    if (req.body?.isPublic !== undefined) {
      update.isPublic = toBoolean(req.body.isPublic, true);
    }

    const updated = await ApiDocument.findByIdAndUpdate(
      docId,
      { $set: update },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "API PDF not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "API PDF updated",
      data: toPublicPayload(req, updated),
    });
  } catch (error) {
    console.error("Update API doc error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update API PDF",
    });
  }
};

export const deleteApiDocument = async (req, res) => {
  try {
    const docId = String(req.params?.id || "").trim();
    const doc = await ApiDocument.findByIdAndDelete(docId);

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "API PDF not found",
      });
    }

    const uploadRoot = path.resolve(process.cwd(), "uploads", "api-docs");
    const filePath = path.resolve(uploadRoot, String(doc.storageFileName || ""));

    try {
      if (doc.storageFileName && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      console.warn("Unable to delete API PDF file:", fileError?.message || fileError);
    }

    return res.status(200).json({
      success: true,
      message: "API PDF deleted",
    });
  } catch (error) {
    console.error("Delete API doc error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete API PDF",
    });
  }
};

export const getPublicApiDocuments = async (req, res) => {
  try {
    const docs = await ApiDocument.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: docs.map((doc) => toPublicPayload(req, doc)),
    });
  } catch (error) {
    console.error("Get public API docs error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch public API PDFs",
    });
  }
};

export const getPublicApiDocumentBySlug = async (req, res) => {
  try {
    const slug = String(req.params?.slug || "").trim().toLowerCase();
    const doc = await ApiDocument.findOne({ slug, isPublic: true }).lean();

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "API PDF not found",
      });
    }

    const wantsJson =
      String(req.query?.format || "").trim().toLowerCase() === "json";
    const fileUrl = buildAbsoluteUrl(req, doc.filePath);

    if (!wantsJson) {
      return res.redirect(302, fileUrl);
    }

    return res.status(200).json({
      success: true,
      data: toPublicPayload(req, doc),
    });
  } catch (error) {
    console.error("Get public API doc by slug error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch API PDF",
    });
  }
};
