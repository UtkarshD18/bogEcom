import { getIO } from "./socket.js";

const safeString = (value) => String(value || "").trim();

const buildEventTypeSummary = (events = []) => {
  const summary = {};
  for (const event of events) {
    const type = safeString(event?.eventType || "unknown");
    summary[type] = (summary[type] || 0) + 1;
  }
  return summary;
};

const buildEventPreview = (event) => {
  if (!event) return null;
  return {
    eventType: safeString(event?.eventType || ""),
    pageUrl: safeString(event?.pageUrl || ""),
    timestamp: event?.timestamp || null,
    sessionId: safeString(event?.sessionId || ""),
    userId: safeString(event?.userId || ""),
  };
};

export const emitAnalyticsBatch = ({
  sessionId,
  events = [],
  source = "tracking_api",
  consent = "unknown",
  requestId = "",
} = {}) => {
  const io = getIO();
  if (!io || !Array.isArray(events) || events.length === 0) return;

  const resolvedSessionId = safeString(
    sessionId || events[0]?.sessionId || "",
  );
  const resolvedUserId = safeString(events[0]?.userId || "");

  const MAX_PREVIEW_EVENTS = 20;
  const previewEvents = events
    .slice(Math.max(events.length - MAX_PREVIEW_EVENTS, 0))
    .map(buildEventPreview)
    .filter(Boolean);

  const payload = {
    sessionId: resolvedSessionId,
    userId: resolvedUserId,
    eventCount: events.length,
    eventTypes: buildEventTypeSummary(events),
    firstTimestamp: events[0]?.timestamp || null,
    lastTimestamp: events[events.length - 1]?.timestamp || null,
    eventsPreview: previewEvents,
    source: safeString(source || "tracking_api"),
    consent: safeString(consent || "unknown"),
    requestId: safeString(requestId || ""),
  };

  io.to("admin:analytics").emit("analytics:batch", payload);
};

export default emitAnalyticsBatch;
