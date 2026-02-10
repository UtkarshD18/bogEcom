export const DEFAULT_GST_RATE_PERCENT = 5;

// ───────────────────────────────
// Money helpers (paise-safe)
// ───────────────────────────────

// Convert rupees → paise (integer). Prefer paise for all internal arithmetic.
const toPaise = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100);

// Convert paise (integer) → rupees (number with up to 2 decimals).
const fromPaise = (paise) => Number(paise || 0) / 100;

/**
 * Round to 2 decimals using paise conversion (single source of rounding truth).
 */
export const round2 = (value) => fromPaise(toPaise(value));

const clampPaise = (paise, min = 0, max = Number.POSITIVE_INFINITY) =>
  Math.min(Math.max(Number(paise || 0), min), max);

export const normalizeGstRatePercent = (
  ratePercent,
  fallback = DEFAULT_GST_RATE_PERCENT,
) => {
  const parsed = Number(ratePercent);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return fallback;
};

export const getGstRatePercentFromSettings = (taxSettings) => {
  const parsed = Number(taxSettings?.taxRate);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return DEFAULT_GST_RATE_PERCENT;
};

/**
 * Extract GST-exclusive base price from a GST-inclusive unit price.
 *
 *   base = gross / (1 + rate/100)
 *   gst  = gross − base
 *
 * Uses integer paise and assigns the remainder to GST so:
 *   basePaise + gstPaise === grossPaise
 */
const extractBaseFromInclusivePaise = (grossPaise, ratePercent) => {
  const rate = normalizeGstRatePercent(ratePercent);
  const safeGrossPaise = Math.max(Number(grossPaise || 0), 0);

  if (!(rate > 0)) return { basePaise: safeGrossPaise, gstPaise: 0 };

  const divisor = 1 + rate / 100;
  const basePaise = Math.round(safeGrossPaise / divisor);
  const gstPaise = safeGrossPaise - basePaise;

  return { basePaise, gstPaise };
};

/**
 * Extract the GST-exclusive base price from a GST-inclusive price (₹).
 * Returns ₹ values rounded to 2 decimals.
 */
export const extractBasePrice = (
  inclusivePrice,
  ratePercent = DEFAULT_GST_RATE_PERCENT,
) => {
  const rate = normalizeGstRatePercent(ratePercent);
  const grossPaise = toPaise(inclusivePrice);
  const { basePaise, gstPaise } = extractBaseFromInclusivePaise(
    grossPaise,
    rate,
  );

  return {
    basePrice: round2(fromPaise(basePaise)),
    gstAmount: round2(fromPaise(gstPaise)),
  };
};

/**
 * Split a GST-inclusive amount into taxable + GST parts.
 * Uses paise math so totals add up exactly to 2 decimals.
 */
export const splitGstInclusiveAmount = (
  inclusiveAmount,
  ratePercent = DEFAULT_GST_RATE_PERCENT,
) => {
  const rate = normalizeGstRatePercent(ratePercent);
  const grossPaise = toPaise(inclusiveAmount);
  const { basePaise, gstPaise } = extractBaseFromInclusivePaise(
    grossPaise,
    rate,
  );

  return {
    ratePercent: rate,
    grossAmount: round2(fromPaise(grossPaise)),
    taxableAmount: round2(fromPaise(basePaise)),
    gstAmount: round2(fromPaise(gstPaise)),
  };
};

/**
 * Calculate GST on a GST-exclusive (base) amount (₹).
 *
 *   gst = round(basePaise × rate / 100) in paise
 */
export const calculateGstFromExclusiveAmount = (
  taxableAmount,
  ratePercent = DEFAULT_GST_RATE_PERCENT,
) => {
  const rate = normalizeGstRatePercent(ratePercent);
  if (!(rate > 0)) return 0;

  const basePaise = Math.max(toPaise(taxableAmount), 0);
  const gstPaise = Math.round((basePaise * rate) / 100);
  return round2(fromPaise(gstPaise));
};

/**
 * Calculate a percentage discount on a rupee amount using paise rounding.
 * Useful for membership / percent-based discounts.
 */
export const calculatePercentageDiscount = (amount, percent) => {
  const safePercent = Number(percent);
  if (!Number.isFinite(safePercent) || safePercent <= 0) return 0;

  const amountPaise = Math.max(toPaise(amount), 0);
  const discountPaise = Math.round((amountPaise * safePercent) / 100);
  return round2(fromPaise(discountPaise));
};

/**
 * Full checkout price calculation — single source of truth.
 *
 * All product prices are GST-inclusive at input.
 *
 * Flow:
 *  1) baseSubtotal (excl. GST) is derived from inclusive item prices
 *  2) baseDiscountBeforeCoupon reduces baseSubtotal (trade discounts)
 *  3) couponDiscount applies ONLY on the GST-exclusive base (after step 2)
 *  4) GST is recalculated ONLY on the discounted base
 *  5) Shipping is GST-free and coupon-free, added at the end
 *  6) Coin redemption is a payment method (does NOT reduce GST)
 */
