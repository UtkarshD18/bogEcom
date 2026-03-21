import puppeteer from "puppeteer";

export async function renderScreenshots(items, screenshotDir) {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: 600,
      height: 900,
      deviceScaleFactor: 2,
    },
  });

  try {
    for (const item of items) {
      const page = await browser.newPage();
      await page.setViewport({ width: 600, height: 900, deviceScaleFactor: 2 });
      await page.setContent(item.html, { waitUntil: "networkidle0" });
      await page.screenshot({ path: item.screenshotPath, fullPage: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  return items;
}
