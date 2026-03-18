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

const siteUrl = "https://healthyonegram.com";
const logoUrl = `${siteUrl}/logo-og-v2.png`;
const heroImageUrl = `${siteUrl}/logo-header.png`;

const html = `
<div style="margin:0;padding:20px 0;background:#f4f6fb;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:700px;margin:0 auto;font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;background:#ffffff;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:18px 24px;background:#0f172a;text-align:center;">
        <img src="${logoUrl}" alt="HealthyOneGram" style="max-width:180px;height:auto;display:block;margin:0 auto 10px;" />
        <p style="margin:0;color:#d1d5db;font-size:13px;letter-spacing:0.4px;">Healthy living, trusted choices</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0;">
        <div style="background:linear-gradient(135deg,#111827 0%,#1f2937 45%,#c1591c 100%);padding:28px 24px;text-align:left;">
          <h1 style="margin:0 0 10px;color:#ffffff;font-size:34px;line-height:1.25;">Modern Newsletter Design Test</h1>
          <p style="margin:0;color:#f8fafc;font-size:16px;">Hello {{email}}, here is the upgraded newsletter with branding and richer visuals.</p>
          <img src="${heroImageUrl}" alt="HealthyOneGram" style="margin-top:18px;width:100%;max-width:652px;border-radius:12px;display:block;" />
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px 8px;background:#ffffff;">
        <p style="margin:0 0 12px;">This is a controlled render test for the new modern layout.</p>
        <p style="margin:0 0 12px;">The template is intentionally longer so readers naturally scroll through sections.</p>
        <p style="margin:0 0 12px;">It includes branded header, hero block, highlight cards, and action block.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;">
          <tr>
            <td style="padding:16px;">
              <h3 style="margin:0 0 10px;font-size:18px;color:#111827;">Why people love HealthyOneGram</h3>
              <p style="margin:0 0 8px;color:#374151;">• Premium quality products curated for health-focused families.</p>
              <p style="margin:0 0 8px;color:#374151;">• Faster delivery and transparent order support.</p>
              <p style="margin:0;color:#374151;">• Exclusive subscriber-only offers and updates.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="width:33.33%;padding:8px;vertical-align:top;"><div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px;min-height:88px;"><p style="margin:0 0 6px;font-size:12px;color:#9a3412;text-transform:uppercase;letter-spacing:.4px;">Fresh Picks</p><p style="margin:0;color:#7c2d12;font-size:14px;">Curated products updated for this week.</p></div></td>
            <td style="width:33.33%;padding:8px;vertical-align:top;"><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px;min-height:88px;"><p style="margin:0 0 6px;font-size:12px;color:#1d4ed8;text-transform:uppercase;letter-spacing:.4px;">Member Perks</p><p style="margin:0;color:#1e3a8a;font-size:14px;">Unlock newsletter-only discounts & rewards.</p></div></td>
            <td style="width:33.33%;padding:8px;vertical-align:top;"><div style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:10px;padding:12px;min-height:88px;"><p style="margin:0 0 6px;font-size:12px;color:#0e7490;text-transform:uppercase;letter-spacing:.4px;">Wellness Tips</p><p style="margin:0;color:#155e75;font-size:14px;">Practical ideas to stay healthy every day.</p></div></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px 24px;text-align:center;">
        <a href="https://healthyonegram.com/products" style="display:inline-block;background:#c1591c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:15px;">Explore Products</a>
        <p style="margin:10px 0 0;color:#6b7280;font-size:13px;">Tap the button to explore latest products and offers.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 26px;">
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;">
          <p style="margin:0 0 8px;color:#111827;font-size:14px;">Warm wishes, HealthyOneGram Team</p>
          <p style="margin:0;color:#6b7280;font-size:12px;">You are receiving this email because you subscribed at HealthyOneGram.</p>
        </div>
      </td>
    </tr>
  </table>
</div>
`;

const run = async () => {
  await connectDb();
  const subscriber = await Newsletter.findOne({ isActive: true }).select("email").lean();
  const fallbackEmail = String(process.env.SUPPORT_ADMIN_EMAIL || "").trim();
  const targetEmail = String(subscriber?.email || fallbackEmail).trim().toLowerCase();

  if (!targetEmail) {
    throw new Error("No target email found for design test.");
  }

  const result = await sendEmail({
    to: targetEmail,
    subject: "Modern Newsletter Design Test",
    html,
    text: "Modern newsletter design test",
    context: "newsletter.design.test",
  });

  console.log(
    JSON.stringify(
      {
        success: Boolean(result?.success),
        targetEmail,
        messageId: result?.messageId || null,
        error: result?.error || null,
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
    console.error("Design test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // noop
    }
  });
