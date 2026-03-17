import ComboModel from "../../models/combo.model.js";
import ProductPairingModel from "../../models/productPairing.model.js";
import ProductModel from "../../models/product.model.js";
import { computeComboAvailability } from "./combo.service.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

const getCacheKey = (prefix, key) => `${prefix}:${key}`;

const getCached = (key) => {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    cache.delete(key);
    return null;
  }
  return cached.value;
};

const setCached = (key, value, ttlMs = CACHE_TTL_MS) => {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const buildActiveComboFilter = () => {
  const now = new Date();
  return {
    isActive: true,
    isVisible: true,
    status: { $ne: "disabled" },
    $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ],
  };
};

const attachAvailability = async (combos = []) => {
  if (!Array.isArray(combos) || combos.length === 0) return [];
  const productIds = combos
    .flatMap((combo) => combo.items || [])
    .map((item) => String(item.productId || ""))
    .filter(Boolean);

  const products = productIds.length
    ? await ProductModel.find({ _id: { $in: productIds } })
        .select("_id stock stock_quantity reserved_quantity track_inventory trackInventory hasVariants variants")
        .lean()
    : [];
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const output = [];
  for (const combo of combos) {
    const availability = await computeComboAvailability(combo, productMap);
    output.push({
      ...combo,
      availableStock: availability.available,
      stockMode: availability.stockMode,
    });
  }
  return output;
};

const resolveDefaultVariant = (product) => {
  if (!product?.hasVariants || !Array.isArray(product?.variants)) return null;
  return (
    product.variants.find((variant) => variant?.isDefault) ||
    product.variants[0] ||
    null
  );
};

const resolveAvailableStock = (product, variant) => {
  if (!product) return 0;
  const trackInventory =
    typeof product.track_inventory === "boolean"
      ? product.track_inventory
      : typeof product.trackInventory === "boolean"
        ? product.trackInventory
        : true;
  if (!trackInventory) return Number.MAX_SAFE_INTEGER;

  if (variant) {
    const stock = Number(variant.stock_quantity ?? variant.stock ?? 0);
    const reserved = Number(variant.reserved_quantity ?? 0);
    return Math.max(stock - reserved, 0);
  }

  const stock = Number(product.stock_quantity ?? product.stock ?? 0);
  const reserved = Number(product.reserved_quantity ?? 0);
  return Math.max(stock - reserved, 0);
};

const buildProductRecommendation = (product) => {
  if (!product) return null;
  const variant = resolveDefaultVariant(product);
  const availableStock = resolveAvailableStock(product, variant);
  if (availableStock <= 0) return null;

  const price = Number(variant?.price ?? product?.price ?? 0);
  const originalPrice = Number(
    variant?.originalPrice ?? product?.originalPrice ?? price,
  );
  const image =
    variant?.image || product?.thumbnail || product?.images?.[0] || "";

  return {
    product,
    variant: variant
      ? {
          _id: variant._id,
          name: variant.name || "",
          price: Number(variant.price ?? price),
          originalPrice: Number(
            variant.originalPrice ?? product?.originalPrice ?? price,
          ),
          weight: variant.weight,
          unit: variant.unit,
          image: variant.image || image,
        }
      : null,
    price,
    originalPrice,
    image,
    availableStock,
  };
};

const filterAvailableCombos = (combos = []) =>
  combos.filter((combo) => Number(combo?.availableStock ?? 0) > 0);

export const getCombosForProduct = async (productId, { limit = 6 } = {}) => {
  if (!productId) return [];
  const cacheKey = getCacheKey("combos_for_product", `${productId}:${limit}`);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const combos = await ComboModel.find({
    ...buildActiveComboFilter(),
    "items.productId": productId,
  })
    .sort({ priority: -1, totalSavings: -1 })
    .limit(Math.max(Number(limit || 6), 1))
    .lean();

  const withAvailability = await attachAvailability(combos);
  const filtered = filterAvailableCombos(withAvailability);
  setCached(cacheKey, filtered);
  return filtered;
};

export const getFrequentlyBoughtTogether = async (productId, { limit = 4 } = {}) => {
  if (!productId) return [];
  const cacheKey = getCacheKey("fbt", `${productId}:${limit}`);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const pairs = await ProductPairingModel.find({ productAId: productId })
    .sort({ pairCount: -1, confidenceScore: -1 })
    .limit(Math.max(Number(limit || 4), 1))
    .lean();

  const relatedIds = pairs.map((pair) => pair.productBId);
  const products = relatedIds.length
    ? await ProductModel.find({ _id: { $in: relatedIds }, isActive: true })
        .select(
          "_id name price originalPrice images thumbnail category hasVariants variants stock stock_quantity reserved_quantity track_inventory trackInventory isExclusive",
        )
        .lean()
    : [];

  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const result = pairs
    .map((pair) => ({
      ...pair,
      product: productMap.get(String(pair.productBId)) || null,
    }))
    .map((pair) => {
      const product = pair.product;
      const recommendation = buildProductRecommendation(product);
      if (!recommendation) return null;
      return {
        ...pair,
        recommendation,
      };
    })
    .filter(Boolean);

  setCached(cacheKey, result);
  return result;
};

