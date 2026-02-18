import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const normalizeEnvValue = (value) => {
  let normalized = String(value || "").trim();

  const hasWrappedDoubleQuotes =
    normalized.startsWith('"') && normalized.endsWith('"');
  const hasWrappedSingleQuotes =
    normalized.startsWith("'") && normalized.endsWith("'");

  if (hasWrappedDoubleQuotes || hasWrappedSingleQuotes) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
};

const isValidMongoUri = (value) => /^mongodb(\+srv)?:\/\//.test(value);

const resolveMongoUri = () => {
  const primaryMongoUri = normalizeEnvValue(process.env.MONGO_URI);
  const fallbackMongoUri = normalizeEnvValue(process.env.MONGODB_URI);

  if (primaryMongoUri && isValidMongoUri(primaryMongoUri)) {
    return primaryMongoUri;
  }

  if (fallbackMongoUri && isValidMongoUri(fallbackMongoUri)) {
    return fallbackMongoUri;
  }

  if (!primaryMongoUri && !fallbackMongoUri) {
    throw new Error(
      "Database URI is missing. Set MONGO_URI or MONGODB_URI in environment variables.",
    );
  }

  throw new Error(
    "Invalid MongoDB URI format. Set MONGO_URI or MONGODB_URI to a value that starts with mongodb:// or mongodb+srv://",
  );
};

async function connectDb() {
  const mongoUri = resolveMongoUri();

  // Keep a normalized key available for the rest of the app.
  process.env.MONGO_URI = mongoUri;

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

export default connectDb;
