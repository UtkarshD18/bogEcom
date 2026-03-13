import mongoose from "mongoose";
import ComboModel from "../../models/combo.model.js";
import ComboItemModel from "../../models/comboItem.model.js";
import ProductModel from "../../models/product.model.js";
import { AppError } from "../../utils/errorHandler.js";

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const toObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const normalizeComboTag = (tag) =>
  String(tag || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

export const normalizeComboTags = (tags = []) => {
  if (!Array.isArray(tags)) return [];
  return tags
    .map(normalizeComboTag)
    .filter(Boolean)
    .slice(0, 12);
};

export const normalizeComboItemsPayload = (items = []) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      productId: String(item?.productId || item?.product || "").trim(),
      quantity: Math.max(Number(item?.quantity || 1), 1),
      variantId: String(item?.variantId || item?.variant || "").trim(),
      variantName: String(item?.variantName || "").trim(),
    }))
    .filter((item) => item.productId);
};

const resolveVariantFromProduct = (product, variantId) => {
  if (!product || !variantId) return null;
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  return (
    variants.find((variant) => String(variant?._id) === String(variantId)) || null
  );
};

const resolveProductPrices = (product, variant) => {
  if (variant) {
    const price = Number(variant?.price ?? product?.price ?? 0);
    const originalPrice = Number(
      variant?.originalPrice ?? product?.originalPrice ?? price,
    );
    return {
      price: round2(price),
      originalPrice: round2(originalPrice || price),
    };
  }

  const price = Number(product?.price ?? 0);
  const originalPrice = Number(product?.originalPrice ?? price);
  return {
    price: round2(price),
    originalPrice: round2(originalPrice || price),
  };
};

export const buildComboPricing = ({ items = [], pricing = {} } = {}) => {
  const originalTotal = round2(
    items.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0,
    ),
  );

  const pricingType = String(pricing?.type || "fixed_price").trim();
  const pricingValue = Math.max(Number(pricing?.value || 0), 0);

  let comboPrice = originalTotal;
  if (pricingType === "fixed_price") {
    comboPrice = pricingValue > 0 ? pricingValue : originalTotal;
  } else if (pricingType === "percent_discount") {
    comboPrice = round2(originalTotal * (1 - pricingValue / 100));
  } else if (pricingType === "fixed_discount") {
    comboPrice = round2(originalTotal - pricingValue);
  }

  comboPrice = Math.max(round2(comboPrice), 0);
  if (originalTotal > 0 && comboPrice > originalTotal) {
    comboPrice = originalTotal;
  }

  const totalSavings = round2(Math.max(originalTotal - comboPrice, 0));
  const discountPercentage =
    originalTotal > 0 ? round2((totalSavings / originalTotal) * 100) : 0;

  return {
    originalTotal,
    comboPrice,
    totalSavings,
    discountPercentage,
  };
};

export const buildComboItemsSnapshot = async ({ items = [] } = {}) => {
  const normalized = normalizeComboItemsPayload(items);
  if (normalized.length === 0) {
    throw new AppError("EMPTY_PRODUCTS", { fieldName: "comboItems" });
  }

  const productIds = normalized.map((item) => item.productId);
  const dbProducts = await ProductModel.find({ _id: { $in: productIds } })
    .select(
      "_id name price originalPrice images thumbnail category isActive hasVariants variants",
    )
    .lean();

  const productMap = new Map(dbProducts.map((product) => [String(product._id), product]));
  const missing = productIds.filter((id) => !productMap.has(String(id)));
  if (missing.length > 0) {
    throw new AppError("PRODUCT_NOT_FOUND", { missing });
  }

  const snapshots = normalized.map((item) => {
    const product = productMap.get(String(item.productId));
    if (!product || product.isActive === false) {
      throw new AppError("PRODUCT_NOT_FOUND", { productId: item.productId });
    }

    const variantId = item.variantId && item.variantId !== "undefined" && item.variantId !== "null"
      ? item.variantId
      : null;
    const variant = variantId ? resolveVariantFromProduct(product, variantId) : null;
    if (variantId && !variant) {
      throw new AppError("INVALID_INPUT", { field: "variantId", value: variantId });
    }

    const { price, originalPrice } = resolveProductPrices(product, variant);
    const image =
      variant?.image || product.thumbnail || product.images?.[0] || "";

    return {
      productId: product._id,
      productTitle: product.name || "Product",
      variantId: variant?._id || null,
      variantName: item.variantName || variant?.name || "",
      quantity: Math.max(Number(item.quantity || 1), 1),
      price,
      originalPrice,
      image,
      categoryId: product.category || null,
    };
  });

  return { snapshots, productMap };
};

