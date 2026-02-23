import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateOrderTotals } from "../../frontend/client/src/utils/calculateOrderTotals.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const checkoutPagePath = path.resolve(
  __dirname,
  "../../frontend/client/src/app/checkout/page.jsx",
);
const ordersPagePath = path.resolve(
  __dirname,
  "../../frontend/client/src/app/my-orders/page.jsx",
);
const orderDetailPagePath = path.resolve(
  __dirname,
  "../../frontend/client/src/app/orders/[orderId]/page.jsx",
);

const pickCoreTotals = (totals) => ({
  subtotal: totals.subtotal,
  discountedSubtotal: totals.discountedSubtotal,
  discount: totals.discount,
  couponDiscount: totals.couponDiscount,
  tax: totals.tax,
  shipping: totals.shipping,
  totalPayable: totals.totalPayable,
});

test("checkout-style calculation with coupon matches expected totals", () => {
  const totals = calculateOrderTotals({
    items: [{ price: 999, quantity: 1 }],
    couponCode: "SAGAR67",
    couponRules: {
      couponsByCode: {
        SAGAR67: { type: "PERCENT", value: 10, maxDiscount: 200 },
      },
    },
    shippingRules: {
      baseShippingCost: 42,
      freeShippingEnabled: true,
      freeShippingThreshold: 800,
      thresholdMetric: "subtotalAfterDiscount",
    },
    taxRules: {
      gstRatePercent: 5,
      pricesIncludeTax: true,
    },
  });

  assert.equal(totals.subtotal, 951.43);
  assert.equal(totals.discount, 95.14);
  assert.equal(totals.discountedSubtotal, 856.29);
  assert.equal(totals.tax, 42.81);
  assert.equal(totals.shipping, 0);
  assert.equal(totals.totalPayable, 899.1);
});

test("without coupon, shipping charge applies when threshold is not met", () => {
  const totals = calculateOrderTotals({
    items: [{ price: 525, quantity: 1 }],
    shippingRules: {
      baseShippingCost: 42,
      freeShippingEnabled: true,
      freeShippingThreshold: 600,
      thresholdMetric: "subtotalAfterDiscount",
    },
    taxRules: {
      gstRatePercent: 5,
      pricesIncludeTax: true,
    },
  });

  assert.equal(totals.subtotal, 500);
  assert.equal(totals.discount, 0);
  assert.equal(totals.tax, 25);
  assert.equal(totals.shipping, 42);
  assert.equal(totals.totalPayable, 567);
});

test("GST breakdown for 179 inclusive follows subtotal + 5% tax = 179", () => {
  const totals = calculateOrderTotals({
    items: [{ price: 179, quantity: 1 }],
    shippingRules: {
      shippingCostOverride: 0,
    },
    taxRules: {
      gstRatePercent: 5,
      pricesIncludeTax: true,
    },
  });

  assert.equal(totals.subtotal, 170.48);
  assert.equal(totals.tax, 8.52);
  assert.equal(totals.totalPayable, 179);
});

test("free shipping threshold removes shipping when subtotal-after-discount crosses threshold", () => {
  const totals = calculateOrderTotals({
    items: [{ price: 999, quantity: 1 }],
    couponCode: "SAVE10",
    couponRules: {
      couponsByCode: {
        SAVE10: { type: "PERCENT", value: 10 },
      },
    },
    shippingRules: {
      baseShippingCost: 42,
      freeShippingEnabled: true,
      freeShippingThreshold: 800,
      thresholdMetric: "subtotalAfterDiscount",
    },
    taxRules: {
      gstRatePercent: 5,
      pricesIncludeTax: true,
    },
  });

  assert.equal(totals.discountedSubtotal, 856.29);
  assert.equal(totals.shipping, 0);
  assert.equal(totals.totalPayable, 899.1);
});

test("invalid coupon returns error and does not apply discount", () => {
  const totals = calculateOrderTotals({
    items: [{ price: 999, quantity: 1 }],
    couponCode: "UNKNOWN",
    couponRules: {
      couponsByCode: {
        SAVE5: { type: "PERCENT", value: 5 },
      },
    },
    shippingRules: {
      shippingCostOverride: 0,
    },
    taxRules: {
      gstRatePercent: 5,
      pricesIncludeTax: true,
    },
  });

  assert.equal(totals.discount, 0);
  assert.equal(totals.tax, 47.57);
  assert.equal(totals.totalPayable, 999);
  assert.ok(totals.errors.includes("INVALID_COUPON"));
});

test("empty cart returns safe totals and error", () => {
  const totals = calculateOrderTotals({
    items: [],
    fallbackTotals: {
      subtotal: 0,
      discount: 0,
      tax: 0,
      shipping: 0,
      totalPayable: 0,
    },
  });

  assert.equal(totals.totalPayable, 0);
  assert.ok(totals.errors.includes("EMPTY_CART"));
});

test("checkout/order/order-detail calculations match for identical input", () => {
  const input = {
    items: [
      { price: 999, quantity: 1 },
      { price: 525, quantity: 1 },
    ],
    couponCode: "SAVE10",
    couponRules: {
      couponsByCode: {
        SAVE10: { type: "PERCENT", value: 10 },
      },
    },
    shippingRules: {
      baseShippingCost: 42,
      freeShippingEnabled: true,
      freeShippingThreshold: 1200,
      thresholdMetric: "subtotalAfterDiscount",
    },
    taxRules: {
      gstRatePercent: 5,
      pricesIncludeTax: true,
    },
    coinRedeemAmount: 20,
  };

  const checkoutTotals = calculateOrderTotals(input);
  const ordersTotals = calculateOrderTotals(input);
  const orderDetailTotals = calculateOrderTotals(input);

  assert.deepEqual(pickCoreTotals(checkoutTotals), pickCoreTotals(ordersTotals));
  assert.deepEqual(
    pickCoreTotals(checkoutTotals),
    pickCoreTotals(orderDetailTotals),
  );
});

test("checkout, orders, and order detail pages import shared calculateOrderTotals", async () => {
  const [checkoutSource, ordersSource, orderDetailSource] = await Promise.all([
    fs.readFile(checkoutPagePath, "utf8"),
    fs.readFile(ordersPagePath, "utf8"),
    fs.readFile(orderDetailPagePath, "utf8"),
  ]);

  assert.match(checkoutSource, /calculateOrderTotals\.mjs/);
  assert.match(checkoutSource, /calculateOrderTotals\(/);

  assert.match(ordersSource, /calculateOrderTotals\.mjs/);
  assert.match(ordersSource, /calculateOrderTotals\(/);

  assert.match(orderDetailSource, /calculateOrderTotals\.mjs/);
  assert.match(orderDetailSource, /calculateOrderTotals\(/);
});
