import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { io as createSocketClient } from "socket.io-client";
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
let sentStockEmails = [];
let orderRouter;
let productRouter;
let notificationRouter;
let releaseExpiredReservations;
let setStockNotificationEmailSenderForTests;
let drainStockNotificationQueueForTests;
let resetStockNotificationQueueForTests;
let initSocket;

const TEST_SECRET = "reservation_integration_secret_1234567890";
const SOCKET_CONNECT_TIMEOUT_MS = process.env.CI ? 15000 : 8000;
const SOCKET_EVENT_TIMEOUT_MS = process.env.CI ? 12000 : 5000;
const MONGO_SELECTION_TIMEOUT_MS = process.env.CI ? 15000 : 5000;

const startServer = async (app) =>
  new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });

const connectMongo = async () => {
  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create();
  }

  const uri = mongoServer.getUri();
  await mongoose.connect(uri, {
    dbName: "bogEcom-reservation-integration",
    serverSelectionTimeoutMS: MONGO_SELECTION_TIMEOUT_MS,
  });
};

const ensureMongoConnection = async () => {
  if (mongoose.connection.readyState === 2) {
    try {
      await mongoose.connection.asPromise();
      return;
    } catch {
      // Fall through to reconnect.
    }
  }

  if (mongoose.connection.readyState === 1) {
    try {
      await mongoose.connection.db.admin().ping();
      return;
    } catch (error) {
      // Connection dropped; fall through to reconnect.
    }
  }

  try {
    await connectMongo();
  } catch (error) {
    if (mongoServer) {
      await mongoServer.stop().catch(() => {});
    }
    mongoServer = null;
    await connectMongo();
  }
};

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
  name = `Reservation Product ${Date.now()}`,
  slug = `reservation-product-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  price = 299,
  stock = 1,
} = {}) =>
  ProductModel.create({
    name,
    slug,
    category: new mongoose.Types.ObjectId(),
    price,
    originalPrice: price + 50,
    stock,
    stock_quantity: stock,
    reserved_quantity: 0,
    images: ["/product_1.webp"],
    thumbnail: "/product_1.webp",
  });

const createOrderLine = (product, quantity = 1) => ({
  productId: String(product?._id || ""),
  productTitle: String(product?.name || "Reservation Product"),
  quantity,
  price: Number(product?.price || 0),
  image: "/product_1.webp",
  subTotal: Number(product?.price || 0) * quantity,
});

const buildGuestDetails = (email) => ({
  fullName: "Reservation Tester",
  phone: "9876543210",
  flat_house: "12-A",
  area_street_sector: "Main Road",
  landmark: "Near Park",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302017",
  email,
});

const createUser = async ({
  email = `notify-user-${Date.now()}@example.com`,
  name = "Notify User",
  role = "User",
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

const buildCreateOrderPayload = (product, email) => ({
  products: [createOrderLine(product)],
  totalAmt: Number(product?.price || 0),
  paymentProvider: "PAYTM",
  paymentType: "prepaid",
  guestDetails: buildGuestDetails(email),
});

const buildManualOrderPayload = (product, email) => ({
  products: [createOrderLine(product)],
  totalAmt: Number(product?.price || 0),
  subtotal: Number(product?.price || 0),
  finalAmount: Number(product?.price || 0),
  payment_status: "pending",
  order_status: "pending",
  paymentMethod: "PAYTM",
  billingDetails: buildGuestDetails(email),
  guestDetails: buildGuestDetails(email),
});

const buildPayOrderToken = (order, email) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const issuedAt = Date.now();
  const orderReferenceId = String(order?.temp_id || order?._id || "").trim();
  const signature = crypto
    .createHmac("sha256", process.env.PAY_ORDER_TOKEN_SECRET)
    .update(`${orderReferenceId}.${normalizedEmail}.${issuedAt}`)
    .digest("hex");

  return `${issuedAt.toString(36)}.${signature}`;
};

const connectRealtimeClient = async ({ token = "" } = {}) =>
  new Promise((resolve, reject) => {
    const socket = createSocketClient(baseUrl, {
      withCredentials: true,
      transports: ["websocket"],
      reconnection: false,
      timeout: SOCKET_CONNECT_TIMEOUT_MS,
      ...(token ? { auth: { token } } : {}),
    });

    const handleConnect = () => {
      socket.off("connect_error", handleError);
      resolve(socket);
    };

    const handleError = (error) => {
      socket.off("connect", handleConnect);
      socket.close();
      reject(error);
    };

    socket.once("connect", handleConnect);
    socket.once("connect_error", handleError);
  });

const waitForSocketEvent = (
  socket,
  eventName,
  predicate = () => true,
  timeoutMs = SOCKET_EVENT_TIMEOUT_MS,
) =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      socket.off(eventName, handleEvent);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    const handleEvent = (payload) => {
      try {
        if (!predicate(payload)) {
          return;
        }
        clearTimeout(timeoutId);
        socket.off(eventName, handleEvent);
        resolve(payload);
      } catch (error) {
        clearTimeout(timeoutId);
        socket.off(eventName, handleEvent);
        reject(error);
      }
    };

    socket.on(eventName, handleEvent);
  });

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

  ({ default: orderRouter } = await import("../routes/order.route.js"));
  ({ default: productRouter } = await import("../routes/product.route.js"));
  ({ default: notificationRouter } =
    await import("../routes/notification.route.js"));
  ({ initSocket } = await import("../realtime/socket.js"));
  ({ releaseExpiredReservations } =
    await import("../services/inventoryReservationExpiry.service.js"));
  ({
    __setStockNotificationEmailSenderForTests:
      setStockNotificationEmailSenderForTests,
  } = await import("../services/stockNotification.service.js"));
  ({
    __drainStockNotificationQueueForTests: drainStockNotificationQueueForTests,
    __resetStockNotificationQueueForTests: resetStockNotificationQueueForTests,
  } = await import("../services/stockNotificationQueue.service.js"));

  setStockNotificationEmailSenderForTests(async (payload) => {
    sentStockEmails.push(payload);
    return {
      success: true,
      messageId: `stock-notify-${sentStockEmails.length}`,
    };
  });

  await connectMongo();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/products", productRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/notifications", notificationRouter);
  app.use((err, _req, res, _next) => {
    res.status(err?.status || 500).json({
      error: true,
      success: false,
      message: err?.message || "Internal server error",
      code: err?.code || null,
    });
  });

  apiServer = await startServer(app);
  initSocket(apiServer, {
    origins: ["http://127.0.0.1"],
    jwtSecret: TEST_SECRET,
  });
  baseUrl = `http://127.0.0.1:${apiServer.address().port}`;
});

