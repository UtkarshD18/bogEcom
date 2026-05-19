import mongoose from "mongoose";
import { checkExclusiveAccess } from "../middlewares/membershipGuard.js";
import CategoryModel from "../models/category.model.js";
import ComboModel from "../models/combo.model.js";
import ProductModel from "../models/product.model.js";
import ReviewModel from "../models/review.model.js";
import { attachComboAvailability } from "../services/combos/combo.service.js";
import {
  getCartUpsellProductSuggestion,
  getFrequentlyBoughtTogether,
} from "../services/combos/comboRecommendation.service.js";
import {
  emitStockUpdatesForProductSnapshotChange,
  getLatestStockSyncVersion,
} from "../realtime/stockEvents.js";
import { triggerBackInStockNotificationsIfRecovered } from "../services/inventory.service.js";
import { getPendingStockNotificationKeySet } from "../services/stockNotification.service.js";
import { normalizeProductPageConfig } from "../utils/productPageConfig.js";
import {
  formatWeight,
  normalizeVariantWeight,
} from "../utils/weightNormalization.js";
import { invalidateAdminReadCaches } from "../utils/adminCacheInvalidation.js";
import { invalidatePublicResponseCache } from "../middlewares/publicResponseCache.js";
import { getLowStockSummaryUpdate } from "../utils/lowStockSummary.js";

const isProduction = process.env.NODE_ENV === "production";
const PRODUCT_RESPONSE_CACHE_NAMESPACES = ["products"];
const CATALOG_RESPONSE_CACHE_NAMESPACES = ["products", "categories", "combos"];
// Debug-only logging to keep production output clean
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

const invalidateProductResponseCache = async (namespaces) => {
  await invalidatePublicResponseCache(namespaces);
};

const applyLowStockSummaryUpdate = async (product) => {
  const result = getLowStockSummaryUpdate(product);
  if (!result) return;
  await ProductModel.updateOne({ _id: product._id }, result.update);
  product.availableStock = result.summary.availableStock;
  product.isLowStock = result.summary.isLowStock;
  product.lowStockUpdatedAt = result.update.$set.lowStockUpdatedAt;
};

const canRequestViewExclusive = async (req) => {
  if (req?.userIsAdmin === true || req?.membershipActive === true) {
    return true;
  }
  if (!req?.user) {
    return false;
  }
  return checkExclusiveAccess(req.user);
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  return Boolean(value);
};

const roundWholeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const normalizeHsnCode = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "");
  if (!normalized) return "";
  return normalized.slice(0, 12);
};

const normalizeStockValue = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Math.max(Number(fallback || 0), 0);
  }
  return parsed;
};

const toPlainObject = (value) =>
  value && typeof value.toObject === "function" ? value.toObject() : value;

const isInventoryTracked = (value) => {
  if (value?.track_inventory === false || value?.trackInventory === false) {
    return false;
  }
  return true;
};

const attachAvailabilityToVariant = (
  variant,
  { trackInventory = true, productId = null } = {},
) => {
  const plainVariant = toPlainObject(variant) || {};
  const resolvedProductId = String(productId || "").trim();
  const resolvedVariantId = String(plainVariant?._id || plainVariant?.id || "").trim();
  const stockQuantity = normalizeStockValue(
    plainVariant?.stock_quantity ?? plainVariant?.stock,
    0,
  );
  const reservedQuantity = normalizeStockValue(
    plainVariant?.reserved_quantity,
    0,
  );
  const availableQuantity = trackInventory
    ? Math.max(stockQuantity - reservedQuantity, 0)
    : Number.MAX_SAFE_INTEGER;

  return {
    ...plainVariant,
    stock: stockQuantity,
    stock_quantity: stockQuantity,
    reserved_quantity: reservedQuantity,
    available_quantity: availableQuantity,
    available_stock: availableQuantity,
    availableStock: availableQuantity,
    inStock: !trackInventory || availableQuantity > 0,
    stock_sync_version: getLatestStockSyncVersion({
      productId: resolvedProductId,
      variantId: resolvedVariantId || null,
    }),
  };
};

const attachAvailabilityToProduct = (product) => {
  const plainProduct = toPlainObject(product) || {};
  const resolvedProductId = String(
    plainProduct?.parentProductId || plainProduct?._id || plainProduct?.id || "",
  ).trim();
  const resolvedVariantId = String(plainProduct?.variantId || "").trim();
  const trackInventory = isInventoryTracked(plainProduct);
  const variants = Array.isArray(plainProduct?.variants)
    ? plainProduct.variants.map((variant) =>
        attachAvailabilityToVariant(variant, {
          trackInventory,
          productId: resolvedProductId,
        }),
      )
    : [];
  const productStockSyncVersion = getLatestStockSyncVersion({
    productId: resolvedProductId,
  });
  const scopedStockSyncVersion = resolvedVariantId
    ? getLatestStockSyncVersion({
        productId: resolvedProductId,
        variantId: resolvedVariantId,
      })
    : productStockSyncVersion;

  const productStockQuantity = variants.length
    ? variants.reduce(
        (sum, variant) =>
          sum + normalizeStockValue(variant?.stock_quantity ?? variant?.stock, 0),
        0,
      )
    : normalizeStockValue(
        plainProduct?.stock_quantity ?? plainProduct?.stock,
        0,
      );
  const reservedQuantity = variants.length
    ? variants.reduce(
        (sum, variant) =>
          sum + normalizeStockValue(variant?.reserved_quantity, 0),
        0,
      )
    : normalizeStockValue(plainProduct?.reserved_quantity, 0);
  const availableQuantity = trackInventory
    ? variants.length
      ? variants.reduce(
          (sum, variant) =>
            sum + normalizeStockValue(variant?.available_quantity, 0),
          0,
        )
      : Math.max(productStockQuantity - reservedQuantity, 0)
    : Number.MAX_SAFE_INTEGER;

  return {
    ...plainProduct,
    newArrival: Boolean(plainProduct?.newArrival ?? plainProduct?.isNewArrival),
    bestSeller: Boolean(plainProduct?.bestSeller ?? plainProduct?.isBestSeller),
    showLimitedTimeOffer: true,
    highDemand:
      Boolean(plainProduct?.highDemand) ||
      String(plainProduct?.demandStatus || "").toUpperCase() === "HIGH",
    productPage: normalizeProductPageConfig(plainProduct?.productPage || {}),
    stock: productStockQuantity,
    stock_quantity: productStockQuantity,
    reserved_quantity: reservedQuantity,
    variants,
    available_quantity: availableQuantity,
    available_stock: availableQuantity,
    availableStock: availableQuantity,
    inStock: !trackInventory || availableQuantity > 0,
    stock_sync_version: scopedStockSyncVersion,
    product_stock_sync_version: productStockSyncVersion,
  };
};

const markNotificationPreferenceOnProduct = (product, notificationKeySet) => {
  if (!notificationKeySet?.size) {
    return product;
  }

  const plainProduct = toPlainObject(product) || {};
  const productId = String(
    plainProduct?.parentProductId || plainProduct?._id || "",
  ).trim();
  const variantId = String(plainProduct?.variantId || "").trim();
  const directRequested = notificationKeySet.has(
    `${productId}::${variantId || ""}`,
  );

  const variants = Array.isArray(plainProduct?.variants)
    ? plainProduct.variants.map((variant) => ({
        ...variant,
        stockNotificationRequested: notificationKeySet.has(
          `${productId}::${String(variant?._id || "").trim()}`,
        ),
      }))
    : [];

  return {
    ...plainProduct,
    variants,
    stockNotificationRequested: directRequested,
  };
};

