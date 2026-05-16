import express from "express";
import {
  bulkUpdateProducts,
  createProduct,
  deleteProduct,
  getExclusiveProducts,
  getFrequentlyBoughtProducts,
  getCartUpsellProduct,
  getFeaturedProducts,
  getProductById,
  getProducts,
  getRelatedProducts,
  incrementProductViewCountBestEffort,
  updateDemandStatus,
  updateProduct,
  updateStock,
} from "../controllers/product.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import {
  attachMembershipStatus,
  requireActiveMembership,
} from "../middlewares/membershipGuard.js";
import optionalAuth from "../middlewares/optionalAuth.js";
import createPublicResponseCacheMiddleware, {
  getPublicResponseCacheTtlSeconds,
} from "../middlewares/publicResponseCache.js";

const router = express.Router();
const PRODUCT_CACHE_TTL_SECONDS = getPublicResponseCacheTtlSeconds(
  "PERF_RESPONSE_CACHE_PRODUCTS_TTL_SECONDS",
  45,
);
const productListingCache = createPublicResponseCacheMiddleware({
  namespaces: ["products", "categories", "combos"],
  ttlSeconds: PRODUCT_CACHE_TTL_SECONDS,
});
const productCollectionCache = createPublicResponseCacheMiddleware({
  namespaces: ["products", "categories"],
  ttlSeconds: PRODUCT_CACHE_TTL_SECONDS,
});
const productRecommendationCache = createPublicResponseCacheMiddleware({
  namespaces: ["products", "combos"],
  ttlSeconds: PRODUCT_CACHE_TTL_SECONDS,
});
const productDetailCache = createPublicResponseCacheMiddleware({
  namespaces: ["products", "categories"],
  ttlSeconds: PRODUCT_CACHE_TTL_SECONDS,
  onHit: (req) => incrementProductViewCountBestEffort(req.params.id),
});

/**
 * Product Routes
 *
 * Public routes for viewing products
 * Protected routes for reviews
 * Admin routes for CRUD operations
 */

// ==================== PUBLIC ROUTES ====================

// Get all products (with filters, pagination, search)
router.get("/", productListingCache, optionalAuth, attachMembershipStatus, getProducts);

// Get featured products
router.get(
  "/featured",
  productCollectionCache,
  optionalAuth,
  attachMembershipStatus,
  getFeaturedProducts,
);

// Get exclusive products (members only)
// Security: auth + membership guard prevents non-members from receiving data.
router.get("/exclusive", auth, requireActiveMembership, getExclusiveProducts);

// Get related products
router.get(
  "/:id/related",
  productCollectionCache,
  optionalAuth,
  attachMembershipStatus,
  getRelatedProducts,
);

// Frequently bought together
router.get(
  "/:id/frequently-bought",
  productRecommendationCache,
  optionalAuth,
  attachMembershipStatus,
  getFrequentlyBoughtProducts,
);

// Cart upsell suggestion
router.post("/upsell", optionalAuth, attachMembershipStatus, getCartUpsellProduct);

// Get single product by ID or slug
router.get("/:id", productDetailCache, optionalAuth, attachMembershipStatus, getProductById);

// ==================== ADMIN ROUTES ====================

// Create product (images are uploaded separately via /api/upload and URLs sent in body)
router.post("/", auth, admin, createProduct);

// Update product
router.put("/:id", auth, admin, updateProduct);

// Delete product
router.delete("/:id", auth, admin, deleteProduct);

// Bulk update products
router.patch("/bulk", auth, admin, bulkUpdateProducts);

// Update stock
router.patch("/:id/stock", auth, admin, updateStock);

// Update demand status (High Demand flag)
router.patch("/:id/demand", auth, admin, updateDemandStatus);

export default router;
