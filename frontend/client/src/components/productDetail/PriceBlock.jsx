"use client";

import { formatPrice } from "@/config/siteConfig";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const PriceBlock = ({ finalPrice = 0, originalPrice = 0, discount = 0 }) => {
  const safeFinal = toNumber(finalPrice, 0);
  const safeOriginal = toNumber(originalPrice, 0);
  const safeDiscount = Math.max(toNumber(discount, 0), 0);

  return (
    <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6 flex-wrap">
      <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">
        {formatPrice(safeFinal)}
      </span>
      {safeOriginal > safeFinal && (
        <span className="text-lg sm:text-xl text-gray-400 line-through">
          {formatPrice(safeOriginal)}
        </span>
      )}
      {safeDiscount > 0 && safeOriginal > safeFinal && (
        <span className="text-sm font-bold text-primary bg-[var(--flavor-glass)] px-2 py-1 rounded">
          Save {formatPrice(safeOriginal - safeFinal)}
        </span>
      )}
    </div>
  );
};

export default PriceBlock;