import fssync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import PDFDocument from "pdfkit";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");
const serverRoot = path.join(projectRoot, "server");

const outputDir = path.join(projectRoot, "output");
const screenshotsDir = path.join(projectRoot, "screenshots");
const ORDER_ID_TOKEN = "__ORDER_ID__";
const ORDER_ID_SERIES = {
  prefix: String(process.env.EMAIL_ORDER_ID_PREFIX || "H1G2526"),
  start: Number.parseInt(String(process.env.EMAIL_ORDER_ID_START || "1"), 10),
  width: Number.parseInt(String(process.env.EMAIL_ORDER_ID_WIDTH || "4"), 10),
};

const common = {
  year: "2026",
  site_url: "https://healthyonegram.com",
  products_url: "https://healthyonegram.com/products",
  support_url: "https://healthyonegram.com/support",
  support_contact: "support@healthyonegram.com",
  order_status: "Pending",
  payment_provider: "PhonePe",
  items_text: "Crunchy Peanut Butter",
  subtotal: "INR 499",
  discount: "INR 0",
  taxable_amount: "INR 499",
  tax_amount: "INR 0",
  shipping_amount: "INR 0",
  discount_text: "Flat 20% OFF on selected products",
  valid_until: "Valid till 31 Mar 2026",
  subscriber_email: "piyush@example.com",
};

const jobs = [
  {
    title: "Email Verification OTP",
    htmlFile: "1-verification.html",
    screenshotFile: "1.png",
    render: async () => {
      const mod = await import(
        pathToFileURL(path.join(serverRoot, "utils", "verifyEmailTemplate.js"))
          .href
      );
      const VerificationEmail = mod.default;
      return VerificationEmail("Piyush", "482913");
    },
  },
  {
    title: "Password Reset OTP",
    htmlFile: "2-password-reset.html",
    screenshotFile: "2.png",
    render: async () => {
      const mod = await import(
        pathToFileURL(path.join(serverRoot, "utils", "verifyEmailTemplate.js"))
          .href
      );
      const VerificationEmail = mod.default;
      return VerificationEmail("Piyush", "748291");
    },
  },
  {
    title: "Order Confirmation",
    htmlFile: "3-order-confirmation.html",
    screenshotFile: "3.png",
    useOrderSeries: true,
    template: "orderConfirmation.html",
    data: {
      customer_name: "Piyush",
      order_date: "21 March 2026",
      order_status: "Pending",
      payment_status: "Pending",
      items_text: "Crunchy Peanut Butter",
      final_amount: "INR 499",
      payment_url: `https://healthyonegram.com/pay-order/${ORDER_ID_TOKEN}`,
      payment_cta_label: "Pay Now",
    },
  },
  {
    title: "Payment Success",
    htmlFile: "4-payment-success.html",
    screenshotFile: "4.png",
    useOrderSeries: true,
    template: "orderPaymentSuccess.html",
    data: {
      customer_name: "Piyush",
      order_date: "21 March 2026",
      payment_status: "Paid",
      final_amount: "INR 499",
      action_url: `https://healthyonegram.com/orders/${ORDER_ID_TOKEN}`,
      order_status: "Confirmed",
    },
  },
  {
    title: "Payment Reminder",
    htmlFile: "5-payment-reminder.html",
    screenshotFile: "5.png",
    useOrderSeries: true,
    template: "orderPaymentReminder.html",
    data: {
      customer_name: "Piyush",
      payment_provider: "PhonePe",
      failure_kind: "Failed",
      failure_message: "Transaction declined",
      final_amount: "INR 499",
      action_url: `https://healthyonegram.com/pay-order/${ORDER_ID_TOKEN}`,
      action_label: "Pay Now",
      order_date: "21 March 2026",
    },
  },
  {
    title: "Order Cancelled",
    htmlFile: "6-order-cancelled.html",
    screenshotFile: "6.png",
    useOrderSeries: true,
    template: "orderCancelled.html",
    data: {
      customer_name: "Piyush",
      order_date: "21 March 2026",
      items_text: "Crunchy Peanut Butter",
      order_status: "Cancelled",
    },
  },
  {
    title: "Feedback Request",
    htmlFile: "7-feedback.html",
    screenshotFile: "7.png",
    useOrderSeries: true,
    template: "orderFeedbackRequest.html",
    data: {
      customer_name: "Piyush",
      order_date: "21 March 2026",
      feedback_url: `https://healthyonegram.com/feedback/${ORDER_ID_TOKEN}`,
      delay_days: "3",
    },
  },
  {
    title: "Promotional Email",
    htmlFile: "8-promo.html",
    screenshotFile: "8.png",
    template: "promotionalOffer.html",
    data: {
      customer_name: "Piyush",
      headline: "Flat 20% OFF on Peanut Butter!",
      message:
        "Enjoy your favorite Crunchy Peanut Butter at a discounted price.",
      offer_details: "Use code below to get discount",
      coupon_code: "HOG20",
      cta_label: "Shop Now",
      cta_url: "https://healthyonegram.com",
    },
  },
  {
    title: "Newsletter Welcome",
    htmlFile: "9-newsletter.html",
    screenshotFile: "9.png",
    template: "newsletterConfirmation.html",
    data: {
      site_url: "https://healthyonegram.com",
      year: "2026",
      subscriber_email: "piyush@example.com",
      products_url: "https://healthyonegram.com/products",
    },
  },
  {
    title: "Support Ticket Update",
    htmlFile: "10-support.html",
    screenshotFile: "10.png",
    template: "adminReply.html",
    data: {
      customer_name: "Piyush",
      ticket_id: "TCK12345",
      status: "Resolved",
      updated_at: "21 March 2026",
      admin_reply: "Your issue has been resolved successfully.",
      support_url: "https://healthyonegram.com/support",
    },
  },
];

