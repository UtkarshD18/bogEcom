const { test, expect } = require("@playwright/test");

const CONSISTENT_HEADER_COLOR = "#0a8f3c";

const buildHeaderSettingsPayload = (color) => ({
  error: false,
  success: true,
  data: {
    headerBackgroundColor: color,
  },
});

const mockHeaderSettings = async (page, color) => {
  await page.route("**/api/settings/header", async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildHeaderSettingsPayload(color)),
    });
  });
};

const readShieldVisualMetrics = async (locator) =>
  locator.evaluate((el) => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      backgroundColor: style.backgroundColor,
      opacity: Number.parseFloat(style.opacity || "0"),
      borderRadius: Number.parseFloat(style.borderTopLeftRadius) || 0,
      width: rect.width,
      height: rect.height,
    };
  });

test("desktop >=1600 keeps compact header and logo shield on configured color", async ({
  page,
}) => {
  await mockHeaderSettings(page, CONSISTENT_HEADER_COLOR);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const root = page.locator(".site-header-root");
  await expect(root).toBeVisible();

  await expect
    .poll(async () => {
      return page.evaluate(() =>
        window
          .getComputedStyle(document.documentElement)
          .getPropertyValue("--header-bg-color")
          .trim()
          .toLowerCase(),
      );
    })
    .toBe(CONSISTENT_HEADER_COLOR);

  const desktopLogoWidth = await page
    .locator(".site-header-logo-image-desktop")
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(desktopLogoWidth).toBeLessThanOrEqual(110);

  const desktopCircle = page.locator(".site-header-logo-shield-desktop");
  await expect(desktopCircle).toBeVisible();
  await expect
    .poll(async () => {
      const metrics = await readShieldVisualMetrics(desktopCircle);
      return metrics.opacity;
    })
    .toBeGreaterThan(0.9);
  const desktopMetrics = await readShieldVisualMetrics(desktopCircle);
  expect(desktopMetrics.backgroundColor).toBe("rgb(255, 255, 255)");
  expect(desktopMetrics.opacity).toBeGreaterThan(0.9);
  expect(desktopMetrics.borderRadius).toBeGreaterThanOrEqual(
    Math.min(desktopMetrics.width, desktopMetrics.height) / 2 - 1,
  );

  const desktopLogoMetrics = await page
    .locator(".site-header-logo-image-desktop")
    .evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
  expect(desktopMetrics.width).toBeGreaterThanOrEqual(64);
  expect(desktopMetrics.height).toBeGreaterThanOrEqual(64);
  expect(desktopLogoMetrics.width).toBeGreaterThanOrEqual(48);

  await expect(root).toHaveScreenshot("header-desktop-1600.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.08,
  });
});

test("mobile header keeps logo shield behavior on same configured color", async ({
  page,
}) => {
  await mockHeaderSettings(page, CONSISTENT_HEADER_COLOR);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const root = page.locator(".site-header-root");
  await expect(root).toBeVisible();

  await expect
    .poll(async () => {
      return page.evaluate(() =>
        window
          .getComputedStyle(document.documentElement)
          .getPropertyValue("--header-bg-color")
          .trim()
          .toLowerCase(),
      );
    })
    .toBe(CONSISTENT_HEADER_COLOR);

  const mobileCircle = page.locator(".site-header-logo-shield-mobile");
  await expect(mobileCircle).toBeVisible();
  await expect
    .poll(async () => {
      const metrics = await readShieldVisualMetrics(mobileCircle);
      return metrics.opacity;
    })
    .toBeGreaterThan(0.9);
  const mobileMetrics = await readShieldVisualMetrics(mobileCircle);
  expect(mobileMetrics.backgroundColor).toBe("rgb(255, 255, 255)");
  expect(mobileMetrics.opacity).toBeGreaterThan(0.9);
  expect(mobileMetrics.borderRadius).toBeGreaterThanOrEqual(
    Math.min(mobileMetrics.width, mobileMetrics.height) / 2 - 1,
  );

  const mobileLogoMetrics = await page
    .locator(".site-header-logo-image-mobile")
    .evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
  expect(mobileMetrics.width).toBeGreaterThanOrEqual(52);
  expect(mobileMetrics.height).toBeGreaterThanOrEqual(52);
  expect(mobileLogoMetrics.width).toBeGreaterThanOrEqual(34);

  await expect(
    page.locator(
      'input[placeholder="Weight Gainer Peanut Butter"]:visible',
    ).first(),
  ).toBeVisible();

  await expect(root).toHaveScreenshot("header-mobile-390.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.08,
  });
});

test("light header keeps logo shield hidden", async ({ page }) => {
  await mockHeaderSettings(page, "#fffbf5");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const desktopCircle = page.locator(".site-header-logo-shield-desktop");
  await expect(desktopCircle).toBeVisible();
  const shieldMetrics = await readShieldVisualMetrics(desktopCircle);

  expect(shieldMetrics.opacity).toBeLessThan(0.05);
});
