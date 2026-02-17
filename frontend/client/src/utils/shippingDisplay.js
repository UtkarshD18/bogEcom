import { round2 } from "@/utils/gst";

export const DEFAULT_SHIPPING_DISPLAY_MARKUP_PERCENT = 30;

const toPositiveNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric;
};

const withMarkup = (baseCharge, markupPercent) =>
  round2(baseCharge * (1 + markupPercent / 100));

/**
 * DISPLAY-ONLY shipping amount for cart/checkout strike-through UI.
 * This value must not be used in payable totals.
 */
export const getDisplayShippingCharge = ({
  isRajasthan = false,
  metrics = {},
} = {}) => {
  const markupPercent = toPositiveNumber(
    metrics?.markupPercent ?? DEFAULT_SHIPPING_DISPLAY_MARKUP_PERCENT,
  );

  const localFromApi = toPositiveNumber(metrics?.maxLocalDisplayCharge);
  const indiaFromApi = toPositiveNumber(metrics?.maxIndiaDisplayCharge);

  const localFromBase = withMarkup(
    toPositiveNumber(metrics?.maxLocalBaseCharge),
    markupPercent,
  );
  const indiaFromBase = withMarkup(
    toPositiveNumber(metrics?.maxIndiaBaseCharge),
    markupPercent,
  );

  const localDisplayCharge = localFromApi || localFromBase;
  const indiaDisplayCharge = indiaFromApi || indiaFromBase;
  const selected = isRajasthan ? localDisplayCharge : indiaDisplayCharge;

  return round2(Math.max(selected, 0));
};

/**
 * Display-only GST breakup for checkout summary labels.
 * Payable tax value remains unchanged.
 */
export const getDisplayTaxBreakup = ({ taxAmount = 0, isRajasthan = false } = {}) => {
  const totalTax = round2(Math.max(Number(taxAmount || 0), 0));

  if (!isRajasthan) {
    return { igst: totalTax, cgst: 0, sgst: 0 };
  }

  const cgst = round2(totalTax / 2);
  const sgst = round2(Math.max(totalTax - cgst, 0));

  return { igst: 0, cgst, sgst };
};
