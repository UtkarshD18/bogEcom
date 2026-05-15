"use client";

import { API_BASE_URL } from "@/utils/api";

const CONSENT_STORAGE_KEY = "hog_analytics_consent";
const VISITOR_STORAGE_KEY = "hog_analytics_visitor_id";
const SESSION_STORAGE_KEY = "hog_analytics_session_id";
const SESSION_LAST_ACTIVITY_KEY = "hog_analytics_session_last_activity";
const DEFAULT_FLUSH_MIN_MS = 10000;
const DEFAULT_FLUSH_MAX_MS = 20000;
const HEARTBEAT_INTERVAL_MS = 30000;
const IDLE_TIMEOUT_MS = 30000;
const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 300;
const HOVER_MIN_DURATION_MS = 300;
const HOVER_EMIT_THROTTLE_MS = 1000;
const RAGE_CLICK_WINDOW_MS = 2000;
const RAGE_CLICK_THRESHOLD = 3;
const MAX_EVENTS_PER_SECOND = Math.max(
  Number(process.env.NEXT_PUBLIC_ANALYTICS_MAX_EVENTS_PER_SECOND || 40),
  10,
);
const MAX_EVENTS_PER_BATCH = 200;
const COMPRESS_THRESHOLD_BYTES = 48 * 1024;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const DEFAULT_TARGET_TYPE = "cart";
const CLICKABLE_SELECTOR =
  "[data-track],[data-track-click],[data-banner-id],[data-banner],[data-product-id],[data-product],[data-productid],button,a,input[type='button'],input[type='submit'],input[type='reset'],summary,[role='button'],[role='link'],[onclick]";
const CRITICAL_EVENT_TYPES = new Set([
  "session_start",
  "page_view_started",
  "purchase_completed",
  "checkout_started",
]);

const trackerState = {
  initialized: false,
  initializingPromise: null,
  sessionId: "",
  queue: [],
  flushTimer: null,
  heartbeatTimer: null,
  sessionStartAt: 0,
  sessionActiveMs: 0,
  lastActivityAt: 0,
  lastHeartbeatAt: 0,
  isIdle: false,
  lastInputAt: 0,
  currentPageView: null,
  scrollThresholds: new Set(),
  maxScrollDepth: 0,
  sectionObserver: null,
  sectionMutationObserver: null,
  activeSections: new Map(),
  sectionObservedElements: new WeakSet(),
  clickHistory: new Map(),
  hoverActive: new WeakMap(),
  focusActive: new WeakMap(),
  hoverLastEmitByKey: new Map(),
  eventRateWindowStartedAt: 0,
  eventRateWindowCount: 0,
  finalizedSession: false,
};

const attachedTrackingElements = new WeakMap();

const trimTrailingSlashes = (value) => String(value || "").replace(/\/+$/, "");

const resolveTrackUrl = () => {
  const base = trimTrailingSlashes(API_BASE_URL || "");
  if (!base) return "/api/track";
  if (/\/api$/i.test(base)) return `${base}/track`;
  return `${base}/api/track`;
};

const resolveTrackSessionUrl = () => {
  const base = trimTrailingSlashes(API_BASE_URL || "");
  if (!base) return "/api/track/session";
  if (/\/api$/i.test(base)) return `${base}/track/session`;
  return `${base}/api/track/session`;
};

const resolveConsentUrl = () => {
  const base = trimTrailingSlashes(API_BASE_URL || "");
  if (!base) return "/api/track/consent";
  if (/\/api$/i.test(base)) return `${base}/track/consent`;
  return `${base}/api/track/consent`;
};

const getFlushMinMs = () =>
  Math.max(
    Number(process.env.NEXT_PUBLIC_TRACK_FLUSH_MIN_MS || DEFAULT_FLUSH_MIN_MS),
    1000,
  );

const getFlushMaxMs = () =>
  Math.max(
    Number(process.env.NEXT_PUBLIC_TRACK_FLUSH_MAX_MS || DEFAULT_FLUSH_MAX_MS),
    getFlushMinMs(),
  );

const getRandomFlushDelay = () => {
  const min = getFlushMinMs();
  const max = getFlushMaxMs();
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
};

const createId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
};

const hasDoNotTrack = () => {
  if (typeof navigator === "undefined" || typeof window === "undefined")
    return false;

  const dnt = String(
    navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack || "",
  )
    .trim()
    .toLowerCase();

  return (
    dnt === "1" || dnt === "yes" || navigator.globalPrivacyControl === true
  );
};

const shouldRespectDoNotTrack = () => {
  const explicit = String(process.env.NEXT_PUBLIC_ANALYTICS_RESPECT_DNT || "")
    .trim()
    .toLowerCase();

  if (explicit) {
    return ["true", "1", "yes", "on"].includes(explicit);
  }

  return process.env.NODE_ENV === "production";
};

const decodeJwtUserId = () => {
  if (typeof window === "undefined") return null;

  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("token") || "";

  if (!token || token.split(".").length !== 3) return null;

  try {
    const payloadPart = token.split(".")[1];
    const normalized = payloadPart
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(normalized));
    return String(decoded?.id || decoded?.sub || "").trim() || null;
  } catch {
    return null;
  }
};

