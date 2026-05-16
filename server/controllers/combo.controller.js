import ComboModel from "../models/combo.model.js";
import ComboDraftModel from "../models/comboDraft.model.js";
import ComboOrderModel from "../models/comboOrder.model.js";
import {
  applyComboUpdates,
  attachComboAvailability,
  buildComboItemsSnapshot,
  buildComboPricing,
  buildComboSkuFromItems,
  computeComboAvailability,
  isComboEligibleForSegment,
  normalizeComboItemsPayload,
  normalizeComboPricingFields,
  normalizeComboTags,
  resolveComboStatus,
  resolveUserSegment,
  upsertComboItems,
} from "../services/combos/combo.service.js";
import {
  buildComboAnalyticsCharts,
  buildComboAnalyticsReport,
  buildComboPairingHeatmap,
  refreshComboAnalyticsBuckets,
  resolveRange,
} from "../services/combos/comboAnalytics.service.js";
import { generateComboDrafts } from "../services/combos/comboDraft.service.js";
import {
  getCartUpsellCombos,
  getCartUpsellProductSuggestion,
  getComboSectionsForProduct,
} from "../services/combos/comboRecommendation.service.js";
import { invalidatePublicResponseCache } from "../middlewares/publicResponseCache.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/errorHandler.js";
import { normalizeProductPageConfig } from "../utils/productPageConfig.js";

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const COMBO_RESPONSE_CACHE_NAMESPACES = ["combos", "products"];

const roundCurrency = (value) => Math.max(Math.round(Number(value || 0)), 0);

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
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
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
    .filter(
      (target) =>
        target &&
        (target.country || target.state || target.city || target.pincode),
    );
};

const normalizeNonNegativeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const buildActiveFilter = () => {
  const now = new Date();
  return {
    isActive: { $ne: false },
    isVisible: { $ne: false },
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

const normalizeDraftItems = (draft) => {
  const items = Array.isArray(draft?.productsIncluded)
    ? draft.productsIncluded
    : [];
  return items.map((item) => ({
    productId: String(item?.productId || item?.product || "").trim(),
    quantity: Math.max(Number(item?.quantity || 1), 1),
    variantId: String(item?.variantId || item?.variant || "").trim(),
    variantName: String(item?.variantName || "").trim(),
  }));
};

const resolveDraftName = (draft, items = []) => {
  const name = String(draft?.name || "").trim();
  if (name) return name;
  if (items.length >= 2) {
    return "AI Combo Draft";
  }
  return "AI Combo";
};

const buildComboPayloadFromDraft = async (draft) => {
  const items = normalizeDraftItems(draft);
  if (items.length === 0) {
    throw new AppError("EMPTY_PRODUCTS", { fieldName: "items" });
  }

  const pricingType = String(draft?.pricingType || "percent_discount").trim();
  const pricingValue = Number(
    draft?.pricingValue ?? draft?.discountPercentage ?? 0,
  );

  const { payload, items: snapshots } = await parseComboPayload(
    {
      name: resolveDraftName(draft, items),
      items,
      pricingType,
      pricingValue,
      comboType: "ai_suggested",
      tags: Array.isArray(draft?.tags) ? draft.tags : ["recommended"],
      source: "ai",
      status: "draft",
    },
    undefined,
  );

  return {
    payload: {
      ...payload,
      aiScore: Number(draft?.aiScore || 0),
      generatedFrom: String(draft?.generatedFrom || "order_history"),
      source: "ai",
      status: "draft",
      isActive: false,
      isVisible: false,
    },
    snapshots,
  };
};

const parseComboPayload = async (body = {}, { existingCombo = null } = {}) => {
  const name = String(body?.name || body?.comboName || "").trim();
  if (!name) {
    throw new AppError("MISSING_FIELD", { fieldName: "name" });
  }

  const slugCandidate =
    slugify(String(body?.slug || "").trim()) || slugify(name);
  const slug = await ensureUniqueSlug(
    slugCandidate,
    existingCombo?._id || null,
  );

  const itemsPayload = normalizeComboItemsPayload(
    body?.items || body?.products || [],
  );
  if (itemsPayload.length === 0) {
    throw new AppError("EMPTY_PRODUCTS", { fieldName: "items" });
  }

  const pricingType = String(
    body?.pricingType || body?.pricing?.type || "fixed_price",
  )
    .trim()
    .toLowerCase();
  const pricingValue = Math.max(
    Number(body?.pricingValue ?? body?.pricing?.value ?? 0),
    0,
  );

  const { snapshots } = await buildComboItemsSnapshot({ items: itemsPayload });
  const calculatedPricing = buildComboPricing({
    items: snapshots,
    pricing: { type: pricingType, value: pricingValue },
  });
  const baseTotal = round2(
    snapshots.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0,
    ),
  );

  const manualOriginalPrice = normalizeNonNegativeNumber(
    body?.originalPrice ?? body?.mrp,
    0,
  );
  const manualComboPrice = normalizeNonNegativeNumber(
    body?.comboPrice ?? body?.price,
    0,
  );
  const manualComboPriceDiffersFromRule =
    Math.abs(manualComboPrice - Number(calculatedPricing.comboPrice || 0)) >
    0.01;
  const shouldUseManualComboPrice =
    pricingType !== "fixed_price" &&
    manualComboPrice > 0 &&
    manualComboPriceDiffersFromRule;
  const rawComboType = normalizeComboType(
    body?.comboType || body?.type || existingCombo?.comboType || "fixed_bundle",
  );
  const shouldRoundAiComboPrice =
    rawComboType === "ai_suggested" ||
    String(body?.source || existingCombo?.source || "")
      .trim()
      .toLowerCase() === "ai";

  let originalTotal = round2(
    manualOriginalPrice > 0
      ? manualOriginalPrice
      : calculatedPricing.originalTotal,
  );
  let comboPrice = round2(
    shouldUseManualComboPrice ? manualComboPrice : calculatedPricing.comboPrice,
  );

  if (originalTotal <= 0) {
    originalTotal = round2(calculatedPricing.originalTotal);
  }
  const maxAllowedComboPrice = baseTotal > 0 ? baseTotal : originalTotal;
  if (maxAllowedComboPrice > 0 && comboPrice > maxAllowedComboPrice) {
    comboPrice = maxAllowedComboPrice;
  }
  comboPrice = Math.max(comboPrice, 0);
  if (shouldRoundAiComboPrice) {
    comboPrice =
      maxAllowedComboPrice > 0
        ? Math.min(roundCurrency(comboPrice), maxAllowedComboPrice)
        : roundCurrency(comboPrice);
  }

  const savingsReferenceTotal = baseTotal > 0 ? baseTotal : originalTotal;
  const totalSavings = round2(Math.max(savingsReferenceTotal - comboPrice, 0));
  const discountPercentage =
    savingsReferenceTotal > 0
      ? round2((totalSavings / savingsReferenceTotal) * 100)
      : 0;
  const persistedPricingType = shouldUseManualComboPrice
    ? "fixed_price"
    : pricingType;
  const normalizedPricingValue =
    persistedPricingType === "fixed_price" ? comboPrice : pricingValue;

  const tags = normalizeComboTags(body?.tags || []);
  const comboType = rawComboType;
  const stockMode = String(
    body?.stockMode || body?.stock_mode || "auto",
  ).trim();
  const stockQuantity = Math.max(Number(body?.stockQuantity || 0), 0);
  const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : true;
  const isVisible =
    body?.isVisible !== undefined ? Boolean(body.isVisible) : true;

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

  const comboImages = Array.isArray(body?.comboImages || body?.combo_images)
    ? (body?.comboImages || body?.combo_images)
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];

  const comboThumbnail = String(
    body?.comboThumbnail ||
      body?.combo_thumbnail ||
      body?.thumbnail ||
      existingCombo?.comboThumbnail ||
      existingCombo?.thumbnail ||
      comboImages[0] ||
      "",
  ).trim();

  const comboImage = String(
    body?.image ||
      body?.banner ||
      existingCombo?.image ||
      comboImages[0] ||
      comboThumbnail ||
      "",
  ).trim();

  const adminStarRating = Math.max(
    Math.min(
      Number(
        body?.adminStarRating ??
          body?.rating ??
          existingCombo?.adminStarRating ??
          0,
      ),
      5,
    ),
    0,
  );

  const comboSkuInput = String(body?.sku || "")
    .trim()
    .toUpperCase();
  const comboSku = comboSkuInput || buildComboSkuFromItems(snapshots);

  const payload = {
    name,
    slug,
    description: String(body?.description || "").trim(),
    shortDescription: String(
      body?.shortDescription || body?.short_description || "",
    ).trim(),
    brand: String(body?.brand || existingCombo?.brand || "").trim(),
    category: String(
      body?.category || body?.categoryName || existingCombo?.category || "",
    ).trim(),
    reviewCount: Math.max(
      Number(body?.reviewCount ?? existingCombo?.reviewCount ?? 0),
      0,
    ),
    image: comboImage,
    thumbnail: comboThumbnail,
    comboImages,
    comboThumbnail,
    sku: comboSku,
    items: snapshots,
    pricing: { type: persistedPricingType, value: normalizedPricingValue },
    originalTotal,
    originalPrice: originalTotal,
    comboPrice,
    price: comboPrice,
    totalSavings,
    discountPercentage,
    comboType,
    tags,
    priority: Number(body?.priority || 0),
    isActive,
    isVisible,
    isFeatured: Boolean(body?.isFeatured ?? existingCombo?.isFeatured ?? false),
    isBestSeller: Boolean(
      body?.isBestSeller ?? existingCombo?.isBestSeller ?? false,
    ),
    isExclusive: Boolean(
      body?.isExclusive ??
      body?.isMembersExclusive ??
      existingCombo?.isExclusive ??
      false,
    ),
    demandStatus:
      String(
        body?.demandStatus ||
          body?.isHighDemand ||
          existingCombo?.demandStatus ||
          "NORMAL",
      )
        .trim()
        .toUpperCase() === "HIGH"
        ? "HIGH"
        : "NORMAL",
    rating: adminStarRating,
    adminStarRating,
    startDate,
    endDate,
    geoTargets: normalizeGeoTargets(body?.geoTargets),
    stockMode: stockMode === "manual" ? "manual" : "auto",
    stockQuantity: stockMode === "manual" ? stockQuantity : 0,
    minOrderQuantity: Math.max(Number(body?.minOrderQuantity || 1), 1),
    maxPerOrder: Math.max(Number(body?.maxPerOrder || 0), 0),
    source: body?.source || existingCombo?.source || "admin",
    status: resolveComboStatus({
      isActive,
      startDate,
      endDate,
      status: body?.status || existingCombo?.status,
    }),
    segmentTargets,
    aiScore: Number(body?.aiScore || existingCombo?.aiScore || 0),
    generatedFrom: String(
      body?.generatedFrom || existingCombo?.generatedFrom || "",
    ),
    productPage: normalizeProductPageConfig(
      body?.productPage || existingCombo?.productPage || {},
    ),
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

  let combos = await ComboModel.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  if (req.query.segment || req.user) {
    const segmentInfo = await resolveUserSegment({ userId: req.user || null });
    const filtered = [];
    for (const combo of combos) {
      const categoryIds = (combo.items || [])
        .map((item) => item.categoryId)
        .filter(Boolean);
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
  const normalizedCombo = normalizeComboPricingFields(combo);
  const availability = await computeComboAvailability(combo);
  return sendSuccess(res, {
    ...normalizedCombo,
    availableStock: availability.available,
    availability,
    outOfStockItems: availability.outOfStockItems || [],
  });
});

export const getComboBySlug = asyncHandler(async (req, res) => {
  const combo = await ComboModel.findOne({ slug: req.params.slug }).lean();
  if (!combo) {
    throw new AppError("NOT_FOUND", { field: "comboSlug" });
  }
  const normalizedCombo = normalizeComboPricingFields(combo);
  const availability = await computeComboAvailability(combo);
  return sendSuccess(res, {
    ...normalizedCombo,
    availableStock: availability.available,
    availability,
    outOfStockItems: availability.outOfStockItems || [],
  });
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
      variantName: String(item?.variantName || "").trim(),
    }))
    .filter((item) => item.productId);

  const [suggestions, productSuggestion] = await Promise.all([
    getCartUpsellCombos(normalizedItems, { limit: 6 }),
    getCartUpsellProductSuggestion(normalizedItems, { limit: 1 }),
  ]);

  return sendSuccess(res, { suggestions, productSuggestion });
});

