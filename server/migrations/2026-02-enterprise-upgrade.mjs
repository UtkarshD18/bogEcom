import dotenv from "dotenv";
import mongoose from "mongoose";
import CoinSettingsModel from "../models/coinSettings.model.js";
import MembershipPlanModel from "../models/membershipPlan.model.js";
import OrderModel from "../models/order.model.js";
import PolicyModel from "../models/policy.model.js";
import UserModel from "../models/user.model.js";
import { calculateTax } from "../services/tax.service.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error("MONGO_URI is required");
}

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // 1) User defaults and coin balance
  await UserModel.updateMany(
    { coinBalance: { $exists: false } },
    { $set: { coinBalance: 0 } },
  );
  await UserModel.updateMany(
    {},
    {
      $set: {
        "notificationSettings.emailNotifications": true,
        "notificationSettings.pushNotifications": true,
        "notificationSettings.orderUpdates": true,
        "notificationSettings.promotionalEmails": true,
      },
    },
  );
  console.log("Users migrated");

  // 2) Membership field sync
  const plans = await MembershipPlanModel.find();
  for (const plan of plans) {
    const changed = [];
    if (!plan.durationDays) {
      plan.durationDays = Number(plan.duration || 365);
      changed.push("durationDays");
    }
    if (plan.discountPercentage === undefined || plan.discountPercentage === null) {
      plan.discountPercentage = Number(plan.discountPercent || 0);
      changed.push("discountPercentage");
    }
    if (plan.active === undefined || plan.active === null) {
      plan.active = Boolean(plan.isActive);
      changed.push("active");
    }
    if (changed.length) {
      await plan.save();
    }
  }
  console.log("Membership plans migrated");

  // 3) Coin settings singleton
  const coinSettings = await CoinSettingsModel.findOne({ isDefault: true });
  if (!coinSettings) {
    await CoinSettingsModel.create({
      isDefault: true,
      coinsPerRupee: 0.05,
      redeemRate: 0.1,
      maxRedeemPercentage: 20,
      expiryDays: 365,
    });
  }
  console.log("Coin settings migrated");

  // 4) Policy seed (safe upsert)
  const defaults = [
    {
      title: "Terms & Conditions",
      slug: "terms-and-conditions",
      content: "<h1>Terms & Conditions</h1><p>Please review these terms before using our services.</p>",
      isActive: true,
      version: 1,
      effectiveDate: new Date("2026-02-01"),
    },
    {
      title: "Return Policy",
      slug: "return-policy",
      content: "<h1>Return Policy</h1><p>No standard returns. Manual approvals apply for eligible prepaid orders.</p>",
      isActive: true,
      version: 1,
      effectiveDate: new Date("2026-02-01"),
    },
  ];

  for (const policy of defaults) {
    await PolicyModel.findOneAndUpdate(
      { slug: policy.slug },
      { $setOnInsert: policy },
      { upsert: true, new: true },
    );
  }
  console.log("Policy defaults migrated");

  // 5) Order backfill
  const cursor = OrderModel.find().cursor();
  let updatedOrders = 0;
  for await (const order of cursor) {
    let dirty = false;

    if (order.subtotal === undefined || order.subtotal === null) {
      order.subtotal = round2(
        (order.products || []).reduce(
          (sum, item) => sum + Number(item?.subTotal || 0),
          0,
        ),
      );
      dirty = true;
    }

    if (!order.gst || typeof order.gst !== "object") {
      const derivedState =
        order.billingDetails?.state ||
        order.guestDetails?.state ||
        "";
      const tax = calculateTax(order.subtotal || 0, derivedState);
      order.gst = {
        rate: tax.rate,
        state: tax.state,
        taxableAmount: tax.taxableAmount,
        cgst: tax.cgst,
        sgst: tax.sgst,
        igst: tax.igst,
      };
      dirty = true;
    }

    if (!order.coinRedemption || typeof order.coinRedemption !== "object") {
      order.coinRedemption = { coinsUsed: 0, amount: 0 };
      dirty = true;
    }

    if (!order.billingDetails || typeof order.billingDetails !== "object") {
      order.billingDetails = {
        fullName: order.guestDetails?.fullName || "",
        email: order.guestDetails?.email || "",
        phone: order.guestDetails?.phone || "",
        address: order.guestDetails?.address || "",
        pincode: order.guestDetails?.pincode || "",
        state: order.guestDetails?.state || "",
      };
      dirty = true;
    }

    if (dirty) {
      await order.save();
      updatedOrders += 1;
    }
  }
  console.log(`Orders migrated: ${updatedOrders}`);
};

run()
  .then(async () => {
    await mongoose.disconnect();
    console.log("Migration completed");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Migration failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  });