const resolveDeviceType = () => {
  if (typeof navigator === "undefined") return "desktop";
  const ua = String(navigator.userAgent || "").toLowerCase();
  if (/tablet|ipad/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  return "desktop";
};

const resolveBrowser = () => {
  if (typeof navigator === "undefined") return "Other";
  const ua = String(navigator.userAgent || "");
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  return "Other";
};

const shouldSkipTracking = () => {
  const consent = getAnalyticsConsent();
  if (consent === "denied") return true;
  if (!shouldRespectDoNotTrack()) return false;
  return hasDoNotTrack();
};

const getNow = () => Date.now();

const toIso = (timeMs = getNow()) => new Date(timeMs).toISOString();

const getPagePath = () => {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname || "/"}${window.location.search || ""}`;
};

const getPageUrl = () =>
  typeof window !== "undefined" ? window.location.href : "";

const getReferrer = () =>
  typeof document !== "undefined" ? document.referrer || "" : "";

const readStorageValue = (storage, key) => {
  if (typeof window === "undefined") return "";
  try {
    return String(storage?.getItem(key) || "").trim();
  } catch {
    return "";
  }
};

const writeStorageValue = (storage, key, value) => {
  if (typeof window === "undefined") return;
  try {
    const normalized = String(value || "").trim();
    if (!normalized) {
      storage?.removeItem(key);
      return;
    }
    storage?.setItem(key, normalized);
  } catch {
    // Ignore storage write failures.
  }
};

const removeStorageValue = (storage, key) => {
  if (typeof window === "undefined") return;
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore storage removal failures.
  }
};

const getSessionTimeoutMs = () =>
  Math.max(
    Number(
      process.env.NEXT_PUBLIC_ANALYTICS_SESSION_TIMEOUT_MS ||
        DEFAULT_SESSION_TIMEOUT_MS,
    ),
    IDLE_TIMEOUT_MS,
  );

const getStoredSessionId = () => {
  if (typeof window === "undefined") return "";
  return readStorageValue(window.sessionStorage, SESSION_STORAGE_KEY);
};

const getStoredSessionLastActivityAt = () => {
  if (typeof window === "undefined") return 0;
  const parsed = Number(
    readStorageValue(window.sessionStorage, SESSION_LAST_ACTIVITY_KEY),
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const persistSessionState = (sessionId, lastActivityAt = getNow()) => {
  if (typeof window === "undefined") return;
  writeStorageValue(window.sessionStorage, SESSION_STORAGE_KEY, sessionId);
  writeStorageValue(
    window.sessionStorage,
    SESSION_LAST_ACTIVITY_KEY,
    String(Math.max(Number(lastActivityAt) || 0, 0)),
  );
};

const clearStoredSessionState = () => {
  if (typeof window === "undefined") return;
  removeStorageValue(window.sessionStorage, SESSION_STORAGE_KEY);
  removeStorageValue(window.sessionStorage, SESSION_LAST_ACTIVITY_KEY);
};

const getOrCreateVisitorId = () => {
  if (typeof window === "undefined") return createId();
  const existing = readStorageValue(window.localStorage, VISITOR_STORAGE_KEY);
  if (existing) return existing;
  const generated = createId();
  writeStorageValue(window.localStorage, VISITOR_STORAGE_KEY, generated);
  return generated;
};

const toBase64FromBytes = (bytes) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const compressToGzipBase64 = async (input) => {
  if (typeof CompressionStream === "undefined") {
    return null;
  }

  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  await writer.write(new TextEncoder().encode(input));
  await writer.close();

  const compressedBuffer = await new Response(stream.readable).arrayBuffer();
  return toBase64FromBytes(new Uint8Array(compressedBuffer));
};

const normalizeMetadataValue = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 1024);
  if (Array.isArray(value))
    return value.slice(0, 100).map(normalizeMetadataValue);
  if (typeof value === "object") {
    const out = {};
    for (const [key, nestedValue] of Object.entries(value).slice(0, 100)) {
      out[key] = normalizeMetadataValue(nestedValue);
    }
    return out;
  }
  return String(value).slice(0, 1024);
};

const sanitizeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 100)) {
    sanitized[key] = normalizeMetadataValue(value);
  }
  return sanitized;
};

const isButtonLikeElement = (element) => {
  if (!element) return false;

  const tagName = String(element.tagName || "").toLowerCase();
  if (tagName === "button" || tagName === "a") return true;

  const role = String(element.getAttribute?.("role") || "").toLowerCase();
  return role === "button" || role === "link";
};

export const getAnalyticsConsent = () => {
  if (typeof window === "undefined") return "unknown";
  const stored = readStorageValue(window.localStorage, CONSENT_STORAGE_KEY)
    .toLowerCase();

  if (["granted", "denied"].includes(stored)) {
    return stored;
  }

  const envDefault = String(
    process.env.NEXT_PUBLIC_DEFAULT_ANALYTICS_CONSENT || "granted",
  )
    .trim()
    .toLowerCase();

  return envDefault === "denied" ? "denied" : "granted";
};

export const setAnalyticsConsent = async (consentValue) => {
  if (typeof window === "undefined") return;

  const normalized = String(consentValue || "")
    .trim()
    .toLowerCase();

  if (!["granted", "denied"].includes(normalized)) {
    return;
  }

  writeStorageValue(window.localStorage, CONSENT_STORAGE_KEY, normalized);

  try {
    await fetch(resolveConsentUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({ consent: normalized }),
    });
  } catch {
    // Ignore consent endpoint network failures.
  }
};

const adoptSessionState = (
  sessionId,
  { startedAt = getNow(), lastActivityAt = startedAt } = {},
) => {
  trackerState.sessionId = String(sessionId || "").trim();
  trackerState.sessionStartAt = startedAt;
  trackerState.sessionActiveMs = 0;
  trackerState.lastActivityAt = lastActivityAt;
  trackerState.lastHeartbeatAt = startedAt;
  trackerState.finalizedSession = false;
  trackerState.isIdle = false;

  if (trackerState.sessionId) {
    persistSessionState(trackerState.sessionId, lastActivityAt);
  }
};

const syncSessionActivity = (timeMs = getNow()) => {
  trackerState.lastActivityAt = timeMs;
  if (trackerState.sessionId) {
    persistSessionState(trackerState.sessionId, timeMs);
  }
};

const isSessionExpired = (referenceTime = getNow()) => {
  const lastActivityAt =
    trackerState.lastActivityAt || getStoredSessionLastActivityAt();
  if (!trackerState.sessionId || !lastActivityAt) {
    return false;
  }
  return referenceTime - lastActivityAt >= getSessionTimeoutMs();
};

const emitSessionStart = (startedAt = getNow()) => {
  enqueue("session_start", {
    startedAt: toIso(startedAt),
    path: typeof window !== "undefined" ? window.location.pathname : "/",
    title: typeof document !== "undefined" ? document.title : "",
    isActive: true,
  });
};

const buildEvent = (eventType, metadata = {}, overrides = {}) => {
  const normalizedType = String(eventType || "")
    .trim()
    .toLowerCase();

  if (!EVENT_TYPE_PATTERN.test(normalizedType)) {
    return null;
  }

  const sessionId = trackerState.sessionId || getStoredSessionId() || createId();
  const userId = decodeJwtUserId();
  const sanitizedMetadata = sanitizeMetadata({
    ...metadata,
    visitorId: getOrCreateVisitorId(),
  });
  const targetType = resolveTargetType(normalizedType, sanitizedMetadata);
  const targetId = resolveTargetId(sanitizedMetadata, sessionId);

  return {
    eventId: createId(),
    eventType: normalizedType,
    event_name: normalizedType,
    sessionId,
    session_id: sessionId,
    userId,
    user_id: userId,
    timestamp: toIso(),
    page: getPagePath(),
    target_type: targetType,
    target_id: targetId,
    pageUrl: String(overrides.pageUrl || getPageUrl()),
    referrer:
      overrides.referrer !== undefined
        ? String(overrides.referrer || "")
        : getReferrer(),
    deviceType: resolveDeviceType(),
    browser: resolveBrowser(),
    metadata: sanitizedMetadata,
  };
};

const sendPayload = async (payload, useBeacon = true) => {
  const trackUrl = resolveTrackUrl();

  let serialized = JSON.stringify(payload);
  let bodyPayload = serialized;

  if (serialized.length > COMPRESS_THRESHOLD_BYTES) {
    try {
      const compressedPayload = await compressToGzipBase64(serialized);
      if (compressedPayload) {
        bodyPayload = JSON.stringify({
          compressed: true,
          encoding: "gzip-base64",
          payload: compressedPayload,
          sessionId: payload.sessionId,
          consent: payload.consent,
        });
      }
    } catch {
      // If compression fails, fallback to plain payload.
    }
  }

  if (
    useBeacon &&
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
  ) {
    const beaconBlob = new Blob([bodyPayload], { type: "application/json" });
    const sent = navigator.sendBeacon(trackUrl, beaconBlob);
    if (sent) {
      return;
    }
  }

  await fetch(trackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: bodyPayload,
  });
};

const scheduleFlush = () => {
  if (trackerState.flushTimer || trackerState.queue.length === 0) {
    return;
  }

  const delay = getRandomFlushDelay();
  trackerState.flushTimer = setTimeout(() => {
    trackerState.flushTimer = null;
    flushQueue().catch(() => {
      // Never throw on tracking flush.
    });
  }, delay);
};

const clearFlushTimer = () => {
  if (!trackerState.flushTimer) return;
  clearTimeout(trackerState.flushTimer);
  trackerState.flushTimer = null;
};

const flushQueue = async ({ immediate = false } = {}) => {
  if (trackerState.queue.length === 0) {
    clearFlushTimer();
    return;
  }

  clearFlushTimer();

  while (trackerState.queue.length > 0) {
    const batchSessionId =
      String(
        trackerState.queue[0]?.sessionId ||
          trackerState.sessionId ||
          getStoredSessionId() ||
          "",
      ).trim() || createId();
    const batch = [];

    while (
      trackerState.queue.length > 0 &&
      batch.length < MAX_EVENTS_PER_BATCH
    ) {
      const nextEvent = trackerState.queue[0];
      if (
        batch.length > 0 &&
        String(nextEvent?.sessionId || "").trim() !== batchSessionId
      ) {
        break;
      }
      batch.push(trackerState.queue.shift());
    }

    const payload = {
      sessionId: batchSessionId,
      consent: getAnalyticsConsent(),
      events: batch,
    };

    try {
      await sendPayload(payload, true);
    } catch {
      // Drop on failure to avoid blocking UX.
    }

    if (!immediate && batch.length < MAX_EVENTS_PER_BATCH) {
      break;
    }
  }

  if (trackerState.queue.length > 0) {
    scheduleFlush();
  }
};

const enqueue = (eventType, metadata = {}, overrides = {}) => {
  if (typeof window === "undefined") return;
  if (shouldSkipTracking()) return;

  const event = buildEvent(eventType, metadata, overrides);
  if (!event) return;

  if (!CRITICAL_EVENT_TYPES.has(event.eventType) && !canEnqueueEvent()) {
    return;
  }

  trackerState.queue.push(event);

  if (CRITICAL_EVENT_TYPES.has(event.eventType)) {
    flushQueue({ immediate: true }).catch(() => {});
    return;
  }

  if (trackerState.queue.length >= MAX_EVENTS_PER_BATCH) {
    flushQueue().catch(() => {});
    return;
  }

  scheduleFlush();
};

const startFreshSession = ({
  sessionId = "",
  syncBackend = false,
  emitStartEvent = true,
} = {}) => {
  const startedAt = getNow();
  const resolvedSessionId = String(sessionId || createId()).trim() || createId();
  adoptSessionState(resolvedSessionId, {
    startedAt,
    lastActivityAt: startedAt,
  });

  if (syncBackend) {
    ensureBackendSessionId(resolvedSessionId).catch(() => {});
  }

  if (emitStartEvent) {
    emitSessionStart(startedAt);
  }

  return resolvedSessionId;
};

const rotateSessionIfExpired = (
  source = "activity",
  { restartPageView = true, nextPath = "" } = {},
) => {
  if (!isSessionExpired()) {
    return false;
  }

  const fallbackPath =
    nextPath || trackerState.currentPageView?.path || getPagePath();
  finalizeSession("inactivity_timeout", { clearStoredSession: true });
  startFreshSession({
    syncBackend: true,
    emitStartEvent: true,
  });
  if (restartPageView) {
    startPageView(fallbackPath);
  }
  trackerState.isIdle = false;
  return true;
};

const markActivity = (source = "activity") => {
  const now = getNow();
  if (now - trackerState.lastInputAt < ACTIVITY_THROTTLE_MS) {
    return;
  }

  rotateSessionIfExpired(source);
  trackerState.lastInputAt = now;
  syncSessionActivity(now);

  if (trackerState.isIdle) {
    trackerState.isIdle = false;
    enqueue("active_heartbeat", {
      transition: "active",
      source,
      sessionActiveMs: trackerState.sessionActiveMs,
    });
  }
};

const resolveScrollDepth = () => {
  const documentElement = document.documentElement;
  const body = document.body;
  const scrollTop = window.scrollY || documentElement.scrollTop || 0;
  const scrollHeight = Math.max(
    documentElement.scrollHeight,
    body?.scrollHeight || 0,
  );
  const viewportHeight =
    window.innerHeight || documentElement.clientHeight || 0;
  const trackableHeight = Math.max(scrollHeight - viewportHeight, 1);
  return Math.max(
    0,
    Math.min(100, Math.round((scrollTop / trackableHeight) * 100)),
  );
};

const updateScrollTracking = () => {
  const depth = resolveScrollDepth();
  if (depth > trackerState.maxScrollDepth) {
    trackerState.maxScrollDepth = depth;
  }

  if (trackerState.currentPageView) {
    trackerState.currentPageView.maxScrollDepth = Math.max(
      trackerState.currentPageView.maxScrollDepth || 0,
      depth,
    );
  }

  for (const threshold of [25, 50, 75, 100]) {
    if (depth >= threshold && !trackerState.scrollThresholds.has(threshold)) {
      trackerState.scrollThresholds.add(threshold);
      enqueue("scroll_depth", {
        depthPercent: threshold,
        maxScrollDepth: trackerState.maxScrollDepth,
        pageViewId: trackerState.currentPageView?.pageViewId || null,
      });
    }
  }
};

const getElementSignature = (element) => {
  if (!element) return "";
  const dataTrack = String(element.getAttribute?.("data-track") || "").trim();
  const tag = String(element.tagName || "").toLowerCase();
  const id = String(element.id || "").trim();
  const className = String(element.className || "").trim();
  const text = String(element.textContent || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return [dataTrack, tag, id, className, text].join("|");
};

const resolveTargetType = (eventType, metadata = {}) => {
  const normalizedEventType = String(eventType || "")
    .trim()
    .toLowerCase();
  const explicit = String(metadata.target_type || metadata.targetType || "")
    .trim()
    .toLowerCase();

  if (["product", "banner", "combo", "wishlist", "cart"].includes(explicit)) {
    return explicit;
  }

  if (
    metadata.bannerId ||
    metadata.bannerName ||
    normalizedEventType.includes("banner")
  )
    return "banner";
  if (metadata.comboId || normalizedEventType.includes("combo")) return "combo";
  if (normalizedEventType.includes("wishlist")) return "wishlist";
  if (
    metadata.productId ||
    normalizedEventType.includes("product") ||
    normalizedEventType.includes("hover")
  )
    return "product";
  return DEFAULT_TARGET_TYPE;
};

const resolveTargetId = (metadata = {}, sessionId = "") => {
  const candidates = [
    metadata.target_id,
    metadata.targetId,
    metadata.productId,
    metadata.bannerId,
    metadata.comboId,
    metadata.id,
    metadata.trackName,
    metadata.elementPath,
    sessionId,
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate || "").trim();
    if (normalized) {
      return normalized.slice(0, 128);
    }
  }

  return "anonymous_target";
};

const canEnqueueEvent = () => {
  const now = getNow();
  if (now - trackerState.eventRateWindowStartedAt >= 1000) {
    trackerState.eventRateWindowStartedAt = now;
    trackerState.eventRateWindowCount = 0;
  }

  if (trackerState.eventRateWindowCount >= MAX_EVENTS_PER_SECOND) {
    return false;
  }

  trackerState.eventRateWindowCount += 1;
  return true;
};

const getClosestDataAttrValue = (element, attributes = []) => {
  if (!element || typeof element.closest !== "function") return "";

  for (const attribute of attributes) {
    const selector = `[${attribute}]`;
    const owner = element.closest(selector);
    const value = String(owner?.getAttribute?.(attribute) || "").trim();
    if (value) return value;
  }

  return "";
};

const normalizeInlineText = (value = "", maxLength = 180) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const toSlugToken = (value = "", maxLength = 80) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLength);

const isRedactedLikeValue = (value = "") =>
  /\[\s*redacted\s*\]/i.test(String(value || ""));

const resolveHrefPath = (hrefValue = "") => {
  const raw = String(hrefValue || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw, "https://tracking.local");
    return String(parsed.pathname || "")
      .trim()
      .toLowerCase();
  } catch {
    return raw.split("?")[0].split("#")[0].trim().toLowerCase();
  }
};

const inferTrackNameFromMetadata = ({
  explicitTrackName,
  hasBannerIdentity,
  hasProductIdentity,
  buttonLabel,
  text,
  hrefPath,
  id,
  className,
} = {}) => {
  const explicit = String(explicitTrackName || "")
    .trim()
    .toLowerCase();
  if (EVENT_TYPE_PATTERN.test(explicit)) {
    return explicit;
  }

  if (hasBannerIdentity) {
    return "banner_click";
  }

  const probe = [buttonLabel, text, hrefPath, id, className]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  if (hasProductIdentity) {
    if (/\badd\s*to\s*cart\b|\baddtocart\b|\bquick\s*add\b/.test(probe)) {
      return "product_cta_add_to_cart";
    }
    if (/\bbuy\s*now\b|\bcheckout\b|\bplace\s*order\b/.test(probe)) {
      return "product_cta_buy_now";
    }
    if (/\bwishlist\b|\bfavorite\b|\bfavourite\b/.test(probe)) {
      return "product_cta_wishlist";
    }
    if (/\bshare\b|\bcopy\s*link\b/.test(probe)) {
      return "product_cta_share";
    }
    if (/\breview\b|\brating\b/.test(probe)) {
      return "product_cta_reviews";
    }
    if (/\bvariant\b|\bweight\b|\bsize\b|\bflavor\b|\bflavour\b/.test(probe)) {
      return "product_variant_select";
    }
    return "product_click";
  }

  if (/\bcombo\b/.test(probe)) return "combo_click";
  if (/\bsearch\b/.test(probe)) return "search_click";
  if (/\blog\s*in\b|\bsign\s*in\b/.test(probe)) return "login";
  if (/\bsign\s*up\b|\bregister\b|\bcreate\s*account\b/.test(probe))
    return "signup";
  if (/\blog\s*out\b|\bsign\s*out\b/.test(probe)) return "logout";

  return "";
};

const deriveStableTargetId = ({
  explicitTargetId,
  trackName,
  productId,
  bannerId,
  id,
  buttonLabel,
  href,
  sectionName,
  pagePath,
  elementPath,
} = {}) => {
  const hrefPath = resolveHrefPath(href);
  const idToken = toSlugToken(id, 100);
  const labelToken = toSlugToken(buttonLabel, 80);
  const sectionToken = toSlugToken(sectionName, 60);
  const pageToken = toSlugToken(pagePath, 80);
  const pathToken = toSlugToken(hrefPath, 80);

  const candidates = [
    explicitTargetId,
    trackName,
    productId,
    bannerId,
    idToken,
    labelToken && sectionToken ? `${sectionToken}_${labelToken}` : "",
    labelToken,
    pathToken ? `path_${pathToken}` : "",
    sectionToken,
    pageToken,
    elementPath,
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate || "").trim();
    if (!normalized || isRedactedLikeValue(normalized)) {
      continue;
    }
    return normalized.slice(0, 160);
  }

  return "anonymous_target";
};

const buildStableElementPath = (element) => {
  if (!element || typeof element.closest !== "function") return "";

  const segments = [];
  let current = element;

  while (current && current.nodeType === 1 && segments.length < 12) {
    const tag = String(current.tagName || "").toLowerCase();
    if (!tag) break;

    const id = String(current.id || "").trim();
    if (id) {
      segments.unshift(`${tag}#${id.slice(0, 80)}`);
      break;
    }

    let index = 1;
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (String(sibling.tagName || "").toLowerCase() === tag) {
        index += 1;
      }
      sibling = sibling.previousElementSibling;
    }

    segments.unshift(`${tag}:nth-of-type(${index})`);
    current = current.parentElement;
  }

  return segments.join(" > ").slice(0, 700);
};