export const calculateCheckoutTotals = ({
  items = [],
  gstRatePercent = DEFAULT_GST_RATE_PERCENT,
  baseDiscountBeforeCoupon = 0,
  coupon = null,
  couponDiscount = 0,
  shippingCost = 0,
  coinRedeemAmount = 0,
} = {}) => {
  const rate = normalizeGstRatePercent(gstRatePercent);
  const safeItems = Array.isArray(items) ? items : [];

  // Step 1: Extract base prices (paise) and compute subtotals
  let baseSubtotalPaise = 0;
  let originalInclusiveTotalPaise = 0;

  const itemBreakdown = safeItems.map((item) => {
    const quantity = Math.max(Number(item?.quantity ?? 1), 0);

    const inclusiveUnitPricePaise = clampPaise(toPaise(item?.price), 0);
    const { basePaise, gstPaise } = extractBaseFromInclusivePaise(
      inclusiveUnitPricePaise,
      rate,
    );

    // Line totals in paise; rounded once per line.
    const lineInclusivePaise = Math.round(inclusiveUnitPricePaise * quantity);
    const lineBasePaise = Math.round(basePaise * quantity);
    const lineGstPaise = Math.round(gstPaise * quantity);

    baseSubtotalPaise += lineBasePaise;
    originalInclusiveTotalPaise += lineInclusivePaise;

    return {
      quantity,
      inclusiveUnitPrice: round2(fromPaise(inclusiveUnitPricePaise)),
      basePrice: round2(fromPaise(basePaise)),
      gstAmount: round2(fromPaise(gstPaise)),
      lineInclusive: round2(fromPaise(lineInclusivePaise)),
      lineBase: round2(fromPaise(lineBasePaise)),
      lineGst: round2(fromPaise(lineGstPaise)),
    };
  });

  const baseSubtotal = round2(fromPaise(baseSubtotalPaise));
  const originalInclusiveTotal = round2(fromPaise(originalInclusiveTotalPaise));

  // Step 2: Trade discounts BEFORE coupon (GST-exclusive), capped at base subtotal
  const baseDiscountBeforeCouponPaise = clampPaise(
    toPaise(baseDiscountBeforeCoupon),
    0,
    baseSubtotalPaise,
  );
  const baseAfterPreDiscountPaise = Math.max(
    baseSubtotalPaise - baseDiscountBeforeCouponPaise,
    0,
  );

  // Step 3: Coupon applies ONLY on GST-exclusive base (after pre-discounts)
  // If both `couponDiscount` and `coupon` are provided, `couponDiscount` wins.
  let couponDiscountPaise = clampPaise(toPaise(couponDiscount), 0);

  if (!(couponDiscountPaise > 0) && coupon && typeof coupon === "object") {
    const type = String(coupon.type || "").toUpperCase();
    const value = Number(coupon.value || 0);

    if (type === "PERCENT") {
      const percent = Number.isFinite(value) ? value : 0;
      if (percent > 0) {
        couponDiscountPaise = Math.round(
          (baseAfterPreDiscountPaise * percent) / 100,
        );
      }
    } else if (type === "FLAT") {
      couponDiscountPaise = toPaise(value);
    }

    if (coupon.maxDiscount != null) {
      couponDiscountPaise = Math.min(
        couponDiscountPaise,
        Math.max(toPaise(coupon.maxDiscount), 0),
      );
    }
  }

  couponDiscountPaise = clampPaise(
    couponDiscountPaise,
    0,
    baseAfterPreDiscountPaise,
  );

  // Step 4: Discounted base subtotal (GST-exclusive)
  const discountedSubtotalPaise = Math.max(
    baseAfterPreDiscountPaise - couponDiscountPaise,
    0,
  );

  // Step 5: GST recalculated on discounted base only (shipping excluded)
  const gstPaise =
    rate > 0 ? Math.round((discountedSubtotalPaise * rate) / 100) : 0;

  // Step 6: Shipping is GST-free and coupon-free
  const shippingPaise = clampPaise(toPaise(shippingCost), 0);

  // Step 7: Coin redemption is a payment method (does NOT reduce taxable value)
  // Cap coin redemption to the product total (discounted base + GST). Shipping stays payable.
  const productTotalAfterDiscountPaise = discountedSubtotalPaise + gstPaise;
  const coinRedeemPaise = clampPaise(
    toPaise(coinRedeemAmount),
    0,
    productTotalAfterDiscountPaise,
  );

  // Step 8: Final payable
  const totalPayablePaise = Math.max(
    discountedSubtotalPaise + gstPaise - coinRedeemPaise + shippingPaise,
    0,
  );

  return {
    originalInclusiveTotal, // GST-inclusive prices × qty (before discounts)
    baseSubtotal, // GST-exclusive subtotal (before trade discounts/coupon)
    baseDiscountBeforeCoupon: round2(fromPaise(baseDiscountBeforeCouponPaise)),
    couponDiscount: round2(fromPaise(couponDiscountPaise)),
    discountedSubtotal: round2(fromPaise(discountedSubtotalPaise)),
    gstRatePercent: rate,
    gstAmount: round2(fromPaise(gstPaise)),
    shippingCost: round2(fromPaise(shippingPaise)),
    coinRedeemAmount: round2(fromPaise(coinRedeemPaise)),
    totalPayable: round2(fromPaise(totalPayablePaise)),
    itemBreakdown,
  };
};
