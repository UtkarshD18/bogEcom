import mongoose from "mongoose";
import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import ReviewModel from "../models/review.model.js";
import UserModel from "../models/user.model.js";

const normalizeStatus = (status) =>
  String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const REVIEW_ALLOWED_STATUSES = new Set(["delivered", "completed"]);

const getRequesterUserId = (req) => req?.userId || req?.user?._id || req?.user;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const toResponseReview = (review) => ({
  _id: review._id,
  productId: review.productId,
  orderId: review.orderId,
  userId: review.userId,
  userName: review.userName,
  city: review.city,
  rating: review.rating,
  comment: review.comment,
  createdAt: review.createdAt,
});

/**
 * Submit review (customer)
 * POST /api/reviews
 */
export const submitReview = async (req, res) => {
  try {
    const userId = getRequesterUserId(req);
    const { productId, orderId, rating, comment } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: true,
        message: "Authentication required",
      });
    }

    if (!productId || !orderId || rating === undefined || !comment?.trim()) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "productId, orderId, rating and comment are required",
      });
    }

    if (!isValidObjectId(productId) || !isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid productId or orderId",
      });
    }

    const normalizedRating = Number(rating);
    if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Rating must be between 1 and 5",
      });
    }

    const order = await OrderModel.findById(orderId)
      .populate("delivery_address", "city")
      .select(
        "user order_status statusTimeline products delivery_address guestDetails billingDetails",
      )
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Order not found",
      });
    }

    if (!order.user || String(order.user) !== String(userId)) {
      return res.status(403).json({
        success: false,
        error: true,
        message: "You can review only your own orders",
      });
    }

    const normalizedOrderStatus = normalizeStatus(order.order_status);
    const hasEligibleTimelineStatus = Array.isArray(order.statusTimeline)
      ? order.statusTimeline.some((entry) =>
          REVIEW_ALLOWED_STATUSES.has(normalizeStatus(entry?.status)),
        )
      : false;

    if (
      !REVIEW_ALLOWED_STATUSES.has(normalizedOrderStatus) &&
      !hasEligibleTimelineStatus
    ) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Review is allowed only for delivered/completed orders",
      });
    }

    const productExistsInOrder = Array.isArray(order.products)
      ? order.products.some(
          (item) => String(item?.productId || "") === String(productId),
        )
      : false;

    if (!productExistsInOrder) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "This product is not part of the selected order",
      });
    }

    const productExists = await ProductModel.exists({ _id: productId });
    if (!productExists) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Product not found",
      });
    }

    const existingReview = await ReviewModel.findOne({
      orderId,
      productId,
      userId,
    }).select("_id");

    if (existingReview) {
      return res.status(409).json({
        success: false,
        error: true,
        message: "You already reviewed this product",
      });
    }

    let userName = "Customer";
    if (typeof req.user?.name === "string" && req.user.name.trim()) {
      userName = req.user.name.trim();
    } else {
      const userDoc = await UserModel.findById(userId).select("name").lean();
      if (userDoc?.name?.trim()) userName = userDoc.name.trim();
    }

    const city =
      order.delivery_address?.city?.trim?.() ||
      order.guestDetails?.city?.trim?.() ||
      order.billingDetails?.city?.trim?.() ||
      "";

    const review = await ReviewModel.create({
      productId,
      orderId,
      userId,
      userName,
      city,
      rating: normalizedRating,
      comment: comment.trim(),
    });

    return res.status(201).json({
      success: true,
      error: false,
      message: "Review submitted successfully",
      data: toResponseReview(review),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        error: true,
        message: "You already reviewed this product",
      });
    }

    console.error("submitReview error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: "Failed to submit review",
      details: error.message,
    });
  }
};

/**
 * Public product reviews
 * GET /api/reviews/:productId
 */
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid productId",
      });
    }

    const reviews = await ReviewModel.find({ productId })
      .select("productId orderId userName city rating comment createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      error: false,
      data: reviews.map((review) => toResponseReview(review)),
      total: reviews.length,
    });
  } catch (error) {
    console.error("getProductReviews error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: "Failed to fetch reviews",
      details: error.message,
    });
  }
};

/**
 * Current user reviews
 * GET /api/reviews/my
 */
export const getMyReviews = async (req, res) => {
  try {
    const userId = getRequesterUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: true,
        message: "Authentication required",
      });
    }

    const { orderId, productId } = req.query || {};
    const filter = { userId };

    if (orderId) {
      if (!isValidObjectId(orderId)) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Invalid orderId",
        });
      }
      filter.orderId = orderId;
    }

    if (productId) {
      if (!isValidObjectId(productId)) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Invalid productId",
        });
      }
      filter.productId = productId;
    }

    const reviews = await ReviewModel.find(filter)
      .select("productId orderId userName city rating comment createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      error: false,
      data: reviews.map((review) => toResponseReview(review)),
      total: reviews.length,
    });
  } catch (error) {
    console.error("getMyReviews error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: "Failed to fetch your reviews",
      details: error.message,
    });
  }
};

/**
 * Admin reviews list
 * GET /api/admin/reviews
 */
export const getAdminReviews = async (req, res) => {
  try {
    const {
      productId,
      orderId,
      userId,
      page = 1,
      limit = 50,
    } = req.query || {};

    const filter = {};
    if (productId) {
      if (!isValidObjectId(productId)) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Invalid productId",
        });
      }
      filter.productId = productId;
    }

    if (orderId) {
      if (!isValidObjectId(orderId)) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Invalid orderId",
        });
      }
      filter.orderId = orderId;
    }

    if (userId) {
      if (!isValidObjectId(userId)) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Invalid userId",
        });
      }
      filter.userId = userId;
    }

    const normalizedPage = Math.max(Number(page) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [reviews, total] = await Promise.all([
      ReviewModel.find(filter)
        .populate("productId", "name thumbnail price rating")
        .populate("orderId", "_id order_status createdAt")
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(normalizedLimit)
        .lean(),
      ReviewModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      error: false,
      data: reviews.map((review) => {
        const productRef = review.productId || null;
        const orderRef = review.orderId || null;
        const userRef = review.userId || null;

        return {
          _id: review._id,
          productId: productRef?._id || productRef || null,
          orderId: orderRef?._id || orderRef || null,
          userId: userRef?._id || userRef || null,
          userName: review.userName,
          city: review.city,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          product: productRef,
          order: orderRef,
          user: userRef,
        };
      }),
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / normalizedLimit)),
      },
    });
  } catch (error) {
    console.error("getAdminReviews error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: "Failed to fetch admin reviews",
      details: error.message,
    });
  }
};

/**
 * Admin delete review
 * DELETE /api/admin/reviews/:id
 */
export const deleteAdminReview = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid review id",
      });
    }

    const deleted = await ReviewModel.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Review not found",
      });
    }

    return res.status(200).json({
      success: true,
      error: false,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("deleteAdminReview error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: "Failed to delete review",
      details: error.message,
    });
  }
};
