import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import connectDb from "../config/connectDb.js";
import { sendNewsletterBroadcast } from "../controllers/newsletter.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.resolve(serverRoot, ".env") });

const run = async () => {
  await connectDb();

  let responsePayload = null;
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      responsePayload = payload;
      return payload;
    },
  };

  await sendNewsletterBroadcast(
    {
      body: { status: "active" },
      user: { id: "manual-script" },
    },
    res,
  );

  console.log(
    JSON.stringify(
      {
        statusCode: res.statusCode,
        ...responsePayload,
      },
      null,
      2,
    ),
  );

  if (!responsePayload?.success || res.statusCode >= 400) {
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    console.error("Broadcast run failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // noop
    }
  });
