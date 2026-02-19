import assert from "node:assert/strict";
import test from "node:test";
import {
  createHmacSha256Base64,
  verifyExpressbeesWebhookAuth,
} from "../utils/expressbeesWebhookSignature.js";
import {
  ORDER_STATUS,
  mapExpressbeesToOrderStatus,
  mapExpressbeesToShipmentStatus,
} from "../utils/orderStatus.js";

test("Xpressbees webhook auth validates X-HMAC-SHA256 signature against raw body", () => {
  const secret = "test-webhook-secret";
  const rawBody =
    '{"order_number":"2396139165","awb_number":"151416440","status_code":"RT-IT"}';
  const signature = createHmacSha256Base64(rawBody, secret);

  const verification = verifyExpressbeesWebhookAuth({
    headers: { "x-hmac-sha256": signature },
    rawBody,
    secret,
  });

  assert.equal(verification.ok, true);
  assert.equal(verification.mode, "hmac_sha256_base64");
});

test("Xpressbees webhook auth accepts sha256= prefixed signature header", () => {
  const secret = "another-secret";
  const rawBody = '{"awb_number":"123","status":"out for delivery"}';
  const signature = createHmacSha256Base64(rawBody, secret);

  const verification = verifyExpressbeesWebhookAuth({
    headers: { "x-hmac-sha256": `sha256=${signature}` },
    rawBody,
    secret,
  });

  assert.equal(verification.ok, true);
  assert.equal(verification.mode, "hmac_sha256_base64");
});

test("Xpressbees webhook auth supports legacy secret header fallback", () => {
  const secret = "legacy-secret";

  const verification = verifyExpressbeesWebhookAuth({
    headers: { "x-webhook-secret": secret },
    body: { awb_number: "123" },
    secret,
  });

  assert.equal(verification.ok, true);
  assert.equal(verification.mode, "legacy_secret_header");
});

test("Xpressbees webhook auth rejects wrong signature", () => {
  const verification = verifyExpressbeesWebhookAuth({
    headers: { "x-hmac-sha256": "invalid-signature" },
    rawBody: '{"awb_number":"123"}',
    secret: "real-secret",
  });

  assert.equal(verification.ok, false);
  assert.equal(verification.reason, "signature_mismatch");
});

test("Xpressbees status codes map to supported order and shipment states", () => {
  const cases = [
    { code: "PP", order: ORDER_STATUS.IN_WAREHOUSE, shipment: "booked" },
    { code: "IT", order: ORDER_STATUS.SHIPPED, shipment: "shipped" },
    { code: "EX", order: ORDER_STATUS.SHIPPED, shipment: "shipped" },
    { code: "OFD", order: ORDER_STATUS.OUT_FOR_DELIVERY, shipment: "shipped" },
    { code: "DL", order: ORDER_STATUS.DELIVERED, shipment: "delivered" },
    { code: "LT", order: ORDER_STATUS.RTO, shipment: "rto_initiated" },
    { code: "DG", order: ORDER_STATUS.RTO, shipment: "rto_initiated" },
    { code: "RT", order: ORDER_STATUS.RTO, shipment: "rto_initiated" },
    { code: "RT-IT", order: ORDER_STATUS.RTO, shipment: "rto_in_transit" },
    { code: "RT-LT", order: ORDER_STATUS.RTO, shipment: "rto_in_transit" },
    { code: "RT-DG", order: ORDER_STATUS.RTO, shipment: "rto_in_transit" },
    { code: "RT-DL", order: ORDER_STATUS.RTO_COMPLETED, shipment: "rto_delivered" },
  ];

  for (const testCase of cases) {
    assert.equal(
      mapExpressbeesToOrderStatus(testCase.code),
      testCase.order,
      `order mapping failed for ${testCase.code}`,
    );
    assert.equal(
      mapExpressbeesToShipmentStatus(testCase.code),
      testCase.shipment,
      `shipment mapping failed for ${testCase.code}`,
    );
  }
});

