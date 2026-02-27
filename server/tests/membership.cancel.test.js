import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import MembershipUserModel from "../models/membershipUser.model.js";
import UserModel from "../models/user.model.js";
import { toggleMembershipUserStatus } from "../services/membershipUser.service.js";

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
    MembershipUserModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
});

test("admin cancel sets membership expiry date to cancellation time", async () => {
  const user = await UserModel.create({
    name: "Cancel User",
    email: "cancel-user@example.com",
    signUpWithGoogle: true,
    password: null,
    isMember: true,
    is_member: true,
  });

  const originalExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const membership = await MembershipUserModel.create({
    user: user._id,
    status: "active",
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    expiryDate: originalExpiry,
    pointsBalance: 100,
  });

  const beforeCancel = Date.now();
  const result = await toggleMembershipUserStatus({
    membershipUserId: membership._id,
    action: "cancel",
  });
  const afterCancel = Date.now();

  assert.equal(result.membershipUser.status, "cancelled");
  const cancelledExpiryMs = new Date(result.membershipUser.expiryDate).getTime();
  assert.ok(cancelledExpiryMs >= beforeCancel);
  assert.ok(cancelledExpiryMs <= afterCancel + 2000);
  assert.ok(cancelledExpiryMs < originalExpiry.getTime());
});

