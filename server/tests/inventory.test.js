import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import ProductModel from "../models/product.model.js";
import OrderModel from "../models/order.model.js";
import PurchaseOrderModel from "../models/purchaseOrder.model.js";
import InventoryAuditModel from "../models/inventoryAudit.model.js";
import {
  applyPurchaseOrderInventory,
  confirmInventory,
  releaseInventory,
  reserveInventory,
  restoreInventory,
} from "../services/inventory.service.js";

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "bogEcom-test",
  });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.afterEach(async () => {
  await ProductModel.deleteMany({});
  await PurchaseOrderModel.deleteMany({});
  await InventoryAuditModel.deleteMany({});
});

test("reserveInventory reserves stock when available", async () => {
  const product = await ProductModel.create({
    name: "Test",
    slug: "test-product-1",
    price: 100,
    category: new mongoose.Types.ObjectId(),
    stock: 10,
    stock_quantity: 10,
  });

  const order = new OrderModel({
    products: [
      {
        productId: product._id.toString(),
        productTitle: "Test",
        quantity: 2,
        price: 100,
        subTotal: 200,
      },
    ],
    totalAmt: 200,
  });

  await reserveInventory(order, "TEST");

  const updated = await ProductModel.findById(product._id).lean();
  assert.equal(updated.reserved_quantity, 2);
});

test("reserveInventory throws when insufficient stock", async () => {
  const product = await ProductModel.create({
    name: "Test",
    slug: "test-product-2",
    price: 100,
    category: new mongoose.Types.ObjectId(),
    stock: 1,
    stock_quantity: 1,
  });

  const order = new OrderModel({
    products: [
      {
        productId: product._id.toString(),
        productTitle: "Test",
        quantity: 2,
        price: 100,
        subTotal: 200,
      },
    ],
    totalAmt: 200,
  });

  await assert.rejects(() => reserveInventory(order, "TEST"));
  const updated = await ProductModel.findById(product._id).lean();
  assert.equal(updated.reserved_quantity ?? 0, 0);
});

test("confirmInventory deducts reserved stock", async () => {
  const product = await ProductModel.create({
    name: "Test",
    slug: "test-product-3",
    price: 100,
    category: new mongoose.Types.ObjectId(),
    stock: 10,
    stock_quantity: 10,
  });

  const order = new OrderModel({
    products: [
      {
        productId: product._id.toString(),
        productTitle: "Test",
        quantity: 3,
        price: 100,
        subTotal: 300,
      },
    ],
    totalAmt: 300,
  });

  await reserveInventory(order, "TEST");
  await confirmInventory(order, "TEST");

  const updated = await ProductModel.findById(product._id).lean();
  assert.equal(updated.stock_quantity, 7);
  assert.equal(updated.reserved_quantity, 0);
});

test("releaseInventory restores reserved stock on failure", async () => {
  const product = await ProductModel.create({
    name: "Test",
    slug: "test-product-4",
    price: 100,
    category: new mongoose.Types.ObjectId(),
    stock: 5,
    stock_quantity: 5,
  });

  const order = new OrderModel({
    products: [
      {
        productId: product._id.toString(),
        productTitle: "Test",
        quantity: 2,
        price: 100,
        subTotal: 200,
      },
    ],
    totalAmt: 200,
  });

  await reserveInventory(order, "TEST");
  await releaseInventory(order, "TEST");

  const updated = await ProductModel.findById(product._id).lean();
  assert.equal(updated.reserved_quantity, 0);
});

test("restoreInventory returns stock after cancellation", async () => {
  const product = await ProductModel.create({
    name: "Test",
    slug: "test-product-5",
    price: 100,
    category: new mongoose.Types.ObjectId(),
    stock: 6,
    stock_quantity: 6,
  });

  const order = new OrderModel({
    products: [
      {
        productId: product._id.toString(),
        productTitle: "Test",
        quantity: 2,
        price: 100,
        subTotal: 200,
      },
    ],
    totalAmt: 200,
  });

  await reserveInventory(order, "TEST");
  await confirmInventory(order, "TEST");
  await restoreInventory(order, "TEST");

  const updated = await ProductModel.findById(product._id).lean();
  assert.equal(updated.stock_quantity, 6);
});

test("applyPurchaseOrderInventory is idempotent", async () => {
  const product = await ProductModel.create({
    name: "Test",
    slug: "test-product-6",
    price: 100,
    category: new mongoose.Types.ObjectId(),
    stock: 0,
    stock_quantity: 0,
  });

  const po = await PurchaseOrderModel.create({
    items: [
      {
        productId: product._id,
        productTitle: "Test",
        quantity: 5,
        price: 100,
        subTotal: 500,
      },
    ],
    subtotal: 500,
    tax: 0,
    shipping: 0,
    total: 500,
    status: "approved",
  });

  await applyPurchaseOrderInventory(po, { receivedItems: [] });
  await applyPurchaseOrderInventory(po, { receivedItems: [] });

  const updated = await ProductModel.findById(product._id).lean();
  assert.equal(updated.stock_quantity, 5);
});