const visibleReviewFilter = {
  $or: [
    { visibility: "visible" },
    { visibility: { $exists: false } },
    { visibility: null },
  ],
};

const buildVariantReviewStatsMap = async (productIds = []) => {
  const ids = Array.from(
    new Set(
      (Array.isArray(productIds) ? productIds : [])
        .map((id) => String(id || "").trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id)),
    ),
  );
  if (!ids.length) return new Map();

  const rows = await ReviewModel.aggregate([
    {
      $match: {
        productId: {
          $in: ids.map((id) => new mongoose.Types.ObjectId(id)),
        },
        variantId: { $ne: null },
        $and: [
          { $or: [{ comboId: null }, { comboId: { $exists: false } }] },
          visibleReviewFilter,
        ],
      },
    },
    {
      $group: {
        _id: { productId: "$productId", variantId: "$variantId" },
        rating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const statsMap = new Map();
  for (const row of rows) {
    const productId = String(row?._id?.productId || "");
    const variantId = String(row?._id?.variantId || "");
    if (!productId || !variantId) continue;
    statsMap.set(`${productId}:${variantId}`, {
      rating: Number(Number(row.rating || 0).toFixed(1)),
      reviewCount: Number(row.reviewCount || 0),
    });
  }
  return statsMap;
};

const buildProductReviewStatsMap = async (productIds = []) => {
  const ids = Array.from(
    new Set(
      (Array.isArray(productIds) ? productIds : [])
        .map((id) => String(id || "").trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id)),
    ),
  );
  if (!ids.length) return new Map();

  const rows = await ReviewModel.aggregate([
    {
      $match: {
        productId: {
          $in: ids.map((id) => new mongoose.Types.ObjectId(id)),
        },
        $and: [
          { $or: [{ comboId: null }, { comboId: { $exists: false } }] },
          visibleReviewFilter,
        ],
      },
    },
    {
      $group: {
        _id: "$productId",
        avgRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const statsMap = new Map();
  for (const row of rows) {
    const productId = String(row?._id || "");
    if (!productId) continue;
    const totalReviews = Number(row?.totalReviews || 0);
    statsMap.set(productId, {
      avgRating: totalReviews ? Number(row.avgRating || 0) : 0,
      totalReviews,
    });
  }
  return statsMap;
};

const attachVariantReviewStatsToProduct = (product, statsMap = new Map()) => {
  const plainProduct = toPlainObject(product) || {};
  const productId = String(
    plainProduct?.parentProductId || plainProduct?._id || plainProduct?.id || "",
  ).trim();
  const variants = Array.isArray(plainProduct?.variants)
    ? plainProduct.variants.map((variant) => {
        const variantId = String(variant?._id || variant?.id || "").trim();
        const stats = statsMap.get(`${productId}:${variantId}`) || null;
        return {
          ...variant,
          rating: Number(stats?.rating || 0),
          reviewCount: Number(stats?.reviewCount || 0),
        };
      })
    : [];

  const selectedVariantId = String(plainProduct?.variantId || "").trim();
  if (selectedVariantId) {
    const stats = statsMap.get(`${productId}:${selectedVariantId}`) || null;
    return {
      ...plainProduct,
      rating: Number(stats?.rating || 0),
      reviewCount: Number(stats?.reviewCount || 0),
      variants,
    };
  }

  return {
    ...plainProduct,
    variants,
  };
};

const attachVariantReviewStatsToProducts = async (products = []) => {
  const safeProducts = Array.isArray(products) ? products : [];
  const productIds = safeProducts.map(
    (product) => product?.parentProductId || product?._id || product?.id,
  );
  const [variantStatsMap, productStatsMap] = await Promise.all([
    buildVariantReviewStatsMap(productIds),
    buildProductReviewStatsMap(productIds),
  ]);
  return safeProducts.map((product) => {
    const productWithVariantStats = attachVariantReviewStatsToProduct(
      product,
      variantStatsMap,
    );
    const productId = String(
      productWithVariantStats?.parentProductId ||
        productWithVariantStats?._id ||
        productWithVariantStats?.id ||
        "",
    ).trim();
    const selectedVariantId = String(
      productWithVariantStats?.variantId || "",
    ).trim();
    const variantStats = selectedVariantId
      ? variantStatsMap.get(`${productId}:${selectedVariantId}`) || null
      : null;
    const productStats = productStatsMap.get(productId) || {
      avgRating: 0,
      totalReviews: 0,
    };
    const avgRating = selectedVariantId
      ? Number(variantStats?.rating || 0)
      : Number(productStats.avgRating || 0);
    const totalReviews = selectedVariantId
      ? Number(variantStats?.reviewCount || 0)
      : Number(productStats.totalReviews || 0);
    return {
      ...productWithVariantStats,
      avgRating,
      totalReviews,
      rating: avgRating,
      reviewCount: totalReviews,
      numReviews: totalReviews,
    };
  });
};

const attachNotificationPreferenceToProducts = async (products, userId) => {
  if (!Array.isArray(products) || !products.length || !userId) {
    return products;
  }

  const notificationKeySet = await getPendingStockNotificationKeySet({
    userId,
  });

  if (!notificationKeySet.size) {
    return products;
  }

  return products.map((product) =>
    markNotificationPreferenceOnProduct(product, notificationKeySet),
  );
};

const buildVariantInventoryTotals = (variants = []) => ({
  stock: variants.reduce(
    (sum, variant) =>
      sum + normalizeStockValue(variant?.stock_quantity ?? variant?.stock, 0),
    0,
  ),
  reserved: variants.reduce(
    (sum, variant) => sum + normalizeStockValue(variant?.reserved_quantity, 0),
    0,
  ),
});

const formatVariantWeightLabel = (variant = {}) => {
  const weight = Number(variant?.weight || 0);
  const unit = String(variant?.unit || "").trim().toLowerCase();
  if (Number.isFinite(weight) && weight > 0 && (unit === "kg" || unit === "g")) {
    return `${weight}${unit}`;
  }
  const weightInGrams = Number(variant?.weightInGrams || 0);
  if (!Number.isFinite(weightInGrams) || weightInGrams <= 0) return "";
  return formatWeight(weightInGrams);
};

const stripWeightRangeFromLabel = (value) =>
  String(value || "")
    .replace(
      /\b\d+(?:\.\d+)?\s*(?:kg|g)\s*[-–]\s*\d+(?:\.\d+)?\s*(?:kg|g)\b/gi,
      "",
    )
    .replace(/\s*-\s*$/g, "")
    .trim();

const normalizeVariantPayload = (variant = {}, fallbackStock = 0) => {
  const normalizedWeight = normalizeVariantWeight(variant);
  const variantPrice = roundWholeNumber(variant.price);
  const variantOriginalPrice =
    variant.originalPrice === undefined || variant.originalPrice === null
      ? undefined
      : roundWholeNumber(variant.originalPrice);
  const variantStock = normalizeStockValue(
    variant.stock ?? variant.stock_quantity,
    fallbackStock,
  );
  const cleanedName = stripWeightRangeFromLabel(variant.name);
  const submittedWeight = Number(variant.weight);
  const submittedUnit = String(variant.unit || "g").trim().toLowerCase();
  const displayWeight =
    Number.isFinite(submittedWeight) && submittedWeight > 0
      ? submittedWeight
      : normalizedWeight.weight;
  const displayUnit = submittedUnit === "kg" ? "kg" : "g";
  const displayLabel = `${displayWeight}${displayUnit}`;

  return {
    ...variant,
    name: cleanedName || displayLabel,
    label: displayLabel,
    weight: displayWeight,
    unit: displayUnit,
    price: variantPrice ?? 0,
    originalPrice: variantOriginalPrice,
    stock: variantStock,
    stock_quantity: variantStock,
    reserved_quantity: normalizeStockValue(variant.reserved_quantity, 0),
  };
};

const resolveComboCardImage = (combo = {}) =>
  (Array.isArray(combo?.images) ? combo.images[0] : "") ||
  combo?.comboThumbnail ||
  combo?.combo_thumbnail ||
  combo?.thumbnail ||
  combo?.image ||
  (Array.isArray(combo?.comboImages) ? combo.comboImages[0] : "") ||
  (Array.isArray(combo?.combo_images) ? combo.combo_images[0] : "") ||
  (Array.isArray(combo?.items)
    ? combo.items.map((item) => String(item?.image || "").trim()).find(Boolean)
    : "") ||
  "";

/**
 * Product Controller
 *
 * CRUD operations for products (Admin)
 * Public operations for viewing products
 */

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get all products with filtering, sorting, and pagination
 * @route GET /api/products
 */
export const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      search,
      category,
      subCategory,
      brand,
      minPrice,
      maxPrice,
      rating,
      sortBy = "createdAt",
      order = "desc",
      featured,
      newArrival,
      newArrivals,
      bestSeller,
      priceDrop,
      minDiscount,
      flavor,
      productType,
      onSale,
      inStock,
      lowStock,
      exclude,
      separateVariants,
      includeCombos,
    } = req.query;

    const shouldSeparateVariants =
      String(separateVariants || "")
        .trim()
        .toLowerCase() === "true";
    const normalizedProductType = String(productType || "all")
      .trim()
      .toLowerCase();
    const shouldIncludeCombos =
      normalizedProductType === "combo" ||
      (String(includeCombos || "")
        .trim()
        .toLowerCase() === "true" &&
        normalizedProductType !== "product");

    const canViewExclusive = req?.userIsAdmin === true;

    // Build filter object
    const filter = { isActive: { $ne: false } };
    // Exclusive products are never part of normal storefront listings.
    // Only admins can include them in this endpoint for dashboard management.
    if (!canViewExclusive) {
      filter.isExclusive = { $ne: true };
    }
    const exprFilters = [];

    // Text search - supports 1+ character partial matching with regex
    if (search && search.trim().length >= 1) {
      const searchTerm = search.trim();

      // Sanitize search term to prevent ReDoS attacks
      // Escape special regex characters
      const sanitizedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(sanitizedTerm, "i");

      debugLog(
        "[Product Search] Searching for:",
        searchTerm,
        "Regex:",
        searchRegex,
      );

      // Find categories matching the search term to include products in those categories
      const matchingCategories = await CategoryModel.find({
        name: { $regex: searchRegex },
      })
        .select("_id")
        .lean();
      const categoryIds = matchingCategories.map((c) => c._id);

      debugLog(
        "[Product Search] Matching categories:",
        matchingCategories.length,
      );

      // Build search conditions
      const searchConditions = [
        { name: { $regex: searchRegex } },
        { brand: { $regex: searchRegex } },
        { tags: { $elemMatch: { $regex: searchRegex } } },
      ];

      // Add category match if any categories match the search
      if (categoryIds.length > 0) {
        searchConditions.push({ category: { $in: categoryIds } });
      }

      // For longer queries, also search description
      if (searchTerm.length >= 3) {
        searchConditions.push({ description: { $regex: searchRegex } });
      }

      filter.$or = searchConditions;

      debugLog("[Product Search] Filter:", JSON.stringify(filter));
    }

    // Category filter - support both ObjectId and slug
    if (category) {
      // Check if it's a valid ObjectId
      const isValidObjectId = mongoose.Types.ObjectId.isValid(category);

      if (isValidObjectId) {
        if (category.includes(",")) {
          filter.category = { $in: category.split(",") };
        } else {
          filter.category = category;
        }
      } else {
        // It's a slug - look up the category by slug
        const categoryDoc = await CategoryModel.findOne({ slug: category });
        if (categoryDoc) {
          filter.category = categoryDoc._id;
        } else {
          // Try to find by name (case-insensitive)
          const categoryByName = await CategoryModel.findOne({
            name: { $regex: new RegExp(`^${category}$`, "i") },
          });
          if (categoryByName) {
            filter.category = categoryByName._id;
          }
        }
      }
    }

    if (subCategory) {
      filter.subCategory = subCategory;
    }

    // Brand filter
    if (brand) {
      filter.brand = { $regex: brand, $options: "i" };
    }

    if (flavor && String(flavor).trim()) {
      const flavorTerm = String(flavor).trim();
      const sanitizedFlavor = flavorTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const flavorRegex = new RegExp(sanitizedFlavor, "i");
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [
            { name: { $regex: flavorRegex } },
            { tags: { $elemMatch: { $regex: flavorRegex } } },
          ],
        },
      ];
    }

    // Price range
    if (
      (minPrice || maxPrice) &&
      !shouldSeparateVariants &&
      !shouldIncludeCombos
    ) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Ratings are computed from ReviewModel at read time, not stored on Product.

    // Boolean filters
    if (newArrival === "true" || newArrivals === "true") {
      filter.isNewArrival = true;
    }
    if (bestSeller === "true") filter.isBestSeller = true;
    if (onSale === "true") filter.isOnSale = true;
    if (priceDrop === "true") {
      const parsedMinDiscount = Number(minDiscount);
      const minDiscountPercent =
        Number.isFinite(parsedMinDiscount) && parsedMinDiscount > 0
          ? parsedMinDiscount
          : 25;
      exprFilters.push({
        $gte: [
          {
            $cond: [
              {
                $and: [
                  { $gt: ["$originalPrice", 0] },
                  { $gt: ["$originalPrice", "$price"] },
                ],
              },
              {
                $multiply: [
                  {
                    $divide: [
                      { $subtract: ["$originalPrice", "$price"] },
                      "$originalPrice",
                    ],
                  },
                  100,
                ],
              },
              0,
            ],
          },
          minDiscountPercent,
        ],
      });
    }
    if (inStock === "true") {
      exprFilters.push({
        $gt: [
          {
            $subtract: [
              { $ifNull: ["$stock_quantity", "$stock"] },
              { $ifNull: ["$reserved_quantity", 0] },
            ],
          },
          0,
        ],
      });
    }

    if (lowStock === "true") {
      const thresholdExpr = {
        $ifNull: [
          "$low_stock_threshold",
          { $ifNull: ["$lowStockThreshold", 5] },
        ],
      };
      const trackExpr = {
        $ne: [
          {
            $ifNull: [
              "$track_inventory",
              { $ifNull: ["$trackInventory", true] },
            ],
          },
          false,
        ],
      };
      const productAvailableExpr = {
        $subtract: [
          { $ifNull: ["$stock_quantity", "$stock"] },
          { $ifNull: ["$reserved_quantity", 0] },
        ],
      };
      const variantStockExpr = {
        $map: {
          input: { $ifNull: ["$variants", []] },
          as: "v",
          in: {
            $subtract: [
              { $ifNull: ["$$v.stock_quantity", "$$v.stock"] },
              { $ifNull: ["$$v.reserved_quantity", 0] },
            ],
          },
        },
      };
      const hasVariantEntriesExpr = {
        $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0],
      };
      exprFilters.push({
        $and: [
          trackExpr,
          {
            $cond: [
              hasVariantEntriesExpr,
              {
                $anyElementTrue: {
                  $map: {
                    input: variantStockExpr,
                    as: "variantStock",
                    in: { $lte: ["$$variantStock", thresholdExpr] },
                  },
                },
              },
              { $lte: [productAvailableExpr, thresholdExpr] },
            ],
          },
        ],
      });
    }

    // Exclude specific product
    if (exclude) {
      filter._id = { $ne: exclude };
    }

    if (exprFilters.length > 0) {
      filter.$expr =
        exprFilters.length === 1 ? exprFilters[0] : { $and: exprFilters };
    }

    // Build sort object. `popular` keeps popular items first, then newest first.
    const normalizedSortBy = String(sortBy || "").trim();
    const sortDirection = order === "asc" ? 1 : -1;
    const sortField =
      normalizedSortBy === "newestCombos"
        ? "createdAt"
        : normalizedSortBy === "bestSeller"
        ? "isBestSeller"
        : normalizedSortBy || "createdAt";
    const sortOptions =
      normalizedSortBy === "popular"
        ? {
            isNewArrival: -1,
            isPopular: -1,
            isBestSeller: -1,
            soldCount: -1,
            createdAt: -1,
          }
        : { [sortField]: sortDirection };

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 15, 1), 200);

    if (shouldSeparateVariants || shouldIncludeCombos) {
      const productsRaw =
        normalizedProductType === "combo"
          ? []
          : await ProductModel.find(filter)
              .populate("category", "name slug")
              .populate("subCategory", "name slug")
              .select("-reviews -description")
              .sort(sortOptions)
              .lean();

      const expandedProducts = [];
      for (const product of productsRaw) {
        const variants = Array.isArray(product?.variants)
          ? product.variants
          : [];
        if (
          shouldSeparateVariants &&
          product?.hasVariants &&
          variants.length > 0
        ) {
          variants.forEach((variant, index) => {
            const variantLabel =
              String(variant?.name || "").trim() ||
              formatVariantWeightLabel(variant);
            expandedProducts.push(
              attachAvailabilityToProduct({
                ...product,
                _id: `${String(product?._id || "")}-${String(variant?._id || index)}`,
                parentProductId: product?._id || null,
                variantId: variant?._id || null,
                variantName: variantLabel,
                name: variantLabel
                  ? `${String(product?.name || "Product").trim()} - ${variantLabel}`
                  : String(product?.name || "Product"),
                price: Number(variant?.price ?? product?.price ?? 0),
                originalPrice: Number(
                  variant?.originalPrice ??
                    product?.originalPrice ??
                    product?.oldPrice ??
                    0,
                ),
                discount: Number(
                  variant?.discountPercent ?? product?.discount ?? 0,
                ),
                label:
                  String(variant?.label || "").trim() ||
                  formatVariantWeightLabel(variant),
                weight: Number(variant?.weight ?? product?.weight ?? 0),
                unit: variant?.unit || product?.unit || "g",
                sku: String(variant?.sku || product?.sku || ""),
                stock: Number(
                  variant?.stock_quantity ??
                    variant?.stock ??
                    product?.stock ??
                    0,
                ),
                stock_quantity: Number(
                  variant?.stock_quantity ??
                    variant?.stock ??
                    product?.stock_quantity ??
                    0,
                ),
                reserved_quantity: Number(variant?.reserved_quantity ?? 0),
                track_inventory:
                  product?.track_inventory ?? product?.trackInventory ?? true,
                trackInventory:
                  product?.trackInventory ?? product?.track_inventory ?? true,
                hasVariants: false,
                variants: [],
              }),
            );
          });
        } else {
          expandedProducts.push(attachAvailabilityToProduct(product));
        }
      }

      const productsWithReviewStats =
        await attachVariantReviewStatsToProducts(expandedProducts);
      const productsWithNotificationState =
        await attachNotificationPreferenceToProducts(
          productsWithReviewStats,
          req?.user,
        );

      let comboCards = [];
      if (shouldIncludeCombos) {
        const now = new Date();
        const comboFilter = {
          isActive: { $ne: false },
          isVisible: { $ne: false },
          status: { $ne: "disabled" },
          $and: [
            { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
            { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
          ],
        };

        if (search && String(search).trim()) {
          comboFilter.$or = [
            { name: { $regex: String(search).trim(), $options: "i" } },
            { brand: { $regex: String(search).trim(), $options: "i" } },
          ];
        }

        if (flavor && String(flavor).trim()) {
          const flavorRegex = new RegExp(
            String(flavor).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i",
          );
          comboFilter.$and = [
            ...(Array.isArray(comboFilter.$and) ? comboFilter.$and : []),
            {
              $or: [
                { name: { $regex: flavorRegex } },
                { tags: { $elemMatch: { $regex: flavorRegex } } },
              ],
            },
          ];
        }

        if (bestSeller === "true") comboFilter.isBestSeller = true;

        const combosRaw = await ComboModel.find(comboFilter)
          .sort({ priority: -1, totalSavings: -1, createdAt: -1 })
          .lean();
        const combosWithAvailability = await attachComboAvailability(combosRaw);

        comboCards = combosWithAvailability.map((combo) => {
          const comboPrice = Number(
            combo?.price ?? combo?.comboPrice ?? combo?.finalPrice ?? 0,
          );
          const comboOriginalPrice = Number(
            combo?.originalPrice ?? combo?.originalTotal ?? comboPrice,
          );
          const comboDiscount =
            Number(combo?.discountPercentage ?? 0) > 0
              ? Math.ceil(Number(combo?.discountPercentage))
              : comboOriginalPrice > comboPrice && comboOriginalPrice > 0
                ? Math.ceil(
                    ((comboOriginalPrice - comboPrice) / comboOriginalPrice) *
                      100,
                  )
                : 0;

          return {
            _id: combo?._id || null,
            id: combo?._id || null,
            comboId: combo?._id || null,
            slug: String(combo?.slug || "").trim(),
            itemType: "combo",
            name: String(combo?.name || "Combo Deal"),
            shortDescription: String(combo?.shortDescription || ""),
            brand: String(combo?.brand || "Buy One Gram"),
            price: comboPrice,
            originalPrice: comboOriginalPrice,
            discount: comboDiscount,
            images: [resolveComboCardImage(combo)].filter(Boolean),
            image: resolveComboCardImage(combo),
            comboType: String(combo?.comboType || "").trim(),
            comboThumbnail: String(
              combo?.comboThumbnail || combo?.thumbnail || "",
            ).trim(),
            thumbnail: String(
              combo?.thumbnail || combo?.comboThumbnail || "",
            ).trim(),
            comboImages: Array.isArray(combo?.comboImages)
              ? combo.comboImages
              : [],
            items: Array.isArray(combo?.items) ? combo.items : [],
            rating: Number(combo?.adminStarRating ?? combo?.rating ?? 0),
            reviewCount: Number(combo?.reviewCount || 0),
            soldCount: Number(combo?.soldCount || combo?.priority || 0),
            isBestSeller: Boolean(combo?.isBestSeller),
            isNewArrival: false,
            availableStock: Number(
              combo?.availableStock ?? combo?.stockQuantity ?? 0,
            ),
            stock: Number(combo?.availableStock ?? combo?.stockQuantity ?? 0),
            stock_quantity: Number(
              combo?.availableStock ?? combo?.stockQuantity ?? 0,
            ),
            createdAt: combo?.createdAt,
            updatedAt: combo?.updatedAt,
            isActive: combo?.isActive !== false,
            isVisible: combo?.isVisible !== false,
          };
        });
      }

      const safeMinPrice = Number(minPrice);
      const safeMaxPrice = Number(maxPrice);
      const combined = [...productsWithNotificationState, ...comboCards]
        .filter((item) => {
          if (normalizedProductType === "combo" && item?.itemType !== "combo") {
            return false;
          }
          if (
            normalizedProductType === "product" &&
            String(item?.itemType || "product") === "combo"
          ) {
            return false;
          }

          const itemPrice = Number(item?.price ?? 0);
          if (Number.isFinite(safeMinPrice) && minPrice !== "" && itemPrice < safeMinPrice) {
            return false;
          }
          if (Number.isFinite(safeMaxPrice) && maxPrice !== "" && itemPrice > safeMaxPrice) {
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          const direction = order === "asc" ? 1 : -1;
          const key =
            normalizedSortBy === "newestCombos"
              ? "createdAt"
              : normalizedSortBy === "bestSeller"
              ? "isBestSeller"
              : normalizedSortBy || "createdAt";

          if (
            normalizedProductType !== "combo" &&
            normalizedSortBy !== "newestCombos"
          ) {
            const firstIsCombo = String(a?.itemType || "product") === "combo";
            const secondIsCombo = String(b?.itemType || "product") === "combo";
            if (firstIsCombo !== secondIsCombo) {
              return firstIsCombo ? 1 : -1;
            }
          }

          const getValue = (item) => {
            if (key === "price") return Number(item?.price ?? 0);
            if (key === "soldCount") return Number(item?.soldCount ?? 0);
            if (key === "isBestSeller") return item?.isBestSeller ? 1 : 0;
            if (key === "rating") return Number(item?.rating ?? 0);
            if (key === "createdAt") return new Date(item?.createdAt || 0).getTime();
            return item?.[key] ?? 0;
          };

          const first = getValue(a);
          const second = getValue(b);
          if (first < second) return -1 * direction;
          if (first > second) return 1 * direction;
          return (
            new Date(b?.createdAt || 0).getTime() -
            new Date(a?.createdAt || 0).getTime()
          );
        });
      const startIndex = (safePage - 1) * safeLimit;
      const paginated = combined.slice(startIndex, startIndex + safeLimit);
      const totalProducts = combined.length;
      const totalPages = Math.max(Math.ceil(totalProducts / safeLimit), 1);

      return res.status(200).json({
        error: false,
        success: true,
        data: paginated,
        totalProducts,
        totalPages,
        currentPage: safePage,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      });
    }

    // Execute query
    const skip = (Number(page) - 1) * Number(limit);

    const [products, totalProducts] = await Promise.all([
      ProductModel.find(filter)
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .select("-reviews -description") // Exclude heavy fields for list view
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      ProductModel.countDocuments(filter),
    ]);

    debugLog("[Product Search] Found:", totalProducts, "products");
    if (search && products.length > 0) {
      debugLog("[Product Search] First result:", products[0]?.name);
    }

    const totalPages = Math.ceil(totalProducts / Number(limit));

    const productsWithReviewStats = await attachVariantReviewStatsToProducts(
      products.map(attachAvailabilityToProduct),
    );
    const productsWithNotificationState =
      await attachNotificationPreferenceToProducts(
        productsWithReviewStats,
        req?.user,
      );

    res.status(200).json({
      error: false,
      success: true,
      data: productsWithNotificationState,
      totalProducts,
      totalPages,
      currentPage: Number(page),
      hasNextPage: Number(page) < totalPages,
      hasPrevPage: Number(page) > 1,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch products",
      details: error.message,
    });
  }
};

/**
 * Get single product by ID or slug
 * @route GET /api/products/:id
 */
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const canViewExclusive = await canRequestViewExclusive(req);

    // Try to find by ID or slug
    let product;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      product = await ProductModel.findById(id)
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .populate("reviews.user", "name avatar");
    } else {
      product = await ProductModel.findOne({
        slug: id,
        isActive: { $ne: false },
      })
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .populate("reviews.user", "name avatar");
    }

    if (!product || (product.isExclusive && !canViewExclusive)) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    // Increment view count using updateOne to avoid triggering save middleware
    await ProductModel.updateOne(
      { _id: product._id },
      { $inc: { viewCount: 1 } },
    );

    const [productWithReviewStats] = await attachVariantReviewStatsToProducts([
      attachAvailabilityToProduct(product),
    ]);
    const [productWithNotificationState] =
      await attachNotificationPreferenceToProducts(
        [productWithReviewStats],
        req?.user,
      );

    res.status(200).json({
      error: false,
      success: true,
      data: productWithNotificationState,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch product",
      details: error.message,
    });
  }
};