test.afterEach(async () => {
  await ensureMongoConnection();
  paytmStatuses.clear();
  sentStockEmails = [];
  if (typeof resetStockNotificationQueueForTests === "function") {
    await resetStockNotificationQueueForTests();
  }
  await Promise.all([
    OrderModel.deleteMany({}),
    ProductModel.deleteMany({}),
    StockNotificationModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
});

test.beforeEach(async () => {
  await ensureMongoConnection();
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

test("POST /api/orders reserves the last unit and product APIs expose zero available stock", async () => {
  const product = await createProduct();

  const createResult = await requestJson("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildCreateOrderPayload(product, "buyer-a@example.com"),
    ),
  });

  assert.equal(createResult.response.status, 201);
  assert.equal(createResult.payload?.success, true);
  assert.ok(String(createResult.payload?.data?.paymentUrl || "").trim());
  assert.ok(
    String(createResult.payload?.data?.merchantTransactionId || "").startsWith(
      "BOG_",
    ),
  );

  const detailResult = await requestJson(`/api/products/${product._id}`);
  assert.equal(detailResult.response.status, 200);
  assert.equal(detailResult.payload?.data?.available_quantity, 0);
  assert.equal(detailResult.payload?.data?.available_stock, 0);
  assert.equal(detailResult.payload?.data?.availableStock, 0);
  assert.ok(Number(detailResult.payload?.data?.stock_sync_version || 0) >= 0);

  const listResult = await requestJson("/api/products?limit=10");
  const listedProduct = (listResult.payload?.data || []).find(
    (entry) => String(entry?._id || "") === String(product._id),
  );
  assert.equal(listedProduct?.available_quantity, 0);
  assert.equal(listedProduct?.available_stock, 0);

  const secondBuyer = await requestJson("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildCreateOrderPayload(product, "buyer-b@example.com"),
    ),
  });

  assert.equal(secondBuyer.response.status, 409);
  assert.equal(secondBuyer.payload?.success, false);
  assert.match(
    String(secondBuyer.payload?.message || ""),
    /insufficient stock|stock/i,
  );
});

