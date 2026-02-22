import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import SettingsModel from "../models/settings.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const checkoutPagePath = path.resolve(
  __dirname,
  "../../frontend/client/src/app/checkout/page.jsx",
);
const cartPagePath = path.resolve(
  __dirname,
  "../../frontend/client/src/app/cart/page.jsx",
);
const cartDrawerPath = path.resolve(
  __dirname,
  "../../frontend/client/src/components/CartDrawer.jsx",
);

const loadShippingRateServiceFresh = async () =>
  import(`../services/shippingRate.service.js?bust=${Date.now()}_${Math.random()}`);

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: "bogEcom-test" });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test.afterEach(async () => {
  await SettingsModel.deleteMany({});
});

test("display shipping metrics are forced to zero even when distance slabs are configured", async () => {
  await SettingsModel.create({
    key: "shippingSettings",
    value: {
      distanceRateChart: {
        RajasthanLocal: {
          base500: 40,
          add500: 25,
          nestedSlabs: { ultraLocal: 60 },
        },
        A: { base500: 24, add500: 14 },
        B: { base500: 42, add500: 26 },
        C: { base500: 80, add500: 30 },
      },
    },
    category: "checkout",
    isActive: true,
  });

  const { getShippingDisplayMetrics } = await loadShippingRateServiceFresh();
  const metrics = await getShippingDisplayMetrics();

  assert.equal(metrics.maxLocalBaseCharge, 0);
  assert.equal(metrics.maxLocalDisplayCharge, 0);
  assert.equal(metrics.maxIndiaBaseCharge, 0);
  assert.equal(metrics.maxIndiaDisplayCharge, 0);
});

test("display shipping metrics stay zero with default/fallback config as well", async () => {
  const { getShippingDisplayMetrics } = await loadShippingRateServiceFresh();
  const metrics = await getShippingDisplayMetrics();

  assert.equal(metrics.maxLocalBaseCharge, 0);
  assert.equal(metrics.maxLocalDisplayCharge, 0);
  assert.equal(metrics.maxIndiaBaseCharge, 0);
  assert.equal(metrics.maxIndiaDisplayCharge, 0);
});

test("UI summary renders strike-through shipping and explicit ₹0.00 label on checkout/cart/drawer", async () => {
  const [checkoutSource, cartSource, drawerSource] = await Promise.all([
    fs.readFile(checkoutPagePath, "utf8"),
    fs.readFile(cartPagePath, "utf8"),
    fs.readFile(cartDrawerPath, "utf8"),
  ]);

  // Checkout: display shipping is struck-through and free shipping label is visible.
  assert.match(checkoutSource, /displayShippingCharge > 0/);
  assert.match(checkoutSource, /line-through/);
  assert.match(checkoutSource, /0\.00/);
  assert.doesNotMatch(checkoutSource, />FREE</);

  // Cart + drawer should show the same visual contract.
  assert.match(cartSource, /displayShippingCharge > 0/);
  assert.match(cartSource, /line-through/);
  assert.match(cartSource, /0\.00/);
  assert.doesNotMatch(cartSource, />FREE</);

  assert.match(drawerSource, /displayShippingCharge > 0/);
  assert.match(drawerSource, /line-through/);
  assert.match(drawerSource, /0\.00/);
  assert.doesNotMatch(drawerSource, />FREE</);
});
