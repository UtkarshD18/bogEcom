const { test, expect } = require("@playwright/test");

const mockHeaderSettings = async (page) => {
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
};

test("search icon submits typed term and navigates to products search URL", async ({
  page,
}) => {
  await mockHeaderSettings(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const searchInput = page.locator(".site-header-desktop-search input").first();
  await expect(searchInput).toBeVisible();

  await searchInput.fill("peanut butter");
  const searchForm = searchInput.locator("xpath=ancestor::form[1]").first();
  const submitButton = searchForm.locator('button[type="submit"]').first();
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page).toHaveURL(/\/products\?search=peanut(\+|%20)butter/);
});