export const incrementProductViewCountBestEffort = async (identifier) => {
  try {
    const normalizedIdentifier = String(identifier || "").trim();
    if (!normalizedIdentifier) {
      return;
    }

    const query = normalizedIdentifier.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: normalizedIdentifier }
      : {
          slug: normalizedIdentifier,
          isActive: { $ne: false },
        };

    await ProductModel.updateOne(query, {
      $inc: { viewCount: 1 },
    });
  } catch (error) {
    console.warn(
      "Product view count cache-hit update failed:",
      error?.message || error,
    );
  }
};

/**
 * Get highlighted products
 * @route GET /api/products/featured
 */
export const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const canViewExclusive = req?.userIsAdmin === true;

    const filter = {
      isActive: { $ne: false },
      isBestSeller: true,
      ...(canViewExclusive ? {} : { isExclusive: { $ne: true } }),
    };

    const products = await ProductModel.find(filter)
      .populate("category", "name slug")
      .select("-reviews -description")
      .sort({ isPopular: -1, createdAt: -1 })
      .limit(Number(limit))
      .lean();

    const productsWithReviewStats = await attachVariantReviewStatsToProducts(
      products.map(attachAvailabilityToProduct),
    );
    const productsWithNotificationState =
      await attachNotificationPreferenceToProducts(
        productsWithReviewStats,
        req?.user,
      );

    res.status(200).json({
      error: false,
      success: true,
      data: productsWithNotificationState,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch featured products",
    });
  }
};

