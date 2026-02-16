import express from "express";
import auth from "../middlewares/auth.js";
import {
  getMyReviews,
  getProductReviews,
  submitReview,
} from "../controllers/review.controller.js";

const router = express.Router();

// Customer actions
router.post("/", auth, submitReview);
router.get("/my", auth, getMyReviews);

// Public product reviews
router.get("/:productId", getProductReviews);

export default router;
