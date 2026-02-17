const DEFAULT_GST_RATE_PERCENT = 5;

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPaise = (value) =>
  Math.round((toSafeNumber(value, 0) + Number.EPSILON) * 100);

const fromPaise = (paise) => Number(paise || 0) / 100;

const roundMoney = (value) => fromPaise(toPaise(value));

const clampPaise = (
  paise,
  min = 0,
  max = Number.POSITIVE_INFINITY,
) => Math.min(Math.max(Number(paise || 0), min), max);

const clampMoney = (value) => Math.max(roundMoney(value), 0);

const normalizeGstRatePercent = (ratePercent) => {
  const parsed = Number(ratePercent);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return DEFAULT_GST_RATE_PERCENT;
};

const normalizeCouponCode = (couponCode) =>
  String(couponCode || "")
    .trim()
    .toUpperCase();

const extractBaseFromInclusivePaise = (grossPaise, gstRatePercent) => {
  const rate = normalizeGstRatePercent(gstRatePercent);
  const safeGrossPaise = Math.max(Number(grossPaise || 0), 0);
  if (!(rate > 0)) return { basePaise: safeGrossPaise, gstPaise: 0 };

  const divisor = 1 + rate / 100;
  const basePaise = Math.round(safeGrossPaise / divisor);
  const gstPaise = safeGrossPaise - basePaise;
  return { basePaise, gstPaise };
};

const resolveCouponFromMap = (code, couponsByCode) => {
  if (!code || !couponsByCode) return null;

  if (couponsByCode instanceof Map) {
    return couponsByCode.get(code) || null;
  }

  if (typeof couponsByCode === "object") {
    return couponsByCode[code] || couponsByCode[code.toLowerCase()] || null;
  }

  return null;
};

const resolveCouponDiscountPaise = ({
  couponCode,
  couponRules,
  baseAfterPreDiscountPaise,
  errors,
}) => {
  const normalizedCode = normalizeCouponCode(couponCode);
  const hasCode = Boolean(normalizedCode);
  const overrideDiscountPaise = toPaise(couponRules?.discountAmountOverride);

  if (overrideDiscountPaise > 0 || couponRules?.allowZeroDiscountOverride) {
    return {
      couponDiscountPaise: clampPaise(
        overrideDiscountPaise,
        0,
        baseAfterPreDiscountPaise,
      ),
      appliedCouponCode: hasCode ? normalizedCode : null,
    };
  }

  if (!hasCode) {
    return { couponDiscountPaise: 0, appliedCouponCode: null };
  }

  let coupon = null;
  if (typeof couponRules?.resolveCoupon === "function") {
    try {
      coupon = couponRules.resolveCoupon(normalizedCode) || null;
    } catch {
      errors.push("COUPON_RESOLUTION_FAILED");
    }
  } else {
    coupon = resolveCouponFromMap(normalizedCode, couponRules?.couponsByCode);
  }

  if (!coupon) {
    errors.push(couponRules?.invalidCouponMessage || "INVALID_COUPON");
    return { couponDiscountPaise: 0, appliedCouponCode: normalizedCode };
  }

  const couponType = String(
    coupon.type || coupon.discountType || "",
  ).toUpperCase();
  const couponValue = toSafeNumber(
    coupon.value ?? coupon.discountValue ?? coupon.amount ?? 0,
    0,
  );

  let couponDiscountPaise = 0;
  if (couponType === "PERCENT" || couponType === "PERCENTAGE") {
    couponDiscountPaise = Math.round((baseAfterPreDiscountPaise * couponValue) / 100);
  } else if (couponType === "FLAT" || couponType === "AMOUNT") {
    couponDiscountPaise = toPaise(couponValue);
  } else if (coupon.discountAmount != null) {
    couponDiscountPaise = toPaise(coupon.discountAmount);
  } else {
    errors.push(couponRules?.invalidCouponMessage || "INVALID_COUPON");
    couponDiscountPaise = 0;
  }

  const maxDiscountValue = coupon.maxDiscount ?? coupon.maxDiscountAmount;
  if (Number.isFinite(Number(maxDiscountValue))) {
    couponDiscountPaise = Math.min(
      couponDiscountPaise,
      Math.max(toPaise(maxDiscountValue), 0),
    );
  }

  return {
    couponDiscountPaise: clampPaise(
      couponDiscountPaise,
      0,
      baseAfterPreDiscountPaise,
    ),
    appliedCouponCode: normalizedCode,
  };
};

