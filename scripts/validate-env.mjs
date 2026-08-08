import fs from "fs";
import path from "path";

const projectRoot = process.cwd();

// Manual parser for env files to make this script dependency-free
const parseEnvFile = (filePath) => {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();

    // Remove wrapping quotes if present
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1);
    }

    env[key] = val;
  }
  return env;
};

// Load the server .env
const serverEnvPath = path.join(projectRoot, "server", ".env");
const localEnv = parseEnvFile(serverEnvPath);

// Merge with process.env
const env = { ...process.env, ...localEnv };

// 1. Required Variables (Failure to provide these fails validation)
const requiredEnv = [
  "MONGO_URI",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "CLIENT_URL",
  "ADMIN_URL",
];

// 2. Optional Integration Variables (Triggers warning and enables Demo Mode fallbacks)
const optionalEnv = {
  FIREBASE: [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ],
  SMTP_EMAIL: [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
  ],
  PHONEPE_GATEWAY: [
    "PHONEPE_CLIENT_ID",
    "PHONEPE_CLIENT_SECRET",
  ],
  CLOUDINARY: [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ],
  XPRESSBEES_SHIPPING: [
    "XPRESSBEES_TOKEN",
  ],
};

const errors = [];
const warnings = [];

// Validate required variables
for (const key of requiredEnv) {
  const val = env[key];
  if (!val || val.includes("your_access_token_secret") || val.includes("your_refresh_token_secret")) {
    errors.push(`Required environment variable [${key}] is missing or using placeholder value.`);
  }
}

// Validate optional integrations
for (const [integration, keys] of Object.entries(optionalEnv)) {
  const missingKeys = keys.filter(key => {
    const val = env[key];
    return !val || val.startsWith("your-") || val.includes("<set-in-github-secret>");
  });
  if (missingKeys.length > 0) {
    warnings.push(`Integration [${integration}] is unconfigured (missing keys: ${missingKeys.join(", ")}). Gracefully falling back to Demo Mode.`);
  }
}

console.log("\n=== bogEcom Environment Health Check ===");

if (warnings.length > 0) {
  console.log("\n⚠️  Optional Integration Warnings:");
  for (const warning of warnings) {
    console.warn(`  - ${warning}`);
  }
}

if (errors.length > 0) {
  console.error("\n❌ Required Environment Validation FAILED:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  console.log("\nPlease configure the required variables in server/.env before proceeding.\n");
  process.exit(1);
}

console.log("\n🟢 Required Environment Validation PASSED. Application is ready in Demo Mode.\n");
process.exit(0);
