import Partner from "../models/partner.model.js";
import PartnerApiKey from "../models/partnerApiKey.model.js";
import PartnerApiRequestLog from "../models/partnerApiRequestLog.model.js";
import { getRedisClient, isRedisConfigured } from "../config/redisClient.js";
import { getPartnerLiveSnapshot } from "../middlewares/partnerApiActivity.js";
import { runWithBackgroundJobLease } from "../utils/backgroundJobLease.js";

const DEFAULT_BASE_RPM = 120;
const DEFAULT_BURST_MULTIPLIER = 1.8;
const DEFAULT_DAILY_LIMIT = 20000;

const MIN_RPM = 10;
const MAX_RPM = 50000;
const MIN_DAILY_LIMIT = 100;
const MAX_DAILY_LIMIT = 10000000;

const SCALING_WINDOW_MS = 5 * 60 * 1000;
const SCALING_INTERVAL_MS = Math.max(
  10_000,
  Number.parseInt(String(process.env.PARTNER_DYNAMIC_SCALING_INTERVAL_MS || "30000"), 10) || 30_000,
);
const EVENTS_LIMIT = 200;

let scalingTimer = null;
let scalingCycleInProgress = false;

const fallbackStateStore = new Map();
const fallbackEventStore = [];

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toFloat = (value, fallback) => {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const round2 = (value) => Number(Number(value || 0).toFixed(2));

const normalizeTier = (value) => {
  const normalized = String(value || "custom").trim().toLowerCase();
  if (["free", "growth", "pro", "enterprise", "custom"].includes(normalized)) {
    return normalized;
  }
  return "custom";
};

const getSnapshotFallbackKey = (partnerId, keyPrefix) =>
  `${String(partnerId || "").trim()}:${String(keyPrefix || "").trim()}`;

export const getPartnerDynamicRedisKeys = (keyPrefix) => ({
  state: `partner:${keyPrefix}:dynamic:state`,
  events: `partner:${keyPrefix}:dynamic:events`,
  bucket: `partner:${keyPrefix}:bucket`,
  rpm: `partner:${keyPrefix}:rpm`,
  daily: `partner:${keyPrefix}:daily`,
  usageDaily: `partner:${keyPrefix}:usage:daily`,
  errors: `partner:${keyPrefix}:errors`,
  meta: `partner:${keyPrefix}:meta`,
});

const buildPlanFromPartner = (partner) => {
  const legacyRateLimit = toInt(partner?.rateLimitPerMinute, DEFAULT_BASE_RPM);
  const legacyDailyLimit = toInt(partner?.dailyRequestLimit, DEFAULT_DAILY_LIMIT);

  const tier = normalizeTier(partner?.rateLimitPlan?.tier);
  const baseRPM = clamp(
    toInt(partner?.rateLimitPlan?.baseRPM, legacyRateLimit),
    MIN_RPM,
    MAX_RPM,
  );
  const burstRPM = clamp(
    toInt(partner?.rateLimitPlan?.burstRPM, Math.round(baseRPM * DEFAULT_BURST_MULTIPLIER)),
    baseRPM,
    MAX_RPM,
  );
  const dailyLimit = clamp(
    toInt(partner?.rateLimitPlan?.dailyLimit, legacyDailyLimit),
    MIN_DAILY_LIMIT,
    MAX_DAILY_LIMIT,
  );

  let minDynamicRPM = clamp(
    toInt(partner?.rateLimitPlan?.minDynamicRPM, Math.max(MIN_RPM, Math.floor(baseRPM * 0.5))),
    MIN_RPM,
    MAX_RPM,
  );
  let maxDynamicRPM = clamp(
    toInt(partner?.rateLimitPlan?.maxDynamicRPM, Math.max(baseRPM, burstRPM * 2)),
    MIN_RPM,
    MAX_RPM,
  );

  if (minDynamicRPM > maxDynamicRPM) {
    const swap = minDynamicRPM;
    minDynamicRPM = maxDynamicRPM;
    maxDynamicRPM = swap;
  }

  const scalingEnabled = partner?.rateLimitPlan?.scalingEnabled !== false;

  const lockScaling = Boolean(partner?.dynamicControls?.lockScaling);
  const safeModeForced = Boolean(partner?.dynamicControls?.safeModeForced);

  const manualOverrideRPMRaw = toInt(partner?.dynamicControls?.manualOverrideRPM, 0);
  const manualOverrideRPM = manualOverrideRPMRaw > 0
    ? clamp(manualOverrideRPMRaw, minDynamicRPM, maxDynamicRPM)
    : 0;

  const manualOverrideDailyRaw = toInt(partner?.dynamicControls?.manualOverrideDailyLimit, 0);
  const manualOverrideDailyLimit = manualOverrideDailyRaw > 0
    ? clamp(manualOverrideDailyRaw, MIN_DAILY_LIMIT, MAX_DAILY_LIMIT)
    : 0;

  const qualityScore = clamp(
    toFloat(partner?.dynamicControls?.qualityScore, 1),
    0.5,
    1.5,
  );

  return {
    tier,
    baseRPM,
    burstRPM,
    dailyLimit,
    minDynamicRPM,
    maxDynamicRPM,
    scalingEnabled,
    lockScaling,
    safeModeForced,
    manualOverrideRPM,
    manualOverrideDailyLimit,
    qualityScore,
  };
};

const parseState = (stateRaw) => ({
  currentRPM: Math.max(toInt(stateRaw?.currentRPM, 0), 0),
  lastScaleAt: String(stateRaw?.lastScaleAt || "") || null,
  lastAction: String(stateRaw?.lastAction || "steady") || "steady",
  reason: String(stateRaw?.reason || "") || "",
  avgResponseMs: Math.max(toFloat(stateRaw?.avgResponseMs, 0), 0),
  errorRate: Math.max(toFloat(stateRaw?.errorRate, 0), 0),
  queuePressure: Math.max(toFloat(stateRaw?.queuePressure, 0), 0),
  throttleRate: Math.max(toFloat(stateRaw?.throttleRate, 0), 0),
});

const writeFallbackState = (key, state) => {
  fallbackStateStore.set(key, {
    ...state,
    updatedAt: new Date().toISOString(),
  });
};

const pushFallbackEvent = (event) => {
  fallbackEventStore.unshift(event);
  if (fallbackEventStore.length > EVENTS_LIMIT) {
    fallbackEventStore.length = EVENTS_LIMIT;
  }
};

const storeScalingEvent = async ({ keyPrefix, event }) => {
  const redis = getRedisClient();
  if (redis && keyPrefix) {
    try {
      const keys = getPartnerDynamicRedisKeys(keyPrefix);
      await redis
        .multi()
        .lpush(keys.events, JSON.stringify(event))
        .ltrim(keys.events, 0, EVENTS_LIMIT - 1)
        .expire(keys.events, 14 * 24 * 60 * 60)
        .exec();
      return;
    } catch {
    }
  }

  pushFallbackEvent(event);
};

const readScalingEvents = async ({ keyPrefix, partnerId, limit = 30 }) => {
  const safeLimit = Math.min(Math.max(toInt(limit, 30), 1), 200);
  const redis = getRedisClient();

  if (redis && keyPrefix) {
    try {
      const keys = getPartnerDynamicRedisKeys(keyPrefix);
      const rows = await redis.lrange(keys.events, 0, safeLimit - 1);
      return rows
        .map((row) => {
          try {
            return JSON.parse(row);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
    }
  }

  const pid = String(partnerId || "").trim();
  return fallbackEventStore
    .filter((item) => !pid || String(item.partnerId || "").trim() === pid)
    .slice(0, safeLimit);
};

const computeTargetRpm = ({ plan, currentRPM, metrics }) => {
  const qualityAdjustedBase = clamp(
    Math.round(plan.baseRPM * plan.qualityScore),
    plan.minDynamicRPM,
    plan.maxDynamicRPM,
  );

  let scaleFactor = 1;
  let action = "steady";
  let reason = "Signals are balanced";

  if (metrics.requests < 5) {
    const idleTarget = Math.round(qualityAdjustedBase * 0.9 + currentRPM * 0.1);
    return {
      action: "idle_adjust",
      reason: "Low request volume in recent window",
      targetRPM: clamp(idleTarget, plan.minDynamicRPM, plan.maxDynamicRPM),
    };
  }

  if (metrics.errorRate >= 0.12 || metrics.avgResponseMs >= 1500 || metrics.throttleRate >= 0.2) {
    scaleFactor = 0.72;
    action = "scale_down_hard";
    reason = "High error/latency/throttle pressure";
  } else if (metrics.errorRate >= 0.06 || metrics.avgResponseMs >= 900 || metrics.throttleRate >= 0.12) {
    scaleFactor = 0.84;
    action = "scale_down";
    reason = "Moderate error/latency/throttle pressure";
  } else if (metrics.queuePressure >= 1.2 && metrics.avgResponseMs < 850 && metrics.errorRate < 0.05) {
    scaleFactor = 1.18;
    action = "scale_up";
    reason = "High queue pressure with healthy latency";
  } else if (metrics.queuePressure >= 0.8 && metrics.avgResponseMs < 600 && metrics.errorRate < 0.03) {
    scaleFactor = 1.1;
    action = "scale_up_soft";
    reason = "Sustained demand with stable quality";
  }

  const targetBySignals = clamp(
    Math.round(qualityAdjustedBase * scaleFactor),
    plan.minDynamicRPM,
    plan.maxDynamicRPM,
  );

  const smoothed = Math.round(currentRPM + (targetBySignals - currentRPM) * 0.35);

  return {
    action,
    reason,
    targetRPM: clamp(smoothed, plan.minDynamicRPM, plan.maxDynamicRPM),
  };
};

const aggregateRecentMetrics = async ({ partnerId, currentRPM, activeRequests }) => {
  const from = new Date(Date.now() - SCALING_WINDOW_MS);

  const [row] = await PartnerApiRequestLog.aggregate([
    {
      $match: {
        partnerId,
        createdAt: { $gte: from },
      },
    },
    {
      $group: {
        _id: null,
        requests: { $sum: 1 },
        errors: {
          $sum: {
            $cond: [{ $gte: ["$statusCode", 400] }, 1, 0],
          },
        },
        avgResponseMs: { $avg: "$responseTimeMs" },
        throttles: {
          $sum: {
            $cond: [{ $in: ["$errorCode", ["RATE_LIMIT_EXCEEDED", "DAILY_LIMIT_EXCEEDED"]] }, 1, 0],
          },
        },
      },
    },
  ]);

  const requests = Math.max(toInt(row?.requests, 0), 0);
  const errors = Math.max(toInt(row?.errors, 0), 0);
  const throttles = Math.max(toInt(row?.throttles, 0), 0);
  const avgResponseMs = Math.max(toFloat(row?.avgResponseMs, 0), 0);

  const errorRate = requests > 0 ? errors / requests : 0;
  const throttleRate = requests > 0 ? throttles / requests : 0;

  const reqPerSecondCapacity = Math.max(currentRPM / 60, 0.1);
  const queuePressure = activeRequests / reqPerSecondCapacity;

  return {
    requests,
    errors,
    throttles,
    avgResponseMs,
    errorRate,
    throttleRate,
    queuePressure,
  };
};

const persistDynamicState = async ({ partnerId, keyPrefix, plan, statePatch }) => {
  const nowIso = new Date().toISOString();
  const nextState = {
    currentRPM: clamp(
      toInt(statePatch.currentRPM, plan.baseRPM),
      plan.minDynamicRPM,
      plan.maxDynamicRPM,
    ),
    lastScaleAt: String(statePatch.lastScaleAt || nowIso),
    lastAction: String(statePatch.lastAction || "steady"),
    reason: String(statePatch.reason || ""),
    avgResponseMs: round2(statePatch.avgResponseMs),
    errorRate: round2(statePatch.errorRate),
    queuePressure: round2(statePatch.queuePressure),
    throttleRate: round2(statePatch.throttleRate),
  };

  const redis = getRedisClient();
  if (redis && keyPrefix) {
    try {
      const keys = getPartnerDynamicRedisKeys(keyPrefix);
      await redis.hset(keys.state, {
        currentRPM: String(nextState.currentRPM),
        lastScaleAt: nextState.lastScaleAt,
        lastAction: nextState.lastAction,
        reason: nextState.reason,
        avgResponseMs: String(nextState.avgResponseMs),
        errorRate: String(nextState.errorRate),
        queuePressure: String(nextState.queuePressure),
        throttleRate: String(nextState.throttleRate),
      });
      await redis.expire(keys.state, 7 * 24 * 60 * 60);
      return nextState;
    } catch {
    }
  }

  writeFallbackState(getSnapshotFallbackKey(partnerId, keyPrefix), nextState);
  return nextState;
};

export const getPartnerDynamicLimitSnapshot = async ({ partner, keyPrefix }) => {
  const partnerId = String(partner?._id || "").trim();
  const safeKeyPrefix = String(keyPrefix || "").trim();
  const plan = buildPlanFromPartner(partner || {});

  const fallbackCurrent = plan.manualOverrideRPM || plan.baseRPM;
  let state = parseState({ currentRPM: fallbackCurrent });
  let storageMode = "memory";

  const redis = getRedisClient();
  if (redis && safeKeyPrefix) {
    try {
      const keys = getPartnerDynamicRedisKeys(safeKeyPrefix);
      const rawState = await redis.hgetall(keys.state);
      state = parseState(rawState);
      storageMode = "redis";
    } catch {
      storageMode = isRedisConfigured() ? "fallback-memory" : "memory";
    }
  } else if (isRedisConfigured()) {
    storageMode = "fallback-memory";
  }

  if (!state.currentRPM) {
    const fallback = fallbackStateStore.get(getSnapshotFallbackKey(partnerId, safeKeyPrefix));
    if (fallback) {
      state = parseState(fallback);
    }
  }

  let effectiveRPM = state.currentRPM || fallbackCurrent;
  let policy = "auto";

  if (plan.safeModeForced) {
    effectiveRPM = plan.baseRPM;
    policy = "safe-mode";
  }

  if (plan.manualOverrideRPM > 0) {
    effectiveRPM = plan.manualOverrideRPM;
    policy = "override";
  }

  if (plan.lockScaling && state.currentRPM > 0) {
    effectiveRPM = state.currentRPM;
    policy = "locked";
  }

  if (!plan.scalingEnabled) {
    effectiveRPM = plan.manualOverrideRPM > 0 ? plan.manualOverrideRPM : plan.baseRPM;
    policy = plan.manualOverrideRPM > 0 ? "override" : "disabled";
  }

  effectiveRPM = clamp(effectiveRPM, plan.minDynamicRPM, plan.maxDynamicRPM);

  const effectiveDailyLimit = plan.manualOverrideDailyLimit > 0
    ? plan.manualOverrideDailyLimit
    : plan.dailyLimit;

  return {
    plan: {
      tier: plan.tier,
      baseRPM: plan.baseRPM,
      burstRPM: plan.burstRPM,
      dailyLimit: plan.dailyLimit,
      minDynamicRPM: plan.minDynamicRPM,
      maxDynamicRPM: plan.maxDynamicRPM,
      scalingEnabled: plan.scalingEnabled,
      qualityScore: plan.qualityScore,
    },
    controls: {
      lockScaling: plan.lockScaling,
      manualOverrideRPM: plan.manualOverrideRPM || null,
      manualOverrideDailyLimit: plan.manualOverrideDailyLimit || null,
      safeModeForced: plan.safeModeForced,
    },
    state: {
      currentRPM: effectiveRPM,
      lastScaleAt: state.lastScaleAt || null,
      lastAction: state.lastAction || policy,
      reason: state.reason || "",
      avgResponseMs: state.avgResponseMs || 0,
      errorRate: state.errorRate || 0,
      queuePressure: state.queuePressure || 0,
      throttleRate: state.throttleRate || 0,
      policy,
      storageMode,
      isSafeFallbackMode: storageMode !== "redis",
    },
    effectiveRPM,
    burstRPM: plan.burstRPM,
    dailyLimit: effectiveDailyLimit,
  };
};

export const getPartnerDynamicScalingEvents = async ({ partnerId, keyPrefix, limit }) =>
  readScalingEvents({ partnerId, keyPrefix, limit });

export const applyPartnerDynamicAdminOverride = async ({ partner, keyPrefix, reason = "admin_update" }) => {
  const snapshot = await getPartnerDynamicLimitSnapshot({ partner, keyPrefix });
  const nextState = await persistDynamicState({
    partnerId: String(partner?._id || ""),
    keyPrefix,
    plan: {
      ...snapshot.plan,
      minDynamicRPM: snapshot.plan.minDynamicRPM,
      maxDynamicRPM: snapshot.plan.maxDynamicRPM,
    },
    statePatch: {
      currentRPM: snapshot.effectiveRPM,
      lastScaleAt: new Date().toISOString(),
      lastAction: "admin_override",
      reason,
      avgResponseMs: snapshot.state.avgResponseMs || 0,
      errorRate: snapshot.state.errorRate || 0,
      queuePressure: snapshot.state.queuePressure || 0,
      throttleRate: snapshot.state.throttleRate || 0,
    },
  });

  await storeScalingEvent({
    keyPrefix,
    event: {
      at: new Date().toISOString(),
      partnerId: String(partner?._id || ""),
      partnerName: String(partner?.name || ""),
      action: "admin_override",
      reason,
      newRPM: nextState.currentRPM,
      policy: snapshot.state.policy,
    },
  });

  return nextState;
};

const runScalingCycle = async () => {
  if (scalingCycleInProgress) return;
  scalingCycleInProgress = true;

  try {
    const partners = await Partner.find({ status: "active" })
      .select("_id name rateLimitPerMinute dailyRequestLimit rateLimitPlan dynamicControls")
      .lean();

    if (!partners.length) return;

    const live = getPartnerLiveSnapshot({ limit: 100 });
    const activeByPartner = new Map();
    for (const row of live.activeApiKeys || []) {
      const id = String(row.partnerId || "").trim();
      if (!id) continue;
      const current = activeByPartner.get(id) || 0;
      activeByPartner.set(id, current + Math.max(toInt(row.activeRequests, 0), 0));
    }

    const activeKeys = await PartnerApiKey.find({
      partnerId: { $in: partners.map((p) => p._id) },
      status: "active",
    })
      .select("partnerId keyPrefix createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const keyByPartner = new Map();
    for (const key of activeKeys) {
      const pid = String(key.partnerId || "").trim();
      if (!pid || keyByPartner.has(pid)) continue;
      keyByPartner.set(pid, String(key.keyPrefix || "").trim());
    }

    for (const partner of partners) {
      const partnerId = String(partner._id || "").trim();
      const keyPrefix = keyByPartner.get(partnerId) || "";
      const snapshot = await getPartnerDynamicLimitSnapshot({ partner, keyPrefix });
      const plan = {
        ...snapshot.plan,
        lockScaling: snapshot.controls.lockScaling,
        manualOverrideRPM: snapshot.controls.manualOverrideRPM,
        safeModeForced: snapshot.controls.safeModeForced,
      };

      if (!plan.scalingEnabled || plan.safeModeForced || plan.manualOverrideRPM || plan.lockScaling) {
        continue;
      }

      const activeRequests = Math.max(activeByPartner.get(partnerId) || 0, 0);
      const metrics = await aggregateRecentMetrics({
        partnerId: partner._id,
        currentRPM: snapshot.effectiveRPM,
        activeRequests,
      });

      const decision = computeTargetRpm({
        plan,
        currentRPM: snapshot.effectiveRPM,
        metrics,
      });

      const currentRPM = snapshot.effectiveRPM;
      const nextRPM = clamp(decision.targetRPM, plan.minDynamicRPM, plan.maxDynamicRPM);

      const delta = Math.abs(nextRPM - currentRPM);
      if (delta < 2) {
        await persistDynamicState({
          partnerId,
          keyPrefix,
          plan,
          statePatch: {
            currentRPM,
            lastAction: "steady",
            reason: decision.reason,
            avgResponseMs: metrics.avgResponseMs,
            errorRate: metrics.errorRate,
            queuePressure: metrics.queuePressure,
            throttleRate: metrics.throttleRate,
          },
        });
        continue;
      }

      const state = await persistDynamicState({
        partnerId,
        keyPrefix,
        plan,
        statePatch: {
          currentRPM: nextRPM,
          lastAction: decision.action,
          reason: decision.reason,
          avgResponseMs: metrics.avgResponseMs,
          errorRate: metrics.errorRate,
          queuePressure: metrics.queuePressure,
          throttleRate: metrics.throttleRate,
        },
      });

      await storeScalingEvent({
        keyPrefix,
        event: {
          at: new Date().toISOString(),
          partnerId,
          partnerName: String(partner.name || ""),
          action: decision.action,
          reason: decision.reason,
          previousRPM: currentRPM,
          newRPM: state.currentRPM,
          avgResponseMs: round2(metrics.avgResponseMs),
          errorRate: round2(metrics.errorRate),
          queuePressure: round2(metrics.queuePressure),
          throttleRate: round2(metrics.throttleRate),
        },
      });
    }
  } catch (error) {
    console.error("partner dynamic scaling cycle failed:", error?.message || error);
  } finally {
    scalingCycleInProgress = false;
  }
};

export const startPartnerDynamicScalingEngine = () => {
  if (scalingTimer) return;

  const runScheduledJob = () =>
    runWithBackgroundJobLease({
      jobKey: "partner-dynamic-scaling",
      intervalMs: SCALING_INTERVAL_MS,
      task: runScalingCycle,
    }).catch(() => null);

  scalingTimer = setInterval(runScheduledJob, SCALING_INTERVAL_MS);
  scalingTimer.unref?.();

  void runScheduledJob();
  console.log(`[partner-dynamic-scaling] started with ${SCALING_INTERVAL_MS}ms interval`);
};

export const stopPartnerDynamicScalingEngine = () => {
  if (!scalingTimer) return;
  clearInterval(scalingTimer);
  scalingTimer = null;
};
