import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCookieOptions,
  resolveSessionId,
} from "../middlewares/analyticsSession.js";

test("resolveSessionId prefers explicit client session ids over stale cookies", () => {
  const req = {
    headers: {
      "x-session-id": "header_session_12345678",
    },
    body: {
      sessionId: "body_session_12345678",
    },
    cookies: {
      hog_sid: "cookie_session_12345678",
      sessionId: "legacy_cookie_12345678",
    },
  };

  assert.equal(resolveSessionId(req), "header_session_12345678");
});

test("buildCookieOptions keeps analytics session cookies browser-session scoped by default", () => {
  const sessionCookie = buildCookieOptions();
  const persistentCookie = buildCookieOptions({ persistent: true });

  assert.equal("maxAge" in sessionCookie, false);
  assert.equal(persistentCookie.maxAge, 365 * 24 * 60 * 60 * 1000);
});
