import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  __resetPublicResponseCacheForTests,
  createPublicResponseCacheMiddleware,
  invalidatePublicResponseCache,
} from "../middlewares/publicResponseCache.js";

const buildReq = ({
  url = "/api/products?limit=10&page=1",
  method = "GET",
  headers = {},
} = {}) => ({
  method,
  url,
  originalUrl: url,
  headers,
  params: {},
});

const buildRes = () => {
  const headers = new Map();
  return {
    statusCode: 200,
    body: null,
    set(name, value) {
      headers.set(String(name).toLowerCase(), value);
      return this;
    },
    get(name) {
      return headers.get(String(name).toLowerCase());
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return payload;
    },
  };
};

const runRequest = async ({
  middleware,
  req = buildReq(),
  handler = (_req, res) =>
    res.status(200).json({
      error: false,
      success: true,
      data: { ts: Date.now() },
    }),
} = {}) => {
  const res = buildRes();
  let nextCalls = 0;

  await middleware(req, res, () => {
    nextCalls += 1;
    return handler(req, res);
  });

  return { req, res, nextCalls };
};

afterEach(() => {
  __resetPublicResponseCacheForTests();
  delete process.env.PERF_RESPONSE_CACHE_ENABLED;
  delete process.env.REDIS_URL;
  delete process.env.REDIS_HOST;
});

test("public response cache stores a successful anonymous GET response", async () => {
  const middleware = createPublicResponseCacheMiddleware({
    namespaces: ["products"],
    ttlSeconds: 60,
  });

  const first = await runRequest({ middleware });
  const second = await runRequest({ middleware });

  assert.equal(first.nextCalls, 1);
  assert.equal(first.res.get("x-response-cache"), "MISS");
  assert.equal(second.nextCalls, 0);
  assert.equal(second.res.get("x-response-cache"), "HIT");
  assert.deepEqual(second.res.body, first.res.body);
});

test("public response cache canonicalizes query-string order", async () => {
  const middleware = createPublicResponseCacheMiddleware({
    namespaces: ["products"],
    ttlSeconds: 60,
  });

  const first = await runRequest({
    middleware,
    req: buildReq({ url: "/api/products?page=1&limit=10" }),
  });
  const second = await runRequest({
    middleware,
    req: buildReq({ url: "/api/products?limit=10&page=1" }),
  });

  assert.equal(first.nextCalls, 1);
  assert.equal(second.nextCalls, 0);
  assert.equal(second.res.get("x-response-cache"), "HIT");
});

test("public response cache skips authenticated requests", async () => {
  const middleware = createPublicResponseCacheMiddleware({
    namespaces: ["products"],
    ttlSeconds: 60,
  });

  const first = await runRequest({
    middleware,
    req: buildReq({ headers: { cookie: "accessToken=abc" } }),
  });
  const second = await runRequest({
    middleware,
    req: buildReq({ headers: { cookie: "accessToken=abc" } }),
  });

  assert.equal(first.nextCalls, 1);
  assert.equal(second.nextCalls, 1);
  assert.equal(first.res.get("x-response-cache"), undefined);
  assert.equal(second.res.get("x-response-cache"), undefined);
});

test("public response cache invalidation forces the next request to miss", async () => {
  const middleware = createPublicResponseCacheMiddleware({
    namespaces: ["products"],
    ttlSeconds: 60,
  });

  const first = await runRequest({ middleware });
  const cached = await runRequest({ middleware });

  await invalidatePublicResponseCache(["products"]);

  const afterInvalidate = await runRequest({ middleware });

  assert.equal(first.nextCalls, 1);
  assert.equal(cached.nextCalls, 0);
  assert.equal(afterInvalidate.nextCalls, 1);
  assert.equal(afterInvalidate.res.get("x-response-cache"), "MISS");
});