test("GET /api/orders/pay-order/:orderId reserves inventory for the payment page and blocks the second user", async () => {
  const product = await createProduct({
    name: "Pay Order Product",
    slug: `pay-order-product-${Date.now()}`,
  });

  const orderA = await OrderModel.create(
    buildManualOrderPayload(product, "pay-user-a@example.com"),
  );
  const tokenA = buildPayOrderToken(orderA, "pay-user-a@example.com");

  const payOrderA = await requestJson(
    `/api/orders/pay-order/${orderA._id}?key=${encodeURIComponent(tokenA)}`,
  );

  assert.equal(payOrderA.response.status, 200);
  assert.equal(payOrderA.payload?.success, true);
  assert.equal(payOrderA.payload?.data?.reservationStatus, "reserved");
  assert.equal(payOrderA.payload?.data?.payable, true);
  assert.ok(Number(payOrderA.payload?.data?.reservationSecondsRemaining) > 0);

  const productAfterReserve = await requestJson(`/api/products/${product._id}`);
  assert.equal(productAfterReserve.payload?.data?.available_quantity, 0);

  const orderB = await OrderModel.create(
    buildManualOrderPayload(product, "pay-user-b@example.com"),
  );
  const tokenB = buildPayOrderToken(orderB, "pay-user-b@example.com");

  const payOrderB = await requestJson(
    `/api/orders/pay-order/${orderB._id}?key=${encodeURIComponent(tokenB)}`,
  );

  assert.equal(payOrderB.response.status, 200);
  assert.equal(payOrderB.payload?.success, true);
  assert.equal(payOrderB.payload?.data?.reservationStatus, "unavailable");
  assert.equal(payOrderB.payload?.data?.payable, false);
});

test("expired reservation is released and product availability is restored", async () => {
  const product = await createProduct({
    name: "Expiry Release Product",
    slug: `expiry-release-product-${Date.now()}`,
  });

  const order = await OrderModel.create(
    buildManualOrderPayload(product, "expiry-user@example.com"),
  );
  const token = buildPayOrderToken(order, "expiry-user@example.com");

  const reservedResult = await requestJson(
    `/api/orders/pay-order/${order._id}?key=${encodeURIComponent(token)}`,
  );
  assert.equal(reservedResult.payload?.data?.reservationStatus, "reserved");

  await OrderModel.updateOne(
    { _id: order._id },
    {
      $set: {
        reservationExpiresAt: new Date(Date.now() - 2_000),
      },
    },
  );

  await releaseExpiredReservations();

  const updatedOrder = await OrderModel.findById(order._id).lean();
  assert.equal(String(updatedOrder?.inventoryStatus || ""), "released");
  assert.equal(updatedOrder?.reservationExpiresAt, null);

  const productAfterExpiry = await requestJson(`/api/products/${product._id}`);
  assert.equal(productAfterExpiry.payload?.data?.available_quantity, 1);
  assert.equal(productAfterExpiry.payload?.data?.available_stock, 1);
});

test("successful payment confirmation within the reservation window deducts stock permanently", async () => {
  const product = await createProduct({
    name: "Webhook Success Product",
    slug: `webhook-success-product-${Date.now()}`,
  });

  const createResult = await requestJson("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildCreateOrderPayload(product, "paid-user@example.com"),
    ),
  });

  assert.equal(createResult.response.status, 201);
  const merchantTransactionId = String(
    createResult.payload?.data?.merchantTransactionId || "",
  ).trim();
  assert.ok(merchantTransactionId);
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
  if (webhookResult.response.status === 200) {
    assert.equal(webhookResult.payload?.success, true);
    assert.equal(webhookResult.payload?.data?.paymentState, "paid");
  } else {
    const redirectLocation = String(
      webhookResult.response.headers.get("location") || "",
    );
    assert.match(redirectLocation, /paymentstate=paid/i);
  }

  const updatedOrder = await OrderModel.findById(
    createResult.payload?.data?.orderId,
  ).lean();
  assert.equal(String(updatedOrder?.payment_status || ""), "paid");
  assert.equal(String(updatedOrder?.inventoryStatus || ""), "deducted");
  assert.equal(updatedOrder?.reservationExpiresAt, null);

  const updatedProduct = await ProductModel.findById(product._id).lean();
  assert.equal(Number(updatedProduct?.stock_quantity || 0), 0);
  assert.equal(Number(updatedProduct?.reserved_quantity || 0), 0);

  const productDetail = await requestJson(`/api/products/${product._id}`);
  assert.equal(productDetail.payload?.data?.available_quantity, 0);
});

