import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

let mongoServer;
let serverProcess;
let shuttingDown = false;

const shutdown = async (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGINT");
  }

  if (mongoServer) {
    await mongoServer.stop();
  }

  process.exit(exitCode);
};

try {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: "BogEcomLocal",
    },
  });

  const mongoUri = mongoServer.getUri();
  console.log(`Local MongoDB started: ${mongoUri}`);

  serverProcess = spawn("node", ["index.js"], {
    cwd: serverRoot,
    env: {
      ...process.env,
      MONGO_URI: mongoUri,
      NODE_ENV: process.env.NODE_ENV || "development",
    },
    stdio: "inherit",
  });

  serverProcess.on("exit", async (code) => {
    await shutdown(code ?? 0);
  });

  serverProcess.on("error", async (error) => {
    console.error("Failed to start local server process:", error);
    await shutdown(1);
  });

  process.on("SIGINT", () => {
    shutdown(0);
  });

  process.on("SIGTERM", () => {
    shutdown(0);
  });
} catch (error) {
  console.error("Local memory Mongo startup failed:", error);
  await shutdown(1);
}
