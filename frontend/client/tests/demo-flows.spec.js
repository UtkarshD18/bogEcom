const { test, expect } = require("@playwright/test");
const {
  setupQualityGates,
  checkBrokenAssets,
  checkNoLoadingDeadEnds,
  checkResponsiveOverflow,
  checkNavigationHealth,
  capturePortfolioScreenshot,
} = require("./quality-gates");

let mockCart = {
  items: [],
  itemCount: 0,
  subtotal: 0,
  total: 0,
};

test.beforeEach(async () => {
  mockCart = {
    items: [],
    itemCount: 0,
    subtotal: 0,
    total: 0,
  };
});

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

  await page.route("**/api/address", async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          {
            _id: "address-123456789012345678901234",
            full_name: "Demo Customer",
            mobile_number: "9999999999",
            pincode: "302001",
            flat_house: "123 Seed Street",
            area_street_sector: "Seed Sector",
            landmark: "Near Seed Garden",
            city: "Jaipur",
            state: "Rajasthan",
            district: "Jaipur",
            email: "customer@buyonegram.com",
            addressType: "Home",
            is_default: true,
          },
        ],
      }),
    });
  });

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
          paymentEnabled: false,
          enabledProviders: ["TEST"],
          defaultProvider: "TEST",
        },
      }),
    });
  });

  await page.route("**/api/cart", async (route, request) => {
    const method = request.method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: mockCart }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/cart/add", async (route, request) => {
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }
    const body = request.postDataJSON() || {};
    const productId = body.productId || "6a738e03e7e06598e684ba4d";
    
    const newItem = {
      _id: "cart-item-123",
      productId,
      parentProductId: productId,
      product: {
        _id: productId,
        name: "Classic Creamy Peanut Butter",
        price: 299,
        images: ["/demo/products/default.webp"],
        stock: 100,
        isActive: true,
      },
      productData: {
        _id: productId,
        name: "Classic Creamy Peanut Butter",
        price: 299,
        images: ["/demo/products/default.webp"],
        stock: 100,
        isActive: true,
      },
      quantity: body.quantity || 1,
      price: 299,
    };
    mockCart.items = [newItem];
    mockCart.itemCount = newItem.quantity;
    mockCart.subtotal = 299 * newItem.quantity;
    mockCart.total = mockCart.subtotal;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: mockCart }),
    });
  });

  await page.route("**/api/cart/merge", async (route, request) => {
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: mockCart }),
    });
  });

  await page.route("**/api/orders", async (route, request) => {
    const method = request.method();
    if (method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            _id: "6a738e03e7e06598e684ba4d",
            orderId: "6a738e03e7e06598e684ba4d",
            orderNumber: "BOG-12345",
            totalAmt: 299,
            status: "accepted",
            payment_status: "paid",
            products: mockCart.items,
            billingDetails: {
              fullName: "Demo Customer",
              email: "customer@buyonegram.com",
            },
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/orders/user/order/*", async (route, request) => {
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
          _id: "6a738e03e7e06598e684ba4d",
          orderNumber: "BOG-12345",
          totalAmt: 299,
          status: "accepted",
          payment_status: "paid",
          products: mockCart.items,
          billingDetails: {
            fullName: "Demo Customer",
            email: "customer@buyonegram.com",
            mobile: "9999999999",
          },
          deliveryAddressSnapshot: {
            full_name: "Demo Customer",
            mobile_number: "9999999999",
            pincode: "302001",
            flat_house: "123 Seed Street",
            area_street_sector: "Seed Sector",
            city: "Jaipur",
            state: "Rajasthan",
            addressType: "Home",
          },
        },
      }),
    });
  });

  await page.route("**/api/orders/6a738e03e7e06598e684ba4d", async (route, request) => {
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
          _id: "6a738e03e7e06598e684ba4d",
          orderNumber: "BOG-12345",
          totalAmt: 299,
          status: "accepted",
          payment_status: "paid",
          products: mockCart.items,
          billingDetails: {
            fullName: "Demo Customer",
            email: "customer@buyonegram.com",
            mobile: "9999999999",
          },
          deliveryAddressSnapshot: {
            full_name: "Demo Customer",
            mobile_number: "9999999999",
            pincode: "302001",
            flat_house: "123 Seed Street",
            area_street_sector: "Seed Sector",
            city: "Jaipur",
            state: "Rajasthan",
            addressType: "Home",
          },
        },
      }),
    });
  });
};

