"use client";

import { useCart } from "@/context/CartContext";
import { trackEvent } from "@/utils/analyticsTracker";
import { getImageUrl } from "@/utils/imageUtils";
import { useMemo, useState } from "react";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildItemsPreview = (items = []) => {
  const names = items
    .map((item) => item?.productTitle || item?.name)
    .filter(Boolean);
  const preview = names.slice(0, 3).join(", ");
  if (names.length > 3) {
    return `${preview} + ${names.length - 3} more`;
  }
  return preview;
};

const resolveDiscountPercent = (combo) => {
  const original = toNumber(combo?.originalTotal, 0);
  const price = toNumber(combo?.comboPrice, 0);
  if (original > 0 && price < original) {
    return Math.round(((original - price) / original) * 100);
  }
  return Math.round(toNumber(combo?.discountPercentage, 0));
};

const ComboCard = ({ combo, variant = "grid", context = "combo_list" }) => {
  const { addComboToCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);

  const itemsPreview = useMemo(
    () => buildItemsPreview(combo?.items || []),
    [combo],
  );
  const comboImage = useMemo(() => {
    const items = Array.isArray(combo?.items) ? combo.items : [];
    return (
      combo?.thumbnail ||
      combo?.image ||
      items.find((item) => item?.image)?.image ||
      "/combo_placeholder.png"
    );
  }, [combo]);

  const discountPercent = resolveDiscountPercent(combo);
  const savings = Math.max(
    toNumber(combo?.totalSavings, 0),
    toNumber(combo?.originalTotal, 0) - toNumber(combo?.comboPrice, 0),
  );
  const isOutOfStock = Number(combo?.availableStock) === 0;

  const handleAddCombo = async () => {
    const comboId = combo?._id || combo?.id;
    if (!comboId || isAdding) return;
    setIsAdding(true);
    try {
      trackEvent("combo_click", {
        comboId: String(comboId),
        comboName: combo?.name || "",
        comboSlug: combo?.slug || "",
        comboType: combo?.comboType || "",
        sectionName: context,
        action: "add",
      });
      await addComboToCart(combo, 1);
    } finally {
      setIsAdding(false);
    }
  };

  const cardBaseClasses =
    variant === "compact"
      ? "p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-lg transition"
      : "p-5 rounded-3xl border border-gray-100 bg-white shadow-sm hover:shadow-xl transition";

  return (
    <div className={cardBaseClasses}>
      <div className="flex gap-4">
        <div className="w-20 h-20 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center p-2 shrink-0">
          <img
            src={getImageUrl(comboImage)}
            alt={combo?.name || "Combo deal"}
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900 line-clamp-1">
              {combo?.name || "Combo Deal"}
            </h3>
            {discountPercent > 0 && (
              <span className="rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5">
                {discountPercent}% OFF
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
            {itemsPreview || "Curated bundle savings"}
          </p>
          {Array.isArray(combo?.tags) && combo.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {combo.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700"
                >
                  {String(tag || "").replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              {toNumber(combo?.originalTotal, 0) > toNumber(combo?.comboPrice, 0) && (
                <p className="text-[11px] text-gray-400 line-through">
                  ₹{toNumber(combo?.originalTotal, 0).toFixed(0)}
                </p>
              )}
              <p className="text-base font-extrabold text-primary">
                ₹{toNumber(combo?.comboPrice, 0).toFixed(0)}
              </p>
              {savings > 0 && (
                <p className="text-[10px] text-emerald-700 font-semibold">
                  Save ₹{savings.toFixed(0)}
                </p>
              )}
            </div>
            <button
              onClick={handleAddCombo}
              disabled={isAdding || isOutOfStock}
              className="rounded-full bg-primary text-white text-xs font-semibold px-4 py-2 hover:brightness-110 transition disabled:opacity-60"
            >
              {isOutOfStock ? "Out of Stock" : isAdding ? "Adding..." : "Buy Combo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComboCard;