function logStep(message) {
  console.log(`[email-catalog] ${message}`);
}

function buildOrderId(sequenceValue) {
  const safeWidth =
    Number.isFinite(ORDER_ID_SERIES.width) && ORDER_ID_SERIES.width > 0
      ? ORDER_ID_SERIES.width
      : 4;
  return `${ORDER_ID_SERIES.prefix}/${String(sequenceValue).padStart(safeWidth, "0")}`;
}

async function ensureDirs() {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(screenshotsDir, { recursive: true });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTemplateString(template, data) {
  const safeData = {};
  for (const [key, value] of Object.entries(data || {})) {
    safeData[key] = escapeHtml(value);
  }

  return String(template ?? "").replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_match, key) => {
      return key in safeData ? String(safeData[key]) : "";
    },
  );
}

async function renderExistingTemplate(templateFile, data) {
  const templatePath = path.join(serverRoot, "emails", templateFile);
  const raw = await fs.readFile(templatePath, "utf8");
  return renderTemplateString(raw, data);
}

async function generateHtmlFiles() {
  logStep("Rendering HTML from existing templates");
  logStep(
    `Order ID series: ${ORDER_ID_SERIES.prefix}/` +
      `${String(
        Number.isFinite(ORDER_ID_SERIES.start) ? ORDER_ID_SERIES.start : 1,
      ).padStart(
        Number.isFinite(ORDER_ID_SERIES.width) && ORDER_ID_SERIES.width > 0
          ? ORDER_ID_SERIES.width
          : 4,
        "0",
      )}`,
  );
  const rendered = [];
  let orderSequence = Number.isFinite(ORDER_ID_SERIES.start)
    ? ORDER_ID_SERIES.start
    : 1;

  for (const job of jobs) {
    const htmlPath = path.join(outputDir, job.htmlFile);
    const screenshotPath = path.join(screenshotsDir, job.screenshotFile);
    const generatedOrderId = job.useOrderSeries
      ? buildOrderId(orderSequence)
      : "";

    let html = "";
    if (job.render) {
      html = await job.render();
    } else {
      const mergedData = {
        ...common,
        order_id: generatedOrderId,
        order_number: generatedOrderId,
        ...(job.data || {}),
      };

      for (const key of Object.keys(mergedData)) {
        if (typeof mergedData[key] === "string") {
          mergedData[key] = mergedData[key].replaceAll(
            ORDER_ID_TOKEN,
            generatedOrderId,
          );
        }
      }

      html = await renderExistingTemplate(job.template, {
        ...mergedData,
      });

      if (job.useOrderSeries) {
        orderSequence += 1;
      }
    }

    await fs.writeFile(htmlPath, html, "utf8");
    rendered.push({
      title: job.title,
      html,
      htmlPath,
      screenshotPath,
    });
    logStep(`HTML generated: ${path.relative(projectRoot, htmlPath)}`);
  }

  return rendered;
}

