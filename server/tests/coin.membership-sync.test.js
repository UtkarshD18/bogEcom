import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import CoinSettingsModel from "../models/coinSettings.model.js";
import CoinTransactionModel from "../models/coinTransaction.model.js";
import MembershipUserModel from "../models/membershipUser.model.js";
import UserModel from "../models/user.model.js";
import { getUserCoinSummary, redeemCoins } from "../services/coin.service.js";

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
  await Promise.all([
    UserModel.deleteMany({}),
    MembershipUserModel.deleteMany({}),
    CoinTransactionModel.deleteMany({}),
    CoinSettingsModel.deleteMany({}),
  ]);
});

test("membership points sync updates coin summary when points increase later", async () => {
  const user = await UserModel.create({
    name: "Coin Sync User",
    email: "coin-sync@example.com",
    signUpWithGoogle: true,
    password: null,
    coinBalance: 0,
  });

  await MembershipUserModel.create({
    user: user._id,
    status: "active",
    startDate: new Date(),
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    pointsBalance: 10,
  });

  const firstSummary = await getUserCoinSummary({ userId: user._id });
  assert.equal(firstSummary.usable_coins, 10);

  await MembershipUserModel.updateOne(
    { user: user._id },
    { $set: { pointsBalance: 20 } },
  );

  const secondSummary = await getUserCoinSummary({ userId: user._id });
  assert.equal(secondSummary.usable_coins, 20);
});

test("membership redemption is capped by plan total and updates remaining balance", async () => {
  await CoinSettingsModel.create({
    isDefault: true,
    coinsPerRupee: 1,
    redeemRate: 1,
    maxRedeemPercentage: 100,
    expiryDays: 365,
  });

  const user = await UserModel.create({
    name: "Coin Cap User",
    email: "coin-cap@example.com",
    signUpWithGoogle: true,
    password: null,
    coinBalance: 500,
  });

  await MembershipUserModel.create({
    user: user._id,
    status: "active",
    startDate: new Date(),
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    pointsBalance: 500,
  });

  await CoinTransactionModel.create({
    user: user._id,
    coins: 500,
    remainingCoins: 500,
    type: "bonus",
    source: "admin",
    referenceId: `admin-seed:${user._id}`,
    expiryDate: null,
  });

  const redemption = await redeemCoins({
    userId: user._id,
    requestedCoins: 500,
    orderTotal: 399,
    source: "membership",
    referenceId: `MEM_${user._id}_1`,
  });

  assert.equal(redemption.coinsUsed, 399);
  assert.equal(redemption.redeemAmount, 399);
  assert.equal(redemption.remainingBalance, 101);

  const summary = await getUserCoinSummary({ userId: user._id });
  assert.equal(summary.usable_coins, 101);

  const membership = await MembershipUserModel.findOne({ user: user._id }).lean();
  assert.equal(Number(membership?.pointsBalance || 0), 101);
});

test("legacy membership sync over-credit is cleaned after redemption backfill", async () => {
  await CoinSettingsModel.create({
    isDefault: true,
    coinsPerRupee: 1,
    redeemRate: 1,
    maxRedeemPercentage: 100,
    expiryDays: 365,
  });

  const user = await UserModel.create({
    name: "Legacy Sync User",
    email: "legacy-sync@example.com",
    signUpWithGoogle: true,
    password: null,
    coinBalance: 500,
  });

  const membership = await MembershipUserModel.create({
    user: user._id,
    status: "active",
    startDate: new Date(),
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    pointsBalance: 500,
  });

  await CoinTransactionModel.insertMany([
    {
      user: user._id,
      coins: 500,
      remainingCoins: 101,
      type: "bonus",
      source: "admin",
      referenceId: `admin-seed:${user._id}`,
      expiryDate: null,
    },
    {
      user: user._id,
      coins: 399,
      remainingCoins: 399,
      type: "bonus",
      source: "membership",
      referenceId: `membership-points-sync:${membership._id}:500`,
      expiryDate: null,
    },
    {
      user: user._id,
      coins: 399,
      remainingCoins: 0,
      type: "redeem",
      source: "membership",
      referenceId: `MEM_${user._id}_legacy`,
      expiryDate: null,
      meta: {},
    },
  ]);

  const summary = await getUserCoinSummary({ userId: user._id });
  assert.equal(summary.usable_coins, 101);

  const updatedMembership = await MembershipUserModel.findById(membership._id).lean();
  assert.equal(Number(updatedMembership?.pointsBalance || 0), 101);

  const staleSync = await CoinTransactionModel.findOne({
    user: user._id,
    source: "membership",
    type: "bonus",
    referenceId: new RegExp(`^membership-points-sync:${membership._id}:`),
  }).lean();
  assert.equal(Number(staleSync?.remainingCoins || 0), 0);
});
