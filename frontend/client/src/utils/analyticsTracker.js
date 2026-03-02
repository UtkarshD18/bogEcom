"use client";

import { API_BASE_URL } from "@/utils/api";

const CONSENT_STORAGE_KEY = "hog_analytics_consent";
const SESSION_MARKER_KEY = "hog_analytics_session_started";
const LOCAL_SESSION_KEY = "hog_analytics_local_session_id";
const DEFAULT_FLUSH_MIN_MS = 5000;
const DEFAULT_FLUSH_MAX_MS = 10000;
const HEARTBEAT_INTERVAL_MS = 10000;
const IDLE_TIMEOUT_MS = 30000;
const ACTIVITY_THROTTLE_MS = 300;
const HOVER_MIN_DURATION_MS = 300;
const HOVER_EMIT_THROTTLE_MS = 1000;
const RAGE_CLICK_WINDOW_MS = 2000;
const RAGE_CLICK_THRESHOLD = 3;
const MAX_EVENTS_PER_BATCH = 200;
const COMPRESS_THRESHOLD_BYTES = 48 * 1024;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

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
  hoverLastEmitByKey: new Map(),
  finalizedSession: false,
};

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
  Math.max(Number(process.env.NEXT_PUBLIC_TRACK_FLUSH_MIN_MS || DEFAULT_FLUSH_MIN_MS), 1000);

const getFlushMaxMs = () =>
  Math.max(Number(process.env.NEXT_PUBLIC_TRACK_FLUSH_MAX_MS || DEFAULT_FLUSH_MAX_MS), getFlushMinMs());

const getRandomFlushDelay = () => {
  const min = getFlushMinMs();
  const max = getFlushMaxMs();
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
};

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
};