export const createCombo = asyncHandler(async (req, res) => {
  const { payload, items } = await parseComboPayload(req.body);

  const combo = await ComboModel.create({
    ...payload,
    createdBy: req.user || null,
    updatedBy: req.user || null,
  });

  await upsertComboItems(combo._id, items);
  await invalidatePublicResponseCache(COMBO_RESPONSE_CACHE_NAMESPACES);

  return sendSuccess(res, combo, "Combo created", 201);
});

export const updateCombo = asyncHandler(async (req, res) => {
  const existing = await ComboModel.findById(req.params.id);
  if (!existing) {
    throw new AppError("NOT_FOUND", { field: "comboId" });
  }

  const { payload, items } = await parseComboPayload(req.body, {
    existingCombo: existing,
  });

  Object.assign(existing, payload);
  existing.updatedBy = req.user || null;
  await existing.save();

  await upsertComboItems(existing._id, items);
  await invalidatePublicResponseCache(COMBO_RESPONSE_CACHE_NAMESPACES);

  return sendSuccess(res, existing, "Combo updated");
});

export const deleteCombo = asyncHandler(async (req, res) => {
  const combo = await ComboModel.findById(req.params.id);
  if (!combo) {
    throw new AppError("NOT_FOUND", { field: "comboId" });
  }

  await ComboModel.deleteOne({ _id: combo._id });
  await ComboOrderModel.deleteMany({ comboId: combo._id });
  await invalidatePublicResponseCache(COMBO_RESPONSE_CACHE_NAMESPACES);

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

  combo.isActive =
    req.body?.isActive !== undefined
      ? Boolean(req.body.isActive)
      : !combo.isActive;
  combo.isVisible =
    req.body?.isVisible !== undefined
      ? Boolean(req.body.isVisible)
      : combo.isVisible;
  combo.status = resolveComboStatus({
    isActive: combo.isActive,
    startDate: combo.startDate,
    endDate: combo.endDate,
    status: combo.status,
  });
  combo.updatedBy = req.user || null;

  await combo.save();
  await invalidatePublicResponseCache(COMBO_RESPONSE_CACHE_NAMESPACES);
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
    ComboModel.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return sendSuccess(res, {
    items: combos.map((combo) => normalizeComboPricingFields(combo)),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

export const generateComboSuggestions = asyncHandler(async (req, res) => {
  const limit = toPositiveInt(req.body?.limit, 8);
  const previewOnly = Boolean(req.body?.previewOnly);
  const result = await generateComboDrafts({
    limit,
    previewOnly,
    refreshIfEmpty: true,
  });

  const suggestions = Array.isArray(result?.suggestions)
    ? result.suggestions.map((draft) => ({
        ...draft,
        items: draft.itemsSnapshot || draft.items || [],
      }))
    : [];

  const message =
    suggestions.length > 0
      ? previewOnly
        ? "AI combo preview ready"
        : "Combo draft suggestions generated"
      : "No AI suggestions available yet. Place a few orders to build pairings.";

  return sendSuccess(
    res,
    {
      suggestions,
      generated: suggestions.length,
      pairsEvaluated: result?.pairsEvaluated || 0,
      refreshResult: result?.refreshResult || null,
      preview: previewOnly,
    },
    message,
  );
});

export const getComboDrafts = asyncHandler(async (req, res) => {
  const status = String(req.query.status || "").trim();
  const filter = status ? { status } : {};
  const drafts = await ComboDraftModel.find(filter)
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  return sendSuccess(res, {
    items: drafts.map((draft) => ({
      ...draft,
      items: draft.itemsSnapshot || [],
    })),
  });
});

export const updateComboDraft = asyncHandler(async (req, res) => {
  const draft = await ComboDraftModel.findById(req.params.id);
  if (!draft) {
    throw new AppError("NOT_FOUND", { field: "comboDraftId" });
  }

  const name = req.body?.name;
  const pricingType = req.body?.pricingType;
  const pricingValue = req.body?.pricingValue;
  const discountPercentage = req.body?.discountPercentage;
  const suggestedPrice = req.body?.suggestedPrice;

  if (name !== undefined) {
    draft.name = String(name || "").trim();
  }
  if (pricingType) {
    draft.pricingType = String(pricingType).trim();
  }
  if (pricingValue !== undefined) {
    draft.pricingValue = Number(pricingValue || 0);
  }
  if (discountPercentage !== undefined) {
    draft.discountPercentage = Number(discountPercentage || 0);
  }
  if (suggestedPrice !== undefined) {
    draft.suggestedPrice = Number(suggestedPrice || 0);
  }
  draft.lastUpdated = new Date();
  await draft.save();

  return sendSuccess(res, {
    ...draft.toObject(),
    items: draft.itemsSnapshot || [],
  });
});

export const approveComboDraft = asyncHandler(async (req, res) => {
  const draft = await ComboDraftModel.findById(req.params.id);
  if (!draft) {
    throw new AppError("NOT_FOUND", { field: "comboDraftId" });
  }

  if (draft.comboId) {
    draft.status = "approved";
    draft.lastUpdated = new Date();
    await draft.save();
    const combo = await ComboModel.findById(draft.comboId).lean();
    return sendSuccess(res, { draft, combo }, "Combo draft approved");
  }

  const { payload, snapshots } = await buildComboPayloadFromDraft(draft);
  const combo = await ComboModel.create({
    ...payload,
    createdBy: req.user || null,
    updatedBy: req.user || null,
  });
  await upsertComboItems(combo._id, snapshots);

  draft.status = "approved";
  draft.comboId = combo._id;
  draft.lastUpdated = new Date();
  await draft.save();

  return sendSuccess(res, { draft, combo }, "Combo draft approved");
});

export const publishComboDraft = asyncHandler(async (req, res) => {
  const draft = await ComboDraftModel.findById(req.params.id);
  if (!draft) {
    throw new AppError("NOT_FOUND", { field: "comboDraftId" });
  }

  let combo = null;
  if (!draft.comboId) {
    const { payload, snapshots } = await buildComboPayloadFromDraft(draft);
    combo = await ComboModel.create({
      ...payload,
      createdBy: req.user || null,
      updatedBy: req.user || null,
    });
    await upsertComboItems(combo._id, snapshots);
    draft.comboId = combo._id;
  } else {
    combo = await applyComboUpdates(draft.comboId, {
      isActive: true,
      isVisible: true,
      status: "active",
    });
  }

  if (combo && combo.isActive === false) {
    combo = await applyComboUpdates(combo._id, {
      isActive: true,
      isVisible: true,
      status: "active",
    });
  }

  draft.status = "approved";
  draft.lastUpdated = new Date();
  await draft.save();
  await invalidatePublicResponseCache(COMBO_RESPONSE_CACHE_NAMESPACES);

  return sendSuccess(res, { draft, combo }, "Combo published");
});

export const rejectComboDraft = asyncHandler(async (req, res) => {
  const draft = await ComboDraftModel.findById(req.params.id);
  if (!draft) {
    throw new AppError("NOT_FOUND", { field: "comboDraftId" });
  }
  draft.status = "rejected";
  draft.lastUpdated = new Date();
  await draft.save();
  return sendSuccess(res, draft, "Combo draft rejected");
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
