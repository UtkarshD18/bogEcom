const { test, expect } = require("@playwright/test");

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

const readCircleVisualMetrics = async (locator) =>
  locator.evaluate((el) => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: Number.parseFloat(style.borderTopLeftRadius) || 0,
      width: rect.width,
      height: rect.height,
    };
  });

test("desktop >=1600 keeps compact header and white logo circle on dark header color", async ({
  page,
}) => {
  await mockHeaderSettings(page, "#000000");
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
    .toBe("#000000");

  const desktopLogoWidth = await page
    .locator(".site-header-logo-image-desktop")
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(desktopLogoWidth).toBeLessThanOrEqual(110);

  const desktopCircle = page.locator(".site-header-logo-circle-desktop");
  await expect(desktopCircle).toBeVisible();
  const desktopMetrics = await readCircleVisualMetrics(desktopCircle);
  expect(desktopMetrics.backgroundColor).toBe("rgb(255, 255, 255)");
  expect(Math.abs(desktopMetrics.width - desktopMetrics.height)).toBeLessThanOrEqual(1.5);
  expect(desktopMetrics.borderRadius).toBeGreaterThanOrEqual(
    Math.min(desktopMetrics.width, desktopMetrics.height) / 2 - 1,
  );

  await expect(root).toHaveScreenshot("header-desktop-1600.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.08,
  });
});

test("mobile header keeps white circular logo on green header color", async ({
  page,
}) => {
  await mockHeaderSettings(page, "#0a8f3c");
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
    .toBe("#0a8f3c");

  const mobileCircle = page.locator(".site-header-logo-circle-mobile");
  await expect(mobileCircle).toBeVisible();
  const mobileMetrics = await readCircleVisualMetrics(mobileCircle);
  expect(mobileMetrics.backgroundColor).toBe("rgb(255, 255, 255)");
  expect(Math.abs(mobileMetrics.width - mobileMetrics.height)).toBeLessThanOrEqual(1.5);
  expect(mobileMetrics.borderRadius).toBeGreaterThanOrEqual(
    Math.min(mobileMetrics.width, mobileMetrics.height) / 2 - 1,
  );

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
