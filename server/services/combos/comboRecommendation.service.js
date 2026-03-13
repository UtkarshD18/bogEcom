import ComboModel from "../../models/combo.model.js";
import FrequentlyBoughtTogetherModel from "../../models/frequentlyBoughtTogether.model.js";
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
  setCached(cacheKey, withAvailability);
  return withAvailability;
};

export const getFrequentlyBoughtTogether = async (productId, { limit = 4 } = {}) => {
  if (!productId) return [];
  const cacheKey = getCacheKey("fbt", `${productId}:${limit}`);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const pairs = await FrequentlyBoughtTogetherModel.find({ productId })
    .sort({ frequencyScore: -1, confidenceScore: -1 })
    .limit(Math.max(Number(limit || 4), 1))
    .lean();

  const relatedIds = pairs.map((pair) => pair.relatedProductId);
  const products = relatedIds.length
    ? await ProductModel.find({ _id: { $in: relatedIds }, isActive: true })
        .select("_id name price originalPrice images thumbnail category")
        .lean()
    : [];

  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const result = pairs
    .map((pair) => ({
      ...pair,
      product: productMap.get(String(pair.relatedProductId)) || null,
    }))
    .filter((pair) => pair.product);

  setCached(cacheKey, result);
  return result;
};

export const getCartUpsellCombos = async (cartProductIds = [], { limit = 6 } = {}) => {
  const uniqueIds = Array.from(new Set(cartProductIds.map(String))).filter(Boolean);
  if (uniqueIds.length === 0) return [];

  const combos = await ComboModel.find({
    ...buildActiveComboFilter(),
    "items.productId": { $in: uniqueIds },
  })
    .sort({ priority: -1, totalSavings: -1 })
    .limit(30)
    .lean();

  const suggestions = combos.map((combo) => {
    const itemProductIds = (combo.items || []).map((item) => String(item.productId));
    const missing = itemProductIds.filter((id) => !uniqueIds.includes(id));
    return {
      combo,
      missingCount: missing.length,
      missingProductIds: missing,
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
  return sorted.map((entry, index) => ({
    combo: withAvailability[index] || entry.combo,
    missingCount: entry.missingCount,
    missingProductIds: entry.missingProductIds,
  }));
};

export const getRecommendedCombosForProduct = async (productId, { limit = 4 } = {}) => {
  const combos = await ComboModel.find({
    ...buildActiveComboFilter(),
    $or: [
      { "items.productId": productId },
      { tags: { $in: ["recommended", "best_seller", "trending"] } },
    ],
  })
    .sort({ priority: -1, totalSavings: -1 })
    .limit(Math.max(Number(limit || 4), 1))
    .lean();

  return attachAvailability(combos);
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

  return attachAvailability(combos);
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
