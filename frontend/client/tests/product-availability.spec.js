const { test, expect } = require("@playwright/test");

const mockCommonPublicApis = async (page) => {
  await page.route("**/api/settings/header", async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        error: false,
        success: true,
        data: { headerBackgroundColor: "#fffbf5" },
      }),
    });
  });

  await page.route("**/api/settings/public", async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        error: false,
        success: true,
        data: {
          showOfferPopup: false,
          offerCouponCode: "",
        },
      }),
    });
  });

  await page.route("**/api/policies/public", async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        error: false,
        success: true,
        data: [],
      }),
    });
  });

  await page.route("**/api/settings/maintenance-status", async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        error: false,
        success: true,
        data: {
          enabled: false,
        },
      }),
    });
  });

  await page.route("**/api/popup/active", async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        error: false,
        success: true,
        data: null,
      }),
    });
  });
};

test("products page renders reserved stock as unavailable and blocks purchase", async ({
  page,
}) => {
  await mockCommonPublicApis(page);
  let notifyRequestBody = null;

  await page.route("**/api/notifications/stock", async (route, request) => {
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    notifyRequestBody = request.postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        error: false,
        success: true,
        message: "We’ll let you know as soon as this is back in stock.",
        data: {
          requested: true,
          alreadyRegistered: false,
          notificationId: "notify-1",
        },
      }),
    });
  });

  await page.route("**/api/products**", async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        error: false,
        success: true,
        totalProducts: 2,
        totalPages: 1,
        data: [
          {
            _id: "product-reserved",
            name: "Reserved Peanut Butter",
            brand: "Buy One Gram",
            price: 349,
            originalPrice: 399,
            discount: 13,
            rating: 4.8,
            reviewCount: 11,
            images: ["/product_1.webp"],
            stock_quantity: 1,
            reserved_quantity: 1,
            available_quantity: 0,
            available_stock: 0,
            availableStock: 0,
            inStock: false,
          },
          {
            _id: "product-last-unit",
            name: "Last Unit Peanut Butter",
            brand: "Buy One Gram",
            price: 399,
            originalPrice: 449,
            discount: 11,
            rating: 4.6,
            reviewCount: 8,
            images: ["/product_1.webp"],
            stock_quantity: 1,
            reserved_quantity: 0,
            available_quantity: 1,
            available_stock: 1,
            availableStock: 1,
            inStock: true,
          },
        ],
      }),
    });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/products", { waitUntil: "domcontentloaded" });

  const reservedCard = page.locator(
    '[data-product-card-id="product-reserved"]',
  );
  await expect(page.getByText("Few products are out of stock")).toBeVisible();
  await expect(reservedCard).toContainText("Reserved Peanut Butter");
  await expect(reservedCard).toContainText("Out of stock");
  await expect(reservedCard).toContainText("We're restocking soon");
  await reservedCard
    .getByRole("button", { name: "Notify me when back in stock" })
    .click();

  await page.getByLabel("Email address").fill("guest-alert@example.com");
  await page.getByRole("button", { name: "Notify me" }).click();

  await expect(
    reservedCard.getByRole("button", { name: "You’ll be notified" }),
  ).toBeVisible();
  expect(notifyRequestBody).toEqual({
    productId: "product-reserved",
    variantId: null,
    email: "guest-alert@example.com",
  });

  const lastUnitCard = page.locator(
    '[data-product-card-id="product-last-unit"]',
  );
  const reservedBox = await reservedCard.boundingBox();
  const lastUnitBox = await lastUnitCard.boundingBox();
  expect(reservedBox?.y).toBeGreaterThan(lastUnitBox?.y || 0);
  await expect(lastUnitCard).toContainText("Only 1 left");
  await expect(
    lastUnitCard.getByLabel("Add Last Unit Peanut Butter to cart"),
  ).toBeEnabled();
});

test("pay-order page shows active reservation countdown from backend response", async ({
  page,
}) => {
  await mockCommonPublicApis(page);

  await page.route("**/api/orders/payment-status", async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          paymentEnabled: true,
          enabledProviders: ["PAYTM"],
          defaultProvider: "PAYTM",
        },
      }),
    });
  });

  await page.route("**/api/orders/pay-order/order-123?key=payment-key", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          orderId: "order-123",
          displayOrderId: "BOG-ORDER-123",
          payable: true,
          paymentStatus: "pending",
          reservationStatus: "reserved",
          reservationSecondsRemaining: 210,
          totals: {
            subtotal: 349,
            discount: 0,
            tax: 17.45,
            shipping: 0,
            finalAmount: 366.45,
          },
        },
      }),
    });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/pay-order/order-123?key=payment-key", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByText("Items are reserved for you for")).toBeVisible();
  await expect(page.getByText("03:30")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pay Now" }),
  ).toBeEnabled();
});
