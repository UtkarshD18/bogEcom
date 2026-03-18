import express from "express";
import multer from "multer";
import * as newsletterController from "../controllers/newsletter.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

const newsletterAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const mime = String(file?.mimetype || "").toLowerCase();
    const allowed =
      mime === "application/pdf" ||
      mime.startsWith("image/jpeg") ||
      mime.startsWith("image/jpg") ||
      mime.startsWith("image/png") ||
      mime.startsWith("image/webp") ||
      mime.startsWith("image/gif");

    if (!allowed) {
      cb(new Error("Only image files and PDF files are allowed."));
      return;
    }

    cb(null, true);
  },
});

// Public routes
router.post("/subscribe", newsletterController.subscribe);
router.post("/unsubscribe", newsletterController.unsubscribe);

// Admin routes
router.get("/subscribers", auth, admin, newsletterController.getAllSubscribers);
router.get(
  "/admin/template",
  auth,
  admin,
  newsletterController.getAdminNewsletterTemplate,
);
router.put(
  "/admin/template",
  auth,
  admin,
  newsletterController.updateAdminNewsletterTemplate,
);
router.post(
  "/admin/send-broadcast",
  auth,
  admin,
  newsletterAttachmentUpload.array("attachments", 5),
  newsletterController.sendNewsletterBroadcast,
);
router.delete(
  "/subscribers/:id",
  auth,
  admin,
  newsletterController.deleteSubscriber,
);

// Campaign management (admin-only)
router.get(
  "/campaign/template",
  auth,
  admin,
  newsletterController.getCampaignTemplate,
);
router.put(
  "/campaign/template",
  auth,
  admin,
  newsletterController.updateCampaignTemplate,
);
router.post("/campaign/send", auth, admin, newsletterController.sendCampaign);

export default router;
