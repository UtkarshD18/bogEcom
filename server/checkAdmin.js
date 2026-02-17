import dotenv from "dotenv";
import mongoose from "mongoose";
import UserModel from "./models/user.model.js";

dotenv.config();

const checkAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const admin = await UserModel.findOne({ email: "admin@buyonegram.com" });

    if (admin) {
      console.log("\n✅ Admin user found:");
      console.log("  Email:", admin.email);
      console.log("  Role:", admin.role);
      console.log("  Status:", admin.status);
      console.log("  Verified:", admin.verifyEmail);
      console.log("  Has password:", !!admin.password);
    } else {
      console.log("\n❌ Admin user NOT FOUND");
      console.log("Run 'node seeder.js' to create one");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

checkAdmin();
