import { PubSub } from "@google-cloud/pubsub";
import {
  DEFAULT_ANALYTICS_PUBSUB_TOPIC,
} from "./constants.js";

let pubSubClient = null;

const isTruthy = (value) =>
  ["true", "1", "yes", "on"].includes(String(value || "").trim().toLowerCase());

const normalizeEnvValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim();
  }

  return raw;
};

const normalizePrivateKey = (value) => normalizeEnvValue(value).replace(/\\n/g, "\n");

const resolveProjectId = () =>
  normalizeEnvValue(
    process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      process.env.FIREBASE_PROJECT_ID ||
      "",
  );

const resolvePubSubCredentials = () => {
  const clientEmail = normalizeEnvValue(
    process.env.GOOGLE_CLIENT_EMAIL ||
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      process.env.FIREBASE_CLIENT_EMAIL ||
      "",
  );

  const privateKey = normalizePrivateKey(
    process.env.GOOGLE_PRIVATE_KEY ||
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
      process.env.FIREBASE_PRIVATE_KEY ||
      "",
  );

  if (!clientEmail || !privateKey) {
    return null;
  }

  return {
    client_email: clientEmail,
    private_key: privateKey,
  };
};

const analyticsEnabled = () => {
  if (process.env.ANALYTICS_PUBSUB_ENABLED === undefined) {
    return true;
  }
  return isTruthy(process.env.ANALYTICS_PUBSUB_ENABLED);
};

const resolveTopicName = () =>
  String(process.env.ANALYTICS_PUBSUB_TOPIC || DEFAULT_ANALYTICS_PUBSUB_TOPIC)
    .trim() || DEFAULT_ANALYTICS_PUBSUB_TOPIC;

const getPubSubClient = () => {
  if (pubSubClient) {
    return pubSubClient;
  }

  const options = {};
  const explicitProjectId = resolveProjectId();
  if (explicitProjectId) {
    options.projectId = explicitProjectId;
  }

  const credentials = resolvePubSubCredentials();
  if (credentials) {
    options.credentials = credentials;
  }

  pubSubClient = new PubSub(options);
  return pubSubClient;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const publishWithRetry = async (topic, message, maxAttempts) => {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      return await topic.publishMessage(message);
    } catch (error) {
      lastError = error;
      const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
      await wait(delay);
    }
  }

  throw lastError || new Error("Failed to publish message");
};

const buildTopic = () => {
  const client = getPubSubClient();
  return client.topic(resolveTopicName(), {
    batching: {
      maxMessages: Number(process.env.ANALYTICS_PUBLISH_BATCH_MESSAGES || 50),
      maxMilliseconds: Number(process.env.ANALYTICS_PUBLISH_BATCH_MS || 10),
    },
  });
};

export const publishTrackingBatch = async ({
  sessionId,
  events,
  source = "tracking_api",
  consent = "unknown",
  requestId = "",
}) => {
  if (!analyticsEnabled()) {
    return null;
  }

  const payload = {
    sessionId,
    consent,
    events,
    source,
    publishedAt: new Date().toISOString(),
  };

  const message = {
    data: Buffer.from(JSON.stringify(payload)),
    attributes: {
      sessionId: String(sessionId || ""),
      eventCount: String(Array.isArray(events) ? events.length : 0),
      source: String(source || "tracking_api"),
      requestId: String(requestId || ""),
    },
  };

  const topic = buildTopic();
  const maxAttempts = Number(process.env.ANALYTICS_PUBLISH_MAX_ATTEMPTS || 3);
  return publishWithRetry(topic, message, Math.max(maxAttempts, 1));
};

export const publishTrackingBatchAsync = (payload) => {
  setImmediate(() => {
    publishTrackingBatch(payload).catch((error) => {
      console.error("[analytics] Failed to publish tracking batch:", error?.message || error);
    });
  });
};

export const getAnalyticsPublisherConfig = () => ({
  enabled: analyticsEnabled(),
  topic: resolveTopicName(),
  projectId: resolveProjectId() || null,
  hasCredentials: Boolean(resolvePubSubCredentials()),
});