const resolveShippingPaise = ({
  shippingRules,
  context,
  errors,
}) => {
  if (typeof shippingRules?.calculateShipping === "function") {
    try {
      const resolved = shippingRules.calculateShipping(context);
      return clampPaise(toPaise(resolved), 0);
    } catch {
      errors.push("SHIPPING_RULES_ERROR");
      return 0;
    }
  }

  if (shippingRules?.shippingCostOverride != null) {
    return clampPaise(toPaise(shippingRules.shippingCostOverride), 0);
  }

  const baseShippingPaise = clampPaise(
    toPaise(
      shippingRules?.baseShippingCost ??
        shippingRules?.shippingCost ??
        0,
    ),
    0,
  );
  const freeShippingEnabled = shippingRules?.freeShippingEnabled !== false;
  const freeShippingThreshold = Number(shippingRules?.freeShippingThreshold);

  if (!freeShippingEnabled || !Number.isFinite(freeShippingThreshold)) {
    return baseShippingPaise;
  }

  const thresholdMetric = String(
    shippingRules?.thresholdMetric || "subtotalAfterDiscount",
  );
  const metricValue =
    thresholdMetric === "totalBeforeShipping"
      ? context.discountedSubtotal + context.tax
      : thresholdMetric === "originalSubtotal"
        ? context.originalSubtotal
        : context.discountedSubtotal;

  if (metricValue >= freeShippingThreshold) {
    return 0;
  }
  return baseShippingPaise;
};

const buildItemBreakdown = ({ items, gstRatePercent, pricesIncludeTax }) => {
  const safeItems = Array.isArray(items) ? items : [];
  let subtotalPaise = 0;
  let originalSubtotalPaise = 0;
  let baseSubtotalPaise = 0;

  const itemBreakdown = safeItems
    .map((item) => {
      const quantity = Math.max(toSafeNumber(item?.quantity, 0), 0);
      const unitPrice = Math.max(toSafeNumber(item?.price, 0), 0);
      if (!(quantity > 0)) return null;

      const unitPricePaise = clampPaise(toPaise(unitPrice), 0);
      let unitBasePaise = unitPricePaise;
      let unitTaxPaise = 0;
      let unitGrossPaise = unitPricePaise;

      if (pricesIncludeTax) {
        const split = extractBaseFromInclusivePaise(unitPricePaise, gstRatePercent);
        unitBasePaise = split.basePaise;
        unitTaxPaise = split.gstPaise;
        unitGrossPaise = unitPricePaise;
      } else {
        unitBasePaise = unitPricePaise;
        unitTaxPaise =
          gstRatePercent > 0
            ? Math.round((unitBasePaise * gstRatePercent) / 100)
            : 0;
        unitGrossPaise = unitBasePaise + unitTaxPaise;
      }

      const lineBasePaise = Math.round(unitBasePaise * quantity);
      const lineTaxPaise = Math.round(unitTaxPaise * quantity);
      const lineGrossPaise = Math.round(unitGrossPaise * quantity);

      baseSubtotalPaise += lineBasePaise;
      originalSubtotalPaise += lineGrossPaise;
      subtotalPaise += lineBasePaise;

      return {
        quantity,
        unitPrice: roundMoney(fromPaise(unitGrossPaise)),
        lineBase: roundMoney(fromPaise(lineBasePaise)),
        lineTax: roundMoney(fromPaise(lineTaxPaise)),
        lineTotal: roundMoney(fromPaise(lineGrossPaise)),
      };
    })
    .filter(Boolean);

  return {
    itemBreakdown,
    subtotalPaise,
    baseSubtotalPaise,
    originalSubtotalPaise,
  };
};

