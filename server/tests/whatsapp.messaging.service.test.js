import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import assert from "node:assert/strict";
import test from "node:test";
import CrmContact from "../models/crmContact.model.js";
import CrmInteraction from "../models/crmInteraction.model.js";
import SettingsModel from "../models/settings.model.js";
import { recordCrmTouchpoint } from "../services/crm/crmTracking.service.js";
import {
  clearWhatsappRuntimeConfigCache,
  getWhatsappRuntimeConfigSnapshot,
  saveWhatsappRuntimeConfig,
} from "../services/whatsapp/whatsappConfig.service.js";
import {
  getWhatsappAudiencePreview,
  sendWhatsappCampaign,
} from "../services/whatsapp/whatsappAdmin.service.js";
import {
  getWhatsappMessagingHealth,
  getWhatsappMessagingHealthSnapshot,
  sendWhatsappMessage,
} from "../services/whatsapp/whatsappMessaging.service.js";

let mongoServer;

const ORIGINAL_ENV = {
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  WHATSAPP_GRAPH_API_VERSION: process.env.WHATSAPP_GRAPH_API_VERSION,
};

const restoreWhatsappEnv = () => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
};

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "bogecom-whatsapp-tests",
  });
});

test.after(async () => {
  restoreWhatsappEnv();
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.afterEach(async () => {
  restoreWhatsappEnv();
  clearWhatsappRuntimeConfigCache();
  await Promise.all([
    CrmContact.deleteMany({}),
    CrmInteraction.deleteMany({}),
    SettingsModel.deleteMany({}),
  ]);
});

test("getWhatsappAudiencePreview includes default-approved customers and dedupes phone variants", async () => {
  const lead = await recordCrmTouchpoint({
    channel: "whatsapp",
    eventType: "chat_message",
    direction: "inbound",
    phone: "919876540001",
    name: "Lead Contact",
    idempotencyKey: "wa-audience-lead",
  });

  const customer = await recordCrmTouchpoint({
    channel: "whatsapp",
    eventType: "chat_message",
    direction: "inbound",
    phone: "919876540002",
    name: "Customer Contact",
    idempotencyKey: "wa-audience-customer",
  });

  await CrmContact.updateOne(
    { _id: lead.contact._id },
    { $set: { lifecycleStage: "lead", status: "open" } },
  );
  await CrmContact.updateOne(
    { _id: customer.contact._id },
    { $set: { lifecycleStage: "customer", status: "converted" } },
  );

  await CrmContact.create({
    name: "Implicit Customer",
    phone: "919876540004",
    lifecycleStage: "customer",
    status: "converted",
    consent: {
      whatsapp: null,
    },
  });

  await CrmContact.create({
    name: "Duplicate Customer Older",
    phone: "919876540005",
    lifecycleStage: "customer",
    status: "converted",
    consent: {
      whatsapp: null,
    },
  });
  await CrmContact.create({
    name: "Duplicate Customer Latest",
    phone: "+919876540005",
    lifecycleStage: "customer",
    status: "converted",
    consent: {
      whatsapp: true,
    },
  });

  await CrmContact.create({
    name: "Blocked Contact",
    phone: "919876540003",
    lifecycleStage: "customer",
    status: "open",
    consent: {
      whatsapp: false,
    },
  });

  const previewAll = await getWhatsappAudiencePreview({
    segment: "all",
    inactiveDays: 45,
  });
  const preview = await getWhatsappAudiencePreview({
    segment: "customers",
    inactiveDays: 45,
  });

  assert.equal(previewAll.count, 4);
  assert.equal(preview.segment, "customers");
  assert.equal(preview.count, 3);
  assert.equal(preview.sample.length, 3);
  assert.equal(
    preview.sample.some((entry) => entry.name === "Implicit Customer"),
    true,
  );
  assert.equal(
    preview.sample.some((entry) => entry.name === "Duplicate Customer Latest"),
    true,
  );
  assert.equal(
    preview.sample.some((entry) => entry.name === "Blocked Contact"),
    false,
  );
});

test("getWhatsappMessagingHealth reports not_configured when required env keys are missing", async () => {
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;

  const health = await getWhatsappMessagingHealth();

  assert.equal(health.ok, false);
  assert.equal(health.state, "not_configured");
  assert.ok(Array.isArray(health.missing));
  assert.ok(health.missing.includes("WHATSAPP_ACCESS_TOKEN"));
  assert.ok(health.missing.includes("WHATSAPP_PHONE_NUMBER_ID"));
});

test("getWhatsappMessagingHealth reports token_expired for Meta OAuthException 190/463", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

  const health = await getWhatsappMessagingHealth({
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      async json() {
        return {
          error: {
            message: "Error validating access token: Session has expired.",
            type: "OAuthException",
            code: 190,
            error_subcode: 463,
          },
        };
      },
    }),
  });

  assert.equal(health.ok, false);
  assert.equal(health.state, "token_expired");
  assert.equal(health.httpStatus, 401);
  assert.equal(health.providerCode, 190);
  assert.equal(health.providerSubcode, 463);
});

