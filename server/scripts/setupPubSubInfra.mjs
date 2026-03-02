import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PubSub } from "@google-cloud/pubsub";
import { GoogleAuth } from "google-auth-library";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

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

const normalizePrivateKey = (value) =>
  normalizeEnvValue(value).replace(/\\n/g, "\n");

const resolveProjectId = () =>
  normalizeEnvValue(
    process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      process.env.FIREBASE_PROJECT_ID ||
      "",
  );

const resolveCredentials = () => {
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

  if (!clientEmail || !privateKey) return null;

  return {
    client_email: clientEmail,
    private_key: privateKey,
  };
};

const projectId = resolveProjectId();
if (!projectId) {
  console.error(
    "Missing project id. Set GOOGLE_CLOUD_PROJECT (or FIREBASE_PROJECT_ID) in server/.env",
  );
  process.exit(1);
}

const topicName =
  normalizeEnvValue(process.env.ANALYTICS_PUBSUB_TOPIC) ||
  "user-behavior-events";
const subscriptionName =
  normalizeEnvValue(process.env.ANALYTICS_PUBSUB_SUBSCRIPTION) ||
  "user-behavior-events-sub";
const deadLetterTopicName =
  normalizeEnvValue(process.env.ANALYTICS_PUBSUB_DEAD_LETTER_TOPIC) ||
  "user-behavior-events-dead-letter";

const backendSaEmail =
  normalizeEnvValue(process.env.ANALYTICS_BACKEND_SERVICE_ACCOUNT_EMAIL) ||
  normalizeEnvValue(process.env.GOOGLE_CLIENT_EMAIL) ||
  normalizeEnvValue(process.env.FIREBASE_CLIENT_EMAIL) ||
  "";

const workerSaEmail =
  normalizeEnvValue(process.env.ANALYTICS_WORKER_SERVICE_ACCOUNT_EMAIL) ||
  backendSaEmail ||
  "";

const credentials = resolveCredentials();
const pubSub = new PubSub({
  projectId,
  ...(credentials ? { credentials } : {}),
});

const result = {
  projectId,
  resources: {},
  iam: {},
  warnings: [],
  errors: [],
};

const toResourceRef = (topic) => `projects/${projectId}/topics/${topic}`;

const ensureTopic = async (name) => {
  const topic = pubSub.topic(name);
  const [exists] = await topic.exists();
  if (!exists) {
    await pubSub.createTopic(name);
  }
  return {
    topic: pubSub.topic(name),
    created: !exists,
  };
};

const ensureSubscription = async (topic, name, deadLetterTopic) => {
  const subscription = pubSub.subscription(name);
  const [exists] = await subscription.exists();
  if (!exists) {
    await topic.createSubscription(name, {
      ackDeadlineSeconds: 30,
      deadLetterPolicy: {
        deadLetterTopic: toResourceRef(deadLetterTopic),
        maxDeliveryAttempts: 10,
      },
    });
  }
  return {
    subscription: pubSub.subscription(name),
    created: !exists,
  };
};

const ensureIamBinding = async (iamClient, role, member) => {
  if (!member) {
    return {
      role,
      member,
      applied: false,
      reason: "member-missing",
    };
  }

  const [policy] = await iamClient.getPolicy({
    requestedPolicyVersion: 3,
  });
  const bindings = Array.isArray(policy.bindings) ? policy.bindings : [];

  let binding = bindings.find((item) => item.role === role);
  if (!binding) {
    binding = {
      role,
      members: [],
    };
    bindings.push(binding);
  }

  if (!Array.isArray(binding.members)) {
    binding.members = [];
  }

  if (binding.members.includes(member)) {
    return {
      role,
      member,
      applied: false,
      reason: "already-present",
    };
  }

  binding.members.push(member);
  policy.bindings = bindings;
  await iamClient.setPolicy(policy);

  return {
    role,
    member,
    applied: true,
  };
};

const resolveProjectNumber = async () => {
  try {
    const auth = new GoogleAuth({
      projectId,
      credentials: credentials
        ? {
            client_email: credentials.client_email,
            private_key: credentials.private_key,
          }
        : undefined,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = String(tokenResponse?.token || "").trim();
    if (!accessToken) return "";

    const response = await fetch(
      `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      return "";
    }

    const data = await response.json();
    return String(data?.projectNumber || "").trim();
  } catch {
    return "";
  }
};

const run = async () => {
  try {
    const mainTopicResult = await ensureTopic(topicName);
    result.resources.topic = {
      name: topicName,
      created: mainTopicResult.created,
    };

    const deadLetterTopicResult = await ensureTopic(deadLetterTopicName);
    result.resources.deadLetterTopic = {
      name: deadLetterTopicName,
      created: deadLetterTopicResult.created,
    };

    const subscriptionResult = await ensureSubscription(
      mainTopicResult.topic,
      subscriptionName,
      deadLetterTopicName,
    );
    result.resources.subscription = {
      name: subscriptionName,
      created: subscriptionResult.created,
    };

    const backendMember = backendSaEmail
      ? `serviceAccount:${backendSaEmail}`
      : "";
    const workerMember = workerSaEmail ? `serviceAccount:${workerSaEmail}` : "";

    result.iam.topicPublisher = await ensureIamBinding(
      mainTopicResult.topic.iam,
      "roles/pubsub.publisher",
      backendMember,
    );

    result.iam.subscriptionSubscriber = await ensureIamBinding(
      subscriptionResult.subscription.iam,
      "roles/pubsub.subscriber",
      workerMember,
    );

    result.iam.deadLetterPublisher = await ensureIamBinding(
      deadLetterTopicResult.topic.iam,
      "roles/pubsub.publisher",
      workerMember,
    );

    const projectNumber = await resolveProjectNumber();
    if (projectNumber) {
      const pubSubServiceAgent = `serviceAccount:service-${projectNumber}@gcp-sa-pubsub.iam.gserviceaccount.com`;
      result.iam.deadLetterServiceAgentPublisher = await ensureIamBinding(
        deadLetterTopicResult.topic.iam,
        "roles/pubsub.publisher",
        pubSubServiceAgent,
      );
    } else {
      result.warnings.push(
        "Could not resolve project number. Skipped Pub/Sub service-agent DLQ publisher binding.",
      );
    }

    if (!backendSaEmail) {
      result.warnings.push(
        "Backend service account email missing. Set ANALYTICS_BACKEND_SERVICE_ACCOUNT_EMAIL for explicit binding.",
      );
    }
    if (!workerSaEmail) {
      result.warnings.push(
        "Worker service account email missing. Set ANALYTICS_WORKER_SERVICE_ACCOUNT_EMAIL for explicit binding.",
      );
    }
  } catch (error) {
    result.errors.push({
      message: String(error?.message || error),
      code: error?.code ?? null,
      details: error?.details || null,
    });
  }

  console.log(JSON.stringify(result, null, 2));

  if (result.errors.length > 0) {
    process.exit(1);
  }
};

run();
