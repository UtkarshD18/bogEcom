import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import CoinSettingsModel from "../models/coinSettings.model.js";
import CoinTransactionModel from "../models/coinTransaction.model.js";
import MembershipUserModel from "../models/membershipUser.model.js";
import UserModel from "../models/user.model.js";
import { getUserCoinSummary } from "../services/coin.service.js";

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