test("getWhatsappMessagingHealth keeps the saved admin token as first priority when it is expired", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "env-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

  await saveWhatsappRuntimeConfig({
    accessToken: "expired-db-token",
    phoneNumberId: "123456789",
    graphApiVersion: "v22.0",
  });

  const seenAuthHeaders = [];
  const health = await getWhatsappMessagingHealth({
    fetchImpl: async (_url, options = {}) => {
      seenAuthHeaders.push(options?.headers?.Authorization || "");

      if (options?.headers?.Authorization === "Bearer expired-db-token") {
        return {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          async json() {
            return {
              error: {
                message: "Error validating access token: Session has expired.",
                type: "OAuthException",
                code: 190,
                error_subcode: 463,
              },
            };
          },
        };
      }

      return {
        ok: true,
        async json() {
          return {
            id: "123456789",
            display_phone_number: "+91 87690 27048",
            verified_name: "Healthy One Gram",
            quality_rating: "GREEN",
            code_verification_status: "VERIFIED",
            name_status: "APPROVED",
            status: "CONNECTED",
            platform_type: "CLOUD_API",
            throughput: { level: "STANDARD" },
          };
        },
      };
    },
  });

  assert.deepEqual(seenAuthHeaders, ["Bearer expired-db-token"]);
  assert.equal(health.ok, false);
  assert.equal(health.state, "token_expired");
  assert.equal(health.accessTokenSource, "database");
  assert.equal(health.providerCode, 190);
  assert.equal(health.providerSubcode, 463);
});

test("getWhatsappRuntimeConfigSnapshot keeps stored overrides separate from environment fallback", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "env-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "env-phone-id";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

  await saveWhatsappRuntimeConfig({
    accessToken: "db-token",
    phoneNumberId: "db-phone-id",
    graphApiVersion: "v22.0",
  });

  await saveWhatsappRuntimeConfig({
    accessToken: "",
    phoneNumberId: "db-phone-id",
    graphApiVersion: "v22.0",
  });

  const snapshot = await getWhatsappRuntimeConfigSnapshot({ forceFresh: true });
  const storedSetting = await SettingsModel.findOne({
    key: "whatsappRuntimeConfig",
  })
    .select("value")
    .lean();

  assert.equal(snapshot.accessToken, "env-token");
  assert.equal(snapshot.effective.accessToken, "env-token");
  assert.equal(snapshot.stored.accessToken, "");
  assert.equal(snapshot.sources.accessToken, "environment");
  assert.equal(snapshot.environmentAvailable.accessToken, true);
  assert.equal(snapshot.phoneNumberId, "db-phone-id");
  assert.equal(snapshot.stored.phoneNumberId, "db-phone-id");
  assert.equal(storedSetting?.value?.accessToken, "");
});

test("getWhatsappMessagingHealth reports ready when provider auth probe succeeds", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

  const health = await getWhatsappMessagingHealth({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          id: "123456789",
          display_phone_number: "+91 87690 27048",
          verified_name: "Healthy One Gram",
          quality_rating: "GREEN",
          code_verification_status: "VERIFIED",
          name_status: "APPROVED",
          status: "CONNECTED",
          platform_type: "CLOUD_API",
          throughput: { level: "STANDARD" },
        };
      },
    }),
  });

  assert.equal(health.ok, true);
  assert.equal(health.state, "ready");
  assert.equal(health.deliveryReady, true);
  assert.equal(health.phoneNumberId, "123456789");
  assert.equal(health.displayPhoneNumber, "+91 87690 27048");
  assert.equal(health.qualityRating, "green");
  assert.equal(health.codeVerificationStatus, "verified");
  assert.equal(health.nameStatus, "approved");
});

