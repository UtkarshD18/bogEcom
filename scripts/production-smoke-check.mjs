const DEFAULT_TIMEOUT_MS = 15000;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    backendUrl: "",
    origins: [],
    adminEmail: "admin@buyonegram.com",
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = String(args[index] || "").trim();
    const next = args[index + 1];

    if (current === "--backend-url" && next) {
      options.backendUrl = String(next).trim();
      index += 1;
      continue;
    }

    if (current === "--origin" && next) {
      options.origins.push(String(next).trim());
      index += 1;
      continue;
    }

    if (current === "--admin-email" && next) {
      options.adminEmail = String(next).trim();
      index += 1;
      continue;
    }
  }

  return options;
};

const sanitizeBaseUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const isAllowedCorsOrigin = (response, expectedOrigin) => {
  const actualOrigin = String(
    response.headers.get("access-control-allow-origin") || "",
  ).trim();
  const allowCredentials = String(
    response.headers.get("access-control-allow-credentials") || "",
  )
    .trim()
    .toLowerCase();

  return actualOrigin === expectedOrigin && allowCredentials === "true";
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const fetchWithTimeout = async (url, init = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const verifyCorsPreflight = async ({ backendUrl, origin, path, method }) => {
  const response = await fetchWithTimeout(`${backendUrl}${path}`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": method,
      "Access-Control-Request-Headers": "content-type,authorization",
    },
  });

  assert(
    response.ok,
    `Preflight failed for ${origin} ${path} with status ${response.status}`,
  );
  assert(
    isAllowedCorsOrigin(response, origin),
    `Preflight CORS headers invalid for ${origin} ${path}`,
  );
};

const verifyJsonGet = async ({ backendUrl, origin, path }) => {
  const response = await fetchWithTimeout(`${backendUrl}${path}`, {
    method: "GET",
    headers: {
      Origin: origin,
      Accept: "application/json",
    },
  });

  assert(response.ok, `GET ${path} failed with status ${response.status}`);
  assert(
    isAllowedCorsOrigin(response, origin),
    `GET ${path} missing expected CORS headers for ${origin}`,
  );

  const payload = await response.json();
  assert(payload?.success === true, `GET ${path} returned unsuccessful payload`);
  return payload;
};

const verifyHealthEndpoint = async ({ backendUrl }) => {
  for (const path of ["/api/healthz", "/healthz/"]) {
    const response = await fetchWithTimeout(`${backendUrl}${path}`, {
      method: "GET",
      headers: { Accept: "text/plain" },
    });
    if (response.ok) {
      return;
    }
  }

  throw new Error("Health endpoint failed for /api/healthz and /healthz/");
};

const verifyProductImages = async ({ backendUrl, origin }) => {
  const payload = await verifyJsonGet({
    backendUrl,
    origin,
    path: "/api/products?limit=3&sortBy=createdAt&order=desc",
  });
  const products = Array.isArray(payload?.data) ? payload.data : [];
  assert(products.length > 0, "Product API returned no products");

  const imageUrl = products
    .flatMap((product) => [
      ...(Array.isArray(product?.images) ? product.images : []),
      product?.thumbnail,
      product?.image,
      product?.imageUrl,
    ])
    .map((value) => String(value || "").trim())
    .find(Boolean);

  assert(imageUrl, "Product API returned no image URL to verify");

  const resolvedImageUrl = imageUrl.startsWith("/")
    ? `${backendUrl}${imageUrl}`
    : imageUrl;

  const response = await fetchWithTimeout(resolvedImageUrl, {
    method: "GET",
    redirect: "follow",
  });
  assert(
    response.ok,
    `Product image failed to load with status ${response.status}: ${resolvedImageUrl}`,
  );
};

