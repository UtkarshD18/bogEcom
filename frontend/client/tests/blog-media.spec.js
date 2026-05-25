const { test, expect } = require("@playwright/test");

const posterSvg =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
      <rect width="1200" height="900" fill="#fff7ed"/>
      <rect x="0" y="0" width="1200" height="120" fill="#16a34a"/>
      <rect x="0" y="780" width="1200" height="120" fill="#dc2626"/>
      <text x="70" y="470" font-size="70" fill="#111827">Full blog image must stay visible</text>
    </svg>`,
  );

const buildBlog = (overrides = {}) => ({
  _id: "blog-media-test",
  slug: "blog-media-test",
  title: "Blog Media Test",
  author: "Admin",
  category: "General",
  createdAt: "2026-05-14T00:00:00.000Z",
  excerpt: "Blog media smoke test excerpt.",
  content: "Blog media smoke test content.",
  image: posterSvg,
  mediaType: "image",
  videoUrl: "",
  viewCount: 1,
  isPublished: true,
  ...overrides,
});

const mockBlogApis = async (page, blog) => {
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

  await page.route("**/api/blogs**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace(/\/+$/, "");

    if (pathname.endsWith("/api/blogs/page/public")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ error: false, success: true, data: {} }),
      });
      return;
    }

    if (pathname.endsWith(`/api/blogs/${blog.slug}`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ error: false, success: true, data: blog }),
      });
      return;
    }

    if (pathname.endsWith("/api/blogs")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          error: false,
          success: true,
          data: [blog],
          totalBlogs: 1,
          totalPages: 1,
          currentPage: 1,
        }),
      });
      return;
    }

    await route.continue();
  });
};

test("blog detail media renders images fully and stale video posts as videos", async ({
  page,
}) => {
  const blog = buildBlog({ slug: "blog-image-media-test" });
  await mockBlogApis(page, blog);

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/blogs/${blog.slug}`, { waitUntil: "domcontentloaded" });

    const image = page.locator('img[alt="Blog Media Test"]').first();
    await expect(image).toBeVisible();

    const metrics = await image.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        objectFit: style.objectFit,
        width: rect.width,
        height: rect.height,
      };
    });

    expect(metrics.objectFit).toBe("contain");
    expect(metrics.width).toBeGreaterThan(250);
    expect(metrics.height).toBeLessThanOrEqual(viewport.height * 0.7 + 1);
  }

  await page.unroute("**/api/blogs**");
  await mockBlogApis(
    page,
    buildBlog({
      slug: "blog-video-media-test",
      mediaType: "image",
      videoUrl: "https://example.com/blog-video.mp4",
    }),
  );

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/blogs/blog-video-media-test", { waitUntil: "domcontentloaded" });

  const video = page.locator('video[src="https://example.com/blog-video.mp4"]').first();
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("controls", "");
});

test("blog detail renders imported HTML blog documents inside an article frame", async ({
  page,
}) => {
  const htmlDocument = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Imported Peanut Butter Story</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #111827; }
        h1 { color: #92400e; margin-bottom: 16px; }
        p { line-height: 1.7; }
      </style>
    </head>
    <body>
      <h1>Imported Peanut Butter Story</h1>
      <p>This article was uploaded as a full HTML document.</p>
    </body>
  </html>`;

  await mockBlogApis(
    page,
    buildBlog({
      slug: "blog-imported-html-test",
      contentFormat: "html",
      contentHtml: htmlDocument,
      contentHtmlFileName: "imported-peanut-butter-story.html",
      content:
        "Imported Peanut Butter Story This article was uploaded as a full HTML document.",
      excerpt: "Imported HTML article smoke test.",
      image: "",
    }),
  );

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/blogs/blog-imported-html-test", {
    waitUntil: "domcontentloaded",
  });

  const frame = page.frameLocator(
    'iframe[title="Blog Media Test imported HTML article"]',
  );
  await expect(frame.locator("body")).toContainText(
    "This article was uploaded as a full HTML document.",
  );

  const iframeMetrics = await page
    .locator('iframe[title="Blog Media Test imported HTML article"]')
    .evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
      };
    });

  expect(iframeMetrics.width).toBeGreaterThan(1200);
  expect(iframeMetrics.height).toBeGreaterThan(520);
});
