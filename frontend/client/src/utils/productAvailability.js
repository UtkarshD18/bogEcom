"use client";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const isInventoryTracked = (entry, fallbackEntry = null) => {
  const source = entry || fallbackEntry || {};
  if (source?.track_inventory === false || source?.trackInventory === false) {
    return false;
  }
  return true;
};

export const resolveAvailability = (entry, fallbackEntry = null) => {
  const source = entry || fallbackEntry || {};
  const tracked = isInventoryTracked(entry, fallbackEntry);
  const explicitAvailable = [
    source?.available_quantity,
    source?.available_stock,
    source?.availableStock,
  ]
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value));
  const stock = toNumber(source?.stock_quantity ?? source?.stock, 0);
  const reserved = toNumber(source?.reserved_quantity, 0);
  const available = tracked
    ? Number.isFinite(explicitAvailable)
      ? Math.max(explicitAvailable, 0)
      : Math.max(stock - reserved, 0)
    : Number.MAX_SAFE_INTEGER;

  return {
    tracked,
    stock,
    reserved,
    available,
  };
};

export const isProductOutOfStock = (product) => {
  const productData = product || {};
  const isComboItem = String(productData?.itemType || "product").toLowerCase() === "combo";
  const defaultVariant =
    productData?.hasVariants && Array.isArray(productData?.variants) && productData.variants.length > 0
      ? productData.variants[0]
      : null;
  const isVariantCard = Boolean(productData?.variantId);
  const availability = isComboItem
    ? resolveAvailability(productData)
    : isVariantCard
      ? resolveAvailability(defaultVariant, productData)
      : resolveAvailability(productData);

  return availability.tracked && availability.available <= 0;
};
