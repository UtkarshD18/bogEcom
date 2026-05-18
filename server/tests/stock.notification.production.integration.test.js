import assert from "node:assert/strict";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import AnalyticsEventModel from "../models/analyticsEvent.model.js";
import EmailLogModel from "../models/emailLog.model.js";
import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import StockNotificationModel from "../models/stockNotification.model.js";
import UserModel from "../models/user.model.js";

let mongoServer;
let apiServer;
let paytmServer;
let baseUrl = "";
let paytmBaseUrl = "";
let paytmStatuses = new Map();
let stockEmailAttempts = [];
let orderRouter;
let notificationRouter;
let productRouter;
let productDemandRouter;
let emailAutomationRouter;
let releaseExpiredReservations;
let setStockNotificationEmailSenderForTests;
let drainStockNotificationQueueForTests;
let resetStockNotificationQueueForTests;

const TEST_SECRET = "stock_notification_prod_secret_1234567890";

const startServer = async (app) =>
  new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...options,
  });
  const clonedResponse = response.clone();
  const payload = await response.json().catch(async () => ({
    rawText: await clonedResponse.text().catch(() => ""),
  }));
  return { response, payload };
};

const createProduct = async ({
  name = `Queue Product ${Date.now()}`,
  slug = `queue-product-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  price = 299,
  stock = 0,
} = {}) =>
  ProductModel.create({
    name,
    slug,
    category: new mongoose.Types.ObjectId(),
    price,
    originalPrice: price + 30,
    stock,
    stock_quantity: stock,
    reserved_quantity: 0,
    images: ["/product_1.webp"],
    thumbnail: "/product_1.webp",
  });

const createUser = async ({
  email = `admin-${Date.now()}@example.com`,
  name = "Admin User",
  role = "Admin",
  status = "active",
} = {}) =>
  UserModel.create({
    name,
    email,
    password: "password123",
    verifyEmail: true,
    role,
    status,
  });

const createAuthToken = (user) =>
  jwt.sign(
    {
      id: String(user?._id || ""),
    },
    TEST_SECRET,
    { expiresIn: "1h" },
  );

const createOrderLine = (product, quantity = 1) => ({
  productId: String(product?._id || ""),
  productTitle: String(product?.name || "Queue Product"),
  quantity,
  price: Number(product?.price || 0),
  image: "/product_1.webp",
  subTotal: Number(product?.price || 0) * quantity,
});

const buildGuestDetails = (email) => ({
  fullName: "Queue Test User",
  phone: "9876543210",
  flat_house: "12-A",
  area_street_sector: "Main Road",
  landmark: "Near Park",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302017",
  email,
});

const buildCreateOrderPayload = (product, email) => ({
  products: [createOrderLine(product)],
  totalAmt: Number(product?.price || 0),
  paymentProvider: "PAYTM",
  paymentType: "prepaid",
  guestDetails: buildGuestDetails(email),
});

const setSuccessfulEmailSender = () => {
  setStockNotificationEmailSenderForTests(async (payload) => {
    stockEmailAttempts.push(payload);
    return {
      success: true,
      messageId: `stock-notify-${stockEmailAttempts.length}`,
    };
  });
};

test.before(async () => {
  const paytmApp = express();
  paytmApp.use(express.json());
  paytmApp.post("/theia/api/v1/initiateTransaction", (_req, res) => {
    res.json({
      body: {
        resultInfo: { resultStatus: "S" },
        txnToken: "test_txn_token",
      },
    });
  });
  paytmApp.post("/v3/order/status", (req, res) => {
    const orderId = String(req.body?.body?.orderId || "").trim();
    const status = paytmStatuses.get(orderId) || "TXN_SUCCESS";
    res.json({
      body: {
        ORDERID: orderId,
        TXNID: `TXN_${orderId || Date.now()}`,
        STATUS: status,
        resultInfo: {
          resultStatus: status,
        },
      },
    });
  });
  paytmServer = await startServer(paytmApp);
  paytmBaseUrl = `http://127.0.0.1:${paytmServer.address().port}`;

  process.env.NODE_ENV = "development";
  process.env.ACCESS_TOKEN_SECRET = TEST_SECRET;
  process.env.PAY_ORDER_TOKEN_SECRET = TEST_SECRET;
  process.env.PAYTM_ENABLED = "true";
  process.env.PAYTM_MERCHANT_ID = "TESTMID123456789";
  process.env.PAYTM_MERCHANT_KEY = "1234567890ABCDEF";
  process.env.PAYTM_BASE_URL = paytmBaseUrl;
  process.env.PAYMENT_PROVIDER = "PAYTM";
  process.env.CLIENT_URL = "http://127.0.0.1:3000";
  process.env.INVENTORY_RESERVATION_ENABLED = "true";
  process.env.INVENTORY_RESERVATION_INTERVAL_SECONDS = "1";
  process.env.STOCK_NOTIFICATION_QUEUE_MODE = "memory";

  ({ default: orderRouter } = await import("../routes/order.route.js"));
  ({ default: notificationRouter } = await import("../routes/notification.route.js"));
  ({ default: productRouter } = await import("../routes/product.route.js"));
  ({ default: productDemandRouter } = await import("../routes/productDemand.route.js"));
  ({ default: emailAutomationRouter } = await import("../routes/emailAutomation.route.js"));
  ({ releaseExpiredReservations } = await import(
    "../services/inventoryReservationExpiry.service.js"
  ));
  ({ __setStockNotificationEmailSenderForTests: setStockNotificationEmailSenderForTests } =
    await import("../services/stockNotification.service.js"));
  ({
    __drainStockNotificationQueueForTests: drainStockNotificationQueueForTests,
    __resetStockNotificationQueueForTests: resetStockNotificationQueueForTests,
  } = await import("../services/stockNotificationQueue.service.js"));

  setSuccessfulEmailSender();

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "bogEcom-stock-notification-production",
  });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/orders", orderRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/products", productRouter);
  app.use("/api/admin", productDemandRouter);
  app.use("/api/email", emailAutomationRouter);
  app.use((err, _req, res, _next) => {
    res.status(err?.status || 500).json({
      error: true,
      success: false,
      message: err?.message || "Internal server error",
      code: err?.code || null,
    });
  });

  apiServer = await startServer(app);
  baseUrl = `http://127.0.0.1:${apiServer.address().port}`;
});

