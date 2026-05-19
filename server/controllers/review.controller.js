import mongoose from "mongoose";
import ComboModel from "../models/combo.model.js";
import {
  DEFAULT_REVIEW_SETTINGS,
  isValidReviewSource,
  isValidReviewVisibility,
  normalizeReviewSettings,
  normalizeReviewVisibility,
} from "../constants/reviewSettings.js";
import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import ReviewModel from "../models/review.model.js";
import SettingsModel from "../models/settings.model.js";
import UserModel from "../models/user.model.js";

const REVIEW_ALLOWED_STATUSES = new Set(["delivered", "completed"]);
const REVIEW_SETTINGS_KEY = "reviewSettings";

const normalizeStatus = (status) =>
  String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const sanitizePlainText = (value, maxLength = 2000) =>
  String(value || "")
    .trim()
    .slice(0, maxLength);

const sanitizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 160);

const getRequesterUserId = (req) => req?.userId || req?.user?._id || req?.user;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const createPlaceholderObjectId = () => new mongoose.Types.ObjectId();

const loadReviewSettings = async () => {
  try {
    const setting = await SettingsModel.findOne({
      key: REVIEW_SETTINGS_KEY,
    })
      .select("value")
      .lean();

    return normalizeReviewSettings(setting?.value);
  } catch {
    return { ...DEFAULT_REVIEW_SETTINGS };
  }
};

const getUserProfile = async (userId) => {
  if (!isValidObjectId(userId)) {
    return null;
  }

  return UserModel.findById(userId).select("name email").lean();
};

const toResponseReview = (review) => ({
  _id: review._id,
  productId: review.productId,
  variantId: review.variantId || null,
  comboId: review.comboId || null,
  orderId: review.orderId,
  userId: review.userId,
  userName: review.userName,
  userEmail: review.userEmail || "",
  city: review.city,
  rating: review.rating,
  comment: review.comment,
  source: review.source || "order",
  visibility: review.visibility || "visible",
  isVerifiedPurchase: Boolean(review.isVerifiedPurchase),
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
});

const toFeaturedHomeReview = (review) => {
  const productRef = review.productId || null;
  const comboRef = review.comboId || null;
  const itemRef =
    comboRef && typeof comboRef === "object" && comboRef._id
      ? comboRef
      : productRef && typeof productRef === "object" && productRef._id
        ? productRef
        : null;
  const itemName =
    String(itemRef?.name || itemRef?.title || "").trim() ||
    (comboRef ? "Combo deal" : "Healthy One Gram");
  const itemImage =
    itemRef?.thumbnail ||
    itemRef?.image ||
    (Array.isArray(itemRef?.images) ? itemRef.images[0] : "") ||
    "";

  return {
    ...toResponseReview(review),
    itemName,
    itemImage,
    itemType: comboRef ? "combo" : "product",
    itemSlug: itemRef?.slug || "",
  };
};

const toAdminResponseReview = (review) => {
  const productRef = review.productId || null;
  const orderRef = review.orderId || null;
  const userRef = review.userId || null;

  return {
    _id: review._id,
    productId: productRef?._id || productRef || null,
    variantId: review.variantId || null,
    comboId: review.comboId?._id || review.comboId || null,
    orderId: orderRef?._id || orderRef || null,
    userId: userRef?._id || userRef || null,
    userName: review.userName,
    userEmail: review.userEmail || "",
    city: review.city,
    rating: review.rating,
    comment: review.comment,
    source: review.source || "order",
    visibility: review.visibility || "visible",
    isVerifiedPurchase: Boolean(review.isVerifiedPurchase),
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    moderatedAt: review.moderatedAt || null,
    moderatedBy: review.moderatedBy || null,
    product: productRef,
    combo: review.comboId || null,
    order: orderRef,
    user: userRef,
  };
};

const syncReviewAggregates = async ({
  productId = null,
  comboId = null,
} = {}) => {
  const visibleFilter = {
    $or: [
      { visibility: "visible" },
      { visibility: { $exists: false } },
      { visibility: null },
    ],
  };

  if (isValidObjectId(productId)) {
    // Product review counts are computed from ReviewModel at read time.
    // Do not persist rating/review totals on Product or Product variants.
  }

  if (isValidObjectId(comboId)) {
    const comboReviews = await ReviewModel.find({
      comboId,
      ...visibleFilter,
    })
      .select("rating")
      .lean();

    const count = comboReviews.length;
    const rating = count
      ? Math.round(
          (comboReviews.reduce(
            (sum, review) => sum + Number(review?.rating || 0),
            0,
          ) /
            count) *
            10,
        ) / 10
      : 0;

    await ComboModel.findByIdAndUpdate(comboId, {
      $set: {
        reviewCount: count,
        rating,
      },
    }).catch(() => null);
  }
};

