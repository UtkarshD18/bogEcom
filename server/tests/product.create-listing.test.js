import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import CategoryModel from "../models/category.model.js";
import ProductModel from "../models/product.model.js";
import {
  createProduct,
  getProductById,
  getProducts,
} from "../controllers/product.controller.js";

let mongoServer;

const createMockRes = () => {
  const result = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return result;
};

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: "bogEcom-product-test" });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.afterEach(async () => {
  await Promise.all([ProductModel.deleteMany({}), CategoryModel.deleteMany({})]);
});

test("newly created product appears in listings and product detail even when optional fields are omitted", async () => {
  const category = await CategoryModel.create({
    name: "Test Category",
    slug: `test-category-${Date.now()}`,
  });

  const createReq = {
    body: {
      name: "Backend Created Test Product",
      category: String(category._id),
      price: 449,
      images: ["/product_1.webp"],
      thumbnail: "/product_1.webp",
      stock: 8,
    },
  };
  const createRes = createMockRes();

  await createProduct(createReq, createRes);

  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.body?.success, true);
  assert.equal(createRes.body?.data?.name, "Backend Created Test Product");

  const createdProductId = String(createRes.body?.data?._id || "");
  assert.ok(createdProductId);

  const listReq = {
    query: { limit: 20, page: 1 },
    user: null,
    userIsAdmin: false,
  };
  const listRes = createMockRes();
  await getProducts(listReq, listRes);

  assert.equal(listRes.statusCode, 200);
  assert.equal(listRes.body?.success, true);
  const listedProduct = (listRes.body?.data || []).find(
    (entry) => String(entry?._id || "") === createdProductId,
  );
  assert.ok(listedProduct);
  assert.equal(listedProduct?.available_quantity, 8);
  assert.equal(listedProduct?.brand, "Buy One Gram");

  const detailReq = {
    params: { id: createdProductId },
    user: null,
    userIsAdmin: false,
    membershipActive: false,
  };
  const detailRes = createMockRes();
  await getProductById(detailReq, detailRes);

  assert.equal(detailRes.statusCode, 200);
  assert.equal(detailRes.body?.success, true);
  assert.equal(detailRes.body?.data?.name, "Backend Created Test Product");
  assert.equal(detailRes.body?.data?.shortDescription, "");
  assert.equal(detailRes.body?.data?.available_quantity, 8);
});