const buildClickMetadata = (element, event) => {
  const pagePath =
    typeof window !== "undefined"
      ? `${window.location.pathname || "/"}${window.location.search || ""}`
      : "";

  const sectionName = String(
    element
      ?.closest?.("[data-track-section]")
      ?.getAttribute?.("data-track-section") || "",
  )
    .trim()
    .toLowerCase();

  const productId = String(
    getClosestDataAttrValue(element, [
      "data-product-id",
      "data-product",
      "data-productid",
    ]),
  )
    .trim()
    .slice(0, 128);

  const productName = String(
    getClosestDataAttrValue(element, [
      "data-product-name",
      "data-productname",
      "data-product-title",
    ]),
  )
    .trim()
    .slice(0, 180);

  const bannerId = String(
    getClosestDataAttrValue(element, [
      "data-banner-id",
      "data-bannerid",
      "data-banner",
    ]),
  )
    .trim()
    .slice(0, 128);

  const bannerName = String(
    getClosestDataAttrValue(element, [
      "data-banner-name",
      "data-banner-title",
      "data-banner",
    ]),
  )
    .trim()
    .slice(0, 180);

  const bannerPosition = String(
    getClosestDataAttrValue(element, [
      "data-banner-position",
      "data-banner-slot",
      "data-position",
    ]),
  )
    .trim()
    .slice(0, 80);

  const bannerCampaign = String(
    getClosestDataAttrValue(element, [
      "data-banner-campaign",
      "data-campaign",
      "data-campaign-id",
    ]),
  )
    .trim()
    .slice(0, 120);
  const explicitTargetType = String(
    getClosestDataAttrValue(element, ["data-track-target-type"]),
  ).trim();
  const explicitTargetId = String(
    getClosestDataAttrValue(element, ["data-track-target-id"]),
  ).trim();
  const explicitTrackName = String(
    element?.getAttribute?.("data-track") ||
      element?.getAttribute?.("data-track-click") ||
      "",
  )
    .trim()
    .toLowerCase();

  const buttonLabel = normalizeInlineText(
    element?.getAttribute?.("aria-label") ||
      element?.getAttribute?.("title") ||
      element?.getAttribute?.("value") ||
      element?.textContent ||
      element?.getAttribute?.("alt") ||
      "",
  );

  const tagName = String(element?.tagName || "").toLowerCase();
  const id = String(element?.id || "").slice(0, 120);
  const className = String(element?.className || "").slice(0, 250);
  const text = normalizeInlineText(String(element?.textContent || ""));
  const href = String(element?.getAttribute?.("href") || "").slice(0, 500);
  const pagePathValue = pagePath.slice(0, 300);
  const elementPath = buildStableElementPath(element);

  const hasBannerIdentity = Boolean(
    bannerId || bannerName || bannerPosition || bannerCampaign,
  );
  const hasProductIdentity = Boolean(productId || productName);

  const inferredTrackName = inferTrackNameFromMetadata({
    explicitTrackName,
    hasBannerIdentity,
    hasProductIdentity,
    buttonLabel,
    text,
    hrefPath: resolveHrefPath(href),
    id,
    className,
  });

  const derivedTargetId = deriveStableTargetId({
    explicitTargetId,
    trackName: inferredTrackName,
    productId,
    bannerId,
    id,
    buttonLabel,
    href,
    sectionName,
    pagePath: pagePathValue,
    elementPath,
  });

  return {
    sectionName: sectionName || null,
    productId: productId || null,
    productName: productName || null,
    bannerId: bannerId || null,
    bannerName: bannerName || null,
    bannerPosition: bannerPosition || null,
    bannerCampaign: bannerCampaign || null,
    targetType: explicitTargetType || null,
    targetId: derivedTargetId || null,
    buttonLabel: buttonLabel || null,
    tagName,
    id,
    className,
    text,
    href,
    trackName: inferredTrackName,
    pagePath: pagePathValue,
    elementPath,
    clickX: Number.isFinite(event?.clientX) ? Number(event.clientX) : null,
    clickY: Number.isFinite(event?.clientY) ? Number(event.clientY) : null,
    pageViewId: trackerState.currentPageView?.pageViewId || null,
    pageActiveMs: Math.max(
      Number(trackerState.currentPageView?.activeMs || 0),
      0,
    ),
    sessionActiveMs: Math.max(Number(trackerState.sessionActiveMs || 0), 0),
  };
};

