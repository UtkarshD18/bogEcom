import bcrypt from "bcryptjs";
import express from "express";
import mongoose from "mongoose";
import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  __setInfluencerOtpEmailSenderForTests,
  __setInfluencerOtpGeneratorForTests,
} from "../controllers/influencer.controller.js";
import InfluencerModel from "../models/influencer.model.js";
import influencerRouter from "../routes/influencer.route.js";

process.env.INFLUENCER_JWT_SECRET =
  process.env.INFLUENCER_JWT_SECRET || "test_influencer_access_secret";
process.env.INFLUENCER_REFRESH_TOKEN_SECRET =
  process.env.INFLUENCER_REFRESH_TOKEN_SECRET ||
  "test_influencer_refresh_secret";
process.env.CLIENT_URL = "http://127.0.0.1:3000";
delete process.env.SITE_URL;
delete process.env.NEXT_PUBLIC_SITE_URL;
delete process.env.FRONTEND_URL;
delete process.env.PUBLIC_CLIENT_URL;
delete process.env.NEXT_PUBLIC_CLIENT_URL;
delete process.env.ADMIN_URL;

let mongoServer;
let apiServer;
let baseUrl = "";
let sentOtps = [];

const startServer = async (app) =>
  new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.json();
  return { response, payload };
};

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "bogEcom-influencer-auth",
  });

  __setInfluencerOtpGeneratorForTests(() => "654321");
  __setInfluencerOtpEmailSenderForTests(async ({ email, otp }) => {
    sentOtps.push({ email, otp });
    return true;
  });

  const app = express();
  app.use(express.json());
  app.use("/api/influencers", influencerRouter);

  apiServer = await startServer(app);
  const address = apiServer.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  sentOtps = [];
  await InfluencerModel.deleteMany({});
});

after(async () => {
  if (apiServer) {
    await new Promise((resolve, reject) => {
      apiServer.close((error) => {
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

test("legacy public collaborator access is disabled", async () => {
  await InfluencerModel.create({
    name: "Creator One",
    email: "creator1@example.com",
    code: "CREATOR1",
    discountValue: 10,
    commissionValue: 5,
  });

  const loginResult = await requestJson("/api/influencers/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: "CREATOR1",
      email: "creator1@example.com",
    }),
  });

  assert.equal(loginResult.response.status, 400);
  assert.match(loginResult.payload.message, /password/i);

  const portalResult = await requestJson(
    "/api/influencers/portal?code=CREATOR1&email=creator1@example.com",
  );

  assert.equal(portalResult.response.status, 410);
  assert.match(portalResult.payload.message, /disabled/i);
});

test("otp password setup enables secure collaborator login", async () => {
  await InfluencerModel.create({
    name: "Creator Two",
    email: "creator2@example.com",
    code: "CREATOR2",
    discountValue: 12,
    commissionValue: 6,
  });

  const forgotResult = await requestJson("/api/influencers/forgot-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: "CREATOR2",
      email: "creator2@example.com",
    }),
  });

  assert.equal(forgotResult.response.status, 200);
  assert.equal(sentOtps.length, 1);
  assert.deepEqual(sentOtps[0], {
    email: "creator2@example.com",
    otp: "654321",
  });

  const pendingReset = await InfluencerModel.findOne({
    code: "CREATOR2",
  }).select("+portalPasswordHash +passwordResetOtpHash +passwordResetOtpExpiresAt");

  assert.ok(pendingReset.passwordResetOtpHash);
  assert.ok(pendingReset.passwordResetOtpExpiresAt instanceof Date);
  assert.equal(pendingReset.portalPasswordHash, "");

  const resetResult = await requestJson("/api/influencers/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: "CREATOR2",
      email: "creator2@example.com",
      otp: "654321",
      newPassword: "StrongPass1",
      confirmPassword: "StrongPass1",
    }),
  });

  assert.equal(resetResult.response.status, 200);
  assert.match(resetResult.payload.message, /updated successfully/i);

  const configuredInfluencer = await InfluencerModel.findOne({
    code: "CREATOR2",
  }).select("+portalPasswordHash +passwordResetOtpHash +passwordResetOtpExpiresAt");

  assert.ok(
    await bcrypt.compare("StrongPass1", configuredInfluencer.portalPasswordHash),
  );
  assert.equal(configuredInfluencer.passwordResetOtpHash, "");
  assert.equal(configuredInfluencer.passwordResetOtpExpiresAt, null);
  assert.equal(configuredInfluencer.refreshToken, "");

  const loginResult = await requestJson("/api/influencers/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: "creator2",
      password: "StrongPass1",
    }),
  });

  assert.equal(loginResult.response.status, 200);
  assert.equal(loginResult.payload.success, true);
  assert.ok(loginResult.payload.data.accessToken);
  assert.ok(loginResult.payload.data.refreshToken);

  const portalResult = await requestJson("/api/influencers/portal/me", {
    headers: {
      Authorization: `Bearer ${loginResult.payload.data.accessToken}`,
    },
  });

  assert.equal(portalResult.response.status, 200);
  assert.equal(portalResult.payload.data.influencer.code, "CREATOR2");
  assert.equal(
    portalResult.payload.data.influencer.referralUrl,
    "http://127.0.0.1:3000/?ref=CREATOR2",
  );
  assert.equal(
    portalResult.payload.data.influencer.portalLoginUrl,
    "http://127.0.0.1:3000/affiliate/login?code=CREATOR2",
  );
});

test("wrong password does not unlock a public referral code", async () => {
  await InfluencerModel.create({
    name: "Creator Three",
    email: "creator3@example.com",
    code: "CREATOR3",
    discountValue: 9,
    commissionValue: 4,
    portalPasswordHash: await bcrypt.hash("CorrectPass1", 10),
  });

  const loginResult = await requestJson("/api/influencers/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: "CREATOR3",
      password: "WrongPass1",
    }),
  });

  assert.equal(loginResult.response.status, 403);
  assert.match(loginResult.payload.message, /invalid referral code or password/i);
});