const verifyAdminLogin = async ({ backendUrl, origin, adminEmail }) => {
  const response = await fetchWithTimeout(`${backendUrl}/api/admin/login`, {
    method: "POST",
    headers: {
      Origin: origin,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: adminEmail,
      password: "__smoke_test_invalid_password__",
      rememberMe: true,
    }),
  });

  assert(
    response.status !== 404,
    "Admin login route returned 404 during smoke test",
  );
  assert(
    response.status < 500,
    `Admin login returned server error status ${response.status}`,
  );
  assert(
    isAllowedCorsOrigin(response, origin),
    `Admin login missing expected CORS headers for ${origin}`,
  );

  const payload = await response.json();
  assert(
    typeof payload?.message === "string" && payload.message.trim(),
    "Admin login response did not include a message",
  );
};

const verifyUserLogin = async ({ backendUrl, origin }) => {
  const response = await fetchWithTimeout(`${backendUrl}/api/user/login`, {
    method: "POST",
    headers: {
      Origin: origin,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "__smoke_test_missing_user__@example.com",
      password: "__smoke_test_invalid_password__",
    }),
  });

  assert(response.status !== 404, "User login route returned 404");
  assert(response.status < 500, `User login returned ${response.status}`);
  assert(
    isAllowedCorsOrigin(response, origin),
    `User login missing expected CORS headers for ${origin}`,
  );
};

const main = async () => {
  const { backendUrl, origins, adminEmail } = parseArgs();
  const normalizedBackendUrl = sanitizeBaseUrl(backendUrl);
  assert(normalizedBackendUrl, "Missing --backend-url");
  assert(origins.length > 0, "At least one --origin is required");

  const normalizedOrigins = origins.map(sanitizeBaseUrl).filter(Boolean);
  const adminOrigin =
    normalizedOrigins.find((origin) => origin.includes("admin")) ||
    normalizedOrigins[0];
  const clientOrigin =
    normalizedOrigins.find((origin) => origin.includes("healthyonegram.com")) ||
    normalizedOrigins[0];

  console.log("[production-smoke-check] Verifying health endpoint");
  await verifyHealthEndpoint({ backendUrl: normalizedBackendUrl });

  for (const normalizedOrigin of normalizedOrigins) {
    console.log(`[production-smoke-check] Verifying CORS for ${normalizedOrigin}`);
    await verifyCorsPreflight({
      backendUrl: normalizedBackendUrl,
      origin: normalizedOrigin,
      path: "/api/admin/login",
      method: "POST",
    });
    await verifyCorsPreflight({
      backendUrl: normalizedBackendUrl,
      origin: normalizedOrigin,
      path: "/api/cart",
      method: "GET",
    });
    await verifyCorsPreflight({
      backendUrl: normalizedBackendUrl,
      origin: normalizedOrigin,
      path: "/api/products",
      method: "GET",
    });
  }

  console.log("[production-smoke-check] Verifying login endpoints");
  await verifyAdminLogin({
    backendUrl: normalizedBackendUrl,
    origin: adminOrigin,
    adminEmail,
  });
  await verifyUserLogin({
    backendUrl: normalizedBackendUrl,
    origin: clientOrigin,
  });

  for (const normalizedOrigin of normalizedOrigins) {
    console.log(
      `[production-smoke-check] Verifying cart/products for ${normalizedOrigin}`,
    );
    await verifyJsonGet({
      backendUrl: normalizedBackendUrl,
      origin: normalizedOrigin,
      path: "/api/cart",
    });
    await verifyJsonGet({
      backendUrl: normalizedBackendUrl,
      origin: normalizedOrigin,
      path: "/api/products",
    });
  }

  console.log("[production-smoke-check] Verifying product image delivery");
  await verifyProductImages({
    backendUrl: normalizedBackendUrl,
    origin: clientOrigin,
  });

  console.log("[production-smoke-check] All smoke checks passed.");
};

main().catch((error) => {
  console.error("[production-smoke-check] Failed:", error?.message || error);
  process.exitCode = 1;
});