const processClickTracking = (event) => {
  const element = event.target?.closest?.(CLICKABLE_SELECTOR);
  if (!element) return;

  markActivity("click");

  const metadata = buildClickMetadata(element, event);
  const explicitTrackType = String(metadata.trackName || "").trim();
  const hasBannerIdentity = Boolean(
    metadata.bannerId ||
    metadata.bannerName ||
    metadata.bannerPosition ||
    metadata.bannerCampaign,
  );
  const hasProductIdentity = Boolean(
    metadata.productId || metadata.productName,
  );
  const eventType = EVENT_TYPE_PATTERN.test(explicitTrackType)
    ? explicitTrackType
    : hasBannerIdentity
      ? "banner_click"
      : hasProductIdentity
        ? "product_click"
        : "click_event";

  enqueue(eventType, metadata);

  const signature = getElementSignature(element);
  if (!signature) return;

  const now = getNow();
  const clicks = (trackerState.clickHistory.get(signature) || []).filter(
    (time) => now - time <= RAGE_CLICK_WINDOW_MS,
  );
  clicks.push(now);
  trackerState.clickHistory.set(signature, clicks);

  if (clicks.length >= RAGE_CLICK_THRESHOLD) {
    enqueue("rage_click", {
      ...metadata,
      clickCount: clicks.length,
      windowMs: RAGE_CLICK_WINDOW_MS,
    });
    trackerState.clickHistory.set(signature, []);
  }
};

