import express from "express";
import * as newsletterController from "../controllers/newsletter.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

// Public routes
router.post("/subscribe", newsletterController.subscribe);
router.post("/unsubscribe", newsletterController.unsubscribe);

// Admin routes
router.get("/subscribers", auth, admin, newsletterController.getAllSubscribers);
router.delete(
  "/subscribers/:id",
  auth,
  admin,
  newsletterController.deleteSubscriber,
);

export default router;
