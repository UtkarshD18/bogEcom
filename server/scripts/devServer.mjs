import { spawn } from "node:child_process";
import dns from "node:dns/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { MongoMemoryServer } from "mongodb-memory-server";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const nodemonBinary = path.resolve(
  serverRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "nodemon.cmd" : "nodemon",
);

let mongoServer = null;
let childProcess = null;
let shuttingDown = false;

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

  return "";
};

const extractSrvHostname = (mongoUri) => {
  const normalized = String(mongoUri || "").trim();
  if (!/^mongodb\+srv:\/\//i.test(normalized)) return "";

  const withoutProtocol = normalized.replace(/^mongodb\+srv:\/\//i, "");
  const hostSection = withoutProtocol.includes("@")
    ? withoutProtocol.split("@").slice(1).join("@")
    : withoutProtocol;

  return String(hostSection || "").split("/")[0].split("?")[0].trim();
};

const resolveSrvWithTimeout = async (hostname, timeoutMs = 4000) => {
  const timer = new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(`Timed out resolving SRV for ${hostname}`);
      error.code = "ETIMEOUT";
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([
    dns.resolveSrv(`_mongodb._tcp.${hostname}`),
    timer,
  ]);
};

const shouldUseMemoryMongo = async (mongoUri, forceMemory) => {
  if (forceMemory) {
    return { useMemory: true, reason: "forced by --memory flag" };
  }

  if (!mongoUri) {
    return { useMemory: true, reason: "no MONGO_URI configured for local dev" };
  }

  const srvHostname = extractSrvHostname(mongoUri);
  if (!srvHostname) {
    return { useMemory: false, reason: "standard MongoDB URI configured" };
  }

  try {
    const records = await resolveSrvWithTimeout(srvHostname);
    if (Array.isArray(records) && records.length > 0) {
      return { useMemory: false, reason: "Atlas SRV lookup succeeded" };
    }
    return { useMemory: true, reason: "Atlas SRV lookup returned no records" };
  } catch (error) {
    return {
      useMemory: true,
      reason: `Atlas SRV lookup failed locally (${error.code || error.message})`,
    };
  }
};

const startMemoryMongo = async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: "BogEcomLocal",
    },
  });

  return mongoServer.getUri();
};

const buildChildEnv = (mongoUri) => {
  const localAccessSecret =
    normalizeEnvValue(process.env.ACCESS_TOKEN_SECRET) ||
    "local_memory_access_token_secret_1234567890";
  const localRefreshSecret =
    normalizeEnvValue(process.env.REFRESH_TOKEN_SECRET) ||
    "local_memory_refresh_token_secret_1234567890";

  return {
    ...process.env,
    MONGO_URI: mongoUri,
    ACCESS_TOKEN_SECRET: localAccessSecret,
    REFRESH_TOKEN_SECRET: localRefreshSecret,
    NODE_ENV: process.env.NODE_ENV || "development",
  };
};

const shutdown = async (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  if (childProcess && !childProcess.killed) {
    childProcess.kill("SIGINT");
  }

  if (mongoServer) {
    await mongoServer.stop();
  }

  process.exit(exitCode);
};

const spawnNodemon = (env) => {
  const isWindows = process.platform === "win32";
  const command = isWindows ? "cmd.exe" : nodemonBinary;
  const args = isWindows ? ["/c", nodemonBinary, "index.js"] : ["index.js"];

  childProcess = spawn(command, args, {
    cwd: serverRoot,
    env,
    stdio: "inherit",
  });

  childProcess.on("exit", async (code) => {
    await shutdown(code ?? 0);
  });

  childProcess.on("error", async (error) => {
    console.error("Failed to start local dev server:", error);
    await shutdown(1);
  });
};

try {
  const forceMemory = process.argv.includes("--memory");
  const configuredMongoUri = resolveMongoUri();
  const decision = await shouldUseMemoryMongo(configuredMongoUri, forceMemory);

  let mongoUriToUse = configuredMongoUri;

  if (decision.useMemory) {
    mongoUriToUse = await startMemoryMongo();
    console.log(`[local-dev] Using in-memory MongoDB because ${decision.reason}.`);
    console.log(`[local-dev] Memory Mongo URI: ${mongoUriToUse}`);
  } else {
    console.log(`[local-dev] Using configured MongoDB because ${decision.reason}.`);
  }

  spawnNodemon(buildChildEnv(mongoUriToUse));

  process.on("SIGINT", () => {
    shutdown(0);
  });

  process.on("SIGTERM", () => {
    shutdown(0);
  });
} catch (error) {
  console.error("Local dev bootstrap failed:", error);
  await shutdown(1);
}
