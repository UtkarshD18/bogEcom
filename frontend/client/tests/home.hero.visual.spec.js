const { test, expect } = require("@playwright/test");

const buildSlidesPayload = () => ({
  error: false,
  success: true,
  data: [
    {
      image: "/slide_1.webp",
      mobileImage: "/slide_1.webp",
      title: "Visual Test Slide",
      subtitle: "Testing hero visual",
      buttonText: "Shop Now",
      buttonLink: "/products",
      backgroundColor: "#f5f5f5",
    },
  ],
});

const mockHomeSlides = async (page) => {
  await page.route("**/api/home-slides", async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildSlidesPayload()),
    });
  });
};

test("desktop hero 16:9 visual", async ({ page }) => {
  await mockHomeSlides(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const hero = page.locator(".homeSlider");
  await expect(hero).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Visual Test Slide" }),
  ).toBeVisible();

  await expect(hero).toHaveScreenshot("home-hero-desktop-1600.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.08,
  });
});

test("mobile hero visual", async ({ page }) => {
  await mockHomeSlides(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const hero = page.locator(".homeSlider");
  await expect(hero).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Visual Test Slide" }),
  ).toBeVisible();

  await expect(hero).toHaveScreenshot("home-hero-mobile-390.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.08,
  });
});
