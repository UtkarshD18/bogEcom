import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const templatePath = path.join(
  process.cwd(),
  "emails",
  "orderConfirmation.html",
);
const raw = await fs.readFile(templatePath, "utf8");

const data = {
  customer_name: "Piyush",
  order_number: "H1G2526/0001",
  order_id: "H1G2526/0001",
  order_date: "21 March 2026",
  order_status: "Pending",
  payment_status: "Pending",
  items_text: "Crunchy Peanut Butter",
  subtotal: "INR 499",
  discount: "INR 0",
  taxable_amount: "INR 499",
  tax_amount: "INR 0",
  shipping_amount: "INR 0",
  final_amount: "INR 499",
  payment_url: "https://healthyonegram.com/pay-order/H1G2526/0001",
  payment_cta_label: "Pay Now",
  site_url: "https://healthyonegram.com",
  support_url: "https://healthyonegram.com/support",
  support_contact: "support@healthyonegram.com",
  year: "2026",
};

const html = raw.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) =>
  String(data[key] ?? ""),
);

const host = String(process.env.SMTP_HOST || "smtp.gmail.com").trim();
const port = Number.parseInt(String(process.env.SMTP_PORT || "587"), 10);
const secure =
  String(process.env.SMTP_SECURE || "false")
    .trim()
    .toLowerCase() === "true";
const user = String(process.env.SMTP_USER || process.env.EMAIL || "").trim();
const pass = String(process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || "")
  .replace(/\s+/g, "")
  .trim();
const from = String(
  process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_FROM || user,
).trim();

if (!user || !pass) {
  throw new Error(
    "SMTP credentials not configured: missing SMTP_USER/SMTP_PASS or EMAIL/EMAIL_PASSWORD",
  );
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
});

await transporter.verify();

const info = await transporter.sendMail({
  from,
  to: "piyushsongara69@gmail.com",
  subject: "Demo Order Confirmation - H1G2526/0001",
  html,
});

console.log("EMAIL_SENT");
console.log(`messageId=${info.messageId}`);
