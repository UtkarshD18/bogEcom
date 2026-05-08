import assert from "node:assert/strict";
import test from "node:test";
import { __backgroundJobLeaseTestUtils } from "../utils/backgroundJobLease.js";

test("background job lease duration is bounded for short and long intervals", () => {
  assert.equal(__backgroundJobLeaseTestUtils.resolveLeaseMs(30_000), 60_000);
  assert.equal(
    __backgroundJobLeaseTestUtils.resolveLeaseMs(24 * 60 * 60 * 1000),
    30 * 60 * 1000,
  );
});

test("background job owner id is always non-empty", () => {
  assert.ok(__backgroundJobLeaseTestUtils.resolveOwnerId());
});
