import { v4 as uuidv4 } from "uuid";
import {
  publishTrackingBatch,
  publishTrackingBatchAsync,
} from "./eventPublisher.service.js";
import {
  buildTrackingEvent,
  isTrackingSuppressed,
} from "./trackingEvent.service.js";

export const emitTrackingEvent = ({
  req,
  eventType,
  eventId = uuidv4(),
  userId = null,
  sessionId,
  timestamp,
  pageUrl,
  referrer,
  metadata = {},
  location = {},
  consent = "",
  async = true,
  source = "backend",
}) => {
  if (!req || !eventType) {
    return null;
  }

  if (isTrackingSuppressed(req, consent)) {
    return null;
  }

  const resolvedSessionId =
    String(sessionId || req.analyticsSessionId || req.cookies?.hog_sid || req.cookies?.sessionId || "")
      .trim();

  if (!resolvedSessionId) {
    return null;
  }

  let normalizedEvent;
  try {
    normalizedEvent = buildTrackingEvent({
      req,
      event: {
        eventId,
        eventType,
        sessionId: resolvedSessionId,
        userId,
        timestamp,
        pageUrl,
        referrer,
        metadata,
        location,
      },
      sessionId: resolvedSessionId,
      userId: userId || req.user || null,
    });
  } catch (error) {
    console.error("[analytics] Invalid event payload:", error?.message || error);
    return null;
  }

  const batchPayload = {
    sessionId: normalizedEvent.sessionId,
    events: [normalizedEvent],
    consent,
    source,
  };

  if (async) {
    publishTrackingBatchAsync(batchPayload);
    return normalizedEvent;
  }

  return publishTrackingBatch(batchPayload);
};

export const emitTrackingEventsBatch = ({
  req,
  events = [],
  consent = "",
  source = "backend",
}) => {
  if (!Array.isArray(events) || events.length === 0) {
    return 0;
  }

  if (isTrackingSuppressed(req, consent)) {
    return 0;
  }

  const normalizedEvents = [];

  for (const event of events) {
    try {
      const normalizedEvent = buildTrackingEvent({
        req,
        event,
        sessionId:
          event?.sessionId || req.analyticsSessionId || req.cookies?.hog_sid || req.cookies?.sessionId,
        userId: event?.userId || req.user || null,
      });
      normalizedEvents.push(normalizedEvent);
    } catch (error) {
      console.error("[analytics] Skipping invalid batch event:", error?.message || error);
    }
  }

  if (normalizedEvents.length === 0) {
    return 0;
  }

  publishTrackingBatchAsync({
    sessionId: normalizedEvents[0].sessionId,
    events: normalizedEvents,
    consent,
    source,
  });

  return normalizedEvents.length;
};
