import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrderAddressSnapshot,
  snapshotToDisplayAddress,
} from "../utils/addressUtils.js";
import { buildXpressbeesShipmentPayload } from "../utils/shippingLabel.js";

test("shipping payload uses landmark as secondary line without duplicating area", () => {
  const snapshot = buildOrderAddressSnapshot(
    {
      full_name: "Rahul Sharma",
      mobile_number: "9876543210",
      flat_house: "B-42",
      area_street_sector: "SKIT Road",
      landmark: "Near Apollo Hospital",
      city: "Jaipur",
      state: "Rajasthan",
      district: "Jaipur",
      pincode: "302017",
    },
    {
      email: "rahul.sharma@example.com",
      source: "saved_address",
      addressId: "addr_123",
    },
  );

  const display = snapshotToDisplayAddress(snapshot);
  const shipment = buildXpressbeesShipmentPayload(snapshot);

  assert.equal(display.address_line1, "B-42, SKIT Road");
  assert.equal(display.address_line2, "Near Apollo Hospital");
  assert.equal(shipment.address_line1, "B-42, SKIT Road");
  assert.equal(shipment.address_line2, "Near Apollo Hospital");
  assert.equal(shipment.landmark, "Near Apollo Hospital");
});