test.afterEach(async () => {
  paytmStatuses.clear();
  stockEmailAttempts = [];
  setSuccessfulEmailSender();
  await resetStockNotificationQueueForTests();
  await Promise.all([
    AnalyticsEventModel.deleteMany({}),
    EmailLogModel.deleteMany({}),
    OrderModel.deleteMany({}),
    ProductModel.deleteMany({}),
    StockNotificationModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
});

test.after(async () => {
  if (apiServer) {
    await new Promise((resolve) => apiServer.close(resolve));
  }
  if (paytmServer) {
    await new Promise((resolve) => paytmServer.close(resolve));
  }
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test("notify click analytics are stored and duplicate requests are prevented", async () => {
  const product = await createProduct({
    name: "Notify Analytics Product",
    slug: `notify-analytics-${Date.now()}`,
    stock: 0,
  });

  const firstRequest = await requestJson("/api/notifications/stock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: String(product._id),
      email: "guest-notify@example.com",
    }),
  });

  const secondRequest = await requestJson("/api/notifications/stock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: String(product._id),
      email: "guest-notify@example.com",
    }),
  });

  assert.equal(firstRequest.response.status, 201);
  assert.equal(secondRequest.response.status, 200);
  assert.equal(firstRequest.payload?.data?.requested, true);
  assert.equal(secondRequest.payload?.data?.alreadyRegistered, true);

  const notifications = await StockNotificationModel.find({
    product_id: product._id,
  }).lean();
  assert.equal(notifications.length, 1);

  const events = await AnalyticsEventModel.find({
    event_type: "notify_click",
    product_id: product._id,
  })
    .sort({ created_at: 1 })
    .lean();

  assert.equal(events.length, 2);
  assert.equal(events[0]?.email, "guest-notify@example.com");
  assert.equal(events[0]?.metadata?.status, "created");
  assert.equal(events[1]?.metadata?.status, "already_registered");
});

