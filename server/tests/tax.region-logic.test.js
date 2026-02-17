import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateTax, splitGstInclusiveAmount } from "../services/tax.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const checkoutPagePath = path.resolve(
  __dirname,
  "../../frontend/client/src/app/checkout/page.jsx",
);

test("tax service shape remains backward compatible (IGST bucket in backend record)", () => {
  const taxFromExclusive = calculateTax(1000, "Rajasthan");
  assert.equal(taxFromExclusive.tax, 50);
  assert.equal(taxFromExclusive.igst, 50);
  assert.equal(taxFromExclusive.cgst, 0);
  assert.equal(taxFromExclusive.sgst, 0);

  const taxFromInclusive = splitGstInclusiveAmount(1050, 5, "Maharashtra");
  assert.equal(taxFromInclusive.grossAmount, 1050);
  assert.equal(taxFromInclusive.tax, 50);
  assert.equal(taxFromInclusive.igst, 50);
  assert.equal(taxFromInclusive.cgst, 0);
  assert.equal(taxFromInclusive.sgst, 0);
});

test("checkout UI shows GST before state entry, then switches to Rajasthan/IGST label by region", async () => {
  const source = await fs.readFile(checkoutPagePath, "utf8");

  // Before state is provided, UI should show generic GST label.
  assert.match(source, /const summaryTaxLabel = !hasCheckoutStateInput/);
  assert.match(source, /\? "GST"/);

  // Rajasthan should show combined SGST+CGST label once state is available.
  assert.match(source, /\? "GST \(S\.GST\+C\.GST\)"/);

  // Other states should show IGST.
  assert.match(source, /: "IGST";/);

  // Tax amount should remain derived from existing values (no business logic change).
  assert.match(source, /const summaryTaxAmount = !hasCheckoutStateInput/);
  assert.match(source, /\? tax/);
});

test("state detection keeps unknown states outside Rajasthan path and preserves state-driven behavior", async () => {
  const source = await fs.readFile(checkoutPagePath, "utf8");

  // Only exact normalized Rajasthan triggers SGST+CGST label.
  assert.match(source, /const normalizedCheckoutState = normalizeStateValue\(checkoutStateForPreview\);/);
  assert.match(source, /const isRajasthanDelivery = normalizedCheckoutState === "Rajasthan";/);
  assert.match(source, /const hasCheckoutStateInput = Boolean\(String\(checkoutStateForPreview \|\| ""\)\.trim\(\)\);/);
  assert.match(
    source,
    /useShippingDisplayCharge\(\{\s*isRajasthan: isRajasthanDelivery,\s*\}\)/,
  );
});