const findTrackableHoverElement = (target) => {
  if (!target || typeof target.closest !== "function") return null;
  return target.closest(
    `[data-track-hover],[data-track-role='product-image'],[data-track-role='price'],[data-product-image],img[data-track-product],.product-image,[data-price],.price,${CLICKABLE_SELECTOR}`,
  );
};

const getHoverKey = (element) => {
  const explicit = String(
    element.getAttribute?.("data-track-hover") || "",
  ).trim();
  if (explicit) return explicit;
  const role = String(element.getAttribute?.("data-track-role") || "").trim();
  if (role) return role;
  return "generic_hover";
};

const onHoverStart = (event) => {
  const element = findTrackableHoverElement(event.target);
  if (!element) return;

  const metadata = buildClickMetadata(element, event);

  trackerState.hoverActive.set(element, {
    startedAt: getNow(),
    hoverKey: getHoverKey(element),
    metadata,
  });

  if (isButtonLikeElement(element)) {
    enqueue("button_hover_start", {
      ...metadata,
      hoverTarget: getHoverKey(element),
    });
  }
};

const onHoverEnd = (event) => {
  const element = findTrackableHoverElement(event.target);
  if (!element) return;

  const session = trackerState.hoverActive.get(element);
  if (!session) return;

  trackerState.hoverActive.delete(element);

  const endedAt = getNow();
  const durationMs = endedAt - session.startedAt;
  if (durationMs < HOVER_MIN_DURATION_MS) return;

  const throttleKey = `${session.hoverKey}:${getElementSignature(element)}`;
  const lastEmittedAt = trackerState.hoverLastEmitByKey.get(throttleKey) || 0;
  if (endedAt - lastEmittedAt < HOVER_EMIT_THROTTLE_MS) {
    return;
  }

  trackerState.hoverLastEmitByKey.set(throttleKey, endedAt);

  if (isButtonLikeElement(element)) {
    enqueue("button_hover_end", {
      ...(session.metadata || buildClickMetadata(element, event)),
      hoverTarget: session.hoverKey,
      durationMs,
    });

    enqueue("button_hover_duration", {
      ...(session.metadata || buildClickMetadata(element, event)),
      hoverTarget: session.hoverKey,
      durationMs,
    });
  }

  enqueue("hover_duration", {
    hoverTarget: session.hoverKey,
    durationMs,
    text: String(element.textContent || "")
      .trim()
      .slice(0, 180),
    pageViewId: trackerState.currentPageView?.pageViewId || null,
  });
};

