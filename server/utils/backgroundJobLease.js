import mongoose from "mongoose";

const JOB_LOCKS_COLLECTION = "runtime_job_locks";
const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const MIN_LEASE_MS = 60 * 1000;
const MAX_LEASE_MS = 30 * 60 * 1000;

const toBoolean = (value, fallback = true) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const resolveOwnerId = () => {
  const explicit = String(process.env.BACKGROUND_JOB_OWNER_ID || "").trim();
  if (explicit) return explicit;

  const runtimeId =
    process.env.GAE_INSTANCE ||
    process.env.HOSTNAME ||
    `pid-${process.pid}`;

  return `job-runner:${runtimeId}`;
};

const isLeaseEnabled = () =>
  toBoolean(process.env.BACKGROUND_JOB_LOCKS_ENABLED, true);

const resolveLeaseMs = (intervalMs = 0, leaseMs = 0) => {
  const explicitLeaseMs = toPositiveInt(leaseMs, 0);
  if (explicitLeaseMs > 0) {
    return clamp(explicitLeaseMs, MIN_LEASE_MS, MAX_LEASE_MS);
  }

  const intervalBasedLeaseMs = Math.max(
    toPositiveInt(intervalMs, DEFAULT_LEASE_MS) * 2,
    MIN_LEASE_MS,
  );

  return clamp(intervalBasedLeaseMs, MIN_LEASE_MS, MAX_LEASE_MS);
};

const getLocksCollection = () => {
  const db = mongoose.connection?.db;
  return db ? db.collection(JOB_LOCKS_COLLECTION) : null;
};

const acquireLease = async ({ jobKey, intervalMs = 0, leaseMs = 0 }) => {
  if (!isLeaseEnabled()) {
    return { acquired: true, ownerId: resolveOwnerId(), bypassed: true };
  }

  const collection = getLocksCollection();
  if (!collection) {
    return { acquired: true, ownerId: resolveOwnerId(), bypassed: true };
  }

  const safeJobKey = String(jobKey || "").trim().toLowerCase();
  if (!safeJobKey) {
    throw new Error("background_job_key_required");
  }

  const ownerId = resolveOwnerId();
  const now = new Date();
  const safeLeaseMs = resolveLeaseMs(intervalMs, leaseMs);
  const expiresAt = new Date(now.getTime() + safeLeaseMs);

  try {
    const result = await collection.findOneAndUpdate(
      {
        _id: safeJobKey,
        $or: [
          { ownerId },
          { expiresAt: { $lte: now } },
          { expiresAt: { $exists: false } },
        ],
      },
      {
        $set: {
          ownerId,
          updatedAt: now,
          expiresAt,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    const doc = result?.value || result;
    return {
      acquired: String(doc?.ownerId || "") === ownerId,
      ownerId,
      expiresAt: doc?.expiresAt || expiresAt,
      leaseMs: safeLeaseMs,
      bypassed: false,
    };
  } catch (error) {
    if (Number(error?.code) === 11000) {
      return {
        acquired: false,
        ownerId,
        expiresAt: null,
        leaseMs: safeLeaseMs,
        bypassed: false,
      };
    }

    throw error;
  }
};

export const runWithBackgroundJobLease = async ({
  jobKey,
  intervalMs = 0,
  leaseMs = 0,
  task,
} = {}) => {
  if (typeof task !== "function") {
    throw new Error("background_job_task_required");
  }

  const lease = await acquireLease({ jobKey, intervalMs, leaseMs });
  if (!lease.acquired) {
    return { ran: false, skipped: true, lease };
  }

  const result = await task();
  return { ran: true, skipped: false, lease, result };
};

export const __backgroundJobLeaseTestUtils = {
  resolveLeaseMs,
  resolveOwnerId,
};