/**
 * Shared calculation engine for checkout/order screens.
 *
 * Rules:
 * - subtotal = item total before coupon (GST-exclusive base)
 * - discount = pre-coupon discount + coupon discount
 * - tax = GST on (subtotal - discount)
 * - shipping = resolved from shipping rules
 * - total = subtotal - discount + tax + shipping - coin redemption
 */
export const calculateOrderTotals = ({
  items = [],
  couponCode = "",
  couponRules = {},
  shippingRules = {},
  taxRules = {},
  baseDiscountBeforeCoupon = 0,
  coinRedeemAmount = 0,
  fallbackTotals = null,
} = {}) => {
  const errors = [];
  const gstRatePercent = normalizeGstRatePercent(
    taxRules?.gstRatePercent ?? taxRules?.rate,
  );
  const pricesIncludeTax = taxRules?.pricesIncludeTax !== false;

  const { itemBreakdown, baseSubtotalPaise, originalSubtotalPaise } =
    buildItemBreakdown({
      items,
      gstRatePercent,
      pricesIncludeTax,
    });

  if (itemBreakdown.length === 0) {
    errors.push("EMPTY_CART");

    const safeFallback = {
      subtotal: clampMoney(fallbackTotals?.subtotal),
      discountedSubtotal: clampMoney(fallbackTotals?.discountedSubtotal),
      discount: clampMoney(fallbackTotals?.discount),
      totalDiscount: clampMoney(fallbackTotals?.discount),
      couponDiscount: clampMoney(fallbackTotals?.couponDiscount),
      baseDiscountBeforeCoupon: clampMoney(
        fallbackTotals?.baseDiscountBeforeCoupon,
      ),
      tax: clampMoney(fallbackTotals?.tax),
      shipping: clampMoney(fallbackTotals?.shipping),
      totalPayable: clampMoney(
        fallbackTotals?.totalPayable ?? fallbackTotals?.total,
      ),
      total: clampMoney(fallbackTotals?.totalPayable ?? fallbackTotals?.total),
      originalSubtotal: clampMoney(fallbackTotals?.originalSubtotal),
      coinRedeemAmount: clampMoney(fallbackTotals?.coinRedeemAmount),
      coinRedemptionAmount: clampMoney(fallbackTotals?.coinRedeemAmount),
      appliedCouponCode: normalizeCouponCode(couponCode) || null,
      itemBreakdown: [],
      errors,
      isValid: false,
    };

    if (!(safeFallback.discountedSubtotal > 0)) {
      safeFallback.discountedSubtotal = safeFallback.subtotal;
    }

    return safeFallback;
  }

  const baseDiscountBeforeCouponPaise = clampPaise(
    toPaise(baseDiscountBeforeCoupon),
    0,
    baseSubtotalPaise,
  );
  const baseAfterPreDiscountPaise = Math.max(
    baseSubtotalPaise - baseDiscountBeforeCouponPaise,
    0,
  );

  const { couponDiscountPaise, appliedCouponCode } = resolveCouponDiscountPaise({
    couponCode,
    couponRules,
    baseAfterPreDiscountPaise,
    errors,
  });

  const discountedSubtotalPaise = Math.max(
    baseAfterPreDiscountPaise - couponDiscountPaise,
    0,
  );
  const gstPaise =
    gstRatePercent > 0
      ? Math.round((discountedSubtotalPaise * gstRatePercent) / 100)
      : 0;

  const shippingPaise = resolveShippingPaise({
    shippingRules,
    context: {
      originalSubtotal: roundMoney(fromPaise(originalSubtotalPaise)),
      subtotal: roundMoney(fromPaise(baseSubtotalPaise)),
      discountedSubtotal: roundMoney(fromPaise(discountedSubtotalPaise)),
      tax: roundMoney(fromPaise(gstPaise)),
      gstRatePercent,
      items,
    },
    errors,
  });

  const productTotalPaise = discountedSubtotalPaise + gstPaise;
  const coinRedeemPaise = clampPaise(
    toPaise(coinRedeemAmount),
    0,
    productTotalPaise,
  );

  const totalDiscountPaise = baseDiscountBeforeCouponPaise + couponDiscountPaise;
  const totalPayablePaise = Math.max(
    discountedSubtotalPaise + gstPaise + shippingPaise - coinRedeemPaise,
    0,
  );

  return {
    subtotal: roundMoney(fromPaise(baseSubtotalPaise)),
    discountedSubtotal: roundMoney(fromPaise(discountedSubtotalPaise)),
    discount: roundMoney(fromPaise(totalDiscountPaise)),
    totalDiscount: roundMoney(fromPaise(totalDiscountPaise)),
    couponDiscount: roundMoney(fromPaise(couponDiscountPaise)),
    baseDiscountBeforeCoupon: roundMoney(fromPaise(baseDiscountBeforeCouponPaise)),
    tax: roundMoney(fromPaise(gstPaise)),
    shipping: roundMoney(fromPaise(shippingPaise)),
    totalPayable: roundMoney(fromPaise(totalPayablePaise)),
    total: roundMoney(fromPaise(totalPayablePaise)),
    originalSubtotal: roundMoney(fromPaise(originalSubtotalPaise)),
    coinRedeemAmount: roundMoney(fromPaise(coinRedeemPaise)),
    coinRedemptionAmount: roundMoney(fromPaise(coinRedeemPaise)),
    gstRatePercent,
    appliedCouponCode,
    itemBreakdown,
    errors,
    isValid: errors.length === 0,
  };
};

