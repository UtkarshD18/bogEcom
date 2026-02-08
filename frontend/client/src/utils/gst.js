export const DEFAULT_GST_RATE_PERCENT = 5;

export const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const toPaise = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100);

const fromPaise = (paise) => Number(paise || 0) / 100;

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
 * Split a GST-inclusive amount into taxable + GST parts.
 * Uses paise math to ensure totals add up exactly to 2 decimals.
 */
export const splitGstInclusiveAmount = (
  inclusiveAmount,
  ratePercent = DEFAULT_GST_RATE_PERCENT,
) => {
  const rate = normalizeGstRatePercent(ratePercent);
  const grossPaise = toPaise(inclusiveAmount);
  const grossAmount = round2(fromPaise(grossPaise));

  if (!(rate > 0)) {
    return {
      ratePercent: rate,
      grossAmount,
      taxableAmount: grossAmount,
      gstAmount: 0,
    };
  }

  const divisor = 1 + rate / 100;
  const taxablePaise = Math.round(grossPaise / divisor);
  const gstPaise = grossPaise - taxablePaise;

  return {
    ratePercent: rate,
    grossAmount,
    taxableAmount: round2(fromPaise(taxablePaise)),
    gstAmount: round2(fromPaise(gstPaise)),
  };
};

export const calculateGstFromExclusiveAmount = (
  taxableAmount,
  ratePercent = DEFAULT_GST_RATE_PERCENT,
) => {
  const rate = normalizeGstRatePercent(ratePercent);
  if (!(rate > 0)) return 0;
  return round2((round2(taxableAmount) * rate) / 100);
};