/**
 * Get exclusive products for active members only
 * @route GET /api/products/exclusive
 */
export const getExclusiveProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      search = "",
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 15, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const filter = {
      isActive: { $ne: false },
      isExclusive: true,
    };

    const searchTerm = String(search || "").trim();
    if (searchTerm) {
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escapedTerm, "i");
      filter.$or = [
        { name: { $regex: regex } },
        { brand: { $regex: regex } },
        { tags: { $elemMatch: { $regex: regex } } },
      ];
    }

    const sortOptions = { [sortBy]: order === "asc" ? 1 : -1 };

    const [products, totalProducts] = await Promise.all([
      ProductModel.find(filter)
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .select("-reviews -description")
        .sort(sortOptions)
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      ProductModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalProducts / safeLimit) || 1;

    const productsWithReviewStats = await attachVariantReviewStatsToProducts(
      products.map(attachAvailabilityToProduct),
    );
    const productsWithNotificationState =
      await attachNotificationPreferenceToProducts(
        productsWithReviewStats,
        req?.user,
      );

    res.status(200).json({
      error: false,
      success: true,
      data: productsWithNotificationState,
      totalProducts,
      totalPages,
      currentPage: safePage,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
    });
  } catch (error) {
    console.error("Error fetching exclusive products:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch exclusive products",
      details: error.message,
    });
  }
};

