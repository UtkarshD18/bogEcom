const DEFAULT_GST_RATE = 5;

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const toPaise = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100);

const fromPaise = (paise) => Number(paise || 0) / 100;

export const calculateTax = (subtotal, state) => {
  const taxableAmount = Math.max(round2(subtotal), 0);
  const tax = round2((taxableAmount * DEFAULT_GST_RATE) / 100);

  return {
    rate: DEFAULT_GST_RATE,
    state: state || "",
    taxableAmount,
    tax,
    cgst: 0,
    sgst: 0,
    igst: tax,
    mode: "IGST",
  };
};

/**
 * Split a GST-inclusive amount into taxable + GST parts.
 * Uses paise math to ensure totals add up exactly to 2 decimals.
 */
export const splitGstInclusiveAmount = (
  inclusiveAmount,
  rate = DEFAULT_GST_RATE,
  state = "",
) => {
  const safeRate = Number(rate);
  const ratePercent =
    Number.isFinite(safeRate) && safeRate >= 0 ? safeRate : DEFAULT_GST_RATE;

  const grossPaise = toPaise(inclusiveAmount);
  const grossAmount = round2(fromPaise(grossPaise));

  if (!(ratePercent > 0)) {
    return {
      rate: ratePercent,
      state,
      grossAmount,
      taxableAmount: grossAmount,
      tax: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      mode: "IGST",
    };
  }

  const divisor = 1 + ratePercent / 100;
  const taxablePaise = Math.round(grossPaise / divisor);
  const taxPaise = grossPaise - taxablePaise;
  const tax = round2(fromPaise(taxPaise));

  return {
    rate: ratePercent,
    state,
    grossAmount,
    taxableAmount: round2(fromPaise(taxablePaise)),
    tax,
    cgst: 0,
    sgst: 0,
    igst: tax,
    mode: "IGST",
  };
};

export default {
  calculateTax,
  splitGstInclusiveAmount,
};
