import express from "express";
import auth from "../middlewares/auth.js";
import admin from "../middlewares/admin.js";
import {
  deleteEmailTemplateOverride,
  getEmailTemplate,
  listEmailTemplates,
  upsertEmailTemplateOverride,
} from "../controllers/adminEmailTemplates.controller.js";

const router = express.Router();

// Admin-only email template overrides for server/emails/*.html
router.get("/", auth, admin, listEmailTemplates);
router.get("/:templateFile", auth, admin, getEmailTemplate);
router.put("/:templateFile", auth, admin, upsertEmailTemplateOverride);
router.delete("/:templateFile", auth, admin, deleteEmailTemplateOverride);

export default router;