/**
 * Get related products by category
 * @route GET /api/products/:id/related
 */
export const getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;
    const canViewExclusive = await canRequestViewExclusive(req);

    const product = await ProductModel.findById(id);
    if (!product || (product.isExclusive && !canViewExclusive)) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    const relatedFilter = {
      _id: { $ne: id },
      category: product.category,
      isActive: { $ne: false },
      ...(canViewExclusive ? {} : { isExclusive: { $ne: true } }),
    };
    if (Array.isArray(product.tags) && product.tags.length > 0) {
      relatedFilter.tags = { $in: product.tags };
    }

    let relatedProducts = await ProductModel.find(relatedFilter)
      .select("-reviews -description")
      .sort({ soldCount: -1, createdAt: -1 })
      .limit(Number(limit))
      .lean();

    if (relatedProducts.length === 0 && relatedFilter.tags) {
      delete relatedFilter.tags;
      relatedProducts = await ProductModel.find(relatedFilter)
        .select("-reviews -description")
        .sort({ soldCount: -1, createdAt: -1 })
        .limit(Number(limit))
        .lean();
    }

    if (relatedProducts.length === 0) {
      relatedProducts = await ProductModel.find({
        _id: { $ne: id },
        isActive: { $ne: false },
        ...(canViewExclusive ? {} : { isExclusive: { $ne: true } }),
      })
        .select("-reviews -description")
        .sort({ isBestSeller: -1, soldCount: -1, createdAt: -1 })
        .limit(Number(limit))
        .lean();
    }

    const productsWithReviewStats = await attachVariantReviewStatsToProducts(
      relatedProducts.map(attachAvailabilityToProduct),
    );
    const productsWithNotificationState =
      await attachNotificationPreferenceToProducts(
        productsWithReviewStats,
        req?.user,
      );

    res.status(200).json({
      error: false,
      success: true,
      data: productsWithNotificationState,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch related products",
    });
  }
};

