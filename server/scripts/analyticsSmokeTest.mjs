import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import {
  ensureAnalyticsIndexes,
  getAnalyticsDb,
} from "../services/analytics/analyticsDb.service.js";

dotenv.config({ path: "./.env" });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeUrl = (value) => String(value || "").trim().replace(/\/+$/, "");

const resolveApiBaseUrl = () => {
  const explicit = normalizeUrl(process.env.TRACKING_TEST_API_URL);
  if (explicit) return explicit;

  const port = Number(process.env.PORT || 8000);
  return `http://localhost:${Number.isFinite(port) ? port : 8000}`;
};

const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET ||
  process.env.SECRET_KEY_ACCESS_TOKEN ||
  process.env.JSON_WEB_TOKEN_SECRET_KEY ||
  process.env.JWT_SECRET ||
  "";

const apiBaseUrl = resolveApiBaseUrl();
const FETCH_TIMEOUT_MS = Number(process.env.TRACKING_TEST_HTTP_TIMEOUT_MS || 12_000);
const MANAGE_WORKER = ["true", "1", "yes", "on"].includes(
  String(process.env.TRACKING_TEST_START_WORKER || "false")
    .trim()
    .toLowerCase(),
);
const WORKER_BOOT_TIMEOUT_MS = Number(process.env.TRACKING_TEST_WORKER_BOOT_TIMEOUT_MS || 20_000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const workerEntry = path.resolve(repoRoot, "analytics-worker", "index.js");

const parseCookie = (setCookieHeader = "") => {
  const first = String(setCookieHeader || "").split(";")[0].trim();
  return first || "";
};

const requestSession = async ({ authToken = "" } = {}) => {
  const headers = {};
  if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${apiBaseUrl}/api/track/session`, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Session endpoint failed (${response.status}): ${payload?.message || "unknown"}`);
  }

  return {
    sessionId: String(payload?.data?.sessionId || "").trim(),
    cookieHeader: parseCookie(response.headers.get("set-cookie")),
    payload,
  };
};

const publishBatch = async ({
  sessionId,
  events,
  authToken = "",
  cookieHeader = "",
  consent = "granted",
}) => {
  const headers = {
    "content-type": "application/json",
    "x-analytics-consent": consent,
  };

  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }
  if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${apiBaseUrl}/api/track`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sessionId,
      events,
      consent,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Track endpoint failed (${response.status}): ${payload?.message || "unknown"}`);
  }

  if (!payload?.data?.accepted) {
    throw new Error(`Track endpoint accepted zero events for session ${sessionId}`);
  }

  return payload;
};

const querySessionSnapshot = async (db, sessionId) => {
  const [rawEvents, productEvents, sessionDoc] = await Promise.all([
    db
      .collection("events_raw")
      .find({ sessionId })
      .project({
        _id: 0,
        eventId: 1,
        eventType: 1,
        sessionId: 1,
        userId: 1,
        timestamp: 1,
      })
      .toArray(),
    db.collection("product_events").countDocuments({ sessionId }),
    db.collection("sessions").findOne(
      { sessionId },
      {
        projection: {
          _id: 0,
          sessionId: 1,
          userId: 1,
          startedAt: 1,
          lastSeenAt: 1,
          eventCount: 1,
          pageViews: 1,
        },
      },
    ),
  ]);

  return {
    sessionId,
    rawEvents,
    productEvents,
    sessionDoc,
  };
};

const queryEventsByIds = async (db, eventIds = []) => {
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    return [];
  }

  return db
    .collection("events_raw")
    .find({ eventId: { $in: eventIds } })
    .project({
      _id: 0,
      eventId: 1,
      eventType: 1,
      sessionId: 1,
      userId: 1,
      timestamp: 1,
    })
    .toArray();
};

const hasActiveWorker = async (db) => {
  const staleThresholdMs = 60_000;
  const activeThreshold = new Date(Date.now() - staleThresholdMs);
  const count = await db.collection("worker_health").countDocuments({
    updatedAt: { $gte: activeThreshold },
  });
  return count > 0;
};

