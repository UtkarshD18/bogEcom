import ComboModel from "../models/combo.model.js";
import ComboOrderModel from "../models/comboOrder.model.js";
import ProductModel from "../models/product.model.js";
import FrequentlyBoughtTogetherModel from "../models/frequentlyBoughtTogether.model.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/errorHandler.js";
import {
  attachComboAvailability,
  buildComboItemsSnapshot,
  buildComboPricing,
  computeComboAvailability,
  normalizeComboItemsPayload,
  normalizeComboTags,
  resolveComboStatus,
  resolveUserSegment,
  isComboEligibleForSegment,
  upsertComboItems,
} from "../services/combos/combo.service.js";
import {
  getComboSectionsForProduct,
  getCartUpsellCombos,
} from "../services/combos/comboRecommendation.service.js";
import {
  buildComboAnalyticsCharts,
  buildComboAnalyticsReport,
  buildComboPairingHeatmap,
  refreshComboAnalyticsBuckets,
  resolveRange,
} from "../services/combos/comboAnalytics.service.js";
import { generateFrequentlyBoughtTogether } from "../services/combos/frequentlyBoughtTogether.service.js";

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeComboType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "fixed_bundle";
  if (normalized === "mix_match_bundle") return "mix_match";
  if (normalized === "dynamic_bundle") return "dynamic";
  return normalized;
};

const normalizeGeoTargets = (value) => {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return rawList
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (!trimmed) return null;
        if (/^\d{3,}$/.test(trimmed)) {
          return { pincode: trimmed };
        }
        return { country: trimmed };
      }
      if (typeof entry === "object") {
        return {
          country: String(entry.country || "").trim(),
          state: String(entry.state || "").trim(),
          city: String(entry.city || "").trim(),
          pincode: String(entry.pincode || "").trim(),
        };
      }
      return null;
    })
    .filter((target) =>
      target &&
      (target.country || target.state || target.city || target.pincode),
    );
};