const onFocusIn = (event) => {
  const element = event.target?.closest?.(CLICKABLE_SELECTOR);
  if (!element || !isButtonLikeElement(element)) return;

  const metadata = buildClickMetadata(element, event);
  trackerState.focusActive.set(element, {
    startedAt: getNow(),
    metadata,
  });

  enqueue("button_focus", metadata);
};

const onFocusOut = (event) => {
  const element = event.target?.closest?.(CLICKABLE_SELECTOR);
  if (!element || !isButtonLikeElement(element)) return;

  const session = trackerState.focusActive.get(element);
  trackerState.focusActive.delete(element);

  const endedAt = getNow();
  const durationMs = session ? Math.max(endedAt - session.startedAt, 0) : null;
  enqueue("button_blur", {
    ...(session?.metadata || buildClickMetadata(element, event)),
    durationMs,
  });
};

const buildSectionKey = (element, sectionName) => {
  const sectionId = String(element.getAttribute("id") || "").trim();
  const className = String(element.className || "")
    .trim()
    .replace(/\s+/g, ".")
    .slice(0, 120);
  return `${sectionName}::${sectionId || className || createId()}`;
};

const endSection = (element, reason = "hidden") => {
  const active = trackerState.activeSections.get(element);
  if (!active) return;

  trackerState.activeSections.delete(element);
  const endedAt = getNow();
  const durationMs = Math.max(endedAt - active.startedAt, 0);

  enqueue("section_view_end", {
    sectionName: active.sectionName,
    sectionKey: active.sectionKey,
    pageViewId: active.pageViewId,
    reason,
  });

  enqueue("section_visible_duration", {
    sectionName: active.sectionName,
    sectionKey: active.sectionKey,
    pageViewId: active.pageViewId,
    durationMs,
  });
};

