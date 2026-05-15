import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeEvent,
  resolveSessionSummaryPatch,
  resolveSourceDomain,
} from "../services/analytics/directIngestion.service.js";
import { buildTrackingEvent } from "../services/analytics/trackingEvent.service.js";

test("buildTrackingEvent replaces placeholder client IPs with the request IP", () => {
  const req = {
    headers: {
      "user-agent": "Mozilla/5.0",
      "x-forwarded-for": "203.0.113.9, 10.0.0.5",
    },
    originalUrl: "/api/track",
    analyticsSessionId: "session_12345678",
    cookies: {
      hog_sid: "session_12345678",
    },
    ip: "10.0.0.5",
  };

  const event = buildTrackingEvent({
    req,
    sessionId: "session_12345678",
    event: {
      eventId: "event_12345678",
      eventType: "page_view_started",
      sessionId: "session_12345678",
      pageUrl: "https://healthyonegram.com/products/honey",
      ipAddress: "0.0.0.0",
      metadata: {},
    },
  });

  assert.equal(event.ipAddress, "203.0.113.9");
});

test("resolveSourceDomain falls back to the referrer hostname", () => {
  assert.equal(
    resolveSourceDomain({
      referrer: "https://www.google.com/search?q=healthy+one+gram",
    }),
    "www.google.com",
  );

  assert.equal(resolveSourceDomain({ referrer: "" }), "direct");
});

test("normalizeEvent keeps hover metrics needed by behavior analytics", () => {
  const normalized = normalizeEvent({
    eventId: "event_hover_1234",
    eventType: "hover_duration",
    sessionId: "session_hover_1234",
    timestamp: "2026-04-09T12:00:00.000Z",
    pageUrl: "https://healthyonegram.com/product/abc",
    referrer: "https://www.google.com/search?q=healthy+one+gram",
    metadata: {
      productId: "prod_123",
      productName: "Honey",
      hoverTarget: "product_image",
      durationMs: 1450,
    },
  });

  assert.equal(normalized.sourceDomain, "www.google.com");
  assert.equal(normalized.productId, "prod_123");
  assert.equal(normalized.productName, "Honey");
  assert.equal(normalized.hoverTarget, "product_image");
  assert.equal(normalized.hoverDurationMs, 1450);
});

test("resolveSessionSummaryPatch keeps the strongest session activity signal", () => {
  const patch = resolveSessionSummaryPatch({
    eventType: "session_end",
    timestamp: "2026-04-09T12:00:00.000Z",
    metadata: {
      pageActiveMs: 1200,
      totalActiveTime: 4200,
      maxScrollDepth: 75,
      endedAt: "2026-04-09T12:00:00.000Z",
    },
  });

  assert.equal(patch.totalActiveTime, 4200);
  assert.equal(patch.maxScrollDepth, 75);
  assert.equal(patch.isActive, false);
  assert.ok(patch.endedAt instanceof Date);
  assert.equal(
    patch.endedAt.toISOString(),
    "2026-04-09T12:00:00.000Z",
  );
});

test("resolveSessionSummaryPatch keeps the visitor id used for guest identity stitching", () => {
  const patch = resolveSessionSummaryPatch({
    eventType: "active_heartbeat",
    timestamp: "2026-04-09T12:00:00.000Z",
    metadata: {
      visitorId: "visitor_12345678",
    },
  });

  assert.equal(patch.visitorId, "visitor_12345678");
});
