const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isInventoryTracked = (product) => {
  if (!product) return true;
  if (typeof product.track_inventory === "boolean") return product.track_inventory;
  if (typeof product.trackInventory === "boolean") return product.trackInventory;
  return true;
};

const resolveLowStockThreshold = (product) => {
  const threshold = toFiniteNumber(
    product?.low_stock_threshold ?? product?.lowStockThreshold,
    5,
  );
  return Math.max(threshold, 0);
};

const getAvailableFromVariant = (variant) => {
  const stock = toFiniteNumber(variant?.stock_quantity ?? variant?.stock, 0);
  const reserved = toFiniteNumber(variant?.reserved_quantity, 0);
  return Math.max(stock - reserved, 0);
};

const getAvailableFromProduct = (product) => {
  const stock = toFiniteNumber(product?.stock_quantity ?? product?.stock, 0);
  const reserved = toFiniteNumber(product?.reserved_quantity, 0);
  return Math.max(stock - reserved, 0);
};

export const calculateLowStockSummary = (product) => {
  if (!isInventoryTracked(product)) {
    return {
      availableStock: null,
      isLowStock: false,
      threshold: resolveLowStockThreshold(product),
    };
  }

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const threshold = resolveLowStockThreshold(product);

  if (variants.length > 0) {
    const availableStock = variants.reduce(
      (sum, variant) => sum + getAvailableFromVariant(variant),
      0,
    );
    const isLowStock = variants.some(
      (variant) => getAvailableFromVariant(variant) <= threshold,
    );
    return {
      availableStock,
      isLowStock,
      threshold,
    };
  }

  const availableStock = getAvailableFromProduct(product);
  return {
    availableStock,
    isLowStock: availableStock <= threshold,
    threshold,
  };
};

const normalizeNullableNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getLowStockSummaryUpdate = (product, now = new Date()) => {
  if (!product?._id) return null;
  const summary = calculateLowStockSummary(product);
  const currentAvailable = normalizeNullableNumber(product?.availableStock);
  const nextAvailable = normalizeNullableNumber(summary.availableStock);
  const currentLowStock = Boolean(product?.isLowStock);

  if (currentAvailable === nextAvailable && currentLowStock === summary.isLowStock) {
    return null;
  }

  return {
    summary,
    update: {
      $set: {
        availableStock: nextAvailable,
        isLowStock: summary.isLowStock,
        lowStockUpdatedAt: now,
      },
    },
  };
};
