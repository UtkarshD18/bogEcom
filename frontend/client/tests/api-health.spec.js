const { test, expect } = require("@playwright/test");

const API_BASE = process.env.PLAYWRIGHT_API_BASE || "http://127.0.0.1:8000";

test.describe("API Health and Integration Tests", () => {
  // 1. GET /api/products (happy path)
  test("GET /api/products returns 200 and product list", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/products`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  // 2. GET /api/categories (happy path)
  test("GET /api/categories returns 200 and category list", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/categories`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  // 3. POST /api/user/login (success path and validation failures)
  test("POST /api/user/login validation with correct & incorrect credentials", async ({ request }) => {
    // Correct credentials
    const successRes = await request.post(`${API_BASE}/api/user/login`, {
      data: {
        email: "customer@buyonegram.com",
        password: "customer123",
      },
    });
    expect(successRes.status()).toBe(200);
    const successBody = await successRes.json();
    expect(successBody.data?.accessToken).toBeDefined();

    // Incorrect password
    const failRes = await request.post(`${API_BASE}/api/user/login`, {
      data: {
        email: "customer@buyonegram.com",
        password: "wrong-password",
      },
    });
    expect(failRes.status()).toBe(400);
    const failBody = await failRes.json();
    expect(failBody.success).toBe(false);

    // Missing field validation
    const invalidRes = await request.post(`${API_BASE}/api/user/login`, {
      data: {
        email: "customer@buyonegram.com",
      },
    });
    expect(invalidRes.status()).toBe(400);
    const invalidBody = await invalidRes.json();
    expect(invalidBody.success).toBe(false);
  });

  // 4. Unauthorized Access Checks
  test("GET /api/orders/user/my-orders without token returns 401 Unauthorized", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/orders/user/my-orders`);
    expect(res.status()).toBe(401);
  });

  // 5. Validation errors on orders
  test("POST /api/orders with empty body returns 400 Bad Request with validation errors", async ({ request }) => {
    // Authenticate first
    const loginRes = await request.post(`${API_BASE}/api/user/login`, {
      data: {
        email: "customer@buyonegram.com",
        password: "customer123",
      },
    });
    const loginBody = await loginRes.json();
    const token = loginBody.data?.accessToken;

    const res = await request.post(`${API_BASE}/api/orders`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {}, // empty body
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message || body.errors).toBeDefined();
  });

  // 6. 404 handler responses
  test("GET /api/non-existent-endpoint returns 404 with structured message", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/non-existent-endpoint`);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain("not found");
  });
});