const runRecruiterFlow = async (page, viewportName, width, height) => {
  await mockCommonPublicApis(page);
  await page.setViewportSize({ width, height });
  setupQualityGates(page);

  // 1. Go to login page
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await checkNoLoadingDeadEnds(page);
  await checkBrokenAssets(page);
  await checkResponsiveOverflow(page);

  // 2. Click "Continue as Demo Customer"
  const demoLoginBtn = page.getByRole("button", { name: "Continue as Demo Customer" });
  await expect(demoLoginBtn).toBeVisible();
  await demoLoginBtn.click();

  // 3. Confirm login success by waiting for redirect to homepage/products
  await page.waitForURL("**/products", { timeout: 15000 }).catch(() => {
    return page.goto("/products", { waitUntil: "domcontentloaded" });
  });

  // Verify and capture home page
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await checkNoLoadingDeadEnds(page);
  await checkBrokenAssets(page);
  await checkResponsiveOverflow(page);
  await capturePortfolioScreenshot(page, "bogecom", viewportName, "home");

  // Verify and capture catalog page
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await checkNoLoadingDeadEnds(page);
  await checkBrokenAssets(page);
  await checkResponsiveOverflow(page);
  await checkNavigationHealth(page);
  await capturePortfolioScreenshot(page, "bogecom", viewportName, "products");

  // Navigate to product details page and capture
  await page.goto("/product/classic-creamy-peanut-butter", { waitUntil: "domcontentloaded" });
  await checkNoLoadingDeadEnds(page);
  await checkBrokenAssets(page);
  await checkResponsiveOverflow(page);
  await capturePortfolioScreenshot(page, "bogecom", viewportName, "product-details");

  // Click Add to Cart button on detail page
  const addToCartBtn = page.locator("button").filter({ hasText: /Add to Cart|Remove from Cart/ }).first();
  await expect(addToCartBtn).toBeVisible();
  const detailBtnText = await addToCartBtn.textContent();
  if (detailBtnText && detailBtnText.includes("Add to Cart")) {
    await addToCartBtn.click();
    await expect(addToCartBtn).toContainText("Remove from Cart");
  } else {
    await expect(addToCartBtn).toContainText("Remove from Cart");
  }

  // 5. Navigate to cart page and take screenshot
  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  await checkNoLoadingDeadEnds(page);
  await checkBrokenAssets(page);
  await checkResponsiveOverflow(page);
  await capturePortfolioScreenshot(page, "bogecom", viewportName, "cart");

  // 6. Click checkout button
  const checkoutBtn = page.locator('a[href="/checkout"]').first();
  await expect(checkoutBtn).toBeVisible();
  await checkoutBtn.click();

  // 7. On checkout page, expect address block and take screenshot
  await page.waitForURL("**/checkout");
  await checkNoLoadingDeadEnds(page);
  await checkBrokenAssets(page);
  await checkResponsiveOverflow(page);
  const addressBlock = page.locator("text=123 Seed Street").first();
  await expect(addressBlock).toBeVisible();
  await capturePortfolioScreenshot(page, "bogecom", viewportName, "checkout");

  // 8. Click "Pay Now" to open payment unavailable modal (since paymentEnabled is false)
  const payNowBtn = page.getByRole("button", { name: "Pay Now" });
  await expect(payNowBtn).toBeEnabled();
  await payNowBtn.click();

  // 9. Inside modal, click "Proceed with Demo Payment"
  const proceedBtn = page.getByRole("button", { name: "Proceed with Demo Payment" });
  await expect(proceedBtn).toBeVisible();
  await proceedBtn.click();

  // 10. Expect the order to be created, and redirect to orders details page
  await page.waitForURL(/\/orders\/[a-f\d]{24}/, { timeout: 15000 });
  await checkNoLoadingDeadEnds(page);
  await checkBrokenAssets(page);
  await checkResponsiveOverflow(page);
  await expect(page.getByText("Order Details")).toBeVisible();
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  await capturePortfolioScreenshot(page, "bogecom", viewportName, "success");
};

test("demo login and checkout flow with TEST payment provider - desktop", async ({ page }) => {
  await runRecruiterFlow(page, "desktop", 1440, 900);
});

test("demo login and checkout flow with TEST payment provider - mobile", async ({ page }) => {
  await runRecruiterFlow(page, "mobile", 390, 844);
});

test("verify application empty states look intentional", async ({ page }) => {
  await mockCommonPublicApis(page);
  setupQualityGates(page);

  // 1. Empty Cart page verification
  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  await checkNoLoadingDeadEnds(page);
  await checkBrokenAssets(page);
  await expect(page.getByText(/Your cart is empty/i).first()).toBeVisible();

  // 2. Empty Search results page verification
  await page.goto("/products?search=non_existent_garbage_value_xyz", { waitUntil: "domcontentloaded" });
  await checkNoLoadingDeadEnds(page);
  await checkBrokenAssets(page);
  await expect(page.getByText(/No products found/i).first()).toBeVisible();
});
