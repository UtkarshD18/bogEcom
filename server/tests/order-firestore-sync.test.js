import assert from "node:assert/strict";
import test from "node:test";
import {
  __orderFirestoreSyncTestUtils,
  buildComparableOrderFirestorePayload,
  buildOrderFirestoreFingerprint,
} from "../utils/orderFirestoreSync.js";

test("order firestore sync cache skips identical payloads", () => {
  const orderId = "order-cache-test";
  const payload = buildComparableOrderFirestorePayload({
    _id: orderId,
    orderId: "H1G-2627/0001",
    user: { _id: "user-1" },
    order_status: "confirmed",
    payment_status: "paid",
    totalAmt: 799,
    products: [{}, {}],
    shipment_status: "packed",
  });
  const fingerprint = buildOrderFirestoreFingerprint(payload);

  __orderFirestoreSyncTestUtils.clearOrderSyncFingerprint(orderId);
  assert.equal(
    __orderFirestoreSyncTestUtils.shouldSkipCachedOrderSync(
      orderId,
      fingerprint,
    ),
    false,
  );

  __orderFirestoreSyncTestUtils.rememberOrderSyncFingerprint(
    orderId,
    fingerprint,
  );
  assert.equal(
    __orderFirestoreSyncTestUtils.shouldSkipCachedOrderSync(
      orderId,
      fingerprint,
    ),
    true,
  );

  __orderFirestoreSyncTestUtils.clearOrderSyncFingerprint(orderId);
});

test("order firestore fingerprint changes when mirrored fields change", () => {
  const baseOrder = {
    _id: "order-2",
    orderId: "H1G-2627/0002",
    userId: "user-2",
    order_status: "pending",
    payment_status: "pending",
    totalAmt: 499,
    products: [{}],
    awb_number: "AWB-1",
  };

  const baseFingerprint = buildOrderFirestoreFingerprint(
    buildComparableOrderFirestorePayload(baseOrder),
  );
  const changedFingerprint = buildOrderFirestoreFingerprint(
    buildComparableOrderFirestorePayload({
      ...baseOrder,
      payment_status: "paid",
    }),
  );

  assert.notEqual(baseFingerprint, changedFingerprint);
});

test("order firestore comparable payload normalizes ids and timestamps", () => {
  const payload = buildComparableOrderFirestorePayload({
    _id: "mongo-order",
    orderId: "H1G-2627/0003",
    user: { _id: "mongo-user" },
    order_status: "shipped",
    paymentStatus: "paid",
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
    statusTimeline: [
      {
        status: "shipped",
        timestamp: new Date("2026-05-02T12:30:00.000Z"),
        source: "XPRESSBEES_POLL",
      },
    ],
    estimatedDeliveryDate: "2026-05-05T00:00:00.000Z",
    awb_number: "AWB-999",
    shipping_provider: "XPRESSBEES",
    shipment_status: "in_transit",
    products: [{}, {}, {}],
  });

  assert.equal(payload.userId, "mongo-user");
  assert.equal(payload.itemCount, 3);
  assert.equal(
    payload.statusHistory[0]?.timestamp,
    "2026-05-02T12:30:00.000Z",
  );
  assert.equal(payload.delivery.estimatedDate, "2026-05-05T00:00:00.000Z");
});