test("reserveInventory reserves variant stock", async () => {
  const product = await ProductModel.create({
    name: "Variant Product",
    slug: "test-product-7",
    price: 100,
    category: new mongoose.Types.ObjectId(),
    hasVariants: true,
    variants: [
      {
        name: "500g",
        sku: "SKU-500",
        price: 120,
        stock: 5,
        stock_quantity: 5,
      },
    ],
  });

  const variantId = product.variants[0]._id.toString();
  const order = new OrderModel({
    products: [
      {
        productId: product._id.toString(),
        productTitle: "Variant Product",
        variantId,
        quantity: 2,
        price: 120,
        subTotal: 240,
      },
    ],
    totalAmt: 240,
  });

  await reserveInventory(order, "TEST");

  const updated = await ProductModel.findById(product._id).lean();
  const updatedVariant = updated.variants.find(
    (variant) => String(variant._id) === String(variantId),
  );
  assert.equal(updatedVariant.reserved_quantity, 2);
});

test("confirmInventory deducts variant stock", async () => {
  const product = await ProductModel.create({
    name: "Variant Product",
    slug: "test-product-8",
    price: 100,
    category: new mongoose.Types.ObjectId(),
    hasVariants: true,
    variants: [
      {
        name: "1kg",
        sku: "SKU-1KG",
        price: 200,
        stock: 6,
        stock_quantity: 6,
      },
    ],
  });

  const variantId = product.variants[0]._id.toString();
  const order = new OrderModel({
    products: [
      {
        productId: product._id.toString(),
        productTitle: "Variant Product",
        variantId,
        quantity: 3,
        price: 200,
        subTotal: 600,
      },
    ],
    totalAmt: 600,
  });

  await reserveInventory(order, "TEST");
  await confirmInventory(order, "TEST");

  const updated = await ProductModel.findById(product._id).lean();
  const updatedVariant = updated.variants.find(
    (variant) => String(variant._id) === String(variantId),
  );
  assert.equal(updatedVariant.stock_quantity, 3);
  assert.equal(updatedVariant.reserved_quantity, 0);
});

test("applyPurchaseOrderInventory increments targeted variant by variantId", async () => {
  const product = await ProductModel.create({
    name: "PO Variant Product",
    slug: "test-product-9",
    price: 100,
    category: new mongoose.Types.ObjectId(),
    hasVariants: true,
    stock: 12,
    stock_quantity: 12,
    variants: [
      {
        name: "500g",
        sku: "SKU-PO-500",
        price: 99,
        weight: 500,
        unit: "g",
        stock: 6,
        stock_quantity: 6,
      },
      {
        name: "1kg",
        sku: "SKU-PO-1KG",
        price: 179,
        weight: 1,
        unit: "kg",
        stock: 6,
        stock_quantity: 6,
      },
    ],
  });

  const targetVariantId = String(product.variants[1]._id);
  const po = await PurchaseOrderModel.create({
    items: [
      {
        productId: product._id,
        productTitle: "PO Variant Product",
        variantId: targetVariantId,
        quantity: 4,
        price: 179,
        subTotal: 716,
      },
    ],
    subtotal: 716,
    tax: 0,
    shipping: 0,
    total: 716,
    status: "approved",
  });

  await applyPurchaseOrderInventory(po, { receivedItems: [] });

  const updatedProduct = await ProductModel.findById(product._id).lean();
  const variant500 = updatedProduct.variants.find(
    (variant) => String(variant._id) === String(product.variants[0]._id),
  );
  const variant1kg = updatedProduct.variants.find(
    (variant) => String(variant._id) === targetVariantId,
  );
  assert.equal(variant500.stock_quantity, 6);
  assert.equal(variant1kg.stock_quantity, 10);
  assert.equal(updatedProduct.stock_quantity, 16);

  const updatedPo = await PurchaseOrderModel.findById(po._id).lean();
  assert.equal(String(updatedPo.items[0].variantId), targetVariantId);
  assert.equal(updatedPo.items[0].packing, "1kg");
  assert.equal(updatedPo.items[0].variantName, "1kg");
});

test("applyPurchaseOrderInventory resolves variant from packing and syncs parent stock when hasVariants flag is false", async () => {
  const product = await ProductModel.create({
    name: "PO Variant Product Legacy",
    slug: "test-product-10",
    price: 100,
    category: new mongoose.Types.ObjectId(),
    hasVariants: false,
    stock: 0,
    stock_quantity: 0,
    variants: [
      {
        name: "500g",
        sku: "SKU-PO-LEGACY-500",
        price: 99,
        weight: 500,
        unit: "g",
        stock: 3,
        stock_quantity: 3,
      },
      {
        name: "Sprouts(Big)",
        sku: "SKU-PO-LEGACY-1KG",
        price: 179,
        weight: 1,
        unit: "kg",
        stock: 3,
        stock_quantity: 3,
      },
    ],
  });

  const po = await PurchaseOrderModel.create({
    items: [
      {
        productId: product._id,
        productTitle: "PO Variant Product Legacy",
        packing: "1kg",
        quantity: 2,
        price: 179,
        subTotal: 358,
      },
    ],
    subtotal: 358,
    tax: 0,
    shipping: 0,
    total: 358,
    status: "approved",
  });

  await applyPurchaseOrderInventory(po, { receivedItems: [] });

  const updatedProduct = await ProductModel.findById(product._id).lean();
  const variant500 = updatedProduct.variants.find(
    (variant) => String(variant._id) === String(product.variants[0]._id),
  );
  const variant1kg = updatedProduct.variants.find(
    (variant) => String(variant._id) === String(product.variants[1]._id),
  );

  assert.equal(variant500.stock_quantity, 3);
  assert.equal(variant1kg.stock_quantity, 5);
  assert.equal(updatedProduct.stock_quantity, 8);
  assert.equal(updatedProduct.stock, 8);
});