export const computeComboAvailability = async (combo, productCache = null) => {
  if (!combo) return { available: 0, stockMode: "manual" };

  if (combo.stockMode === "manual") {
    const available = Math.max(
      Number(combo.stockQuantity || 0) - Number(combo.reservedQuantity || 0),
      0,
    );
    return { available, stockMode: "manual" };
  }

  const items = Array.isArray(combo.items) ? combo.items : [];
  if (items.length === 0) {
    return { available: 0, stockMode: "auto" };
  }

  const productIds = items.map((item) => String(item.productId || "")).filter(Boolean);
  const products = productCache
    ? productIds.map((id) => productCache.get(String(id))).filter(Boolean)
    : await ProductModel.find({ _id: { $in: productIds } })
        .select("_id stock stock_quantity reserved_quantity track_inventory trackInventory hasVariants variants")
        .lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const availablePerItem = items.map((item) => {
    const product = productMap.get(String(item.productId));
    if (!product) return 0;

    const trackInventory =
      typeof product.track_inventory === "boolean"
        ? product.track_inventory
        : typeof product.trackInventory === "boolean"
          ? product.trackInventory
          : true;
    if (!trackInventory) {
      return Number.MAX_SAFE_INTEGER;
    }

    let available = 0;
    if (item.variantId && product.hasVariants && Array.isArray(product.variants)) {
      const variant = product.variants.find(
        (v) => String(v?._id) === String(item.variantId),
      );
      if (!variant) return 0;
      const stock = Number(variant.stock_quantity ?? variant.stock ?? 0);
      const reserved = Number(variant.reserved_quantity ?? 0);
      available = Math.max(stock - reserved, 0);
    } else {
      const stock = Number(product.stock_quantity ?? product.stock ?? 0);
      const reserved = Number(product.reserved_quantity ?? 0);
      available = Math.max(stock - reserved, 0);
    }

    const perCombo = Math.floor(available / Math.max(Number(item.quantity || 1), 1));
    return perCombo;
  });

  const available = availablePerItem.length
    ? Math.max(Math.min(...availablePerItem), 0)
    : 0;

  return { available, stockMode: "auto" };
};

export const allocateTotalsProportionally = (baseTotals = [], targetTotal = 0) => {
  const originalSum = baseTotals.reduce((sum, value) => sum + Number(value || 0), 0);
  const normalizedTarget = round2(Math.max(Number(targetTotal || 0), 0));
  if (originalSum <= 0 || baseTotals.length === 0) {
    return baseTotals.map(() => 0);
  }

  let running = 0;
  const allocations = baseTotals.map((value, index) => {
    if (index === baseTotals.length - 1) {
      const remainder = round2(normalizedTarget - running);
      running = round2(running + remainder);
      return remainder;
    }

    const weight = Number(value || 0) / originalSum;
    const allocation = round2(normalizedTarget * weight);
    running = round2(running + allocation);
    return allocation;
  });

  return allocations;
};

export const expandComboToOrderProducts = (combo, quantity = 1) => {
  if (!combo) return [];
  const comboQty = Math.max(Number(quantity || 1), 1);
  const items = Array.isArray(combo.items) ? combo.items : [];

  return items.map((item, index) => {
    const lineQty = Math.max(Number(item.quantity || 1) * comboQty, 1);
    const unitPrice = round2(Number(item.price || 0));
    const subTotal = round2(unitPrice * lineQty);

    return {
      productId: String(item.productId || ""),
      comboId: String(combo._id || ""),
      comboName: combo.name || "Combo",
      comboSlug: combo.slug || "",
      comboType: combo.comboType || "",
      productTitle: item.productTitle || "Product",
      variantId: item.variantId ? String(item.variantId) : null,
      variantName: item.variantName || "",
      quantity: lineQty,
      price: unitPrice,
      image: item.image || "",
      subTotal,
    };
  });
};