test("successful payment keeps customer name, phone, and address details on the stored order", async () => {
  const product = await createProduct({
    name: "Stored Details Product",
    slug: `stored-details-product-${Date.now()}`,
  });

  const createResult = await requestJson("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildCreateOrderPayload(product, "details-user@example.com"),
    ),
  });

  assert.equal(createResult.response.status, 201);
  const orderId = createResult.payload?.data?.orderId;
  const merchantTransactionId = String(
    createResult.payload?.data?.merchantTransactionId || "",
  ).trim();
  assert.ok(orderId);
  assert.ok(merchantTransactionId);

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
      source: "integration_test_details",
    }),
  });

  assert.ok([200, 303].includes(webhookResult.response.status));

  const savedOrder = await OrderModel.findById(orderId).lean();
  assert.equal(String(savedOrder?.payment_status || ""), "paid");
  assert.ok(savedOrder?.paymentCompletedAt);
  assert.equal(
    String(savedOrder?.billingDetails?.fullName || ""),
    "Reservation Tester",
  );
  assert.equal(String(savedOrder?.billingDetails?.phone || ""), "9876543210");
  assert.equal(
    String(savedOrder?.guestDetails?.fullName || ""),
    "Reservation Tester",
  );
  assert.equal(String(savedOrder?.guestDetails?.phone || ""), "9876543210");
  assert.match(
    String(
      savedOrder?.billingDetails?.address ||
        savedOrder?.deliveryAddressSnapshot?.address_line1 ||
        savedOrder?.deliveryAddressSnapshot?.full_address ||
        "",
    ),
    /main road/i,
  );
});