test("getWhatsappMessagingHealth reports sender_warning when sender setup can block delivery", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

  const health = await getWhatsappMessagingHealth({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          id: "123456789",
          display_phone_number: "+91 87690 27048",
          verified_name: "Healthy One Gram",
          quality_rating: "GREEN",
          code_verification_status: "EXPIRED",
          name_status: "DECLINED",
          status: "CONNECTED",
          platform_type: "CLOUD_API",
          throughput: { level: "STANDARD" },
        };
      },
    }),
  });

  assert.equal(health.ok, true);
  assert.equal(health.state, "sender_warning");
  assert.equal(health.deliveryReady, false);
  assert.equal(health.codeVerificationStatus, "expired");
  assert.equal(health.nameStatus, "declined");
  assert.match(health.message, /block reliable delivery/i);
});

test("getWhatsappMessagingHealthSnapshot falls back quickly when live verification stalls", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

  const startedAt = Date.now();
  const health = await getWhatsappMessagingHealthSnapshot({
    fetchImpl: async () => new Promise(() => {}),
    timeoutMs: 25,
  });

  assert.equal(health.ok, false);
  assert.equal(health.state, "health_check_timeout");
  assert.equal(health.timedOut, true);
  assert.ok(Date.now() - startedAt < 500);
});

test("sendWhatsappMessage sends text message for active conversation and stores outbound CRM event", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

  const inbound = await recordCrmTouchpoint({
    channel: "whatsapp",
    eventType: "chat_message",
    direction: "inbound",
    phone: "919876540010",
    name: "Reply User",
    idempotencyKey: "wa-send-text-inbound",
  });

  let requestPayload = null;
  const mockFetch = async (url, options = {}) => {
    requestPayload = {
      url,
      method: options.method,
      body: JSON.parse(String(options.body || "{}")),
    };

    return {
      ok: true,
      async json() {
        return {
          messaging_product: "whatsapp",
          contacts: [
            {
              input: "919876540010",
              wa_id: "919876540010",
            },
          ],
          messages: [
            {
              id: "wamid.text.123",
            },
          ],
        };
      },
    };
  };

  const result = await sendWhatsappMessage({
    contactId: String(inbound.contact._id),
    body: "Thanks for reaching out. We are on it.",
    adminUserId: "admin-1",
    fetchImpl: mockFetch,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.mode, "text");
  assert.equal(result.messageId, "wamid.text.123");
  assert.equal(
    requestPayload.url,
    "https://graph.facebook.com/v22.0/123456789/messages",
  );
  assert.equal(requestPayload.method, "POST");
  assert.equal(requestPayload.body.type, "text");
  assert.equal(requestPayload.body.to, "919876540010");
  assert.equal(
    requestPayload.body.text.body,
    "Thanks for reaching out. We are on it.",
  );

  const outbound = await CrmInteraction.findOne({
    contact: inbound.contact._id,
    direction: "outbound",
    eventName: "whatsapp_text",
  }).lean();

  assert.ok(outbound);
  assert.equal(outbound.eventType, "chat_message");
  assert.equal(outbound.metadata?.messageId, "wamid.text.123");
});

test("sendWhatsappMessage builds template payload with variables for promotional sends", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

  const contact = await recordCrmTouchpoint({
    channel: "whatsapp",
    eventType: "chat_message",
    direction: "inbound",
    phone: "919876540020",
    name: "Promo User",
    idempotencyKey: "wa-send-template-inbound",
  });

  let requestPayload = null;
  const mockFetch = async (_url, options = {}) => {
    requestPayload = JSON.parse(String(options.body || "{}"));
    return {
      ok: true,
      async json() {
        return {
          contacts: [{ input: "919876540020", wa_id: "919876540020" }],
          messages: [{ id: "wamid.template.123" }],
        };
      },
    };
  };

  const result = await sendWhatsappMessage({
    contactId: String(contact.contact._id),
    templateName: "spring_offer_template",
    languageCode: "en_US",
    bodyVariables: ["Utkarsh", "15% OFF"],
    headerVariables: ["HealthyOneGram"],
    campaignName: "Spring Offer",
    segment: "customers",
    adminUserId: "admin-2",
    fetchImpl: mockFetch,
  });

  assert.equal(result.mode, "template");
  assert.equal(result.templateName, "spring_offer_template");
  assert.equal(requestPayload.type, "template");
  assert.equal(requestPayload.template.name, "spring_offer_template");
  assert.equal(requestPayload.template.language.code, "en_US");
  assert.equal(requestPayload.template.components.length, 2);
  assert.equal(requestPayload.template.components[0].type, "header");
  assert.equal(requestPayload.template.components[1].type, "body");

  const outbound = await CrmInteraction.findOne({
    contact: contact.contact._id,
    direction: "outbound",
    eventName: "whatsapp_template",
  }).lean();

  assert.ok(outbound);
  assert.equal(outbound.metadata?.templateName, "spring_offer_template");
  assert.equal(outbound.metadata?.messageId, "wamid.template.123");
  assert.equal(outbound.campaign?.campaign, "Spring Offer");
});

