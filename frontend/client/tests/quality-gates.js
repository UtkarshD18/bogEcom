const { expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

function setupQualityGates(page) {
  // 1. Console Errors & Unhandled Exception Checks
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") {
      // Exclude expected mocked warning messages or browser logs
      if (
        !text.includes("Demo Mode") && 
        !text.includes("Firebase") && 
        !text.includes("PhonePe") &&
        !text.includes("Paytm") &&
        !text.includes("API key") &&
        !text.includes("socket.io") &&
        !text.includes("CORS") &&
        !text.includes("net::ERR_FAILED") &&
        !text.includes("Failed to load resource") &&
        !text.includes("hydration") &&
        !text.includes("hydrated") &&
        !text.includes("mismatch")
      ) {
        throw new Error(`Browser console error detected: ${text}`);
      }
    }
  });

  page.on("pageerror", (err) => {
    throw new Error(`Browser unhandled exception: ${err.message}\nStack:\n${err.stack}`);
  });

  // 2. Failed Request & CORS Checks
  page.on("requestfailed", (request) => {
    const url = request.url();
    const failure = request.failure();
    // Ignore normal aborts, socket.io, or external image CDN connection issues
    if (
      url.includes("socket.io") || 
      url.includes("unsplash.com") || 
      url.includes("cloudinary.com")
    ) {
      return;
    }
    if (
      failure && 
      (failure.errorText === "net::ERR_ABORTED" || 
       failure.errorText.includes("ORB") || 
       failure.errorText.includes("BLOCKED_BY"))
    ) {
      return;
    }
    if (failure) {
      throw new Error(`Network request failed: ${url} - Error: ${failure.errorText}`);
    }
  });

  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    // Fail on 500 errors on API routes
    if (status === 500 && url.includes("/api/")) {
      throw new Error(`Server returned 500 status for: ${url}`);
    }
  });
}

// 3. Broken Image & Asset Detection
async function checkBrokenAssets(page) {
  // Check images
  const images = page.locator("img");
  const imgCount = await images.count();
  for (let i = 0; i < imgCount; i++) {
    const img = images.nth(i);
    const isVisible = await img.isVisible();
    if (isVisible) {
      const isBroken = await img.evaluate((el) => {
        if (!el.src) return true;
        if (el.complete) {
          return typeof el.naturalWidth === "undefined" || el.naturalWidth === 0;
        }
        return false;
      });
      if (isBroken) {
        const src = await img.getAttribute("src");
        if (
          src && 
          (src.includes("product-default.webp") || 
           src.includes("/api/media/gcs") || 
           src.includes("default"))
        ) {
          continue;
        }
        throw new Error(`Broken image detected: ${src}`);
      }
    }
  }
}

async function checkNoLoadingDeadEnds(page) {
  const selectors = [
    '[class*="spinner"]',
    '[class*="loading"]',
    '[class*="skeleton"]',
    'text="Loading..."'
  ];
  for (const sel of selectors) {
    const loaders = page.locator(sel);
    const count = await loaders.count();
    for (let i = 0; i < count; i++) {
      const loader = loaders.nth(i);
      const isVisible = await loader.isVisible();
      if (isVisible) {
        await expect(loader).toBeHidden({ timeout: 10000 }).catch(() => {
          throw new Error(`Page remains indefinitely in a loading state matching selector: ${sel}`);
        });
      }
    }
  }
}

// 5. Responsive Layout Overflow check
async function checkResponsiveOverflow(page) {
  const isOverflowing = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  if (isOverflowing) {
    throw new Error(`Responsive overflow layout issue: horizontal scroll detected on viewport width ${page.viewportSize().width}`);
  }
}

// 6. Navigation Link Health check
async function checkNavigationHealth(page) {
  const navLinks = page.locator("nav a, footer a");
  const count = await navLinks.count();
  const checkedHrefs = new Set();
  for (let i = 0; i < count && checkedHrefs.size < 5; i++) {
    const link = navLinks.nth(i);
    const href = await link.getAttribute("href");
    if (href && !href.startsWith("#") && !href.startsWith("http") && !checkedHrefs.has(href)) {
      checkedHrefs.add(href);
      const isVisible = await link.isVisible();
      if (isVisible) {
        expect(href).toMatch(/^\/[a-zA-Z0-9\-_/]*$/);
      }
    }
  }
}

// 7. Visual Portfolio Screenshot Automation
async function capturePortfolioScreenshot(page, project, viewportName, pageName) {
  const targetDir = path.join("/home/shadow/projects/screenshots", project, viewportName);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const filename = `${viewportName}-${pageName}.png`;
  const targetPath = path.join(targetDir, filename);
  await page.screenshot({ path: targetPath, fullPage: true });
  console.log(`📸 Screenshot captured: ${targetPath}`);
}

module.exports = {
  setupQualityGates,
  checkBrokenAssets,
  checkNoLoadingDeadEnds,
  checkResponsiveOverflow,
  checkNavigationHealth,
  capturePortfolioScreenshot,
};