const resolveReviewUserIdentity = async (req, userId, explicitUserName = "") => {
  const sanitizedExplicitName = sanitizePlainText(explicitUserName, 120);
  const sanitizedRequestName =
    typeof req.user?.name === "string"
      ? sanitizePlainText(req.user.name, 120)
      : "";
  const sanitizedRequestEmail =
    typeof req.user?.email === "string" ? sanitizeEmail(req.user.email) : "";

  if (sanitizedExplicitName) {
    return {
      userName: sanitizedExplicitName,
      userEmail: sanitizedRequestEmail,
    };
  }

  if (sanitizedRequestName || sanitizedRequestEmail) {
    return {
      userName: sanitizedRequestName || "Customer",
      userEmail: sanitizedRequestEmail,
    };
  }

  const userProfile = await getUserProfile(userId);

  return {
    userName: sanitizePlainText(userProfile?.name, 120) || "Customer",
    userEmail: sanitizeEmail(userProfile?.email),
  };
};

const buildSearchRegex = (value) =>
  new RegExp(String(value || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

const validateRating = (rating) => {
  const normalizedRating = Number(rating);
  if (
    !Number.isFinite(normalizedRating) ||
    normalizedRating < 1 ||
    normalizedRating > 5
  ) {
    return null;
  }

  return normalizedRating;
};

const submitOrderLinkedReview = async ({
  req,
  res,
  userId,
  productId,
  variantId = null,
  orderId,
  rating,
  comment,
}) => {
  if (!isValidObjectId(productId) || !isValidObjectId(orderId)) {
    return res.status(400).json({
      success: false,
      error: true,
      message: "Invalid productId or orderId",
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

  const normalizedVariantId = isValidObjectId(variantId) ? variantId : null;
  const productExistsInOrder = Array.isArray(order.products)
    ? order.products.some((item) => {
        const itemProductMatches =
          String(item?.productId || "") === String(productId);
        if (!itemProductMatches) return false;
        if (!normalizedVariantId) return true;
        return (
          String(item?.variantId || item?.variant?._id || item?.variant || "") ===
          String(normalizedVariantId)
        );
      })
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
    variantId: normalizedVariantId,
    userId,
  }).select("_id");

  if (existingReview) {
    return res.status(409).json({
      success: false,
      error: true,
      message: "You already reviewed this product",
    });
  }

  const userIdentity = await resolveReviewUserIdentity(req, userId);
  const city =
    sanitizePlainText(order.delivery_address?.city, 120) ||
    sanitizePlainText(order.guestDetails?.city, 120) ||
    sanitizePlainText(order.billingDetails?.city, 120) ||
    "";

  const review = await ReviewModel.create({
    productId,
    variantId: normalizedVariantId,
    orderId,
    userId,
    userName: userIdentity.userName,
    userEmail: userIdentity.userEmail,
    city,
    rating,
    comment,
    source: "order",
    visibility: "visible",
    isVerifiedPurchase: true,
  });

  await syncReviewAggregates({ productId });

  return res.status(201).json({
    success: true,
    error: false,
    message: "Review submitted successfully",
    data: toResponseReview(review),
  });
};

const submitPublicReview = async ({
  req,
  res,
  userId,
  productId,
  variantId,
  comboId,
  rating,
  comment,
}) => {
  const reviewSettings = await loadReviewSettings();

  if (!reviewSettings.allowPublicSubmissions) {
    return res.status(403).json({
      success: false,
      error: true,
      message: "Public review submissions are currently disabled",
    });
  }

  const normalizedComboId = isValidObjectId(comboId) ? comboId : null;
  const normalizedVariantId = isValidObjectId(variantId) ? variantId : null;
  const targetId = normalizedComboId || productId;

  if (!isValidObjectId(targetId)) {
    return res.status(400).json({
      success: false,
      error: true,
      message: normalizedComboId ? "Invalid comboId" : "Invalid productId",
    });
  }

  const targetExists = normalizedComboId
    ? await ComboModel.exists({ _id: normalizedComboId })
    : await ProductModel.exists({ _id: productId });
  if (!targetExists) {
    return res.status(404).json({
      success: false,
      error: true,
      message: normalizedComboId ? "Combo not found" : "Product not found",
    });
  }

  const userIdentity = await resolveReviewUserIdentity(
    req,
    userId,
    req.body?.userName,
  );

  if (!sanitizePlainText(userIdentity.userName, 120)) {
    return res.status(400).json({
      success: false,
      error: true,
      message: "userName is required for public reviews",
    });
  }

  const review = await ReviewModel.create({
    productId: targetId,
    variantId: normalizedVariantId,
    comboId: normalizedComboId,
    orderId: createPlaceholderObjectId(),
    userId: isValidObjectId(userId) ? userId : createPlaceholderObjectId(),
    userName: userIdentity.userName,
    userEmail:
      sanitizeEmail(req.body?.userEmail) || userIdentity.userEmail || "",
    city: sanitizePlainText(req.body?.city, 120),
    rating,
    comment,
    source: "public",
    visibility: "visible",
    isVerifiedPurchase: false,
  });

  await syncReviewAggregates({
    productId: normalizedComboId ? null : targetId,
    comboId: normalizedComboId,
  });

  return res.status(201).json({
    success: true,
    error: false,
    message: "Review submitted successfully",
    data: toResponseReview(review),
  });
};

/**
 * Submit review
 * POST /api/reviews
 */
export const submitReview = async (req, res) => {
  try {
    const userId = getRequesterUserId(req);
    const { productId, variantId, comboId, orderId, rating, comment } = req.body || {};

    if ((!productId && !comboId) || rating === undefined || !sanitizePlainText(comment)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "productId or comboId, rating and comment are required",
      });
    }

    const normalizedRating = validateRating(rating);
    if (!normalizedRating) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Rating must be between 1 and 5",
      });
    }

    const normalizedComment = sanitizePlainText(comment, 2000);

    if (userId && orderId && productId) {
      return submitOrderLinkedReview({
        req,
        res,
        userId,
        productId,
        variantId,
        orderId,
        rating: normalizedRating,
        comment: normalizedComment,
      });
    }

    return submitPublicReview({
      req,
      res,
      userId,
      productId,
      variantId,
      comboId,
      rating: normalizedRating,
      comment: normalizedComment,
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
    const { variantId } = req.query || {};
    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid productId",
      });
    }

    const filter = {
      productId,
      $and: [
        { $or: [{ comboId: null }, { comboId: { $exists: false } }] },
        {
          $or: [
            { visibility: "visible" },
            { visibility: { $exists: false } },
            { visibility: null },
          ],
        },
      ],
    };

    if (variantId) {
      if (!isValidObjectId(variantId)) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Invalid variantId",
        });
      }
      filter.variantId = variantId;
    }

    const reviews = await ReviewModel.find(filter)
      .select(
        "productId variantId orderId userName userEmail city rating comment source visibility isVerifiedPurchase createdAt updatedAt",
      )
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