test("sendWhatsappMessage sends image mode payload and records media metadata", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

  const inbound = await recordCrmTouchpoint({
    channel: "whatsapp",
    eventType: "chat_message",
    direction: "inbound",
    phone: "919876540030",
    name: "Image User",
    idempotencyKey: "wa-send-image-inbound",
  });

  let requestPayload = null;
  const mockFetch = async (_url, options = {}) => {
    requestPayload = JSON.parse(String(options.body || "{}"));
    return {
      ok: true,
      async json() {
        return {
          contacts: [{ input: "919876540030", wa_id: "919876540030" }],
          messages: [{ id: "wamid.image.123" }],
        };
      },
    };
  };

  const result = await sendWhatsappMessage({
    contactId: String(inbound.contact._id),
    mode: "image",
    mediaUrl: "https://cdn.example.com/media/promo-banner.png",
    mediaCaption: "Today only: extra 10% off",
    adminUserId: "admin-image",
    fetchImpl: mockFetch,
  });

  assert.equal(result.mode, "image");
  assert.equal(requestPayload.type, "image");
  assert.equal(
    requestPayload.image.link,
    "https://cdn.example.com/media/promo-banner.png",
  );
  assert.equal(requestPayload.image.caption, "Today only: extra 10% off");

  const outbound = await CrmInteraction.findOne({
    contact: inbound.contact._id,
    direction: "outbound",
    eventName: "whatsapp_image",
  }).lean();

  assert.ok(outbound);
  assert.equal(outbound.metadata?.messageType, "image");
  assert.equal(outbound.metadata?.providerPayloadType, "image");
  assert.equal(
    outbound.metadata?.mediaUrl,
    "https://cdn.example.com/media/promo-banner.png",
  );
});

test("sendWhatsappMessage sends gif mode as video when using Cloudinary gif URL", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

  const inbound = await recordCrmTouchpoint({
    channel: "whatsapp",
    eventType: "chat_message",
    direction: "inbound",
    phone: "919876540040",
    name: "Gif User",
    idempotencyKey: "wa-send-gif-inbound",
  });

  let requestPayload = null;
  const mockFetch = async (_url, options = {}) => {
    requestPayload = JSON.parse(String(options.body || "{}"));
    return {
      ok: true,
      async json() {
        return {
          contacts: [{ input: "919876540040", wa_id: "919876540040" }],
          messages: [{ id: "wamid.gif.123" }],
        };
      },
    };
  };

  const result = await sendWhatsappMessage({
    contactId: String(inbound.contact._id),
    mode: "gif",
    mediaUrl:
      "https://res.cloudinary.com/demo/image/upload/v1/buyonegram/whatsapp/offer.gif",
    mediaCaption: "Festive offer",
    mediaFilename: "offer.gif",
    adminUserId: "admin-gif",
    fetchImpl: mockFetch,
  });

  assert.equal(result.mode, "gif");
  assert.equal(requestPayload.type, "video");
  assert.ok(
    String(requestPayload.video.link || "").includes("/video/upload/f_mp4/"),
  );
  assert.ok(String(requestPayload.video.link || "").endsWith("offer.mp4"));

  const outbound = await CrmInteraction.findOne({
    contact: inbound.contact._id,
    direction: "outbound",
    eventName: "whatsapp_gif",
  }).lean();

  assert.ok(outbound);
  assert.equal(outbound.metadata?.messageType, "gif");
  assert.equal(outbound.metadata?.providerPayloadType, "video");
  assert.ok(String(outbound.metadata?.mediaUrl || "").endsWith("offer.mp4"));
});