const hasDoNotTrack = () => {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;

  const dnt = String(
    navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack || "",
  )
    .trim()
    .toLowerCase();

  return dnt === "1" || dnt === "yes" || navigator.globalPrivacyControl === true;
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
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    "";

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

const getPageUrl = () => (typeof window !== "undefined" ? window.location.href : "");

const getReferrer = () => (typeof document !== "undefined" ? document.referrer || "" : "");

const getOrCreateLocalSessionId = () => {
  if (typeof window === "undefined") return createId();
  const existing = String(localStorage.getItem(LOCAL_SESSION_KEY) || "").trim();
  if (existing) return existing;
  const generated = createId();
  localStorage.setItem(LOCAL_SESSION_KEY, generated);
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
  if (Array.isArray(value)) return value.slice(0, 100).map(normalizeMetadataValue);
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

export const getAnalyticsConsent = () => {
  if (typeof window === "undefined") return "unknown";
  const stored = String(localStorage.getItem(CONSENT_STORAGE_KEY) || "")
    .trim()
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

  localStorage.setItem(CONSENT_STORAGE_KEY, normalized);

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

const buildEvent = (eventType, metadata = {}, overrides = {}) => {
  const normalizedType = String(eventType || "")
    .trim()
    .toLowerCase();

  if (!EVENT_TYPE_PATTERN.test(normalizedType)) {
    return null;
  }

  const sessionId = trackerState.sessionId || getOrCreateLocalSessionId();
  const userId = decodeJwtUserId();

  return {
    eventId: createId(),
    eventType: normalizedType,
    sessionId,
    userId,
    timestamp: toIso(),
    pageUrl: String(overrides.pageUrl || getPageUrl()),
    referrer:
      overrides.referrer !== undefined
        ? String(overrides.referrer || "")
        : getReferrer(),
    ipAddress: "0.0.0.0",
    deviceType: resolveDeviceType(),
    browser: resolveBrowser(),
    metadata: sanitizeMetadata(metadata),
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

  if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
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
    const batch = trackerState.queue.splice(0, MAX_EVENTS_PER_BATCH);
    const payload = {
      sessionId: trackerState.sessionId || getOrCreateLocalSessionId(),
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

  trackerState.queue.push(event);

  if (trackerState.queue.length >= MAX_EVENTS_PER_BATCH) {
    flushQueue().catch(() => {});
    return;
  }

  scheduleFlush();
};

const markActivity = (source = "activity") => {
  const now = getNow();
  if (now - trackerState.lastInputAt < ACTIVITY_THROTTLE_MS) {
    return;
  }

  trackerState.lastInputAt = now;
  trackerState.lastActivityAt = now;

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
  const viewportHeight = window.innerHeight || documentElement.clientHeight || 0;
  const trackableHeight = Math.max(scrollHeight - viewportHeight, 1);
  return Math.max(0, Math.min(100, Math.round((scrollTop / trackableHeight) * 100)));
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
  const text = String(element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80);
  return [dataTrack, tag, id, className, text].join("|");
};

const buildClickMetadata = (element) => ({
  sectionName:
    String(
      element?.closest?.("[data-track-section]")?.getAttribute?.("data-track-section") ||
        "",
    )
      .trim()
      .toLowerCase() || null,
  productId:
    String(
      element?.getAttribute?.("data-product-id") ||
        element?.getAttribute?.("data-product") ||
        element?.getAttribute?.("data-productid") ||
        element?.closest?.("[data-product-id]")?.getAttribute?.("data-product-id") ||
        element?.closest?.("[data-product]")?.getAttribute?.("data-product") ||
        "",
    )
      .trim()
      .slice(0, 128) || null,
  tagName: String(element?.tagName || "").toLowerCase(),
  id: String(element?.id || "").slice(0, 120),
  className: String(element?.className || "").slice(0, 250),
  text: String(element?.textContent || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 180),
  href: String(element?.getAttribute?.("href") || "").slice(0, 500),
  trackName: String(element?.getAttribute?.("data-track") || "")
    .trim()
    .toLowerCase(),
  pageViewId: trackerState.currentPageView?.pageViewId || null,
  pageActiveMs: Math.max(Number(trackerState.currentPageView?.activeMs || 0), 0),
  sessionActiveMs: Math.max(Number(trackerState.sessionActiveMs || 0), 0),
});

const processClickTracking = (event) => {
  const element = event.target?.closest?.("[data-track],button,a,[role='button']");
  if (!element) return;

  markActivity("click");

  const metadata = buildClickMetadata(element);
  const explicitTrackType = String(metadata.trackName || "").trim();
  const eventType = EVENT_TYPE_PATTERN.test(explicitTrackType)
    ? explicitTrackType
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
    "[data-track-hover],[data-track-role='product-image'],[data-track-role='price'],[data-product-image],img[data-track-product],.product-image,[data-price],.price",
  );
};

const getHoverKey = (element) => {
  const explicit = String(element.getAttribute?.("data-track-hover") || "").trim();
  if (explicit) return explicit;
  const role = String(element.getAttribute?.("data-track-role") || "").trim();
  if (role) return role;
  return "generic_hover";
};

const onHoverStart = (event) => {
  const element = findTrackableHoverElement(event.target);
  if (!element) return;

  trackerState.hoverActive.set(element, {
    startedAt: getNow(),
    hoverKey: getHoverKey(element),
  });
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
  enqueue("hover_duration", {
    hoverTarget: session.hoverKey,
    durationMs,
    text: String(element.textContent || "").trim().slice(0, 180),
    pageViewId: trackerState.currentPageView?.pageViewId || null,
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

  trackerState.sectionObserver = new IntersectionObserver(onSectionIntersection, {
    threshold: [0.35, 0.6],
  });

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

    const shouldBeIdle = document.hidden || now - trackerState.lastActivityAt >= IDLE_TIMEOUT_MS;

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
  const targetPath = String(path || (typeof window !== "undefined" ? window.location.pathname : ""));

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

const finalizeSession = (reason = "pagehide") => {
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
  document.addEventListener("mouseover", onHoverStart, { passive: true, capture: true });
  document.addEventListener("mouseout", onHoverEnd, { passive: true, capture: true });
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
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("beforeunload", onBeforeUnload);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
};

const ensureBackendSessionId = async () => {
  try {
    const response = await fetch(resolveTrackSessionUrl(), {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const sessionId = String(data?.data?.sessionId || "").trim();
    if (!sessionId) return;

    trackerState.sessionId = sessionId;
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_SESSION_KEY, sessionId);
    }
  } catch {
    // Keep local fallback when backend session call fails.
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
    trackerState.sessionId = getOrCreateLocalSessionId();
    await ensureBackendSessionId();
    trackerState.sessionStartAt = getNow();
    trackerState.lastActivityAt = trackerState.sessionStartAt;
    trackerState.lastHeartbeatAt = trackerState.sessionStartAt;
    trackerState.finalizedSession = false;

    attachEventListeners();
    setupSectionTracking();
    startHeartbeat();

    if (sessionStorage.getItem(SESSION_MARKER_KEY) !== "1") {
      sessionStorage.setItem(SESSION_MARKER_KEY, "1");
      enqueue("session_start", {
        startedAt: toIso(trackerState.sessionStartAt),
        path: window.location.pathname,
        title: document.title,
        isActive: true,
      });
    }

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

  startPageView(path);
  observeTrackSections();
};

export const trackEvent = (eventType, metadata = {}, overrides = {}) => {
  enqueue(eventType, metadata, overrides);
};

export const markSessionStartIfNeeded = () => {
  initializeBehaviorTracking().catch(() => {});
};

export const trackSessionEnd = (reason = "manual_end") => {
  finalizeSession(reason);
};

export const flushTrackingQueueNow = () => flushQueue({ immediate: true });