export const getComboReviews = async (req, res) => {
  try {
    const { comboId } = req.params;
    const { variantId } = req.query || {};
    if (!isValidObjectId(comboId)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid comboId",
      });
    }

    const filter = {
      comboId,
      $or: [
        { visibility: "visible" },
        { visibility: { $exists: false } },
        { visibility: null },
      ],
    };

    if (variantId) {
      if (!isValidObjectId(variantId)) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Invalid variantId",
        });
      }
      filter.variantId = variantId;
    }

    const reviews = await ReviewModel.find(filter)
      .select(
        "productId variantId comboId orderId userName userEmail city rating comment source visibility isVerifiedPurchase createdAt updatedAt",
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      error: false,
      data: reviews.map((review) => toResponseReview(review)),
      total: reviews.length,
    });
  } catch (error) {
    console.error("getComboReviews error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: "Failed to fetch combo reviews",
      details: error.message,
    });
  }
};

export const getFeaturedHomeReviews = async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(Number.parseInt(String(req.query?.limit || "6"), 10) || 6, 1),
      12,
    );

    const reviews = await ReviewModel.find({
      $or: [
        { visibility: "visible" },
        { visibility: { $exists: false } },
        { visibility: null },
      ],
      rating: { $gte: 4 },
    })
      .select(
        "productId variantId comboId orderId userName userEmail city rating comment source visibility isVerifiedPurchase createdAt updatedAt",
      )
      .populate("productId", "name title slug thumbnail images")
      .populate("comboId", "name title slug thumbnail image images")
      .sort({ isVerifiedPurchase: -1, rating: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      error: false,
      data: reviews.map((review) => toFeaturedHomeReview(review)),
      total: reviews.length,
    });
  } catch (error) {
    console.error("getFeaturedHomeReviews error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: "Failed to fetch featured reviews",
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
      .select(
        "productId variantId orderId userName userEmail city rating comment source visibility isVerifiedPurchase createdAt updatedAt",
      )
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
      variantId,
      comboId,
      orderId,
      userId,
      source,
      visibility,
      q,
      page = 1,
      limit = 50,
    } = req.query || {};

    const filter = {};
    const andClauses = [];

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

    if (variantId) {
      if (!isValidObjectId(variantId)) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Invalid variantId",
        });
      }
      filter.variantId = variantId;
    }

    if (comboId) {
      if (!isValidObjectId(comboId)) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Invalid comboId",
        });
      }
      filter.comboId = comboId;
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

    if (source) {
      if (!isValidReviewSource(source)) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Invalid review source",
        });
      }
      filter.source = String(source).trim().toLowerCase();
    }

    if (visibility) {
      if (!isValidReviewVisibility(visibility)) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Invalid review visibility",
        });
      }
      const normalizedVisibility = String(visibility).trim().toLowerCase();
      if (normalizedVisibility === "visible") {
        andClauses.push({
          $or: [
            { visibility: "visible" },
            { visibility: { $exists: false } },
            { visibility: null },
          ],
        });
      } else {
        filter.visibility = normalizedVisibility;
      }
    }

    if (sanitizePlainText(q, 160)) {
      const searchRegex = buildSearchRegex(sanitizePlainText(q, 160));
      andClauses.push({
        $or: [
        { userName: searchRegex },
        { userEmail: searchRegex },
        { city: searchRegex },
        { comment: searchRegex },
        ],
      });
    }

    if (andClauses.length > 0) {
      filter.$and = andClauses;
    }

    const normalizedPage = Math.max(Number(page) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const skip = (normalizedPage - 1) * normalizedLimit;

    const hasFilters = Object.keys(filter).length > 0;

    const [reviews, total] = await Promise.all([
      ReviewModel.find(filter)
        .select(
          "productId variantId comboId orderId userId userName userEmail city rating comment source visibility isVerifiedPurchase createdAt updatedAt moderatedAt moderatedBy",
        )
        .populate("productId", "name thumbnail price rating")
        .populate("comboId", "name slug thumbnail comboPrice rating reviewCount")
        .populate("orderId", "_id order_status createdAt")
        .populate("userId", "name email")
        .populate("moderatedBy", "name email")
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(normalizedLimit)
        .lean(),
      hasFilters
        ? ReviewModel.countDocuments(filter)
        : ReviewModel.estimatedDocumentCount(),
    ]);

    return res.status(200).json({
      success: true,
      error: false,
      data: reviews.map((review) => toAdminResponseReview(review)),
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
 * Admin update review
 * PATCH /api/admin/reviews/:id
 */
export const updateAdminReview = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid review id",
      });
    }

    const updateData = {};
    const adminId = req.user?.id || req.user?._id || req.user || null;

    if (req.body?.visibility !== undefined) {
      if (!isValidReviewVisibility(req.body.visibility)) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Invalid review visibility",
        });
      }
      updateData.visibility = normalizeReviewVisibility(req.body.visibility);
      updateData.moderatedAt = new Date();
      updateData.moderatedBy = isValidObjectId(adminId) ? adminId : null;
    }

    if (req.body?.userName !== undefined) {
      const userName = sanitizePlainText(req.body.userName, 120);
      if (!userName) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "userName cannot be empty",
        });
      }
      updateData.userName = userName;
    }

    if (req.body?.userEmail !== undefined) {
      updateData.userEmail = sanitizeEmail(req.body.userEmail);
    }

    if (req.body?.city !== undefined) {
      updateData.city = sanitizePlainText(req.body.city, 120);
    }

    if (req.body?.comment !== undefined) {
      const nextComment = sanitizePlainText(req.body.comment, 2000);
      if (!nextComment) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "comment cannot be empty",
        });
      }
      updateData.comment = nextComment;
    }

    if (req.body?.rating !== undefined) {
      const normalizedRating = validateRating(req.body.rating);
      if (!normalizedRating) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Rating must be between 1 and 5",
        });
      }
      updateData.rating = normalizedRating;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "No valid review updates were provided",
      });
    }

    const review = await ReviewModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("productId", "name thumbnail price rating")
      .populate("comboId", "name slug thumbnail comboPrice rating reviewCount")
      .populate("orderId", "_id order_status createdAt")
      .populate("userId", "name email")
      .populate("moderatedBy", "name email")
      .lean();

    if (!review) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Review not found",
      });
    }

    const updatedComboId = review?.comboId?._id || review?.comboId || null;
    const updatedProductId = review?.productId?._id || review?.productId || null;

    await syncReviewAggregates({
      productId: updatedComboId ? null : updatedProductId,
      comboId: updatedComboId,
    });

    return res.status(200).json({
      success: true,
      error: false,
      message: "Review updated successfully",
      data: toAdminResponseReview(review),
    });
  } catch (error) {
    console.error("updateAdminReview error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: "Failed to update review",
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

    await syncReviewAggregates({
      productId: deleted?.comboId ? null : deleted?.productId || null,
      comboId: deleted?.comboId || null,
    });

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