const buildActiveFilter = () => {
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

const ensureUniqueSlug = async (baseSlug, ignoreId = null) => {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await ComboModel.findOne({
      slug,
      ...(ignoreId ? { _id: { $ne: ignoreId } } : {}),
    }).select("_id");
    if (!existing) return slug;
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
};

const parseComboPayload = async (body = {}, { existingCombo = null } = {}) => {
  const name = String(body?.name || body?.comboName || "").trim();
  if (!name) {
    throw new AppError("MISSING_FIELD", { fieldName: "name" });
  }

  const slugCandidate = String(body?.slug || "").trim() || slugify(name);
  const slug = await ensureUniqueSlug(slugCandidate, existingCombo?._id || null);

  const itemsPayload = normalizeComboItemsPayload(body?.items || body?.products || []);
  if (itemsPayload.length === 0) {
    throw new AppError("EMPTY_PRODUCTS", { fieldName: "items" });
  }

  const pricingType = String(body?.pricingType || body?.pricing?.type || "fixed_price").trim();
  const pricingValue = Math.max(Number(body?.pricingValue ?? body?.pricing?.value ?? 0), 0);

  const { snapshots } = await buildComboItemsSnapshot({ items: itemsPayload });
  const pricing = buildComboPricing({
    items: snapshots,
    pricing: { type: pricingType, value: pricingValue },
  });

  const tags = normalizeComboTags(body?.tags || []);
  const comboType = normalizeComboType(body?.comboType || body?.type || "fixed_bundle");
  const stockMode = String(body?.stockMode || body?.stock_mode || "auto").trim();
  const stockQuantity = Math.max(Number(body?.stockQuantity || 0), 0);
  const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : true;
  const isVisible = body?.isVisible !== undefined ? Boolean(body.isVisible) : true;

  const startDate = body?.startDate ? new Date(body.startDate) : null;
  const endDate = body?.endDate ? new Date(body.endDate) : null;

  const segmentTargets = {
    segments: Array.isArray(body?.segmentTargets?.segments)
      ? body.segmentTargets.segments
      : Array.isArray(body?.segments)
        ? body.segments
        : [],
    categories: Array.isArray(body?.segmentTargets?.categories)
      ? body.segmentTargets.categories
      : Array.isArray(body?.segmentCategories)
        ? body.segmentCategories
        : [],
  };

  const payload = {
    name,
    slug,
    description: String(body?.description || "").trim(),
    image: String(body?.image || body?.banner || "").trim(),
    thumbnail: String(body?.thumbnail || "").trim(),
    items: snapshots,
    pricing: { type: pricingType, value: pricingValue },
    originalTotal: pricing.originalTotal,
    comboPrice: pricing.comboPrice,
    totalSavings: pricing.totalSavings,
    discountPercentage: pricing.discountPercentage,
    comboType,
    tags,
    priority: Number(body?.priority || 0),
    isActive,
    isVisible,
    startDate,
    endDate,
    geoTargets: normalizeGeoTargets(body?.geoTargets),
    stockMode: stockMode === "manual" ? "manual" : "auto",
    stockQuantity: stockMode === "manual" ? stockQuantity : 0,
    minOrderQuantity: Math.max(Number(body?.minOrderQuantity || 1), 1),
    maxPerOrder: Math.max(Number(body?.maxPerOrder || 0), 0),
    source: body?.source || existingCombo?.source || "admin",
    status: resolveComboStatus({ isActive, startDate, endDate, status: body?.status || existingCombo?.status }),
    segmentTargets,
    aiScore: Number(body?.aiScore || existingCombo?.aiScore || 0),
    generatedFrom: String(body?.generatedFrom || existingCombo?.generatedFrom || ""),
  };

  return { payload, items: snapshots };
};

export const getCombos = asyncHandler(async (req, res) => {
  const page = toPositiveInt(req.query.page, 1);
  const limit = Math.min(toPositiveInt(req.query.limit, 12), 50);
  const skip = (page - 1) * limit;

  const filter = buildActiveFilter();
  if (req.query.type) filter.comboType = String(req.query.type).trim();
  if (req.query.tag) filter.tags = normalizeComboTags([req.query.tag]);
  if (req.query.productId) filter["items.productId"] = req.query.productId;
  if (req.query.category) filter["items.categoryId"] = req.query.category;

  if (req.query.minDiscount) {
    filter.discountPercentage = { $gte: Number(req.query.minDiscount || 0) };
  }

  const sortKey = String(req.query.sort || "priority");
  const sortMap = {
    priority: { priority: -1, totalSavings: -1 },
    savings: { totalSavings: -1 },
    discount: { discountPercentage: -1 },
    newest: { createdAt: -1 },
  };
  const sort = sortMap[sortKey] || sortMap.priority;

  let combos = await ComboModel.find(filter).sort(sort).skip(skip).limit(limit).lean();

  if (req.query.segment || req.user) {
    const segmentInfo = await resolveUserSegment({ userId: req.user || null });
    const filtered = [];
    for (const combo of combos) {
      const categoryIds = (combo.items || []).map((item) => item.categoryId).filter(Boolean);
      if (isComboEligibleForSegment(combo, segmentInfo, categoryIds)) {
        filtered.push(combo);
      }
    }
    combos = filtered;
  }

  const total = await ComboModel.countDocuments(filter);
  const enriched = await attachComboAvailability(combos);

  return sendSuccess(res, {
    items: enriched,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  });
});

export const getComboById = asyncHandler(async (req, res) => {
  const combo = await ComboModel.findById(req.params.id).lean();
  if (!combo) {
    throw new AppError("NOT_FOUND", { field: "comboId" });
  }
  const availability = await computeComboAvailability(combo);
  return sendSuccess(res, { ...combo, availableStock: availability.available });
});

export const getComboBySlug = asyncHandler(async (req, res) => {
  const combo = await ComboModel.findOne({ slug: req.params.slug }).lean();
  if (!combo) {
    throw new AppError("NOT_FOUND", { field: "comboSlug" });
  }
  const availability = await computeComboAvailability(combo);
  return sendSuccess(res, { ...combo, availableStock: availability.available });
});

export const getComboSections = asyncHandler(async (req, res) => {
  const productId = String(req.query.productId || "").trim();
  if (!productId) {
    throw new AppError("MISSING_FIELD", { fieldName: "productId" });
  }
  const sections = await getComboSectionsForProduct(productId);
  return sendSuccess(res, sections);
});

export const getCartUpsells = asyncHandler(async (req, res) => {
  const cartItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const normalizedItems = cartItems
    .map((item) => ({
      productId: String(item?.productId || item?.product || "").trim(),
      variantId: String(item?.variantId || item?.variant || "").trim(),
    }))
    .filter((item) => item.productId);

  const suggestions = await getCartUpsellCombos(normalizedItems, { limit: 6 });
  return sendSuccess(res, { suggestions });
});

export const createCombo = asyncHandler(async (req, res) => {
  const { payload, items } = await parseComboPayload(req.body);

  const combo = await ComboModel.create({
    ...payload,
    createdBy: req.user || null,
    updatedBy: req.user || null,
  });

  await upsertComboItems(combo._id, items);

  return sendSuccess(res, combo, "Combo created", 201);
});

export const updateCombo = asyncHandler(async (req, res) => {
  const existing = await ComboModel.findById(req.params.id);
  if (!existing) {
    throw new AppError("NOT_FOUND", { field: "comboId" });
  }

  const { payload, items } = await parseComboPayload(req.body, { existingCombo: existing });

  Object.assign(existing, payload);
  existing.updatedBy = req.user || null;
  await existing.save();

  await upsertComboItems(existing._id, items);

  return sendSuccess(res, existing, "Combo updated");
});

export const deleteCombo = asyncHandler(async (req, res) => {
  const combo = await ComboModel.findById(req.params.id);
  if (!combo) {
    throw new AppError("NOT_FOUND", { field: "comboId" });
  }

  await ComboModel.deleteOne({ _id: combo._id });
  await ComboOrderModel.deleteMany({ comboId: combo._id });

  return sendSuccess(res, { deleted: true }, "Combo deleted");
});

export const duplicateCombo = asyncHandler(async (req, res) => {
  const combo = await ComboModel.findById(req.params.id).lean();
  if (!combo) {
    throw new AppError("NOT_FOUND", { field: "comboId" });
  }

  const baseSlug = slugify(`${combo.name}-copy`);
  const slug = await ensureUniqueSlug(baseSlug);

  const copy = await ComboModel.create({
    ...combo,
    _id: undefined,
    name: `${combo.name} (Copy)`,
    slug,
    status: "draft",
    isActive: false,
    createdAt: undefined,
    updatedAt: undefined,
    createdBy: req.user || null,
    updatedBy: req.user || null,
  });

  await upsertComboItems(copy._id, copy.items || []);

  return sendSuccess(res, copy, "Combo duplicated", 201);
});

export const toggleCombo = asyncHandler(async (req, res) => {
  const combo = await ComboModel.findById(req.params.id);
  if (!combo) {
    throw new AppError("NOT_FOUND", { field: "comboId" });
  }

  combo.isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : !combo.isActive;
  combo.isVisible = req.body?.isVisible !== undefined ? Boolean(req.body.isVisible) : combo.isVisible;
  combo.status = resolveComboStatus({
    isActive: combo.isActive,
    startDate: combo.startDate,
    endDate: combo.endDate,
    status: combo.status,
  });
  combo.updatedBy = req.user || null;

  await combo.save();
  return sendSuccess(res, combo, "Combo updated");
});

export const getAdminCombos = asyncHandler(async (req, res) => {
  const page = toPositiveInt(req.query.page, 1);
  const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.source) filter.source = req.query.source;
  if (req.query.type) filter.comboType = req.query.type;
  if (req.query.search) {
    const search = String(req.query.search).trim();
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
      ];
    }
  }

  const [total, combos] = await Promise.all([
    ComboModel.countDocuments(filter),
    ComboModel.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  return sendSuccess(res, {
    items: combos,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

export const generateComboSuggestions = asyncHandler(async (req, res) => {
  const limit = toPositiveInt(req.body?.limit, 8);
  const previewOnly = Boolean(req.body?.previewOnly);
  const pairLimit = Math.max(limit * 4, 20);

  const fetchPairs = async () =>
    FrequentlyBoughtTogetherModel.find({})
      .sort({ frequencyScore: -1, confidenceScore: -1 })
      .limit(pairLimit)
      .lean();

  let pairs = await fetchPairs();
  let refreshResult = null;

  if (pairs.length === 0) {
    try {
      refreshResult = await generateFrequentlyBoughtTogether();
      if (refreshResult?.pairs > 0) {
        pairs = await fetchPairs();
      }
    } catch (error) {
      refreshResult = { error: error?.message || String(error) };
    }
  }

  const suggestions = [];
  const seenSlugs = new Set();
  const productIds = pairs.flatMap((pair) => [
    String(pair.productId || ""),
    String(pair.relatedProductId || ""),
  ]);
  const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));
  const products = uniqueProductIds.length
    ? await ProductModel.find({ _id: { $in: uniqueProductIds }, isActive: true })
        .select("_id name price originalPrice images thumbnail category")
        .lean()
    : [];
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  for (const pair of pairs) {
    if (suggestions.length >= limit) break;

    const primaryProduct = productMap.get(String(pair.productId || ""));
    const secondaryProduct = productMap.get(String(pair.relatedProductId || ""));
    if (!primaryProduct || !secondaryProduct) continue;

    const items = [primaryProduct, secondaryProduct].map((product) => ({
      productId: String(product._id),
      quantity: 1,
    }));

    const { payload, items: snapshots } = await parseComboPayload(
      {
        name: `${primaryProduct.name} + ${secondaryProduct.name}`,
        items,
        pricingType: "percent_discount",
        pricingValue: 10,
        comboType: "ai_suggested",
        tags: ["recommended"],
        source: "ai",
        status: "draft",
      },
      undefined,
    );

    if (seenSlugs.has(payload.slug)) continue;
    const existing = await ComboModel.findOne({
      name: { $regex: `^${escapeRegex(payload.name)}$`, $options: "i" },
    })
      .select("_id")
      .lean();
    if (existing) continue;

    seenSlugs.add(payload.slug);

    if (previewOnly) {
      suggestions.push({
        ...payload,
        items: snapshots,
        aiScore: round2(pair.confidenceScore * 100),
        generatedFrom: "frequently_bought_together",
      });
      continue;
    }

    const combo = await ComboModel.create({
      ...payload,
      source: "ai",
      status: "draft",
      isActive: false,
      aiScore: round2(pair.confidenceScore * 100),
      generatedFrom: "frequently_bought_together",
    });

    await upsertComboItems(combo._id, snapshots);
    suggestions.push(combo);
  }

  if (previewOnly) {
    const previewMessage =
      suggestions.length > 0
        ? "AI combo preview ready"
        : "No AI suggestions available yet. Place a few orders to build pairings.";

    return sendSuccess(
      res,
      {
        suggestions,
        generated: suggestions.length,
        pairsEvaluated: pairs.length,
        refreshResult,
        preview: true,
      },
      previewMessage,
    );
  }

  const message =
    suggestions.length > 0
      ? "Combo suggestions generated"
      : "No AI suggestions available yet. Place a few orders to build pairings.";

  return sendSuccess(
    res,
    {
      suggestions,
      generated: suggestions.length,
      pairsEvaluated: pairs.length,
      refreshResult,
    },
    message,
  );
});

export const getComboAnalyticsDashboard = asyncHandler(async (req, res) => {
  const { from, to } = resolveRange(req.query);
  const report = await buildComboAnalyticsReport({ from, to });
  const charts = await buildComboAnalyticsCharts({ from, to });
  const heatmap = await buildComboPairingHeatmap({ limit: 20 });

  await refreshComboAnalyticsBuckets({ from, to, bucketLabel: "admin" });

  return sendSuccess(res, {
    range: { from, to },
    summary: report.summary,
    combos: report.rows,
    charts,
    heatmap,
  });
});

export const getComboOrderInsights = asyncHandler(async (req, res) => {
  const { from, to } = resolveRange(req.query);

  const pipeline = [
    { $match: { createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: "$comboId",
        revenue: { $sum: "$comboPrice" },
        purchases: { $sum: 1 },
        avgOrderTotal: { $avg: "$orderTotal" },
      },
    },
    { $sort: { revenue: -1 } },
  ];

  const rows = await ComboOrderModel.aggregate(pipeline);

  return sendSuccess(res, {
    range: { from, to },
    rows: rows.map((row) => ({
      comboId: String(row._id || ""),
      revenue: round2(row.revenue || 0),
      purchases: row.purchases || 0,
      avgOrderTotal: round2(row.avgOrderTotal || 0),
    })),
  });
});
