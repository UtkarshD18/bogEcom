import assert from "node:assert/strict";
import test from "node:test";
import { generateWhatsappWebhookVerifyToken } from "../services/whatsapp/whatsappConfig.service.js";

test("generateWhatsappWebhookVerifyToken builds a prefixed token with year and secure suffix", () => {
  const token = generateWhatsappWebhookVerifyToken({ year: 2031 });

  assert.match(token, /^bog_whatsapp_verify_2031_[a-f0-9]{40}$/);
});

test("generateWhatsappWebhookVerifyToken returns unique values across calls", () => {
  const firstToken = generateWhatsappWebhookVerifyToken({ year: 2031 });
  const secondToken = generateWhatsappWebhookVerifyToken({ year: 2031 });

  assert.notEqual(firstToken, secondToken);
});