const startManagedWorker = async () => {
  const child = spawn("node", [workerEntry], {
    cwd: repoRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  const onStdout = (chunk) => {
    const text = String(chunk || "").trim();
    if (text) {
      console.log(`[analytics-worker] ${text}`);
    }
  };

  const onStderr = (chunk) => {
    const text = String(chunk || "").trim();
    if (text) {
      console.error(`[analytics-worker:err] ${text}`);
    }
  };

  child.stdout.on("data", onStdout);
  child.stderr.on("data", onStderr);

  let booted = false;
  const bootPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (booted) return;
      reject(new Error("Managed worker did not boot in time."));
    }, WORKER_BOOT_TIMEOUT_MS);

    const onData = (chunk) => {
      const text = String(chunk || "");
      if (text.includes("[analytics-worker] listening")) {
        booted = true;
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        resolve(true);
      }
    };

    child.stdout.on("data", onData);

    child.once("exit", (code) => {
      if (booted) return;
      clearTimeout(timeout);
      reject(new Error(`Managed worker exited early with code ${code}`));
    });
  });

  await bootPromise;

  return {
    process: child,
    stop: async () =>
      new Promise((resolve) => {
        if (child.killed) {
          resolve();
          return;
        }

        child.once("exit", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) {
            child.kill("SIGKILL");
          }
          resolve();
        }, 5000);
      }),
  };
};

const waitForEventsIngested = async ({
  db,
  eventIds = [],
  timeoutMs = 30_000,
}) => {
  const deadline = Date.now() + timeoutMs;
  let docs = [];

  while (Date.now() < deadline) {
    docs = await queryEventsByIds(db, eventIds);
    if (docs.length >= eventIds.length) {
      return docs;
    }
    await sleep(1500);
  }

  return docs;
};

const buildGuestEvents = (sessionId) => {
  const now = new Date().toISOString();
  return [
    {
      eventId: randomUUID(),
      eventType: "page_view_started",
      sessionId,
      timestamp: now,
      pageUrl: "http://localhost:3000/test-tracking",
      referrer: "",
      metadata: {
        pageKey: "test-tracking",
      },
    },
    {
      eventId: randomUUID(),
      eventType: "product_view",
      sessionId,
      timestamp: now,
      pageUrl: "http://localhost:3000/product/smoke-product-001",
      referrer: "http://localhost:3000/test-tracking",
      metadata: {
        productId: "smoke-product-001",
        productName: "Smoke Test Product",
        source: "analytics-smoke-test",
      },
    },
    {
      eventId: randomUUID(),
      eventType: "scroll_depth",
      sessionId,
      timestamp: now,
      pageUrl: "http://localhost:3000/product/smoke-product-001",
      referrer: "http://localhost:3000/test-tracking",
      metadata: {
        threshold: 75,
        maxScrollDepth: 82,
      },
    },
  ];
};

const buildLoggedInEvents = (sessionId) => {
  const now = new Date().toISOString();
  return [
    {
      eventId: randomUUID(),
      eventType: "click_event",
      sessionId,
      timestamp: now,
      pageUrl: "http://localhost:3000/product/smoke-product-001",
      referrer: "http://localhost:3000/",
      metadata: {
        elementType: "button",
        elementId: "buy-now",
      },
    },
    {
      eventId: randomUUID(),
      eventType: "add_to_cart",
      sessionId,
      timestamp: now,
      pageUrl: "http://localhost:3000/product/smoke-product-001",
      referrer: "http://localhost:3000/product/smoke-product-001",
      metadata: {
        productId: "smoke-product-001",
        productName: "Smoke Test Product",
        quantity: 1,
      },
    },
  ];
};

