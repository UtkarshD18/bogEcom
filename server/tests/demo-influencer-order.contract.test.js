import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const orderControllerPath = path.resolve(
  __dirname,
  "../controllers/order.controller.js",
);
const orderRoutePath = path.resolve(__dirname, "../routes/order.route.js");
const checkoutPagePath = path.resolve(
  __dirname,
  "../../frontend/client/src/app/checkout/page.jsx",
);

test("demo influencer order contract keeps shipping suppressed and exposes invoice + commission metadata", async () => {
  const source = await fs.readFile(orderControllerPath, "utf8");

  assert.match(source, /const shippingSuppressed = true;/);
  assert.match(source, /isDemoOrder:\s*true/);
  assert.match(source, /ensureOrderInvoice\(testOrder\)/);
  assert.match(source, /updateInfluencerStats\(/);
  assert.match(source, /xpressbeesPosted:\s*false/);
  assert.match(source, /influencerCommission/);
  assert.match(source, /local-test-invoices/);
  assert.match(source, /persistInvoiceSnapshotToDisk/);
});

test("demo order route is available only in non-production mode", async () => {
  const source = await fs.readFile(orderRoutePath, "utf8");

  assert.match(source, /if \(process\.env\.NODE_ENV !== "production"\)/);
  assert.match(source, /router\.post\("\/test\/create",\s*optionalAuth,\s*createTestOrder\)/);
  assert.match(
    source,
    /router\.post\("\/test\/save-invoice",\s*optionalAuth,\s*saveClientTestInvoiceToDisk\)/,
  );
});

test("checkout persists demo test invoice into local storage", async () => {
  const source = await fs.readFile(checkoutPagePath, "utf8");

  assert.match(source, /TEST_INVOICE_STORAGE_KEY = "bog_test_invoices"/);
  assert.match(source, /localStorage\.setItem\("bog_last_test_invoice"/);
  assert.match(source, /fetch\(`\$\{API_URL\}\/api\/orders\/test\/create`/);
  assert.match(source, /fetch\(`\$\{API_URL\}\/api\/orders\/test\/save-invoice`/);
});