export const getCartUpsellCombos = async (cartItems = [], { limit = 6 } = {}) => {
  const normalizedItems = Array.isArray(cartItems)
    ? cartItems
        .map((item) => ({
          productId: String(item?.productId || item?.product || "").trim(),
          variantId: String(item?.variantId || item?.variant || "").trim(),
        }))
        .filter((item) => item.productId)
    : [];

  if (normalizedItems.length === 0) return [];

  const itemKeys = normalizedItems
    .map((item) => `${item.productId}:${item.variantId || ""}`)
    .sort();
  const cacheKey = getCacheKey(
    "cart_upsell",
    `${itemKeys.join("|")}:${Number(limit || 6)}`,
  );
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const uniqueIds = Array.from(
    new Set(normalizedItems.map((item) => String(item.productId))),
  ).filter(Boolean);
  const cartProductIdSet = new Set(uniqueIds);
  const cartVariantKeySet = new Set(itemKeys);

  const combos = await ComboModel.find({
    ...buildActiveComboFilter(),
    "items.productId": { $in: uniqueIds },
  })
    .sort({ priority: -1, totalSavings: -1 })
    .limit(30)
    .lean();

  const suggestions = combos.map((combo) => {
    const comboItems = Array.isArray(combo.items) ? combo.items : [];
    const missingItems = comboItems.filter((item) => {
      const productId = String(item?.productId || "");
      if (!productId) return false;
      const variantId = item?.variantId ? String(item.variantId) : "";
      if (variantId) {
        return !cartVariantKeySet.has(`${productId}:${variantId}`);
      }
      return !cartProductIdSet.has(productId);
    });
    const missingProductIds = missingItems
      .map((item) => String(item?.productId || ""))
      .filter(Boolean);
    return {
      combo,
      missingCount: missingProductIds.length,
      missingProductIds,
    };
  });

  const sorted = suggestions
    .sort((a, b) => {
      if (a.missingCount !== b.missingCount) {
        return a.missingCount - b.missingCount;
      }
      return Number(b.combo?.totalSavings || 0) - Number(a.combo?.totalSavings || 0);
    })
    .slice(0, Math.max(Number(limit || 6), 1));

  const withAvailability = await attachAvailability(sorted.map((entry) => entry.combo));
  const response = sorted
    .map((entry, index) => ({
      combo: withAvailability[index] || entry.combo,
      missingCount: entry.missingCount,
      missingProductIds: entry.missingProductIds,
    }))
    .filter((entry) => Number(entry?.combo?.availableStock ?? 0) > 0);

  setCached(cacheKey, response);
  return response;
};

export const getCartUpsellProductSuggestion = async (
  cartItems = [],
  { limit = 1 } = {},
) => {
  const normalizedItems = Array.isArray(cartItems)
    ? cartItems
        .map((item) => ({
          productId: String(item?.productId || item?.product || "").trim(),
        }))
        .filter((item) => item.productId)
    : [];

  if (normalizedItems.length === 0) return null;

  const cartProductIds = Array.from(
    new Set(normalizedItems.map((item) => String(item.productId))),
  );

  const pairs = await ProductPairingModel.find({
    productAId: { $in: cartProductIds },
    productBId: { $nin: cartProductIds },
  })
    .sort({ pairCount: -1, confidenceScore: -1 })
    .limit(Math.max(Number(limit || 1) * 8, 8))
    .lean();

  if (!pairs.length) return null;

  const relatedIds = Array.from(
    new Set(pairs.map((pair) => String(pair.productBId || ""))),
  ).filter(Boolean);

  const products = relatedIds.length
    ? await ProductModel.find({ _id: { $in: relatedIds }, isActive: true })
        .select(
          "_id name price originalPrice images thumbnail category hasVariants variants stock stock_quantity reserved_quantity track_inventory trackInventory isExclusive",
        )
        .lean()
    : [];
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  for (const pair of pairs) {
    const product = productMap.get(String(pair.productBId || ""));
    const recommendation = buildProductRecommendation(product);
    if (!recommendation) continue;
    return {
      ...pair,
      recommendation,
    };
  }

  return null;
};

export const getRecommendedCombosForProduct = async (productId, { limit = 4 } = {}) => {
  const combos = await ComboModel.find({
    ...buildActiveComboFilter(),
    "items.productId": productId,
  })
    .sort({ priority: -1, totalSavings: -1 })
    .limit(Math.max(Number(limit || 4), 1))
    .lean();

  const withAvailability = await attachAvailability(combos);
  return filterAvailableCombos(withAvailability);
};

export const getCompleteSetCombos = async (productId, { limit = 4 } = {}) => {
  if (!productId) return [];
  const product = await ProductModel.findById(productId)
    .select("category")
    .lean();

  if (!product?.category) return [];

  const combos = await ComboModel.find({
    ...buildActiveComboFilter(),
    "items.categoryId": product.category,
  })
    .sort({ priority: -1, totalSavings: -1 })
    .limit(Math.max(Number(limit || 4), 1))
    .lean();

  const withAvailability = await attachAvailability(combos);
  return filterAvailableCombos(withAvailability);
};

export const getComboSectionsForProduct = async (productId) => {
  const [fbt, bundleAndSave, completeSet, recommended] = await Promise.all([
    getFrequentlyBoughtTogether(productId, { limit: 4 }),
    getCombosForProduct(productId, { limit: 4 }),
    getCompleteSetCombos(productId, { limit: 4 }),
    getRecommendedCombosForProduct(productId, { limit: 4 }),
  ]);

  return {
    frequentlyBoughtTogether: fbt,
    bundleAndSave,
    completeTheSet: completeSet,
    recommendedCombos: recommended,
  };
};