/**
 * Get frequently bought together products for a product
 * @route GET /api/products/:id/frequently-bought
 */
export const getFrequentlyBoughtProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 4 } = req.query;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid product id",
      });
    }

    const recommendations = await getFrequentlyBoughtTogether(id, {
      limit: Math.max(Number(limit) || 4, 1),
    });

    return res.status(200).json({
      error: false,
      success: true,
      data: recommendations,
    });
  } catch (error) {
    console.error("Error fetching frequently bought products:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch frequently bought products",
      details: error.message,
    });
  }
};

/**
 * Get single upsell product suggestion from cart context
 * @route POST /api/products/upsell
 */
export const getCartUpsellProduct = async (req, res) => {
  try {
    const cartItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const suggestion = await getCartUpsellProductSuggestion(cartItems, {
      limit: 1,
    });

    return res.status(200).json({
      error: false,
      success: true,
      data: suggestion,
    });
  } catch (error) {
    console.error("Error fetching cart upsell product:", error);
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch upsell recommendation",
      details: error.message,
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Create new product (Admin only)
 * @route POST /api/products
 */
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      shortDescription,
      brand,
      price,
      originalPrice,
      images,
      videos,
      thumbnail,
      category,
      subCategory,
      sku,
      stock,
      hasVariants,
      variants,
      variantType,
      weight,
      unit,
      hsnCode,
      tags,
      newArrival,
      isNewArrival,
      isBestSeller,
      isExclusive,
      demandStatus,
      specifications,
      ingredients,
      freeShipping,
      metaTitle,
      metaDescription,
      metaKeywords,
      productPage,
    } = req.body;

    // Validate required fields
    if (!name || !category) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Name and category are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid category",
      });
    }

    if (subCategory && !mongoose.Types.ObjectId.isValid(subCategory)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid subcategory",
      });
    }

    const submittedVariants = Array.isArray(variants) ? variants : [];
    const submittedDefaultVariant =
      submittedVariants.find((variant) => variant?.isDefault) ||
      submittedVariants[0] ||
      null;
    const normalizedPrice = Number(price ?? submittedDefaultVariant?.price);
    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Please enter at least one variant with a valid price",
      });
    }
    const roundedPrice = Math.round(normalizedPrice);
    const roundedOriginalPrice =
      originalPrice === undefined || originalPrice === null
        ? undefined
        : roundWholeNumber(originalPrice);

    // Check if category exists
    const categoryExists = await CategoryModel.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid category",
      });
    }

    // Create product
    const normalizedStock = normalizeStockValue(
      stock ?? req.body?.stock_quantity,
      0,
    );
    const normalizedReserved = normalizeStockValue(
      req.body?.reserved_quantity,
      0,
    );
    const normalizedLowStock = Number(
      req.body?.low_stock_threshold ?? req.body?.lowStockThreshold ?? 5,
    );
    const normalizedTrackInventory =
      typeof req.body?.track_inventory === "boolean"
        ? req.body.track_inventory
        : typeof req.body?.trackInventory === "boolean"
          ? req.body.trackInventory
          : true;

    // Validate variants if present
    let processedVariants = submittedVariants;
    if (
      hasVariants &&
      Array.isArray(processedVariants) &&
      processedVariants.length > 0
    ) {
      let normalizedWeightEntries = [];
      try {
        normalizedWeightEntries = processedVariants.map((variant) =>
          normalizeVariantWeight(variant),
        );
      } catch (error) {
        return res.status(400).json({
          error: true,
          success: false,
          message: error.message || "Invalid weight format",
        });
      }
      const uniqueWeights = new Set(
        normalizedWeightEntries.map((entry) => `${entry.weight}${entry.unit}`),
      );
      if (uniqueWeights.size !== normalizedWeightEntries.length) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Duplicate variant weights are not allowed",
        });
      }
      processedVariants = processedVariants.map((variant) =>
        normalizeVariantPayload(variant, 0),
      );
      // Ensure exactly one default
      const defaults = processedVariants.filter((v) => v.isDefault);
      if (defaults.length === 0) {
        processedVariants[0].isDefault = true;
      } else if (defaults.length > 1) {
        processedVariants.forEach((v, i) => {
          v.isDefault = i === processedVariants.indexOf(defaults[0]);
        });
      }
    }

    const variantInventoryTotals =
      hasVariants && processedVariants.length > 0
        ? buildVariantInventoryTotals(processedVariants)
        : null;
    const defaultVariant =
      processedVariants.find((variant) => variant?.isDefault) ||
      processedVariants[0] ||
      null;
    const derivedPrice =
      defaultVariant?.price !== undefined ? defaultVariant.price : roundedPrice;
    const derivedOriginalPrice =
      defaultVariant?.originalPrice !== undefined
        ? defaultVariant.originalPrice
        : roundedOriginalPrice;

    const product = new ProductModel({
      name: String(name || "").trim(),
      description,
      shortDescription,
      brand,
      price: derivedPrice,
      originalPrice:
        derivedOriginalPrice === null ? undefined : derivedOriginalPrice,
      images: Array.isArray(images) ? images : [],
      videos: Array.isArray(videos) ? videos.filter(Boolean).slice(0, 3) : [],
      thumbnail,
      category,
      subCategory,
      sku,
      stock: variantInventoryTotals?.stock ?? normalizedStock,
      stock_quantity: variantInventoryTotals?.stock ?? normalizedStock,
      reserved_quantity:
        variantInventoryTotals?.reserved ?? Math.max(normalizedReserved, 0),
      low_stock_threshold: normalizedLowStock,
      track_inventory: normalizedTrackInventory,
      hasVariants: hasVariants || false,
      variants: processedVariants,
      variantType,
      weight: defaultVariant?.weight ?? weight,
      unit: defaultVariant?.unit || unit || "g",
      hsnCode: normalizeHsnCode(hsnCode),
      tags: tags || [],
      isNewArrival: toBoolean(newArrival ?? isNewArrival),
      isBestSeller: toBoolean(isBestSeller),
      isExclusive: toBoolean(isExclusive),
      demandStatus: demandStatus || "NORMAL",
      specifications,
      ingredients,
      freeShipping: freeShipping || false,
      metaTitle,
      metaDescription,
      metaKeywords,
      productPage: normalizeProductPageConfig(productPage),
    });

    await product.save();

    // Update category product count
    await CategoryModel.findByIdAndUpdate(category, {
      $inc: { productCount: 1 },
    });
    await invalidateProductResponseCache(CATALOG_RESPONSE_CACHE_NAMESPACES);
    invalidateAdminReadCaches();

    res.status(201).json({
      error: false,
      success: true,
      message: "Product created successfully",
      data: {
        ...(product.toObject ? product.toObject() : product),
        newArrival: Boolean(product?.isNewArrival),
      },
    });
  } catch (error) {
    console.error("Error creating product:", error);

    if (error.name === "ValidationError") {
      const firstValidationError = Object.values(error.errors || {})[0];
      return res.status(400).json({
        error: true,
        success: false,
        message: firstValidationError?.message || "Invalid product data",
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Product with this SKU or slug already exists",
      });
    }

    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create product",
      details: error.message,
    });
  }
};