test("admin and manager cannot manually change order status", async () => {
  const product = await createProduct({
    name: "Manual Status Block Product",
    slug: `manual-status-block-${Date.now()}`,
  });
  const order = await OrderModel.create(
    buildManualOrderPayload(product, "status-block@example.com"),
  );
  const adminUser = await createUser({
    email: `manual-status-admin-${Date.now()}@example.com`,
    name: "Manual Status Admin",
    role: "Admin",
  });
  const managerUser = await createUser({
    email: `manual-status-manager-${Date.now()}@example.com`,
    name: "Manual Status Manager",
    role: "Manager",
  });
  managerUser.managerPermissions = ["manage_orders"];
  await managerUser.save();

  for (const actor of [adminUser, managerUser]) {
    const token = createAuthToken(actor);
    const result = await requestJson(`/api/orders/${order._id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ order_status: "shipped" }),
    });

    assert.equal(result.response.status, 403);
    assert.equal(result.payload?.success, false);
    assert.match(
      String(result.payload?.message || ""),
      /manual order status changes are disabled/i,
    );
  }

  const unchangedOrder = await OrderModel.findById(order._id).lean();
  assert.equal(String(unchangedOrder?.order_status || ""), "pending");
});

test("POST /api/notifications/stock dedupes guest requests and sends a back-in-stock email after reservation expiry", async () => {
  const product = await createProduct({
    name: "Notify Guest Product",
    slug: `notify-guest-product-${Date.now()}`,
  });

  const createResult = await requestJson("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildCreateOrderPayload(product, "guest-buyer@example.com"),
    ),
  });

  assert.equal(createResult.response.status, 201);

  const subscribeResult = await requestJson("/api/notifications/stock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: String(product._id),
      email: "guest-notify@example.com",
    }),
  });

  assert.equal(subscribeResult.response.status, 201);
  assert.equal(subscribeResult.payload?.success, true);
  assert.equal(subscribeResult.payload?.data?.requested, true);

  const duplicateSubscribe = await requestJson("/api/notifications/stock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: String(product._id),
      email: "guest-notify@example.com",
    }),
  });

  assert.equal(duplicateSubscribe.response.status, 200);
  assert.equal(duplicateSubscribe.payload?.data?.alreadyRegistered, true);

  const pendingNotifications = await StockNotificationModel.find({
    product_id: product._id,
    notified: false,
  }).lean();
  assert.equal(pendingNotifications.length, 1);

  await OrderModel.updateOne(
    { _id: createResult.payload?.data?.orderId },
    {
      $set: {
        reservationExpiresAt: new Date(Date.now() - 2_000),
      },
    },
  );

  await releaseExpiredReservations();
  await drainStockNotificationQueueForTests();

  const sentNotification = await StockNotificationModel.findOne({
    product_id: product._id,
  }).lean();
  assert.equal(sentNotification?.notified, true);
  assert.equal(sentStockEmails.length, 1);
  assert.equal(
    String(sentStockEmails[0]?.to || ""),
    "guest-notify@example.com",
  );

  const productDetail = await requestJson(`/api/products/${product._id}`);
  assert.equal(productDetail.payload?.data?.available_quantity, 1);
});

test("logged-in stock notification requests are saved against the user and reflected in product API responses", async () => {
  const user = await createUser({
    email: "member-notify@example.com",
    name: "Member Notify",
  });
  const token = createAuthToken(user);

  const product = await createProduct({
    name: "Notify User Product",
    slug: `notify-user-product-${Date.now()}`,
  });

  const createResult = await requestJson("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildCreateOrderPayload(product, "member-buyer@example.com"),
    ),
  });

  assert.equal(createResult.response.status, 201);

  const subscribeResult = await requestJson("/api/notifications/stock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      productId: String(product._id),
    }),
  });

  assert.equal(subscribeResult.response.status, 201);
  assert.equal(subscribeResult.payload?.data?.requested, true);

  const savedNotification = await StockNotificationModel.findOne({
    product_id: product._id,
    user_id: user._id,
    notified: false,
  }).lean();
  assert.ok(savedNotification);
  assert.equal(String(savedNotification?.email || ""), "");

  const productDetail = await requestJson(`/api/products/${product._id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.equal(productDetail.response.status, 200);
  assert.equal(
    Boolean(productDetail.payload?.data?.stockNotificationRequested),
    true,
  );
  assert.equal(productDetail.payload?.data?.available_quantity, 0);

  const listResult = await requestJson("/api/products?limit=10", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const listedProduct = (listResult.payload?.data || []).find(
    (entry) => String(entry?._id || "") === String(product._id),
  );
  assert.equal(Boolean(listedProduct?.stockNotificationRequested), true);
});

test("stock_update is emitted immediately when the last unit is reserved and when that reservation expires", async () => {
  const socket = await connectRealtimeClient();
  const product = await createProduct({
    name: "Realtime Reserve Product",
    slug: `realtime-reserve-product-${Date.now()}`,
  });

  try {
    const reservedEventPromise = waitForSocketEvent(
      socket,
      "stock_update",
      (payload) =>
        String(payload?.product_id || "") === String(product._id) &&
        Number(payload?.available_stock) === 0,
    );

    const createResult = await requestJson("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildCreateOrderPayload(product, "realtime-buyer@example.com"),
      ),
    });

    assert.equal(createResult.response.status, 201);
    const reservedEvent = await reservedEventPromise;
    assert.equal(String(reservedEvent?.product_id || ""), String(product._id));
    assert.equal(Number(reservedEvent?.available_stock), 0);
    assert.ok(Number(reservedEvent?.event_version || 0) > 0);

    await OrderModel.updateOne(
      { _id: createResult.payload?.data?.orderId },
      {
        $set: {
          reservationExpiresAt: new Date(Date.now() - 2_000),
        },
      },
    );

    const restoredEventPromise = waitForSocketEvent(
      socket,
      "stock_update",
      (payload) =>
        String(payload?.product_id || "") === String(product._id) &&
        Number(payload?.available_stock) === 1,
    );

    await releaseExpiredReservations();

    const restoredEvent = await restoredEventPromise;
    assert.equal(Number(restoredEvent?.available_stock), 1);
    assert.ok(
      Number(restoredEvent?.event_version || 0) >
        Number(reservedEvent?.event_version || 0),
    );
  } finally {
    socket.close();
  }
});

test("admin stock updates emit stock_update to connected clients in real time", async () => {
  const adminUser = await createUser({
    email: `admin-stock-${Date.now()}@example.com`,
    name: "Stock Admin",
    role: "Admin",
    status: "active",
  });
  const adminToken = createAuthToken(adminUser);
  const socket = await connectRealtimeClient({ token: adminToken });
  const product = await createProduct({
    name: "Realtime Admin Stock Product",
    slug: `realtime-admin-stock-${Date.now()}`,
    stock: 0,
  });

  try {
    const stockEventPromise = waitForSocketEvent(
      socket,
      "stock_update",
      (payload) =>
        String(payload?.product_id || "") === String(product._id) &&
        Number(payload?.available_stock) === 4,
    );

    const updateResult = await requestJson(
      `/api/products/${product._id}/stock`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          stock: 4,
        }),
      },
    );

    assert.equal(updateResult.response.status, 200);
    const stockEvent = await stockEventPromise;
    assert.equal(String(stockEvent?.product_id || ""), String(product._id));
    assert.equal(Number(stockEvent?.available_stock), 4);
    assert.ok(Number(stockEvent?.event_version || 0) > 0);
  } finally {
    socket.close();
  }
});
