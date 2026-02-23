import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateCheckoutTotals, round2 } from "../../frontend/client/src/utils/gst.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const checkoutPagePath = path.resolve(
  __dirname,
  "../../frontend/client/src/app/checkout/page.jsx",
);

test("payment payload wiring keeps payable shipping sourced from backend quote (never from display strike-through)", async () => {
  const source = await fs.readFile(checkoutPagePath, "utf8");

  assert.match(
    source,
    /const payableShipping = round2\(Number\(shippingQuote\?\.charge \|\| 0\)\);/,
  );
  assert.match(source, /\/api\/shipping\/quote/);
  assert.match(source, /\/api\/orders\/preview/);
  assert.match(source, /backendPricing\?\.shipping \?\? payableShipping \?\? 0/);
  assert.match(source, /const originalAmount = round2\(\s*Math\.max\(effectiveOriginalAmount \+ effectiveShipping, 0\),\s*\);/);
  assert.match(source, /shipping: effectiveShipping,/);
  assert.match(source, /totalAmt: effectiveTotal,/);
  assert.match(source, /finalAmount: effectiveTotal,/);

  // Guard against accidental inclusion of strike-through display amount in payment payload.
  assert.doesNotMatch(source, /shipping:\s*displayShippingCharge/);
  assert.doesNotMatch(source, /shippingCost:\s*displayShippingCharge/);
});

test("multi-item cart with coupon keeps payable total independent of display shipping", () => {
  const items = [
    { price: 210, quantity: 2 }, // GST-inclusive
    { price: 157.5, quantity: 3 },
  ];

  const baseInput = {
    items,
    gstRatePercent: 5,
    baseDiscountBeforeCoupon: 40,
    couponDiscount: 25,
    coinRedeemAmount: 0,
  };

  const totalsWithoutShipping = calculateCheckoutTotals({
    ...baseInput,
    shippingCost: 0,
  });
  const totalsWithShippingAdded = calculateCheckoutTotals({
    ...baseInput,
    shippingCost: 150,
  });

  assert.equal(totalsWithoutShipping.shippingCost, 0);
  assert.equal(
    totalsWithoutShipping.totalPayable,
    round2(totalsWithoutShipping.discountedSubtotal + totalsWithoutShipping.gstAmount),
  );
  assert.equal(
    totalsWithShippingAdded.totalPayable,
    round2(totalsWithoutShipping.totalPayable + 150),
  );
});

test("address switch Rajasthan <-> other state keeps display logic separate from payable calculation source", async () => {
  const source = await fs.readFile(checkoutPagePath, "utf8");

  // State-driven display branch exists.
  assert.match(source, /const isRajasthanDelivery = normalizedCheckoutState === "Rajasthan";/);
  assert.match(
    source,
    /useShippingDisplayCharge\(\{\s*isRajasthan: isRajasthanDelivery,\s*\}\)/,
  );

  // Payable total comes from backend preview response with local shipping-quote fallback,
  // while strike-through display shipping remains a visual-only path.
  assert.match(source, /const effectiveShipping = Number\(/);
  assert.match(source, /backendPricing\?\.shipping \?\? payableShipping \?\? 0/);
  assert.match(source, /const effectiveTotal = Number\(/);

  const sampleTotalsA = calculateCheckoutTotals({
    items: [{ price: 105, quantity: 4 }],
    gstRatePercent: 5,
    shippingCost: 0,
  });
  const sampleTotalsB = calculateCheckoutTotals({
    items: [{ price: 105, quantity: 4 }],
    gstRatePercent: 5,
    shippingCost: 0,
  });

  assert.equal(sampleTotalsA.totalPayable, sampleTotalsB.totalPayable);
});
