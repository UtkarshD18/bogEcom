import express from "express";
import {
  getAdminCrmContactTimeline,
  getAdminCrmContacts,
  getAdminCrmOverview,
  getAdminCrmWhatsappConfig,
  getAdminCrmWhatsappAudiencePreview,
  getAdminCrmWhatsappOverview,
  getAdminCrmWhatsappTemplates,
  patchAdminCrmContact,
  postAdminCrmContactWhatsappMessage,
  postAdminCrmWhatsappCampaign,
  postAdminCrmWhatsappVerifyTokenGeneration,
  putAdminCrmWhatsappConfig,
} from "../controllers/adminCrm.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import requireAdminPermission from "../middlewares/requireAdminPermission.js";

const router = express.Router();

router.use(auth, admin, requireAdminPermission("manage_crm"));

router.get("/overview", getAdminCrmOverview);
router.get("/contacts", getAdminCrmContacts);
router.get("/contacts/:contactId/timeline", getAdminCrmContactTimeline);
router.patch("/contacts/:contactId", patchAdminCrmContact);
router.post(
  "/contacts/:contactId/whatsapp/send",
  postAdminCrmContactWhatsappMessage,
);
router.get("/whatsapp/overview", getAdminCrmWhatsappOverview);
router.get("/whatsapp/templates", getAdminCrmWhatsappTemplates);
router.get(
  "/whatsapp/config",
  requireAdminPermission("manage_settings"),
  getAdminCrmWhatsappConfig,
);
router.put(
  "/whatsapp/config",
  requireAdminPermission("manage_settings"),
  putAdminCrmWhatsappConfig,
);
router.post(
  "/whatsapp/config/generate-verify-token",
  requireAdminPermission("manage_settings"),
  postAdminCrmWhatsappVerifyTokenGeneration,
);
router.get("/whatsapp/audience-preview", getAdminCrmWhatsappAudiencePreview);
router.post("/whatsapp/campaign/send", postAdminCrmWhatsappCampaign);

export default router;
