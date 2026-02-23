import { round2 } from "@/utils/gst";

export const DEFAULT_SHIPPING_DISPLAY_MARKUP_PERCENT = 30;
export const RAJASTHAN_DISPLAY_SHIPPING = 36;
export const OTHER_STATES_DISPLAY_SHIPPING = 68;

const toPositiveNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric;
};

/**
 * DISPLAY-ONLY shipping amount for cart/checkout strike-through UI.
 * This value must not be used in payable totals.
 */
export const getDisplayShippingCharge = ({
  isRajasthan = false,
  metrics = {},
} = {}) => {
  const configuredRajasthan = toPositiveNumber(
    metrics?.rajasthanDisplayCharge,
  );
  const configuredOtherStates = toPositiveNumber(
    metrics?.otherStatesDisplayCharge,
  );

  if (configuredRajasthan > 0 || configuredOtherStates > 0) {
    return round2(
      isRajasthan
        ? configuredRajasthan || RAJASTHAN_DISPLAY_SHIPPING
        : configuredOtherStates || OTHER_STATES_DISPLAY_SHIPPING,
    );
  }

  // Fixed storefront display rates requested by business.
  return round2(
    isRajasthan ? RAJASTHAN_DISPLAY_SHIPPING : OTHER_STATES_DISPLAY_SHIPPING,
  );
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