const flushActiveSections = (reason = "page_end") => {
  for (const element of Array.from(trackerState.activeSections.keys())) {
    endSection(element, reason);
  }
};

const onSectionIntersection = (entries) => {
  const now = getNow();

  for (const entry of entries) {
    const element = entry.target;
    const sectionName = String(element.getAttribute("data-track-section") || "")
      .trim()
      .toLowerCase();
    if (!sectionName) continue;

    const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
    const currentlyActive = trackerState.activeSections.get(element);

    if (isVisible && !currentlyActive) {
      const sectionKey = buildSectionKey(element, sectionName);
      const pageViewId = trackerState.currentPageView?.pageViewId || null;
      trackerState.activeSections.set(element, {
        sectionName,
        sectionKey,
        pageViewId,
        startedAt: now,
      });

      enqueue("section_view_start", {
        sectionName,
        sectionKey,
        pageViewId,
      });
      continue;
    }

    if (!isVisible && currentlyActive) {
      endSection(element, "hidden");
    }
  }
};

const observeTrackSections = () => {
  if (!trackerState.sectionObserver || typeof document === "undefined") {
    return;
  }

  const elements = document.querySelectorAll("[data-track-section]");
  for (const element of elements) {
    if (trackerState.sectionObservedElements.has(element)) {
      continue;
    }
    trackerState.sectionObservedElements.add(element);
    trackerState.sectionObserver.observe(element);
  }
};

const setupSectionTracking = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (trackerState.sectionObserver) {
    return;
  }

  trackerState.sectionObserver = new IntersectionObserver(
    onSectionIntersection,
    {
      threshold: [0.35, 0.6],
    },
  );

  observeTrackSections();

  trackerState.sectionMutationObserver = new MutationObserver(() => {
    observeTrackSections();
  });

  trackerState.sectionMutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
};

const startHeartbeat = () => {
  if (trackerState.heartbeatTimer) return;

  trackerState.heartbeatTimer = setInterval(() => {
    const now = getNow();
    const deltaMs = Math.max(now - trackerState.lastHeartbeatAt, 0);
    trackerState.lastHeartbeatAt = now;

    const shouldBeIdle =
      document.hidden || now - trackerState.lastActivityAt >= IDLE_TIMEOUT_MS;

    if (shouldBeIdle && !trackerState.isIdle) {
      trackerState.isIdle = true;
    }

    if (!shouldBeIdle) {
      trackerState.sessionActiveMs += deltaMs;
      if (trackerState.currentPageView) {
        trackerState.currentPageView.activeMs += deltaMs;
      }
    }

    enqueue("active_heartbeat", {
      sessionActiveMs: trackerState.sessionActiveMs,
      pageActiveMs: trackerState.currentPageView?.activeMs || 0,
      pageViewId: trackerState.currentPageView?.pageViewId || null,
      isIdle: shouldBeIdle,
      maxScrollDepth: trackerState.maxScrollDepth,
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    });
  }, HEARTBEAT_INTERVAL_MS);

  trackerState.heartbeatTimer.unref?.();
};

const stopHeartbeat = () => {
  if (!trackerState.heartbeatTimer) return;
  clearInterval(trackerState.heartbeatTimer);
  trackerState.heartbeatTimer = null;
};

const endCurrentPageView = (reason = "route_change") => {
  if (!trackerState.currentPageView) {
    return;
  }

  flushActiveSections(reason);

  const current = trackerState.currentPageView;
  trackerState.currentPageView = null;

  enqueue("page_view_ended", {
    pageViewId: current.pageViewId,
    path: current.path,
    title: current.title,
    startedAt: toIso(current.startedAt),
    endedAt: toIso(),
    activeTimeMs: current.activeMs,
    maxScrollDepth: current.maxScrollDepth,
    reason,
  });
};

const startPageView = (path = "") => {
  const now = getNow();
  const targetPath = String(
    path || (typeof window !== "undefined" ? window.location.pathname : ""),
  );

  endCurrentPageView("route_change");

  trackerState.scrollThresholds = new Set();
  trackerState.maxScrollDepth = 0;

  const pageViewId = createId();
  trackerState.currentPageView = {
    pageViewId,
    path: targetPath,
    title: typeof document !== "undefined" ? document.title : "",
    startedAt: now,
    activeMs: 0,
    maxScrollDepth: 0,
  };

  enqueue("page_view_started", {
    pageViewId,
    path: targetPath,
    title: trackerState.currentPageView.title,
  });
};

const finalizeSession = (
  reason = "pagehide",
  { clearStoredSession = true } = {},
) => {
  if (trackerState.finalizedSession) {
    return;
  }

  trackerState.finalizedSession = true;

  endCurrentPageView(reason);
  flushActiveSections(reason);

  enqueue("session_end", {
    reason,
    totalActiveTime: trackerState.sessionActiveMs,
    startedAt: toIso(trackerState.sessionStartAt),
    endedAt: toIso(),
    isActive: false,
  });

  if (clearStoredSession) {
    clearStoredSessionState();
  }

  flushQueue({ immediate: true }).catch(() => {});
};

