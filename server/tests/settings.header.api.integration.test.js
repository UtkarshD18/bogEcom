import assert from "node:assert/strict";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import SettingsModel from "../models/settings.model.js";
import UserModel from "../models/user.model.js";
import settingsRouter from "../routes/settings.route.js";

const TEST_JWT_SECRET =
  "test_access_token_secret_for_settings_header_1234567890";

let mongoServer;
let httpServer;
let baseUrl = "";

const createJsonHeaders = (token) => {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const issueTokenForRole = async (role) => {
  const user = await UserModel.create({
    name: `${role} Test`,
    email: `${role.toLowerCase()}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}@example.com`,
    password: "secure-password",
    role,
    status: "active",
  });

  const token = jwt.sign(
    { id: user._id.toString() },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "1h",
    },
  );

  return { user, token };
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.json();
  return { response, payload };
};

test.before(async () => {
  process.env.ACCESS_TOKEN_SECRET =
    process.env.ACCESS_TOKEN_SECRET || TEST_JWT_SECRET;

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: "bogEcom-test" });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/settings", settingsRouter);
  app.use((err, _req, res, _next) => {
    res.status(err?.status || 500).json({
      error: true,
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
  await Promise.all([SettingsModel.deleteMany({}), UserModel.deleteMany({})]);
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

test("GET /api/settings/header returns fallback color when setting is absent", async () => {
  const { response, payload } = await requestJson("/api/settings/header");

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.headerBackgroundColor, "#fffbf5");
});

test("GET /api/settings/header falls back when stored value is invalid", async () => {
  await SettingsModel.create({
    key: "headerSettings",
    value: { headerBackgroundColor: "not-a-hex" },
    category: "display",
    isActive: true,
  });

  const { response, payload } = await requestJson("/api/settings/header");

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.headerBackgroundColor, "#fffbf5");
});

test("PUT /api/settings/header requires auth token", async () => {
  const { response, payload } = await requestJson("/api/settings/header", {
    method: "PUT",
    headers: createJsonHeaders(),
    body: JSON.stringify({ headerBackgroundColor: "#000000" }),
  });

  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
});

test("PUT /api/settings/header rejects non-admin user", async () => {
  const { token } = await issueTokenForRole("User");

  const { response, payload } = await requestJson("/api/settings/header", {
    method: "PUT",
    headers: createJsonHeaders(token),
    body: JSON.stringify({ headerBackgroundColor: "#000000" }),
  });

  assert.equal(response.status, 403);
  assert.equal(payload.success, false);
  assert.match(payload.message, /admin access required/i);
});

test("PUT /api/settings/header validates hex payload", async () => {
  const { token } = await issueTokenForRole("Admin");

  const { response, payload } = await requestJson("/api/settings/header", {
    method: "PUT",
    headers: createJsonHeaders(token),
    body: JSON.stringify({ headerBackgroundColor: "green" }),
  });

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /valid hex color/i);
});

test("PUT then GET /api/settings/header persists normalized color", async () => {
  const { token } = await issueTokenForRole("Admin");

  const updateResult = await requestJson("/api/settings/header", {
    method: "PUT",
    headers: createJsonHeaders(token),
    body: JSON.stringify({ headerBackgroundColor: "#0F0" }),
  });

  assert.equal(updateResult.response.status, 200);
  assert.equal(updateResult.payload.success, true);
  assert.equal(updateResult.payload.data.headerBackgroundColor, "#00ff00");

  const readResult = await requestJson("/api/settings/header");
  assert.equal(readResult.response.status, 200);
  assert.equal(readResult.payload.success, true);
  assert.equal(readResult.payload.data.headerBackgroundColor, "#00ff00");

  const stored = await SettingsModel.findOne({ key: "headerSettings" }).lean();
  assert.equal(stored?.value?.headerBackgroundColor, "#00ff00");
});