export const buildComboOrderSnapshot = (combo, quantity = 1) => {
  if (!combo) return null;
  const comboQty = Math.max(Number(quantity || 1), 1);

  return {
    comboId: String(combo._id || ""),
    comboName: combo.name || "Combo",
    comboSlug: combo.slug || "",
    comboType: combo.comboType || "",
    quantity: comboQty,
    comboPrice: round2(Number(combo.comboPrice || 0)),
    originalPrice: round2(Number(combo.originalTotal || 0)),
    savings: round2(Number(combo.totalSavings || 0)),
    items: (combo.items || []).map((item) => ({
      productId: String(item.productId || ""),
      productTitle: item.productTitle || "Product",
      variantId: item.variantId ? String(item.variantId) : null,
      variantName: item.variantName || "",
      quantity: Math.max(Number(item.quantity || 1), 1),
      price: round2(Number(item.price || 0)),
      originalPrice: round2(Number(item.originalPrice || 0)),
      image: item.image || "",
    })),
  };
};

export const upsertComboItems = async (comboId, items = []) => {
  if (!comboId) return;
  const normalizedComboId = String(comboId);

  await ComboItemModel.deleteMany({ comboId: normalizedComboId });
  if (!Array.isArray(items) || items.length === 0) return;

  const docs = items.map((item) => ({
    comboId: comboId,
    productId: item.productId,
    productTitle: item.productTitle,
    variantId: item.variantId || null,
    variantName: item.variantName || "",
    quantity: item.quantity,
    price: item.price,
    originalPrice: item.originalPrice,
    image: item.image,
    categoryId: item.categoryId || null,
  }));

  await ComboItemModel.insertMany(docs);
};

export const resolveComboStatus = ({
  isActive,
  startDate,
  endDate,
  status,
}) => {
  const now = new Date();
  const normalizedStatus = String(status || "").trim().toLowerCase();

  if (normalizedStatus === "disabled") {
    return "disabled";
  }

  if (!isActive) {
    return "disabled";
  }

  if (startDate && new Date(startDate) > now) {
    return "scheduled";
  }

  if (endDate && new Date(endDate) < now) {
    return "disabled";
  }

  if (normalizedStatus === "draft") {
    return "draft";
  }

  return "active";
};

export const reserveComboStock = async (order, source = "ORDER_CREATE") => {
  if (!order || !Array.isArray(order.combos) || order.combos.length === 0) {
    return { status: "noop", reason: "no_combos" };
  }

  const applied = [];
  try {
    for (const combo of order.combos) {
      const comboId = combo?.comboId || combo?._id;
      if (!comboId) continue;
      const quantity = Math.max(Number(combo?.quantity || 1), 1);

      const filter = {
        _id: comboId,
        stockMode: "manual",
        $expr: {
          $gte: [
            { $subtract: ["$stockQuantity", "$reservedQuantity"] },
            quantity,
          ],
        },
      };

      const result = await ComboModel.updateOne(filter, {
        $inc: { reservedQuantity: quantity },
      });

      if (result.modifiedCount === 1) {
        applied.push({ comboId, quantity });
      } else {
        throw new AppError("INSUFFICIENT_STOCK", {
          comboId,
          source,
        });
      }
    }

    return { status: "reserved" };
  } catch (error) {
    if (applied.length > 0) {
      await releaseComboStock({ combos: applied });
    }
    throw error;
  }
};

export const confirmComboStock = async (order, source = "PAYMENT_SUCCESS") => {
  if (!order || !Array.isArray(order.combos) || order.combos.length === 0) {
    return { status: "noop", reason: "no_combos" };
  }

  for (const combo of order.combos) {
    const comboId = combo?.comboId || combo?._id;
    if (!comboId) continue;
    const quantity = Math.max(Number(combo?.quantity || 1), 1);

    await ComboModel.updateOne(
      { _id: comboId, stockMode: "manual" },
      {
        $inc: {
          stockQuantity: -quantity,
          reservedQuantity: -quantity,
        },
      },
    );
  }

  return { status: "deducted" };
};

export const releaseComboStock = async (order, source = "PAYMENT_FAILURE") => {
  const combos = Array.isArray(order?.combos) ? order.combos : [];
  if (combos.length === 0) return { status: "noop", reason: "no_combos" };

  for (const combo of combos) {
    const comboId = combo?.comboId || combo?._id;
    if (!comboId) continue;
    const quantity = Math.max(Number(combo?.quantity || 1), 1);

    await ComboModel.updateOne(
      { _id: comboId, stockMode: "manual" },
      { $inc: { reservedQuantity: -quantity } },
    );
  }

  return { status: "released" };
};