test("queue retries delivery and admin APIs expose waiting users and notification logs", async () => {
  const adminUser = await createUser({
    email: `stock-admin-${Date.now()}@example.com`,
    name: "Stock Admin",
    role: "Admin",
    status: "active",
  });
  const adminToken = createAuthToken(adminUser);
  const product = await createProduct({
    name: "Queue Retry Product",
    slug: `queue-retry-${Date.now()}`,
    stock: 0,
  });

  const subscribeResult = await requestJson("/api/notifications/stock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: String(product._id),
      email: "retry-notify@example.com",
    }),
  });

  assert.equal(subscribeResult.response.status, 201);

  const demandSummaryBefore = await requestJson("/api/admin/product-demand", {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  assert.equal(demandSummaryBefore.response.status, 200);
  const summaryRow = (demandSummaryBefore.payload?.data || []).find(
    (entry) => String(entry?.product_id || "") === String(product._id),
  );
  assert.equal(Number(summaryRow?.waiting_users_count || 0), 1);

  let attempt = 0;
  setStockNotificationEmailSenderForTests(async (payload) => {
    attempt += 1;
    stockEmailAttempts.push(payload);
    if (attempt === 1) {
      return {
        success: false,
        error: "temporary_smtp_failure",
      };
    }
    return {
      success: true,
      messageId: `retry-success-${attempt}`,
    };
  });

  const stockUpdateResult = await requestJson(`/api/products/${product._id}/stock`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      stock: 5,
    }),
  });

  assert.equal(stockUpdateResult.response.status, 200);
  await drainStockNotificationQueueForTests();

  assert.equal(stockEmailAttempts.length, 2);

  const notification = await StockNotificationModel.findOne({
    product_id: product._id,
  }).lean();
  assert.equal(notification?.notification_status, "sent");
  assert.equal(notification?.notified, true);

  const demandDetail = await requestJson(
    `/api/admin/product-demand/${product._id}`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  );

  assert.equal(demandDetail.response.status, 200);
  assert.equal(Number(demandDetail.payload?.data?.waiting_users_count || 0), 0);
  assert.equal(
    demandDetail.payload?.data?.requests?.[0]?.notification_status,
    "sent",
  );

  const emailLogsResult = await requestJson(
    "/api/email/admin/logs?days=30&page=1&limit=20",
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  );

  assert.equal(emailLogsResult.response.status, 200);
  const stockLog = (emailLogsResult.payload?.data || []).find(
    (entry) =>
      entry?.email_type === "stock_back_in_stock" &&
      entry?.to_email === "retry-notify@example.com",
  );
  assert.ok(stockLog);
  assert.equal(stockLog?.status, "sent");
  assert.equal(stockLog?.metadata?.productName, product.name);
});

test("stock-out and restock conversion analytics capture the notification lifecycle after purchase", async () => {
  const product = await createProduct({
    name: "Conversion Analytics Product",
    slug: `conversion-analytics-${Date.now()}`,
    stock: 1,
  });

  const reserveOrder = await requestJson("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildCreateOrderPayload(product, "reservation-holder@example.com"),
    ),
  });

  assert.equal(reserveOrder.response.status, 201);

  const subscribeResult = await requestJson("/api/notifications/stock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: String(product._id),
      email: "converted-user@example.com",
    }),
  });
  assert.equal(subscribeResult.response.status, 201);

  await OrderModel.updateOne(
    { _id: reserveOrder.payload?.data?.orderId },
    {
      $set: {
        reservationExpiresAt: new Date(Date.now() - 2_000),
      },
    },
  );

  await releaseExpiredReservations();
  await drainStockNotificationQueueForTests();

  const purchaseOrder = await requestJson("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildCreateOrderPayload(product, "converted-user@example.com"),
    ),
  });

  assert.equal(purchaseOrder.response.status, 201);
  const merchantTransactionId = String(
    purchaseOrder.payload?.data?.merchantTransactionId || "",
  ).trim();
  paytmStatuses.set(merchantTransactionId, "TXN_SUCCESS");

  const webhookResult = await requestJson("/api/orders/webhook/paytm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-requested-with": "fetch",
    },
    body: JSON.stringify({
      merchantTransactionId,
      paymentState: "success",
      source: "integration_test",
    }),
  });

  assert.ok([200, 303].includes(webhookResult.response.status));

  const stockOutEvents = await AnalyticsEventModel.find({
    event_type: "stock_out",
    product_id: product._id,
  }).lean();
  assert.ok(stockOutEvents.length >= 1);

  const restockEvent = await AnalyticsEventModel.findOne({
    event_type: "restock_conversion",
    product_id: product._id,
  }).lean();
  assert.ok(restockEvent);
  assert.equal(Number(restockEvent?.metadata?.notified_users_count || 0), 1);
  assert.equal(Number(restockEvent?.metadata?.converted_users_count || 0), 1);

  const notification = await StockNotificationModel.findOne({
    product_id: product._id,
  }).lean();
  assert.ok(notification?.restock_batch_key);
  assert.ok(notification?.converted_at);
  assert.equal(
    String(notification?.converted_order_id || ""),
    String(purchaseOrder.payload?.data?.orderId || ""),
  );
});
