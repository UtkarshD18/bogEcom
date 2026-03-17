"use client";

import ProductItem from "@/components/ProductItem";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isImageCandidate = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized || /\s/.test(normalized)) return false;
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("res.cloudinary.com/") ||
    normalized.startsWith("/uploads/") ||
    normalized.startsWith("uploads/") ||
    normalized.startsWith("data:image/")
  );
};

const FALLBACK_COMBO_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='480' viewBox='0 0 480 480'%3E%3Crect width='480' height='480' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='Arial,sans-serif' font-size='28'%3ECombo%20Image%3C/text%3E%3C/svg%3E";

const resolveComboImage = (combo) => {
  const comboImages = Array.isArray(combo?.images)
    ? combo.images
    : Array.isArray(combo?.comboImages)
      ? combo.comboImages
      : Array.isArray(combo?.combo_images)
        ? combo.combo_images
        : [];

  const itemImage = (Array.isArray(combo?.items) ? combo.items : [])
    .map((item) => item?.image)
    .find((entry) => isImageCandidate(entry));

  const candidate = [
    comboImages[0],
    combo?.comboThumbnail,
    combo?.combo_thumbnail,
    combo?.thumbnail,
    combo?.image,
    itemImage,
  ].find((entry) => isImageCandidate(entry));

  if (candidate?.startsWith("res.cloudinary.com/")) {
    return `https://${candidate}`;
  }
  return candidate || FALLBACK_COMBO_IMAGE;
};

const resolveDiscount = (combo, originalPrice, finalPrice) => {
  const explicitDiscount = toNumber(combo?.discountPercentage, 0);
  if (explicitDiscount > 0) return explicitDiscount;
  if (originalPrice > 0 && finalPrice < originalPrice) {
    return Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
  }
  return 0;
};

const mapComboToProductCard = (combo) => {
  const id = combo?._id || combo?.id || "";
  const name = String(combo?.name || "").trim() || "Untitled Combo";
  const shortDescription = String(combo?.shortDescription || "").trim();
  const normalizedName = name.toLowerCase();
  const normalizedDescription = shortDescription.toLowerCase();
  const finalPrice = toNumber(combo?.finalPrice ?? combo?.comboPrice ?? combo?.price, 0);
  const originalPrice = toNumber(combo?.originalPrice ?? combo?.originalTotal, 0);

  return {
    id,
    _id: id,
    name,
    image: resolveComboImage(combo),
    price: finalPrice,
    originalPrice,
    discount: resolveDiscount(combo, originalPrice, finalPrice),
    rating: toNumber(combo?.rating ?? combo?.adminStarRating, 0),
    reviewCount: toNumber(combo?.reviewCount, 0),
    shortDescription:
      normalizedDescription && normalizedDescription !== normalizedName
        ? shortDescription
        : "",
    isBestSeller: Boolean(combo?.isBestSeller),
    isFeatured: Boolean(combo?.isFeatured),
    isHighDemand:
      Boolean(combo?.isHighDemand) || String(combo?.demandStatus || "").toUpperCase() === "HIGH",
    availableStock: toNumber(combo?.availableStock ?? combo?.stockQuantity ?? 0, 0),
    stock: toNumber(combo?.availableStock ?? combo?.stockQuantity ?? 0, 0),
    brand: String(combo?.brand || "").trim() || "Buy One Gram",
    images: [resolveComboImage(combo)],
    itemType: "combo",
    comboId: id,
    items: Array.isArray(combo?.items) ? combo.items : [],
  };
};

const ComboCard = ({ combo }) => {
  const mapped = mapComboToProductCard(combo || {});
  return <ProductItem product={mapped} itemType="combo" />;
};

export default ComboCard;