const main = async () => {
  let managedWorker = null;
  console.log("[analytics-smoke-test] starting", {
    apiBaseUrl,
    fetchTimeoutMs: FETCH_TIMEOUT_MS,
    manageWorker: MANAGE_WORKER,
  });

  try {
    console.log("[analytics-smoke-test] ensuring analytics indexes");
    await ensureAnalyticsIndexes();
    const db = await getAnalyticsDb();
    console.log("[analytics-smoke-test] analytics db connected", {
      dbName: db.databaseName,
    });

    const activeWorker = await hasActiveWorker(db);
    if (!activeWorker && MANAGE_WORKER) {
      console.log("[analytics-smoke-test] no active worker detected, starting managed worker");
      managedWorker = await startManagedWorker();
    } else if (!activeWorker && !MANAGE_WORKER) {
      console.warn(
        "[analytics-smoke-test] warning: no active worker detected. Set TRACKING_TEST_START_WORKER=true to auto-start one.",
      );
    }

    console.log("[analytics-smoke-test] requesting guest session");
    const guestSession = await requestSession();
    if (!guestSession.sessionId) {
      throw new Error("Guest session did not return sessionId.");
    }
    const guestEvents = buildGuestEvents(guestSession.sessionId);
    const guestEventIds = guestEvents.map((event) => event.eventId);

    console.log("[analytics-smoke-test] publishing guest batch", {
      sessionId: guestSession.sessionId,
    });
    await publishBatch({
      sessionId: guestSession.sessionId,
      events: guestEvents,
      cookieHeader: guestSession.cookieHeader,
      consent: "granted",
    });

    console.log("[analytics-smoke-test] creating logged-in token");
    if (!ACCESS_TOKEN_SECRET) {
      throw new Error("Missing ACCESS_TOKEN_SECRET (or equivalent) for logged-in smoke test.");
    }

    const loggedInUserId = `smoke_user_${Date.now()}`;
    const authToken = jwt.sign({ id: loggedInUserId }, ACCESS_TOKEN_SECRET, {
      expiresIn: "20m",
    });

    console.log("[analytics-smoke-test] requesting logged-in session", {
      userId: loggedInUserId,
    });
    const loggedInSession = await requestSession({ authToken });
    if (!loggedInSession.sessionId) {
      throw new Error("Logged-in session did not return sessionId.");
    }
    const loggedInEvents = buildLoggedInEvents(loggedInSession.sessionId);
    const loggedInEventIds = loggedInEvents.map((event) => event.eventId);

    console.log("[analytics-smoke-test] publishing logged-in batch", {
      sessionId: loggedInSession.sessionId,
    });
    await publishBatch({
      sessionId: loggedInSession.sessionId,
      events: loggedInEvents,
      authToken,
      cookieHeader: loggedInSession.cookieHeader,
      consent: "granted",
    });

    console.log("[analytics-smoke-test] waiting for worker ingestion");
    const [guestDocs, loggedInDocs] = await Promise.all([
      waitForEventsIngested({
        db,
        eventIds: guestEventIds,
        timeoutMs: 40_000,
      }),
      waitForEventsIngested({
        db,
        eventIds: loggedInEventIds,
        timeoutMs: 40_000,
      }),
    ]);

    const guestResolvedSessionId = String(guestDocs?.[0]?.sessionId || guestSession.sessionId);
    const loggedInResolvedSessionId = String(loggedInDocs?.[0]?.sessionId || loggedInSession.sessionId);

    const [guestSnapshot, loggedInSnapshot] = await Promise.all([
      querySessionSnapshot(db, guestResolvedSessionId),
      querySessionSnapshot(db, loggedInResolvedSessionId),
    ]);

    const guestPass = guestDocs.length >= guestEventIds.length;
    const loggedInPass =
      loggedInDocs.length >= loggedInEventIds.length &&
      loggedInDocs.every((doc) => String(doc?.userId || "") === loggedInUserId) &&
      String(loggedInSnapshot?.sessionDoc?.userId || "") === loggedInUserId;

    const summary = {
      apiBaseUrl,
      guest: {
        requestedSessionId: guestSession.sessionId,
        persistedSessionId: guestResolvedSessionId,
        eventIds: guestEventIds,
        persistedEventsById: guestDocs.length,
        trackedEvents: guestSnapshot?.rawEvents?.length || 0,
        productEvents: guestSnapshot?.productEvents || 0,
        sessionDoc: guestSnapshot?.sessionDoc || null,
        pass: guestPass,
      },
      loggedIn: {
        requestedSessionId: loggedInSession.sessionId,
        persistedSessionId: loggedInResolvedSessionId,
        eventIds: loggedInEventIds,
        persistedEventsById: loggedInDocs.length,
        userId: loggedInUserId,
        trackedEvents: loggedInSnapshot?.rawEvents?.length || 0,
        sessionDoc: loggedInSnapshot?.sessionDoc || null,
        pass: loggedInPass,
      },
      overallPass: guestPass && loggedInPass,
    };

    if (!summary.overallPass) {
      console.error("[analytics-smoke-test] FAILED");
      console.error(JSON.stringify(summary, null, 2));
      throw new Error("Smoke test assertions failed.");
    }

    console.log("[analytics-smoke-test] PASSED");
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (managedWorker) {
      console.log("[analytics-smoke-test] stopping managed worker");
      await managedWorker.stop();
    }
  }
};

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("[analytics-smoke-test] FAILED");
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