/**
 * Update product (Admin only)
 * @route PUT /api/products/:id
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.viewCount;
    delete updateData.soldCount;

    if ("stock" in updateData && !("stock_quantity" in updateData)) {
      updateData.stock_quantity = updateData.stock;
    }
    if ("stock_quantity" in updateData && !("stock" in updateData)) {
      updateData.stock = updateData.stock_quantity;
    }
    if (
      "low_stock_threshold" in updateData &&
      !("lowStockThreshold" in updateData)
    ) {
      updateData.lowStockThreshold = updateData.low_stock_threshold;
    }
    if ("track_inventory" in updateData && !("trackInventory" in updateData)) {
      updateData.trackInventory = updateData.track_inventory;
    }
    delete updateData.adminStarRating;
    delete updateData.rating;
    if ("isExclusive" in updateData) {
      updateData.isExclusive = toBoolean(updateData.isExclusive);
    }
    if ("isBestSeller" in updateData) {
      updateData.isBestSeller = toBoolean(updateData.isBestSeller);
    }
    if ("newArrival" in updateData && !("isNewArrival" in updateData)) {
      updateData.isNewArrival = updateData.newArrival;
    }
    if ("isNewArrival" in updateData) {
      updateData.isNewArrival = toBoolean(updateData.isNewArrival);
    }
    delete updateData.newArrival;
    delete updateData.isFeatured;
    delete updateData.discount;
    if ("price" in updateData) {
      const rounded = roundWholeNumber(updateData.price);
      if (rounded !== null) {
        updateData.price = rounded;
      } else {
        delete updateData.price;
      }
    }
    if ("originalPrice" in updateData) {
      const rounded = roundWholeNumber(updateData.originalPrice);
      if (rounded !== null) {
        updateData.originalPrice = rounded;
      } else {
        delete updateData.originalPrice;
      }
    }
    if ("hsnCode" in updateData) {
      updateData.hsnCode = normalizeHsnCode(updateData.hsnCode);
    }
    if ("productPage" in updateData) {
      updateData.productPage = normalizeProductPageConfig(updateData.productPage);
    }
    if ("images" in updateData) {
      updateData.images = Array.isArray(updateData.images)
        ? updateData.images.filter(Boolean).slice(0, 10)
        : [];
    }
    if ("videos" in updateData) {
      updateData.videos = Array.isArray(updateData.videos)
        ? updateData.videos.filter(Boolean).slice(0, 3)
        : [];
    }

    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    // Validate variants if being updated
    if (
      updateData.hasVariants &&
      Array.isArray(updateData.variants) &&
      updateData.variants.length > 0
    ) {
      let normalizedWeightEntries = [];
      try {
        normalizedWeightEntries = updateData.variants.map((variant) =>
          normalizeVariantWeight(variant),
        );
      } catch (error) {
        return res.status(400).json({
          error: true,
          success: false,
          message: error.message || "Invalid weight format",
        });
      }
      const uniqueWeights = new Set(
        normalizedWeightEntries.map((entry) => `${entry.weight}${entry.unit}`),
      );
      if (uniqueWeights.size !== normalizedWeightEntries.length) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Duplicate variant weights are not allowed",
        });
      }
      const existingVariantMap = new Map(
        (product.variants || []).map((variant) => [
          String(variant?._id || ""),
          variant,
        ]),
      );
      updateData.variants = updateData.variants.map((variant) => {
        const existingVariant = existingVariantMap.get(
          String(variant?._id || ""),
        );
        const normalizedVariant = normalizeVariantPayload(
          variant,
          existingVariant?.stock_quantity ?? existingVariant?.stock ?? 0,
        );
        return {
          ...normalizedVariant,
          reserved_quantity: normalizeStockValue(
            variant.reserved_quantity,
            existingVariant?.reserved_quantity ?? 0,
          ),
        };
      });
      // Ensure exactly one default
      const defaults = updateData.variants.filter((v) => v.isDefault);
      if (defaults.length === 0) {
        updateData.variants[0].isDefault = true;
      } else if (defaults.length > 1) {
        updateData.variants.forEach((v, i) => {
          v.isDefault = i === updateData.variants.indexOf(defaults[0]);
        });
      }
    }

    if (
      updateData.hasVariants &&
      Array.isArray(updateData.variants) &&
      updateData.variants.length > 0
    ) {
      const variantInventoryTotals = buildVariantInventoryTotals(
        updateData.variants,
      );
      updateData.stock = variantInventoryTotals.stock;
      updateData.stock_quantity = variantInventoryTotals.stock;
      updateData.reserved_quantity = variantInventoryTotals.reserved;
      const defaultVariant =
        updateData.variants.find((variant) => variant?.isDefault) ||
        updateData.variants[0];
      if (defaultVariant) {
        updateData.price = defaultVariant.price;
        updateData.originalPrice = defaultVariant.originalPrice;
        updateData.weight = defaultVariant.weight;
        updateData.unit = defaultVariant.unit || "g";
      }
    }

    // If category is being changed, update product counts
    if (
      updateData.category &&
      updateData.category !== product.category.toString()
    ) {
      await CategoryModel.findByIdAndUpdate(product.category, {
        $inc: { productCount: -1 },
      });
      await CategoryModel.findByIdAndUpdate(updateData.category, {
        $inc: { productCount: 1 },
      });
    }

    const productBefore = product.toObject ? product.toObject() : product;

    const updatedProduct = await ProductModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    ).populate("category", "name slug");

    const updatedProductForNotifications = await ProductModel.findById(id)
      .select(
        "track_inventory trackInventory stock stock_quantity reserved_quantity variants",
      )
      .lean();

    await applyLowStockSummaryUpdate(updatedProductForNotifications);

    const variantIdsToCheck = Array.isArray(updatedProductForNotifications?.variants)
      ? updatedProductForNotifications.variants.map((variant) => variant?._id)
      : [];

    if (variantIdsToCheck.length > 0) {
      for (const variantId of variantIdsToCheck) {
        await triggerBackInStockNotificationsIfRecovered({
          productBefore,
          productAfter: updatedProductForNotifications,
          variantId,
          source: "ADMIN_PRODUCT_UPDATE",
        });
      }
    } else {
      await triggerBackInStockNotificationsIfRecovered({
        productBefore,
        productAfter: updatedProductForNotifications,
        source: "ADMIN_PRODUCT_UPDATE",
      });
    }

    emitStockUpdatesForProductSnapshotChange({
      productBefore,
      productAfter: updatedProductForNotifications,
      source: "ADMIN_PRODUCT_UPDATE",
    });
    await invalidateProductResponseCache(CATALOG_RESPONSE_CACHE_NAMESPACES);
    invalidateAdminReadCaches();

    res.status(200).json({
      error: false,
      success: true,
      message: "Product updated successfully",
      data: {
        ...(updatedProduct?.toObject ? updatedProduct.toObject() : updatedProduct),
        newArrival: Boolean(updatedProduct?.isNewArrival),
      },
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update product",
      details: error.message,
    });
  }
};

/**
 * Delete product (Admin only)
 * @route DELETE /api/products/:id
 */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    // Update category product count
    await CategoryModel.findByIdAndUpdate(product.category, {
      $inc: { productCount: -1 },
    });

    await ProductModel.findByIdAndDelete(id);
    await invalidateProductResponseCache(CATALOG_RESPONSE_CACHE_NAMESPACES);
    invalidateAdminReadCaches();

    res.status(200).json({
      error: false,
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete product",
      details: error.message,
    });
  }
};

