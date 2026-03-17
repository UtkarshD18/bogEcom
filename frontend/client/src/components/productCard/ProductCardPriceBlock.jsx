"use client";

import { formatPrice } from "@/config/siteConfig";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const ProductCardPriceBlock = ({
  originalPrice = 0,
  finalPrice = 0,
  savings = 0,
}) => {
  const safeOriginalPrice = toNumber(originalPrice, 0);
  const safeFinalPrice = toNumber(finalPrice, 0);
  const safeSavings = toNumber(savings, 0);

  return (
    <div>
      {safeOriginalPrice > safeFinalPrice && (
        <span className="block text-[10px] font-medium text-gray-400 line-through">
          {formatPrice(safeOriginalPrice)}
        </span>
      )}
      <span className="block text-lg font-bold text-primary">
        {formatPrice(safeFinalPrice)}
      </span>
      {safeSavings > 0 && (
        <span className="block text-[10px] font-medium text-emerald-600">
          Save {formatPrice(safeSavings)}
        </span>
      )}
    </div>
  );
};

export default ProductCardPriceBlock;