import express from "express";
import {
  adminCreatePartner,
  adminDeletePartner,
  adminGeneratePartnerCredentialPdf,
  adminExportPartnersCsv,
  adminListPartners,
  adminRotatePartnerKey,
  adminUpdatePartner,
  getPartnerApiGuide,
  getPartnerApiGuidePdf,
  getPartnerCategories,
  getPartnerInventory,
  getPartnerPricing,
  getPartnerProductById,
  getPartnerProducts,
  getPartnerTags,
  partnerHealth,
} from "../controllers/partnerApi.controller.js";
import {
  partnerApiAuth,
  partnerRuntimeLimiter,
  requirePartnerScope,
} from "../middlewares/partnerApiAuth.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

router.get("/guide", getPartnerApiGuide);
router.get("/guide.pdf", getPartnerApiGuidePdf);
router.get("/health", partnerApiAuth, partnerRuntimeLimiter, partnerHealth);
router.get(
  "/products",
  partnerApiAuth,
  partnerRuntimeLimiter,
  requirePartnerScope("catalog.read"),
  getPartnerProducts,
);
router.get(
  "/products/:productId",
  partnerApiAuth,
  partnerRuntimeLimiter,
  requirePartnerScope("catalog.read"),
  getPartnerProductById,
);
router.get(
  "/inventory",
  partnerApiAuth,
  partnerRuntimeLimiter,
  requirePartnerScope("inventory.read"),
  getPartnerInventory,
);
router.get(
  "/pricing",
  partnerApiAuth,
  partnerRuntimeLimiter,
  requirePartnerScope("price.read"),
  getPartnerPricing,
);
router.get(
  "/categories",
  partnerApiAuth,
  partnerRuntimeLimiter,
  requirePartnerScope("catalog.read"),
  getPartnerCategories,
);
router.get(
  "/tags",
  partnerApiAuth,
  partnerRuntimeLimiter,
  requirePartnerScope("catalog.read"),
  getPartnerTags,
);

router.get("/admin/partners", auth, admin, adminListPartners);
router.get("/admin/partners/export.csv", auth, admin, adminExportPartnersCsv);
router.post("/admin/partners", auth, admin, adminCreatePartner);
router.patch("/admin/partners/:partnerId", auth, admin, adminUpdatePartner);
router.delete("/admin/partners/:partnerId", auth, admin, adminDeletePartner);
router.post(
  "/admin/partners/:partnerId/credential-pdf",
  auth,
  admin,
  adminGeneratePartnerCredentialPdf,
);
router.post(
  "/admin/partners/:partnerId/rotate-key",
  auth,
  admin,
  adminRotatePartnerKey,
);

export default router;
