import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { updateAddress } from "../controllers/address.controller.js";
import AddressModel from "../models/address.model.js";

let mongoServer;

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
  };

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (payload) => {
    res.body = payload;
    return res;
  };

  return res;
};

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: "bogecom-address-test" });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test.afterEach(async () => {
  await AddressModel.deleteMany({});
});

test("updateAddress reassigns another default address when current default is unset", async () => {
  const userId = new mongoose.Types.ObjectId().toString();

  const primary = await AddressModel.create({
    userId,
    full_name: "Rahul Sharma",
    mobile_number: "9876543210",
    flat_house: "B-42",
    area_street_sector: "SKIT Road",
    city: "Jaipur",
    state: "Rajasthan",
    district: "Jaipur",
    pincode: "302017",
    is_default: true,
    selected: true,
  });

  const secondary = await AddressModel.create({
    userId,
    full_name: "Rahul Sharma",
    mobile_number: "9876543210",
    flat_house: "C-12",
    area_street_sector: "Malviya Nagar",
    city: "Jaipur",
    state: "Rajasthan",
    district: "Jaipur",
    pincode: "302017",
    is_default: false,
    selected: false,
  });

  const req = {
    user: userId,
    params: { addressId: primary._id.toString() },
    body: { is_default: false },
  };
  const res = createMockRes();

  await updateAddress(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.success, true);

  const refreshedPrimary = await AddressModel.findById(primary._id).lean();
  const refreshedSecondary = await AddressModel.findById(secondary._id).lean();

  assert.equal(refreshedPrimary?.is_default, false);
  assert.equal(refreshedPrimary?.selected, false);
  assert.equal(refreshedSecondary?.is_default, true);
  assert.equal(refreshedSecondary?.selected, true);
});