test("sendWhatsappMessage sends template with image header media parameter", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

  const inbound = await recordCrmTouchpoint({
    channel: "whatsapp",
    eventType: "chat_message",
    direction: "inbound",
    phone: "919876540045",
    name: "Template Header Media User",
    idempotencyKey: "wa-send-template-header-media-inbound",
  });

  let requestPayload = null;
  const mockFetch = async (_url, options = {}) => {
    requestPayload = JSON.parse(String(options.body || "{}"));
    return {
      ok: true,
      async json() {
        return {
          contacts: [{ input: "919876540045", wa_id: "919876540045" }],
          messages: [{ id: "wamid.template.media.123" }],
        };
      },
    };
  };

  const result = await sendWhatsappMessage({
    contactId: String(inbound.contact._id),
    templateName: "spring_offer_template",
    languageCode: "en_US",
    bodyVariables: ["Protein Peanut Butter", "399"],
    templateHeaderMediaType: "image",
    templateHeaderMediaUrl: "https://cdn.example.com/media/product-offer.png",
    campaignName: "Product Retrieval Ad",
    segment: "customers",
    adminUserId: "admin-template-media",
    fetchImpl: mockFetch,
  });

  assert.equal(result.mode, "template");
  assert.equal(requestPayload.type, "template");
  assert.equal(requestPayload.template.components.length, 2);
  assert.equal(requestPayload.template.components[0].type, "header");
  assert.equal(
    requestPayload.template.components[0].parameters[0].type,
    "image",
  );
  assert.equal(
    requestPayload.template.components[0].parameters[0].image.link,
    "https://cdn.example.com/media/product-offer.png",
  );

  const outbound = await CrmInteraction.findOne({
    contact: inbound.contact._id,
    direction: "outbound",
    eventName: "whatsapp_template",
  }).sort({ createdAt: -1 });

  assert.ok(outbound);
  assert.equal(outbound.metadata?.templateHeaderMediaType, "image");
  assert.equal(
    outbound.metadata?.templateHeaderMediaUrl,
    "https://cdn.example.com/media/product-offer.png",
  );
});

test("sendWhatsappCampaign sends approved template messages to the deduped campaign-ready audience", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

  await Promise.all([
    CrmContact.create({
      name: "Campaign Customer One",
      phone: "919876540050",
      lifecycleStage: "customer",
      status: "converted",
      consent: { whatsapp: null },
    }),
    CrmContact.create({
      name: "Campaign Customer Two",
      phone: "919876540051",
      lifecycleStage: "repeat_customer",
      status: "converted",
      consent: { whatsapp: true },
    }),
    CrmContact.create({
      name: "Campaign Customer One Duplicate",
      phone: "+919876540050",
      lifecycleStage: "customer",
      status: "converted",
      consent: { whatsapp: true },
    }),
    CrmContact.create({
      name: "Blocked Contact",
      phone: "919876540052",
      lifecycleStage: "customer",
      status: "open",
      consent: { whatsapp: false },
    }),
  ]);

  const originalFetch = globalThis.fetch;
  let requestCount = 0;

  globalThis.fetch = async () => {
    requestCount += 1;
    return {
      ok: true,
      async json() {
        return {
          contacts: [
            {
              input: `9198765400${49 + requestCount}`,
              wa_id: `9198765400${49 + requestCount}`,
            },
          ],
          messages: [{ id: `wamid.campaign.${requestCount}` }],
        };
      },
    };
  };

  try {
    const result = await sendWhatsappCampaign(
      {
        templateName: "spring_offer_template",
        campaignName: "Spring Offer Blast",
        segment: "customers",
        limit: 10,
        languageCode: "en_US",
        bodyVariables: ["Utkarsh", "15% OFF"],
        headerVariables: ["HealthyOneGram"],
      },
      "admin-campaign",
    );

    assert.equal(result.attempted, 2);
    assert.equal(result.sent, 2);
    assert.equal(result.failed, 0);
    assert.equal(result.recipients.length, 2);
    assert.equal(requestCount, 2);
    assert.equal(result.campaignName, "Spring Offer Blast");

    const campaignEvents = await CrmInteraction.find({
      direction: "outbound",
      eventName: "whatsapp_template",
      "campaign.campaign": "Spring Offer Blast",
    }).lean();

    assert.equal(campaignEvents.length, 2);
    assert.ok(
      campaignEvents.every(
        (event) => event.metadata?.templateName === "spring_offer_template",
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
