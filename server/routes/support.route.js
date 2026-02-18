import express from "express";
import {
  createSupportTicket,
  getAllSupportTicketsAdmin,
  getMySupportTickets,
  getSupportTicketByIdAdmin,
  getUnresolvedSupportTicketCount,
  updateSupportTicketAdmin,
} from "../controllers/support.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import optionalAuth from "../middlewares/optionalAuth.js";
import { supportLimiter } from "../middlewares/rateLimiter.js";
import {
  handleSupportUploadError,
  supportUploadFields,
  validateSupportUploadedFileSizes,
} from "../middlewares/supportUpload.js";

const router = express.Router();

router.post(
  "/create",
  supportLimiter,
  optionalAuth,
  supportUploadFields,
  handleSupportUploadError,
  validateSupportUploadedFileSizes,
  createSupportTicket,
);

router.get("/my-tickets", auth, getMySupportTickets);

router.get("/admin/all", auth, admin, getAllSupportTicketsAdmin);
router.get("/admin/unresolved-count", auth, admin, getUnresolvedSupportTicketCount);
router.get("/admin/:ticketId", auth, admin, getSupportTicketByIdAdmin);
router.put("/admin/update/:ticketId", auth, admin, updateSupportTicketAdmin);

export default router;
