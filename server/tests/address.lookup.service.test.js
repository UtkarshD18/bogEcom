import assert from "node:assert/strict";
import test from "node:test";
import {
  clearPincodeLookupCache,
  getCachedPincodeLookup,
  lookupIndiaPostPincode,
} from "../services/addressLookup.service.js";

test.beforeEach(() => {
  clearPincodeLookupCache();
});

test("lookupIndiaPostPincode parses India Post payload and caches the result", async () => {
  let fetchCalls = 0;
  const payload = [
    {
      Status: "Success",
      PostOffice: [
        {
          Name: "Malviya Nagar",
          District: "Jaipur",
          State: "Rajasthan",
          Block: "Jaipur",
          BranchType: "Sub Post Office",
          DeliveryStatus: "Delivery",
        },
        {
          Name: "Pratap Nagar Sector 5",
          District: "Jaipur",
          State: "Rajasthan",
          Block: "Jaipur",
          BranchType: "Sub Post Office",
          DeliveryStatus: "Delivery",
        },
      ],
    },
  ];

  const result = await lookupIndiaPostPincode("302017", {
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        ok: true,
        json: async () => payload,
      };
    },
  });

  assert.equal(fetchCalls, 1);
  assert.equal(result.cacheHit, false);
  assert.equal(result.city, "Jaipur");
  assert.equal(result.state, "Rajasthan");
  assert.equal(result.district, "Jaipur");
  assert.equal(result.areaSuggestions.length, 2);
  assert.equal(result.areaSuggestions[0].name, "Malviya Nagar");

  const cached = getCachedPincodeLookup("302017");
  assert.equal(cached?.cacheHit, true);
  assert.equal(cached?.state, "Rajasthan");

  const fromCache = await lookupIndiaPostPincode("302017", {
    fetchImpl: async () => {
      throw new Error("Network should not be called for cached result");
    },
  });

  assert.equal(fromCache.cacheHit, true);
  assert.equal(fetchCalls, 1);
});

test("lookupIndiaPostPincode rejects invalid pincodes", async () => {
  await assert.rejects(
    () => lookupIndiaPostPincode("12A"),
    (error) => error?.code === "INVALID_PINCODE",
  );
});
