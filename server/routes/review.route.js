import express from "express";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import optionalAuth from "../middlewares/optionalAuth.js";
import {
  deleteAdminReview,
  getComboReviews,
  getFeaturedHomeReviews,
  getMyReviews,
  getProductReviews,
  submitReview,
} from "../controllers/review.controller.js";

const router = express.Router();

// Customer actions
router.post("/", optionalAuth, submitReview);
router.delete("/:id", auth, admin, deleteAdminReview);
router.get("/my", auth, getMyReviews);

// Public product reviews
router.get("/featured/home", getFeaturedHomeReviews);
router.get("/combo/:comboId", getComboReviews);
router.get("/:productId", getProductReviews);

export default router;
