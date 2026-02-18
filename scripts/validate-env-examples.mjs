import fs from "fs";
import path from "path";

const projectRoot = process.cwd();

const envFiles = {
  "server/.env.example": [
    "NODE_ENV",
    "MONGO_URI",
    "ACCESS_TOKEN_SECRET",
    "REFRESH_TOKEN_SECRET",
    "CLIENT_URL",
    "ADMIN_URL",
  ],
  "frontend/client/.env.example": [
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ],
  "frontend/admin/.env.example": [
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ],
};

const parseEnvKeys = (content) => {
  const keys = new Set();
  const lines = String(content || "").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    if (!key) continue;
    keys.add(key);
  }

  return keys;
};

const errors = [];
for (const [relativePath, requiredKeys] of Object.entries(envFiles)) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing file: ${relativePath}`);
    continue;
  }

  const keys = parseEnvKeys(fs.readFileSync(absolutePath, "utf8"));
  const missingKeys = requiredKeys.filter((key) => !keys.has(key));
  if (missingKeys.length > 0) {
    errors.push(
      `Missing required keys in ${relativePath}: ${missingKeys.join(", ")}`,
    );
  }
}

if (errors.length > 0) {
  console.error("Environment example validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Environment example validation passed.");

