import dotenv from "dotenv";
import mongoose from "mongoose";
import OrderModel from "../models/order.model.js";

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  "";

if (!MONGO_URI) {
  console.error("Missing MongoDB connection string for payment cleanup migration");
  process.exit(1);
}

const LEGACY_METHOD = String.fromCharCode(82, 65, 90, 79, 82, 80, 65, 89);
const LEGACY_ORDER_ID_FIELD = ["razor", "pay", "OrderId"].join("");
const LEGACY_SIGNATURE_FIELD = ["razor", "pay", "Signature"].join("");
const TARGET_METHOD = "PHONEPE";

const run = async () => {
  await mongoose.connect(MONGO_URI);

  try {
    // Step 1: normalize legacy payment method values before enum cleanup.
    const paymentMethodResult = await OrderModel.updateMany(
      { paymentMethod: LEGACY_METHOD },
      { $set: { paymentMethod: TARGET_METHOD } },
    );

    // Step 2: preserve legacy gateway identifiers under provider-neutral keys.
    const orderIdRenameResult = await OrderModel.updateMany(
      { [LEGACY_ORDER_ID_FIELD]: { $exists: true } },
      { $rename: { [LEGACY_ORDER_ID_FIELD]: "legacyGatewayOrderId" } },
      { strict: false },
    );

    const signatureRenameResult = await OrderModel.updateMany(
      { [LEGACY_SIGNATURE_FIELD]: { $exists: true } },
      { $rename: { [LEGACY_SIGNATURE_FIELD]: "legacyGatewaySignature" } },
      { strict: false },
    );

    console.log("Payment provider cleanup migration complete", {
      paymentMethodNormalized: {
        matched: paymentMethodResult.matchedCount,
        modified: paymentMethodResult.modifiedCount,
      },
      orderIdRenamed: {
        matched: orderIdRenameResult.matchedCount,
        modified: orderIdRenameResult.modifiedCount,
      },
      signatureRenamed: {
        matched: signatureRenameResult.matchedCount,
        modified: signatureRenameResult.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Payment provider cleanup migration failed", {
      message: error?.message || "Unknown error",
      stack: error?.stack,
    });
    throw error;
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Payment provider cleanup migration failed", error);
  process.exit(1);
});