const inferOrderGstRatePercent = (order) => {
  const fromOrder = toSafeNumber(order?.gst?.rate, NaN);
  if (Number.isFinite(fromOrder) && fromOrder > 0) return fromOrder;
  return DEFAULT_GST_RATE_PERCENT;
};

const buildOrderItems = (order) => {
  const products = Array.isArray(order?.products) ? order.products : [];
  return products
    .map((product) => {
      const quantity = Math.max(toSafeNumber(product?.quantity, 0), 0);
      const directPrice = toSafeNumber(product?.price, NaN);
      const derivedPrice =
        quantity > 0 ? toSafeNumber(product?.subTotal, 0) / quantity : 0;
      const price = Number.isFinite(directPrice) ? directPrice : derivedPrice;
      return { price: clampMoney(price), quantity };
    })
    .filter((item) => item.quantity > 0);
};

const normalizeDiscountValue = (value, { assumeInclusive, gstRatePercent }) => {
  const amount = clampMoney(value);
  if (!assumeInclusive || !(gstRatePercent > 0)) return amount;
  return clampMoney(amount / (1 + gstRatePercent / 100));
};

/**
 * Adapter for order/order-detail pages.
 * Converts stored order fields into calculateOrderTotals input.
 */
export const buildSavedOrderCalculationInput = (order = {}, options = {}) => {
  const gstRatePercent = inferOrderGstRatePercent(order);
  const items = buildOrderItems(order);
  const payableShipping = clampMoney(
    options?.payableShipping ?? options?.shippingCost ?? 0,
  );
  const coinRedeemAmount = clampMoney(order?.coinRedemption?.amount);
  const fallbackTotals = {
    subtotal: clampMoney(order?.subtotal),
    discountedSubtotal: clampMoney(order?.subtotal),
    discount: clampMoney(order?.discount),
    tax: clampMoney(order?.tax),
    shipping: payableShipping,
    totalPayable: clampMoney(order?.finalAmount ?? order?.totalAmt),
    total: clampMoney(order?.finalAmount ?? order?.totalAmt),
    coinRedeemAmount,
  };

  if (items.length === 0) {
    return {
      items,
      couponCode: order?.couponCode || "",
      couponRules: {
        discountAmountOverride: clampMoney(order?.discountAmount),
      },
      shippingRules: {
        shippingCostOverride: payableShipping,
      },
      taxRules: {
        gstRatePercent,
        pricesIncludeTax: true,
      },
      baseDiscountBeforeCoupon: clampMoney(
        toSafeNumber(order?.membershipDiscount, 0) +
          toSafeNumber(order?.influencerDiscount, 0),
      ),
      coinRedeemAmount,
      fallbackTotals,
    };
  }

  const originalTotals = calculateOrderTotals({
    items,
    shippingRules: { shippingCostOverride: 0 },
    taxRules: { gstRatePercent, pricesIncludeTax: true },
  });
  const baseSubtotal = clampMoney(originalTotals.subtotal);
  const storedTotalDiscount = clampMoney(order?.discount);
  const storedMembershipDiscount = clampMoney(order?.membershipDiscount);
  const storedInfluencerDiscount = clampMoney(order?.influencerDiscount);
  const storedCouponDiscount = clampMoney(order?.discountAmount);
  const storedShipping = clampMoney(order?.shipping);
  const storedFinalAmount = clampMoney(order?.finalAmount ?? order?.totalAmt);
  const storedProductTotal = clampMoney(
    storedFinalAmount - storedShipping + coinRedeemAmount,
  );

  // Older pending-payment orders persisted GST-inclusive discounts.
  const assumeInclusiveDiscounts =
    storedTotalDiscount > 0 &&
    Math.abs(
      roundMoney(originalTotals.originalSubtotal - storedTotalDiscount) -
        storedProductTotal,
    ) <= 1;

  let membershipDiscount = normalizeDiscountValue(storedMembershipDiscount, {
    assumeInclusive: assumeInclusiveDiscounts,
    gstRatePercent,
  });
  let influencerDiscount = normalizeDiscountValue(storedInfluencerDiscount, {
    assumeInclusive: assumeInclusiveDiscounts,
    gstRatePercent,
  });
  let couponDiscount = normalizeDiscountValue(storedCouponDiscount, {
    assumeInclusive: assumeInclusiveDiscounts,
    gstRatePercent,
  });
  let totalDiscount = normalizeDiscountValue(storedTotalDiscount, {
    assumeInclusive: assumeInclusiveDiscounts,
    gstRatePercent,
  });

  if (!(totalDiscount > 0)) {
    totalDiscount = clampMoney(
      membershipDiscount + influencerDiscount + couponDiscount,
    );
  }

  const partSum = clampMoney(
    membershipDiscount + influencerDiscount + couponDiscount,
  );
  if (totalDiscount > partSum + 0.01) {
    couponDiscount = clampMoney(couponDiscount + (totalDiscount - partSum));
  }

  let baseDiscountBeforeCoupon = clampMoney(
    membershipDiscount + influencerDiscount,
  );
  baseDiscountBeforeCoupon = Math.min(baseDiscountBeforeCoupon, baseSubtotal);

  let effectiveCouponDiscount = Math.min(
    couponDiscount,
    Math.max(baseSubtotal - baseDiscountBeforeCoupon, 0),
  );
  const knownDiscount = clampMoney(baseDiscountBeforeCoupon + effectiveCouponDiscount);
  if (totalDiscount > knownDiscount + 0.01) {
    effectiveCouponDiscount = Math.min(
      clampMoney(effectiveCouponDiscount + (totalDiscount - knownDiscount)),
      Math.max(baseSubtotal - baseDiscountBeforeCoupon, 0),
    );
  }

  return {
    items,
    couponCode: order?.couponCode || "",
    couponRules: {
      discountAmountOverride: effectiveCouponDiscount,
    },
    shippingRules: {
      shippingCostOverride: payableShipping,
    },
    taxRules: {
      gstRatePercent,
      pricesIncludeTax: true,
    },
    baseDiscountBeforeCoupon,
    coinRedeemAmount,
    fallbackTotals,
  };
};

export default calculateOrderTotals;
