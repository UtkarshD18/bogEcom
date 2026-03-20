import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Category from "../models/category.model.js";
import Partner from "../models/partner.model.js";
import PartnerApiKey from "../models/partnerApiKey.model.js";
import Product from "../models/product.model.js";
import partnerApiRouter from "../routes/partnerApi.route.js";

let mongoServer;
let httpServer;
let baseUrl = "";

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload =
    response.status === 304 ? null : await response.json();
  return { response, payload };
};

const buildPartnerApiKey = () => {
  const keyPrefix = `hogp_test${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
  const apiKey = `${keyPrefix}.${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
  return { apiKey, keyPrefix, keyHash };
};

const seedPartner = async ({ scopes = ["catalog.read", "inventory.read", "price.read"] } = {}) => {
  const partner = await Partner.create({
    name: `Partner ${Date.now()}`,
    contactEmail: `partner-${Date.now()}@example.com`,
    status: "active",
    scopes,
  });

  const key = buildPartnerApiKey();
  await PartnerApiKey.create({
    partnerId: partner._id,
    keyPrefix: key.keyPrefix,
    keyHash: key.keyHash,
    status: "active",
  });

  return {
    partner,
    apiKey: key.apiKey,
  };
};

const seedCatalog = async () => {
  const category = await Category.create({
    name: "Nuts",
    slug: `nuts-${Date.now()}`,
    isActive: true,
  });

  const product = await Product.create({
    name: "Almond 500g",
    slug: `almond-500g-${Date.now()}`,
    description: "Premium almonds",
    shortDescription: "Crunchy almonds",
    price: 599,
    originalPrice: 699,
    discount: 14,
    images: ["https://example.com/almond.jpg"],
    category: category._id,
    sku: `ALM-${Date.now()}`,
    stock: 20,
    stock_quantity: 20,
    reserved_quantity: 2,
    tags: ["dry-fruits", "protein"],
    isActive: true,
  });

  return { category, product };
};

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: "bogEcom-partner-test" });

  const app = express();
  app.use(express.json());
  app.use("/api/v1/partner", partnerApiRouter);
  app.use((err, _req, res, _next) => {
    res.status(err?.status || 500).json({
      success: false,
      message: err?.message || "Internal server error",
    });
  });

  httpServer = await new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });

  const { port } = httpServer.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.afterEach(async () => {
  await Promise.all([
    PartnerApiKey.deleteMany({}),
    Partner.deleteMany({}),
    Product.deleteMany({}),
    Category.deleteMany({}),
  ]);
});

test.after(async () => {
  if (httpServer) {
    await new Promise((resolve, reject) => {
      httpServer.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test("GET /api/v1/partner/guide?format=json returns shareable partner guide", async () => {
  const { response, payload } = await requestJson("/api/v1/partner/guide?format=json");

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.version, "v1");
  assert.ok(Array.isArray(payload.data.endpoints));
  assert.ok(payload.data.endpoints.some((endpoint) => endpoint.path === "/products"));
});

test("GET /api/v1/partner/products rejects missing API key", async () => {
  const { response, payload } = await requestJson("/api/v1/partner/products");

  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, "UNAUTHORIZED");
});

test("GET /api/v1/partner/inventory enforces scope checks", async () => {
  const { apiKey } = await seedPartner({ scopes: ["catalog.read"] });

  const { response, payload } = await requestJson("/api/v1/partner/inventory", {
    headers: {
      "x-api-key": apiKey,
    },
  });

  assert.equal(response.status, 403);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, "INSUFFICIENT_SCOPE");
});

test("GET /api/v1/partner/products returns expected partner payload with ETag", async () => {
  const { partner, apiKey } = await seedPartner();
  const { product } = await seedCatalog();

  const first = await requestJson("/api/v1/partner/products?limit=10&page=1", {
    headers: {
      "x-api-key": apiKey,
    },
  });

  assert.equal(first.response.status, 200);
  assert.equal(first.payload.success, true);
  assert.equal(first.payload.meta.version, "v1");
  assert.equal(first.payload.meta.partnerId, String(partner._id));
  assert.ok(Array.isArray(first.payload.data));
  assert.ok(first.payload.data.length >= 1);

  const item = first.payload.data.find((entry) => entry.id === String(product._id));
  assert.ok(item);
  assert.equal(item.sku, product.sku);
  assert.equal(item.price.amount, 599);
  assert.equal(item.stock.status, "in_stock");
  assert.equal(item.stock.availableQuantity, 18);
  assert.equal(item.shipping.freeShipping, true);
  assert.match(item.productUrl, /\/product\//);

  const etag = first.response.headers.get("etag");
  assert.ok(etag);

  const second = await requestJson("/api/v1/partner/products?limit=10&page=1", {
    headers: {
      "x-api-key": apiKey,
      "if-none-match": etag,
    },
  });

  assert.equal(second.response.status, 304);
});

test("GET /api/v1/partner/products/:productId returns product details for valid id", async () => {
  const { apiKey } = await seedPartner({ scopes: ["catalog.read"] });
  const { product } = await seedCatalog();

  const { response, payload } = await requestJson(
    `/api/v1/partner/products/${String(product._id)}`,
    {
      headers: {
        "x-api-key": apiKey,
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.id, String(product._id));
  assert.equal(payload.data.name, "Almond 500g");
  assert.equal(payload.data.price.amount, 599);
  assert.equal(payload.data.stock.availableQuantity, 18);
});

test("GET /api/v1/partner/products/:productId returns 404 for unknown product", async () => {
  const { apiKey } = await seedPartner({ scopes: ["catalog.read"] });

  const { response, payload } = await requestJson(
    "/api/v1/partner/products/unknown-product-slug",
    {
      headers: {
        "x-api-key": apiKey,
      },
    },
  );

  assert.equal(response.status, 404);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, "NOT_FOUND");
});