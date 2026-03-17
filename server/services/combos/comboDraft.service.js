import ComboDraftModel from "../../models/comboDraft.model.js";
import ProductPairingModel from "../../models/productPairing.model.js";
import ProductModel from "../../models/product.model.js";
import {
  buildComboItemsSnapshot,
  buildComboPricing,
} from "./combo.service.js";
import { generateFrequentlyBoughtTogether } from "./frequentlyBoughtTogether.service.js";

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const buildPairKey = (a, b) =>
  [String(a || ""), String(b || "")]
    .sort()
    .join("::");

const resolveDefaultVariant = (product) => {
  if (!product?.hasVariants || !Array.isArray(product?.variants)) return null;
  return (
    product.variants.find((variant) => variant?.isDefault) ||
    product.variants[0] ||
    null
  );
};

const resolveDiscountPercent = (confidenceScore) => {
  const normalized = Math.max(Math.min(Number(confidenceScore || 0), 1), 0);
  return round2(11 + normalized * 4);
};

const resolvePopularityScore = (productOrderCounts, productId) => {
  if (!productOrderCounts) return 0;
  const value = productOrderCounts.get(String(productId || "")) || 0;
  return Number(value || 0);
};

const computeAiScore = ({
  pairCount = 0,
  popularityScore = 0,
  discountPercent = 0,
  maxPairCount = 1,
  maxPopularity = 1,
}) => {
  const frequencyScore = maxPairCount > 0 ? pairCount / maxPairCount : 0;
  const popularity = maxPopularity > 0 ? popularityScore / maxPopularity : 0;
  const discountScore = Math.min(Math.max(discountPercent / 15, 0), 1);

  return round2(
    (frequencyScore * 0.45 + popularity * 0.35 + discountScore * 0.2) * 100,
  );
};

const buildDraftPayload = async ({
  pair,
  primaryProduct,
  secondaryProduct,
  productOrderCounts,
  maxPairCount,
  maxPopularity,
}) => {
  const primaryVariant = resolveDefaultVariant(primaryProduct);
  const secondaryVariant = resolveDefaultVariant(secondaryProduct);

  const items = [
    {
      productId: String(primaryProduct._id),
      quantity: 1,
      variantId: primaryVariant?._id || "",
      variantName: primaryVariant?.name || "",
    },
    {
      productId: String(secondaryProduct._id),
      quantity: 1,
      variantId: secondaryVariant?._id || "",
      variantName: secondaryVariant?.name || "",
    },
  ];

  const { snapshots } = await buildComboItemsSnapshot({ items });
  const discountPercent = resolveDiscountPercent(pair?.confidenceScore || 0);
  const pricing = buildComboPricing({
    items: snapshots,
    pricing: { type: "percent_discount", value: discountPercent },
  });

  const popularityScore = productOrderCounts
    ? resolvePopularityScore(productOrderCounts, primaryProduct?._id) +
      resolvePopularityScore(productOrderCounts, secondaryProduct?._id)
    : Number(pair?.pairCount || 0);
  const aiScore = computeAiScore({
    pairCount: Number(pair?.pairCount || 0),
    popularityScore,
    discountPercent: pricing.discountPercentage || discountPercent,
    maxPairCount,
    maxPopularity,
  });

  const name = `${primaryProduct.name} + ${secondaryProduct.name}`;
  const pairKey = buildPairKey(primaryProduct._id, secondaryProduct._id);

  return {
    name,
    slug: slugify(name),
    pairKey,
    productsIncluded: items,
    itemsSnapshot: snapshots,
    originalTotal: pricing.originalTotal,
    suggestedPrice: pricing.comboPrice,
    discountPercentage: pricing.discountPercentage,
    pricingType: "percent_discount",
    pricingValue: discountPercent,
    aiScore,
    status: "draft",
    source: "ai",
    generatedFrom: "order_history",
    tags: ["recommended"],
    lastUpdated: new Date(),
  };
};

export const generateComboDrafts = async ({
  limit = 8,
  previewOnly = false,
  refreshIfEmpty = true,
  productOrderCounts = null,
} = {}) => {
  const safeLimit = Math.max(Number(limit || 8), 1);
  const pairLimit = Math.max(safeLimit * 4, 20);
  const minPairCount = Math.max(Number(process.env.FBT_MIN_PAIR_COUNT || 2), 1);

  const fetchPairs = async () =>
    ProductPairingModel.find({ pairCount: { $gte: minPairCount } })
      .sort({ pairCount: -1, confidenceScore: -1 })
      .limit(pairLimit)
      .lean();

  let pairs = await fetchPairs();
  let refreshResult = null;
  let orderCounts = productOrderCounts;

  if (pairs.length === 0 && refreshIfEmpty) {
    try {
      refreshResult = await generateFrequentlyBoughtTogether();
      if (refreshResult?.pairs > 0) {
        pairs = await fetchPairs();
      }
      orderCounts = refreshResult?.productOrderCounts || orderCounts;
    } catch (error) {
      refreshResult = { error: error?.message || String(error) };
    }
  }

  const suggestions = [];
  const seenKeys = new Set();
  const productIds = pairs.flatMap((pair) => [
    String(pair.productAId || ""),
    String(pair.productBId || ""),
  ]);
  const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));
  const products = uniqueProductIds.length
    ? await ProductModel.find({ _id: { $in: uniqueProductIds }, isActive: true })
        .select(
          "_id name price originalPrice images thumbnail category hasVariants variants",
        )
        .lean()
    : [];
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const maxPairCount = pairs.reduce(
    (max, pair) => Math.max(max, Number(pair?.pairCount || 0)),
    1,
  );
  const maxPopularity = orderCounts
    ? Array.from(orderCounts.values()).reduce(
        (max, value) => Math.max(max, Number(value || 0)),
        1,
      )
    : maxPairCount;

  for (const pair of pairs) {
    if (suggestions.length >= safeLimit) break;
    const primaryProduct = productMap.get(String(pair.productAId || ""));
    const secondaryProduct = productMap.get(String(pair.productBId || ""));
    if (!primaryProduct || !secondaryProduct) continue;

    const pairKey = buildPairKey(primaryProduct._id, secondaryProduct._id);
    if (seenKeys.has(pairKey)) continue;
    seenKeys.add(pairKey);

    const payload = await buildDraftPayload({
      pair,
      primaryProduct,
      secondaryProduct,
      productOrderCounts: orderCounts,
      maxPairCount,
      maxPopularity,
    });

    if (previewOnly) {
      suggestions.push(payload);
      continue;
    }

    const existing = await ComboDraftModel.findOne({ pairKey }).lean();
    if (existing?.status === "approved") {
      suggestions.push(existing);
      continue;
    }
    if (existing?.status === "rejected") {
      continue;
    }

    const saved = existing
      ? await ComboDraftModel.findOneAndUpdate(
          { pairKey },
          { $set: payload },
          { new: true },
        )
      : await ComboDraftModel.create(payload);

    suggestions.push(saved?.toObject ? saved.toObject() : saved);
  }

  return {
    suggestions,
    generated: suggestions.length,
    pairsEvaluated: pairs.length,
    refreshResult,
  };
};