async function takeScreenshots(renderedJobs) {
  logStep("Capturing screenshots with Puppeteer");
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: 600,
      height: 900,
      deviceScaleFactor: 2,
    },
  });

  try {
    for (const item of renderedJobs) {
      const page = await browser.newPage();
      await page.setViewport({ width: 600, height: 900, deviceScaleFactor: 2 });
      await page.setContent(item.html, { waitUntil: "networkidle0" });
      await page.screenshot({ path: item.screenshotPath, fullPage: true });
      await page.close();
      logStep(
        `Screenshot generated: ${path.relative(projectRoot, item.screenshotPath)}`,
      );
    }
  } finally {
    await browser.close();
  }
}

function drawFooter(doc, pageText) {
  const y = doc.page.height - doc.page.margins.bottom - 12;
  doc
    .fillColor("#64748b")
    .fontSize(10)
    .text(pageText, doc.page.margins.left, y, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      align: "center",
    });
}

function buildPdf(renderedJobs) {
  const pdfPath = path.join(outputDir, "email-catalog.pdf");
  logStep("Building PDF catalog");

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fssync.createWriteStream(pdfPath);
    doc.pipe(stream);

    const totalPages = renderedJobs.length + 1;
    let pageIndex = 1;

    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#f0fdfa");
    doc
      .fillColor("#0f766e")
      .fontSize(34)
      .text("HealthyOneGram Email Catalog", 40, 240, {
        width: doc.page.width - 80,
        align: "center",
      });
    doc
      .fillColor("#475569")
      .fontSize(14)
      .text("Generated from existing project templates", 40, 288, {
        width: doc.page.width - 80,
        align: "center",
      });
    drawFooter(doc, `Page ${pageIndex} of ${totalPages}`);

    for (const item of renderedJobs) {
      doc.addPage();
      pageIndex += 1;

      doc
        .fillColor("#0f172a")
        .fontSize(17)
        .text(item.title, 40, 30, {
          width: doc.page.width - 80,
          align: "left",
        });

      const topGap = 72;
      const bottomGap = 52;
      const maxW = doc.page.width - 80;
      const maxH = doc.page.height - topGap - bottomGap;
      const image = doc.openImage(item.screenshotPath);
      const scale = Math.min(maxW / image.width, maxH / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const x = (doc.page.width - width) / 2;

      doc.image(item.screenshotPath, x, topGap, { width, height });
      drawFooter(doc, `Page ${pageIndex} of ${totalPages}`);
    }

    doc.end();
    stream.on("finish", () => {
      logStep(`PDF generated: ${path.relative(projectRoot, pdfPath)}`);
      resolve(pdfPath);
    });
    stream.on("error", reject);
  });
}

async function main() {
  logStep("Starting existing-template email catalog generation");
  await ensureDirs();
  const renderedJobs = await generateHtmlFiles();
  await takeScreenshots(renderedJobs);
  const pdfPath = await buildPdf(renderedJobs);
  logStep(`Done. Output PDF: ${pdfPath}`);
}

main().catch((error) => {
  console.error("[email-catalog] Failed:", error);
  process.exit(1);
});