export const restoreComboStock = async (order, source = "ORDER_CANCELLED") => {
  const combos = Array.isArray(order?.combos) ? order.combos : [];
  if (combos.length === 0) return { status: "noop", reason: "no_combos" };

  for (const combo of combos) {
    const comboId = combo?.comboId || combo?._id;
    if (!comboId) continue;
    const quantity = Math.max(Number(combo?.quantity || 1), 1);

    await ComboModel.updateOne(
      { _id: comboId, stockMode: "manual" },
      { $inc: { stockQuantity: quantity } },
    );
  }

  return { status: "restored" };
};

export const evaluateComboEligibility = (combo, { now = new Date() } = {}) => {
  if (!combo) return { eligible: false, reason: "missing_combo" };
  if (combo.isActive === false) return { eligible: false, reason: "inactive" };
  if (combo.isVisible === false) return { eligible: false, reason: "hidden" };
  if (combo.startDate && new Date(combo.startDate) > now) {
    return { eligible: false, reason: "not_started" };
  }
  if (combo.endDate && new Date(combo.endDate) < now) {
    return { eligible: false, reason: "expired" };
  }
  return { eligible: true };
};

export const resolveUserSegment = async ({ userId = null, highValueThreshold = 5000 } = {}) => {
  if (!userId) {
    return { segment: "new", orderCount: 0, lifetimeSpend: 0 };
  }

  const OrderModel = (await import("../../models/order.model.js")).default;
  const orders = await OrderModel.aggregate([
    { $match: { user: toObjectId(userId) } },
    {
      $group: {
        _id: "$user",
        orderCount: { $sum: 1 },
        lifetimeSpend: {
          $sum: {
            $cond: [
              { $gt: ["$finalAmount", 0] },
              "$finalAmount",
              "$totalAmt",
            ],
          },
        },
      },
    },
  ]);

  const stats = orders[0] || { orderCount: 0, lifetimeSpend: 0 };
  let segment = "new";
  if (stats.orderCount > 0) segment = "returning";
  if (stats.lifetimeSpend >= highValueThreshold) segment = "high_value";

  return {
    segment,
    orderCount: stats.orderCount || 0,
    lifetimeSpend: round2(stats.lifetimeSpend || 0),
  };
};

export const isComboEligibleForSegment = (combo, segmentInfo, categoryIds = []) => {
  if (!combo) return false;
  const targets = combo.segmentTargets || {};
  const segments = Array.isArray(targets.segments) ? targets.segments : [];
  const categories = Array.isArray(targets.categories) ? targets.categories.map(String) : [];

  if (segments.length > 0) {
    if (!segmentInfo?.segment || !segments.includes(segmentInfo.segment)) {
      return false;
    }
  }

  if (categories.length > 0) {
    const matchesCategory = categoryIds.some((id) => categories.includes(String(id)));
    if (!matchesCategory) return false;
  }

  return true;
};

export const applyComboUpdates = async (comboId, updates = {}) => {
  const combo = await ComboModel.findById(comboId);
  if (!combo) {
    throw new AppError("NOT_FOUND", { field: "comboId" });
  }

  Object.assign(combo, updates);
  combo.status = resolveComboStatus({
    isActive: combo.isActive,
    startDate: combo.startDate,
    endDate: combo.endDate,
    status: combo.status,
  });

  await combo.save();
  return combo;
};

export const attachComboAvailability = async (combos = []) => {
  if (!Array.isArray(combos) || combos.length === 0) return [];

  const items = combos.flatMap((combo) => combo.items || []);
  const productIds = items.map((item) => String(item.productId || "")).filter(Boolean);
  const products = productIds.length
    ? await ProductModel.find({ _id: { $in: productIds } })
        .select("_id stock stock_quantity reserved_quantity track_inventory trackInventory hasVariants variants")
        .lean()
    : [];
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  return Promise.all(
    combos.map(async (combo) => {
      const availability = await computeComboAvailability(combo, productMap);
      return {
        ...combo,
        availableStock: availability.available,
        stockMode: availability.stockMode,
      };
    }),
  );
};
