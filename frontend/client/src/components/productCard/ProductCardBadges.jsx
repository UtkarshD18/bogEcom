"use client";

const ProductCardBadges = ({
  isBestSeller = false,
  showDiscountBadge = false,
  discountLabel = "",
  isExclusive = false,
}) => {
  return (
    <>
      {isBestSeller && (
        <span className="absolute -left-8 top-4 z-20 -rotate-45 bg-red-600 px-8 py-1 text-[9px] font-extrabold tracking-[0.2em] text-white shadow-md">
          BEST SELLER
        </span>
      )}

      {showDiscountBadge && (
        <span className="absolute left-2 top-2 z-10 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
          {discountLabel}
        </span>
      )}

      {isExclusive && (
        <span className={`absolute left-2 z-10 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ${showDiscountBadge ? "top-8" : "top-2"}`}>
          Members Only
        </span>
      )}
    </>
  );
};

export default ProductCardBadges;