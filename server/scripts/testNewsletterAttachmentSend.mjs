import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import connectDb from "../config/connectDb.js";
import Newsletter from "../models/newsletter.model.js";
import { sendEmail } from "../config/emailService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.resolve(serverRoot, ".env") });

const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zz3kAAAAASUVORK5CYII=";

const buildPdfBuffer = () =>
  Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 56 >>\nstream\nBT /F1 14 Tf 40 90 Td (Newsletter PDF attachment test) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000244 00000 n \n0000000352 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n422\n%%EOF\n`,
    "utf8",
  );

const run = async () => {
  await connectDb();

  const subscriber = await Newsletter.findOne({ isActive: true })
    .select("email")
    .lean();

  const fallbackEmail = String(process.env.SUPPORT_ADMIN_EMAIL || "").trim();
  const targetEmail = String(subscriber?.email || fallbackEmail)
    .trim()
    .toLowerCase();

  if (!targetEmail) {
    throw new Error(
      "No active subscriber or SUPPORT_ADMIN_EMAIL found for controlled attachment test.",
    );
  }

  const imageBuffer = Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64");
  const pdfBuffer = buildPdfBuffer();

  const result = await sendEmail({
    to: targetEmail,
    subject: "Controlled attachment test: 1 image + 1 PDF",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
        <h2>Attachment Delivery Test</h2>
        <p>This test includes exactly 2 attachments:</p>
        <ul>
          <li>1 image file</li>
          <li>1 PDF file</li>
        </ul>
      </div>
    `,
    text: "Attachment Delivery Test - includes one image and one PDF.",
    context: "newsletter.attachment.controlled-test",
    attachments: [
      {
        filename: "newsletter-test-image.png",
        content: imageBuffer,
        contentType: "image/png",
      },
      {
        filename: "newsletter-test-file.pdf",
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  console.log(
    JSON.stringify(
      {
        success: Boolean(result?.success),
        targetEmail,
        messageId: result?.messageId || null,
        error: result?.error || null,
        attachmentCount: 2,
      },
      null,
      2,
    ),
  );

  if (!result?.success) {
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    console.error("Controlled attachment test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // noop
    }
  });