const attachEventListeners = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const onMouseMove = () => markActivity("mousemove");
  const onKeydown = () => markActivity("keydown");
  const onTouchStart = () => markActivity("touchstart");
  const onClick = (event) => processClickTracking(event);
  const onScroll = () => {
    markActivity("scroll");
    updateScrollTracking();
  };

  const onPageHide = () => finalizeSession("pagehide");
  const onBeforeUnload = () => finalizeSession("beforeunload");
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      trackerState.isIdle = true;
      flushQueue({ immediate: true }).catch(() => {});
      return;
    }
    markActivity("visibility_visible");
  };

  document.addEventListener("mousemove", onMouseMove, { passive: true });
  document.addEventListener("keydown", onKeydown, { passive: true });
  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("click", onClick, { passive: true, capture: true });
  document.addEventListener("mouseover", onHoverStart, {
    passive: true,
    capture: true,
  });
  document.addEventListener("mouseout", onHoverEnd, {
    passive: true,
    capture: true,
  });
  document.addEventListener("focusin", onFocusIn, { capture: true });
  document.addEventListener("focusout", onFocusOut, { capture: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("beforeunload", onBeforeUnload);
  document.addEventListener("visibilitychange", onVisibilityChange);

  trackerState.detachListeners = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("touchstart", onTouchStart);
    document.removeEventListener("click", onClick, { capture: true });
    document.removeEventListener("mouseover", onHoverStart, { capture: true });
    document.removeEventListener("mouseout", onHoverEnd, { capture: true });
    document.removeEventListener("focusin", onFocusIn, { capture: true });
    document.removeEventListener("focusout", onFocusOut, { capture: true });
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("beforeunload", onBeforeUnload);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
};

const ensureBackendSessionId = async (preferredSessionId = "") => {
  try {
    const headers = preferredSessionId
      ? { "x-session-id": String(preferredSessionId || "").trim() }
      : undefined;
    const response = await fetch(resolveTrackSessionUrl(), {
      method: "GET",
      ...(headers ? { headers } : {}),
      credentials: "include",
    });

    if (!response.ok) {
      return "";
    }

    const data = await response.json();
    const sessionId = String(data?.data?.sessionId || "").trim();
    if (!sessionId) return "";

    trackerState.sessionId = sessionId;
    persistSessionState(
      sessionId,
      trackerState.lastActivityAt || getStoredSessionLastActivityAt() || getNow(),
    );
    return sessionId;
  } catch {
    // Keep local fallback when backend session call fails.
    return "";
  }
};

export const initializeBehaviorTracking = async () => {
  if (typeof window === "undefined") {
    return;
  }

  if (trackerState.initialized) {
    return;
  }

  if (trackerState.initializingPromise) {
    return trackerState.initializingPromise;
  }

  trackerState.initializingPromise = (async () => {
    const now = getNow();
    const storedSessionId = getStoredSessionId();
    const storedLastActivityAt = getStoredSessionLastActivityAt();
    const canResumeStoredSession =
      Boolean(storedSessionId) &&
      storedLastActivityAt > 0 &&
      now - storedLastActivityAt < getSessionTimeoutMs();

    if (canResumeStoredSession) {
      adoptSessionState(storedSessionId, {
        startedAt: now,
        lastActivityAt: storedLastActivityAt,
      });
      const syncedSessionId = await ensureBackendSessionId(storedSessionId);
      if (syncedSessionId && syncedSessionId !== storedSessionId) {
        adoptSessionState(syncedSessionId, {
          startedAt: now,
          lastActivityAt: storedLastActivityAt,
        });
      }
    } else {
      clearStoredSessionState();
      const backendSessionId = await ensureBackendSessionId();
      const resolvedSessionId =
        String(backendSessionId || createId()).trim() || createId();

      adoptSessionState(resolvedSessionId, {
        startedAt: now,
        lastActivityAt: now,
      });

      if (!backendSessionId) {
        ensureBackendSessionId(resolvedSessionId).catch(() => {});
      }

      emitSessionStart(now);
    }

    attachEventListeners();
    setupSectionTracking();
    startHeartbeat();

    trackerState.initialized = true;
  })().finally(() => {
    trackerState.initializingPromise = null;
  });

  return trackerState.initializingPromise;
};

export const handleRouteChangeTracking = (path) => {
  if (typeof window === "undefined") return;
  if (shouldSkipTracking()) return;

  if (!trackerState.initialized) {
    initializeBehaviorTracking()
      .then(() => {
        startPageView(path);
        observeTrackSections();
      })
      .catch(() => {});
    return;
  }

  rotateSessionIfExpired("route_change", {
    restartPageView: false,
    nextPath: path,
  });
  syncSessionActivity(getNow());
  startPageView(path);
  observeTrackSections();
};

export const trackEvent = (eventType, metadata = {}, overrides = {}) => {
  rotateSessionIfExpired("manual_event", {
    restartPageView: true,
    nextPath: getPagePath(),
  });
  syncSessionActivity(getNow());
  enqueue(eventType, metadata, overrides);
};

export const attachTracking = (element, config = {}) => {
  if (!element || typeof element.getAttribute !== "function") {
    return () => {};
  }

  const previousDetach = attachedTrackingElements.get(element);
  if (typeof previousDetach === "function") {
    previousDetach();
  }

  const trackedAttrs = [
    "data-track",
    "data-track-click",
    "data-track-hover",
    "data-track-role",
    "data-track-target-type",
    "data-track-target-id",
    "data-banner-id",
    "data-product-id",
  ];

  const previousValues = new Map();
  for (const name of trackedAttrs) {
    previousValues.set(name, element.getAttribute(name));
  }

  const setOrRemove = (name, value) => {
    const normalized = String(value || "").trim();
    if (normalized) {
      element.setAttribute(name, normalized);
      return;
    }
    element.removeAttribute(name);
  };

  setOrRemove("data-track", config.trackName || config.eventName || "");
  setOrRemove("data-track-click", config.trackName || config.eventName || "");
  setOrRemove("data-track-hover", config.hoverKey || "");
  setOrRemove("data-track-role", config.trackRole || "");
  setOrRemove("data-track-target-type", config.targetType || "");
  setOrRemove("data-track-target-id", config.targetId || "");
  setOrRemove("data-banner-id", config.bannerId || "");
  setOrRemove("data-product-id", config.productId || "");

  const detach = () => {
    for (const name of trackedAttrs) {
      const value = previousValues.get(name);
      if (value === null || typeof value === "undefined") {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, value);
      }
    }
    attachedTrackingElements.delete(element);
  };

  attachedTrackingElements.set(element, detach);
  return detach;
};

export const markSessionStartIfNeeded = () => {
  initializeBehaviorTracking().catch(() => {});
};

export const trackSessionEnd = (reason = "manual_end") => {
  finalizeSession(reason);
};

export const flushTrackingQueueNow = () => flushQueue({ immediate: true });