/**
 * Bulk update products (Admin only)
 * @route PATCH /api/products/bulk
 */
export const bulkUpdateProducts = async (req, res) => {
  try {
    const { ids, updateData } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Product IDs are required",
      });
    }

    if ("stock" in updateData && !("stock_quantity" in updateData)) {
      updateData.stock_quantity = updateData.stock;
    }
    if ("stock_quantity" in updateData && !("stock" in updateData)) {
      updateData.stock = updateData.stock_quantity;
    }
    if (
      "low_stock_threshold" in updateData &&
      !("lowStockThreshold" in updateData)
    ) {
      updateData.lowStockThreshold = updateData.low_stock_threshold;
    }
    if ("track_inventory" in updateData && !("trackInventory" in updateData)) {
      updateData.trackInventory = updateData.track_inventory;
    }
    delete updateData.adminStarRating;
    delete updateData.rating;

    const stockSensitiveUpdate = [
      "stock",
      "stock_quantity",
      "reserved_quantity",
      "variants",
    ].some((field) => field in updateData);

    const productsBefore = stockSensitiveUpdate
      ? await ProductModel.find({ _id: { $in: ids } })
          .select(
            "_id track_inventory trackInventory stock stock_quantity reserved_quantity variants",
          )
          .lean()
      : [];

    const result = await ProductModel.updateMany(
      { _id: { $in: ids } },
      { $set: updateData },
    );

    if (stockSensitiveUpdate && productsBefore.length > 0) {
      const productsAfter = await ProductModel.find({ _id: { $in: ids } })
        .select(
          "_id track_inventory trackInventory stock stock_quantity reserved_quantity variants",
        )
        .lean();
      const productsAfterMap = new Map(
        productsAfter.map((product) => [String(product?._id || ""), product]),
      );

      for (const productBefore of productsBefore) {
        const productAfter = productsAfterMap.get(String(productBefore?._id || ""));
        if (!productAfter) continue;

        await applyLowStockSummaryUpdate(productAfter);

        await triggerBackInStockNotificationsIfRecovered({
          productBefore,
          productAfter,
          source: "ADMIN_PRODUCT_BULK_UPDATE",
        });

        emitStockUpdatesForProductSnapshotChange({
          productBefore,
          productAfter,
          source: "ADMIN_PRODUCT_BULK_UPDATE",
        });
      }
    }
    await invalidateProductResponseCache(CATALOG_RESPONSE_CACHE_NAMESPACES);
    invalidateAdminReadCaches();

    res.status(200).json({
      error: false,
      success: true,
      message: `${result.modifiedCount} products updated`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to bulk update products",
    });
  }
};

/**
 * Update product stock (Admin only)
 * @route PATCH /api/products/:id/stock
 */
export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, variantId } = req.body;
    const normalizedStock = Number(stock ?? 0);

    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    const productBefore = product.toObject ? product.toObject() : product;

    if (variantId) {
      // Update variant stock
      const variant = product.variants.id(variantId);
      if (variant) {
        variant.stock = normalizedStock;
        variant.stock_quantity = normalizedStock;
      }
      // Parent stock will be synced automatically by pre-save hook
    } else if (!product.hasVariants || !product.variants.length) {
      product.stock = normalizedStock;
      product.stock_quantity = normalizedStock;
    }
    // If hasVariants and no variantId, skip — parent is derived from variants

    await product.save();

    const updatedProductForNotifications = await ProductModel.findById(id)
      .select(
        "track_inventory trackInventory stock stock_quantity reserved_quantity variants",
      )
      .lean();

    await applyLowStockSummaryUpdate(updatedProductForNotifications);

    await triggerBackInStockNotificationsIfRecovered({
      productBefore,
      productAfter: updatedProductForNotifications,
      variantId: variantId || null,
      source: "ADMIN_STOCK_UPDATE",
    });

    emitStockUpdatesForProductSnapshotChange({
      productBefore,
      productAfter: updatedProductForNotifications,
      source: "ADMIN_STOCK_UPDATE",
    });
    await invalidateProductResponseCache(CATALOG_RESPONSE_CACHE_NAMESPACES);

    res.status(200).json({
      error: false,
      success: true,
      message: "Stock updated successfully",
      data: updatedProductForNotifications,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update stock",
    });
  }
};

// ==================== REVIEW ENDPOINTS ====================

/**
 * Add product review
 * @route POST /api/products/:id/reviews
 */
export const addReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, title, comment, images } = req.body;
    const userId = req.user;

    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    // Check if user already reviewed
    const existingReview = product.reviews.find(
      (r) => r.user.toString() === userId,
    );
    if (existingReview) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "You have already reviewed this product",
      });
    }

    // Get user name
    const UserModel = (await import("../models/user.model.js")).default;
    const user = await UserModel.findById(userId);

    product.reviews.push({
      user: userId,
      userName: user?.name || "Anonymous",
      rating,
      title,
      comment,
      images: images || [],
    });

    await product.save();
    await invalidateProductResponseCache(PRODUCT_RESPONSE_CACHE_NAMESPACES);
    invalidateAdminReadCaches();

    res.status(201).json({
      error: false,
      success: true,
      message: "Review added successfully",
      data: product.reviews[product.reviews.length - 1],
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to add review",
    });
  }
};

/**
 * Delete review (User can delete own review, Admin can delete any)
 * @route DELETE /api/products/:id/reviews/:reviewId
 */
export const deleteReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const userId = req.user;

    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    const review = product.reviews.id(reviewId);
    if (!review) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Review not found",
      });
    }

    // Check ownership (or admin)
    // Note: Admin check would need to be added based on your auth middleware
    if (review.user.toString() !== userId) {
      return res.status(403).json({
        error: true,
        success: false,
        message: "Not authorized to delete this review",
      });
    }

    product.reviews.pull(reviewId);
    await product.save();
    await invalidateProductResponseCache(PRODUCT_RESPONSE_CACHE_NAMESPACES);
    invalidateAdminReadCaches();

    res.status(200).json({
      error: false,
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete review",
    });
  }
};

/**
 * Update product demand status (Admin only)
 * @route PATCH /api/products/:id/demand
 */
export const updateDemandStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { demandStatus } = req.body;

    // Validate demandStatus
    if (!demandStatus || !["NORMAL", "HIGH"].includes(demandStatus)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid demandStatus. Must be 'NORMAL' or 'HIGH'",
      });
    }

    const product = await ProductModel.findByIdAndUpdate(
      id,
      { demandStatus },
      { new: true, runValidators: true },
    );

    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }
    await invalidateProductResponseCache(CATALOG_RESPONSE_CACHE_NAMESPACES);

    res.status(200).json({
      error: false,
      success: true,
      message: `Product demand status updated to ${demandStatus}`,
      data: product,
    });
  } catch (error) {
    console.error("Update demand status error:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update demand status",
    });
  }
};

export default {
  getProducts,
  getProductById,
  getFeaturedProducts,
  getExclusiveProducts,
  getRelatedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUpdateProducts,
  updateStock,
  addReview,
  deleteReview,
  updateDemandStatus,
};
