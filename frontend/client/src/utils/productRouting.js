const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const toTrimmedString = (value) => String(value || "").trim();

const pickFirstString = (...values) => {
  for (const value of values) {
    const normalized = toTrimmedString(value);
    if (normalized) return normalized;
  }
  return "";
};

export const parseCompositeProductRouteId = (value) => {
  const rawId = toTrimmedString(value);
  if (!rawId) {
    return {
      rawId: "",
      lookupId: "",
      variantId: "",
      isComposite: false,
    };
  }

  const parts = rawId.split("-");
  if (
    parts.length === 2 &&
    OBJECT_ID_PATTERN.test(parts[0]) &&
    OBJECT_ID_PATTERN.test(parts[1])
  ) {
    return {
      rawId,
      lookupId: parts[0],
      variantId: parts[1],
      isComposite: true,
    };
  }

  return {
    rawId,
    lookupId: rawId,
    variantId: "",
    isComposite: false,
  };
};

export const getPublicProductIdentifier = (value, fallbackId = "") => {
  if (value && typeof value === "object") {
    return pickFirstString(
      value?.slug,
      value?.parentProductSlug,
      value?.parentSlug,
      value?.parentProductId,
      value?._id,
      value?.id,
      fallbackId,
    );
  }

  const parsed = parseCompositeProductRouteId(value);
  return pickFirstString(parsed.lookupId, fallbackId);
};

export const getProductVariantIdentifier = (value, fallbackVariantId = "") => {
  if (value && typeof value === "object") {
    return pickFirstString(
      fallbackVariantId,
      value?.variantId,
      value?.selectedVariant?._id,
      value?.selectedVariant?.id,
    );
  }

  return pickFirstString(fallbackVariantId);
};

export const buildProductHref = (
  value,
  {
    variantId = "",
    fallbackId = "",
    fallbackHref = "/products",
  } = {},
) => {
  const identifier = getPublicProductIdentifier(value, fallbackId);
  if (!identifier) return fallbackHref;

  const resolvedVariantId = getProductVariantIdentifier(value, variantId);
  const baseHref = `/product/${encodeURIComponent(identifier)}`;

  return resolvedVariantId
    ? `${baseHref}?variantId=${encodeURIComponent(resolvedVariantId)}`
    : baseHref;
};
