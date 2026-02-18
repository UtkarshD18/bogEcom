import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

async function enableOfferPopup() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Enable offer popup
    const result1 = await mongoose.connection.db
      .collection("settings")
      .updateOne({ key: "showOfferPopup" }, { $set: { value: true } });
    console.log("showOfferPopup enabled:", result1.modifiedCount);

    // Set coupon code
    const result2 = await mongoose.connection.db
      .collection("settings")
      .updateOne({ key: "offerCouponCode" }, { $set: { value: "WELCOME10" } });
    console.log("offerCouponCode set:", result2.modifiedCount);

    // Update title
    const result3 = await mongoose.connection.db
      .collection("settings")
      .updateOne(
        { key: "offerTitle" },
        { $set: { value: "🎉 Welcome Offer!" } },
      );
    console.log("offerTitle set:", result3.modifiedCount);

    // Update description
    const result4 = await mongoose.connection.db
      .collection("settings")
      .updateOne(
        { key: "offerDescription" },
        {
          $set: {
            value:
              "Get 10% off on your first order! Use code below at checkout.",
          },
        },
      );
    console.log("offerDescription set:", result4.modifiedCount);

    await mongoose.disconnect();
    console.log("Done! Offer popup is now enabled.");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

enableOfferPopup();
