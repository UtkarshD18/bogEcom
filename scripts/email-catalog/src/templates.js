import { EMAIL_META } from "./emailTypes.js";

const brand = {
  primary: "#0f766e",
  secondary: "#134e4a",
  ink: "#0f172a",
  lightInk: "#475569",
  border: "#e2e8f0",
  bg: "#f8fafc",
};

const THEME_BY_TYPE = {
  "Email Verification OTP": {
    accent: "#0ea5e9",
    soft: "#e0f2fe",
    cta: "Verify Email",
  },
  "Password Reset OTP": {
    accent: "#f97316",
    soft: "#fff7ed",
    cta: "Reset Password",
  },
  "Order Confirmation": {
    accent: "#22c55e",
    soft: "#f0fdf4",
    cta: "Track Order",
  },
  "Payment Success": {
    accent: "#14b8a6",
    soft: "#f0fdfa",
    cta: "View Receipt",
  },
  "Payment Reminder": {
    accent: "#eab308",
    soft: "#fefce8",
    cta: "Complete Payment",
  },
  "Order Cancelled": {
    accent: "#ef4444",
    soft: "#fef2f2",
    cta: "Reorder Items",
  },
  "Feedback Request": {
    accent: "#8b5cf6",
    soft: "#f5f3ff",
    cta: "Write Feedback",
  },
  "Promotional Email": {
    accent: "#db2777",
    soft: "#fdf2f8",
    cta: "Claim Offer",
  },
  "Newsletter Welcome": {
    accent: "#6366f1",
    soft: "#eef2ff",
    cta: "Read Stories",
  },
  "Support Ticket Update": {
    accent: "#0ea5e9",
    soft: "#f0f9ff",
    cta: "View Ticket",
  },
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wrapper({ title, subtitle, body, footer, accent, soft }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:28px;background:${brand.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${brand.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0;">
        <div style="background:linear-gradient(135deg, ${brand.primary}, ${brand.secondary});padding:18px 22px;border-radius:14px 14px 0 0;color:#fff;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:12px;letter-spacing:1.3px;opacity:0.85;">HEALTHYONEGRAM</div>
            <div style="font-size:16px;font-weight:700;">Fresh choices, delivered with care</div>
          </div>
          <div style="height:44px;width:44px;border-radius:12px;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">HOG</div>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background:#fff;padding:24px 24px 20px;border:1px solid ${brand.border};border-top:none;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${soft};color:${accent};font-size:12px;font-weight:600;letter-spacing:0.4px;">${escapeHtml(subtitle)}</div>
        <h1 style="margin:12px 0 8px;font-size:24px;line-height:1.25;color:${brand.ink};">${escapeHtml(title)}</h1>
        ${body}
      </td>
    </tr>
    <tr>
      <td style="background:#fff;border:1px solid ${brand.border};border-top:none;padding:18px 24px;border-radius:0 0 14px 14px;">
        ${footer}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label, accent, href = "https://healthyonegram.com") {
  return `<a href="${href}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:14px;">${escapeHtml(label)}</a>`;
}

function orderRows(items) {
  return items
    .map(
      (item) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${brand.border};font-size:14px;color:${brand.ink};">${escapeHtml(item.name)}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${brand.border};font-size:14px;color:${brand.lightInk};text-align:center;">${escapeHtml(item.qty)}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${brand.border};font-size:14px;color:${brand.ink};text-align:right;font-weight:600;">${escapeHtml(item.price)}</td>
      </tr>`,
    )
    .join("\n");
}

function buildBody(emailType, data, theme) {
  const commonFooter = `
    <p style="margin:0 0 6px;font-size:13px;color:${brand.lightInk};">Need help? Reach us at <a href="mailto:${data.supportEmail}" style="color:${brand.primary};">${data.supportEmail}</a> or call ${data.supportPhone}</p>
    <p style="margin:0;font-size:12px;color:${brand.lightInk};">HealthyOneGram, Jaipur, Rajasthan</p>
  `;

  switch (emailType) {
    case "Email Verification OTP":
      return {
        body: `
          <p style="margin:0 0 14px;font-size:15px;color:${brand.lightInk};">Hi ${escapeHtml(data.customer_name)}, welcome aboard. Please confirm your email address to secure your account.</p>
          <div style="margin:0 0 18px;background:${theme.soft};border:1px dashed ${theme.accent};padding:16px;border-radius:12px;text-align:center;">
            <div style="font-size:12px;color:${brand.lightInk};letter-spacing:1px;">YOUR OTP</div>
            <div style="font-size:34px;letter-spacing:6px;font-weight:700;color:${theme.accent};margin-top:6px;">${escapeHtml(data.otp)}</div>
            <div style="font-size:12px;color:${brand.lightInk};margin-top:6px;">Valid for 10 minutes</div>
          </div>
          ${ctaButton(theme.cta, theme.accent)}
        `,
        footer: commonFooter,
      };

    case "Password Reset OTP":
      return {
        body: `
          <p style="margin:0 0 14px;font-size:15px;color:${brand.lightInk};">We received a request to reset your password. Use the OTP below to continue.</p>
          <div style="margin-bottom:18px;padding:16px;border-radius:12px;background:${theme.soft};border-left:5px solid ${theme.accent};">
            <div style="font-size:12px;color:${brand.lightInk};">One-time security code</div>
            <div style="font-size:30px;font-weight:700;letter-spacing:5px;color:${theme.accent};margin-top:8px;">${escapeHtml(data.otp)}</div>
          </div>
          ${ctaButton(theme.cta, theme.accent)}
          <p style="margin:12px 0 0;font-size:12px;color:${brand.lightInk};">If you did not request this, you can ignore this email.</p>
        `,
        footer: commonFooter,
      };

    case "Order Confirmation":
      return {
        body: `
          <p style="margin:0 0 12px;font-size:15px;color:${brand.lightInk};">Thanks ${escapeHtml(data.customer_name)}. Your order is confirmed and being prepared.</p>
          <div style="padding:14px;border:1px solid ${brand.border};border-radius:12px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;font-size:14px;">
              <span style="color:${brand.lightInk};">Order number</span><strong>${escapeHtml(data.order_number)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:6px;">
              <span style="color:${brand.lightInk};">Order date</span><strong>${escapeHtml(data.date)}</strong>
            </div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px;">
            <thead>
              <tr>
                <th align="left" style="font-size:12px;color:${brand.lightInk};padding-bottom:8px;">Item</th>
                <th align="center" style="font-size:12px;color:${brand.lightInk};padding-bottom:8px;">Qty</th>
                <th align="right" style="font-size:12px;color:${brand.lightInk};padding-bottom:8px;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${orderRows(data.items)}
            </tbody>
          </table>
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;margin-bottom:16px;">
            <span>Total</span><span>${escapeHtml(data.amount)}</span>
          </div>
          ${ctaButton(theme.cta, theme.accent)}
        `,
        footer: commonFooter,
      };

    case "Payment Success":
      return {
        body: `
          <p style="margin:0 0 14px;font-size:15px;color:${brand.lightInk};">Your payment was successful and your order is now processing.</p>
          <div style="background:${theme.soft};padding:14px;border-radius:12px;border:1px solid #ccfbf1;margin-bottom:16px;">
            <div style="font-size:28px;color:${theme.accent};font-weight:700;">${escapeHtml(data.amount)}</div>
            <div style="font-size:13px;color:${brand.lightInk};margin-top:4px;">Paid via ${escapeHtml(data.payment_method)} on ${escapeHtml(data.date)}</div>
            <div style="font-size:13px;color:${brand.lightInk};margin-top:4px;">Order reference: ${escapeHtml(data.order_number)}</div>
          </div>
          ${ctaButton(theme.cta, theme.accent)}
        `,
        footer: commonFooter,
      };

    case "Payment Reminder":
      return {
        body: `
          <p style="margin:0 0 14px;font-size:15px;color:${brand.lightInk};">Your checkout is almost complete. Please finish payment to secure your selected items.</p>
          <div style="margin-bottom:14px;padding:14px;border-radius:12px;background:${theme.soft};border:1px solid #fde68a;">
            <div style="font-size:14px;color:${brand.lightInk};">Pending amount</div>
            <div style="font-size:28px;font-weight:700;color:${theme.accent};margin-top:4px;">${escapeHtml(data.amount)}</div>
            <div style="font-size:13px;color:${brand.lightInk};margin-top:4px;">Order: ${escapeHtml(data.order_number)}</div>
          </div>
          ${ctaButton(theme.cta, theme.accent)}
        `,
        footer: commonFooter,
      };

    case "Order Cancelled":
      return {
        body: `
          <p style="margin:0 0 14px;font-size:15px;color:${brand.lightInk};">Your order ${escapeHtml(data.order_number)} has been cancelled. Any captured amount will be refunded in 5-7 business days.</p>
          <div style="margin-bottom:16px;padding:14px;border-radius:12px;background:${theme.soft};border-left:5px solid ${theme.accent};">
            <div style="font-size:13px;color:${brand.lightInk};">Cancelled on ${escapeHtml(data.date)}</div>
            <div style="font-size:14px;color:${brand.ink};margin-top:6px;">Reason: Requested by customer</div>
          </div>
          ${ctaButton(theme.cta, theme.accent)}
        `,
        footer: commonFooter,
      };

    case "Feedback Request":
      return {
        body: `
          <p style="margin:0 0 14px;font-size:15px;color:${brand.lightInk};">How was your experience with order ${escapeHtml(data.order_number)}? Your feedback helps us improve each delivery.</p>
          <div style="display:flex;gap:8px;margin-bottom:16px;">
            ${[1, 2, 3, 4, 5]
              .map(
                (star) =>
                  `<div style="height:44px;width:44px;border-radius:10px;background:${theme.soft};display:flex;align-items:center;justify-content:center;color:${theme.accent};font-weight:700;">${star}</div>`,
              )
              .join("")}
          </div>
          ${ctaButton(theme.cta, theme.accent)}
        `,
        footer: commonFooter,
      };

    case "Promotional Email":
      return {
        body: `
          <div style="margin-bottom:14px;padding:18px;border-radius:12px;background:linear-gradient(135deg, ${theme.accent}, #f43f5e);color:#fff;">
            <div style="font-size:12px;letter-spacing:1px;opacity:0.9;">LIMITED TIME OFFER</div>
            <div style="font-size:28px;font-weight:800;margin-top:6px;">20% OFF</div>
            <div style="font-size:14px;margin-top:8px;">Use code <strong>${escapeHtml(data.promo_code)}</strong> before ${escapeHtml(data.expiry_date)}</div>
          </div>
          <p style="margin:0 0 16px;font-size:15px;color:${brand.lightInk};">Curated wellness picks, same-day dispatch, and premium quality guaranteed.</p>
          ${ctaButton(theme.cta, theme.accent)}
        `,
        footer: commonFooter,
      };

    case "Newsletter Welcome":
      return {
        body: `
          <div style="margin:0 0 16px;border-radius:14px;overflow:hidden;border:1px solid #dbe4f0;">
            <div style="background:linear-gradient(90deg, #0b1b4a, #12396b);padding:18px 16px 14px;text-align:center;color:#ffffff;">
              <div style="display:inline-flex;height:42px;width:42px;border-radius:10px;background:#ffffff;color:#0f766e;align-items:center;justify-content:center;font-weight:800;font-size:13px;">HOG</div>
              <div style="font-size:11px;opacity:0.9;margin-top:8px;">Healthy living, trusted choices</div>
            </div>
            <div style="background:linear-gradient(120deg, #112d59, #a8551d);padding:16px;">
              <div style="font-size:34px;line-height:1.1;color:#ffffff;font-weight:800;letter-spacing:0.2px;">New Arrivals Are Here</div>
              <div style="margin-top:6px;font-size:13px;color:#dbeafe;">Hello ${escapeHtml(data.customer_name)}, we just launched something new for you.</div>
              <div style="margin-top:14px;border-radius:10px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);height:170px;padding:8px;box-sizing:border-box;">
                <div style="height:100%;border-radius:8px;background:linear-gradient(135deg, #f8fafc, #e2e8f0);display:flex;align-items:center;justify-content:center;color:#334155;font-weight:700;font-size:16px;">Product Showcase Image</div>
              </div>
            </div>
          </div>
          <p style="margin:0 0 10px;font-size:14px;color:${brand.lightInk};">Discover our latest products made for healthy living. Be the first to try them and share your feedback.</p>
          <div style="margin:0 0 10px;padding:12px;border:1px solid ${brand.border};border-radius:10px;background:#f8fafc;">
            <div style="font-size:14px;font-weight:700;color:${brand.ink};margin-bottom:6px;">Why people love HealthyOneGram</div>
            <ul style="margin:0;padding-left:18px;color:${brand.lightInk};font-size:13px;line-height:1.6;">
              <li>Premium quality products curated for health-focused families.</li>
              <li>Faster delivery and transparent order support.</li>
              <li>Exclusive subscriber-only offers and updates.</li>
            </ul>
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:6px 0;margin:0 0 16px;">
            <tr>
              <td style="width:33.3%;padding:10px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74;vertical-align:top;">
                <div style="font-size:10px;font-weight:700;letter-spacing:0.5px;color:#ea580c;">FRESH PICKS</div>
                <div style="font-size:12px;color:#7c2d12;margin-top:4px;">Curated products updated this week.</div>
              </td>
              <td style="width:33.3%;padding:10px;border-radius:10px;background:#eff6ff;border:1px solid #93c5fd;vertical-align:top;">
                <div style="font-size:10px;font-weight:700;letter-spacing:0.5px;color:#2563eb;">MEMBER PERKS</div>
                <div style="font-size:12px;color:#1e3a8a;margin-top:4px;">Unlock newsletter-only discounts and rewards.</div>
              </td>
              <td style="width:33.3%;padding:10px;border-radius:10px;background:#ecfeff;border:1px solid #67e8f9;vertical-align:top;">
                <div style="font-size:10px;font-weight:700;letter-spacing:0.5px;color:#0891b2;">WELLNESS TIPS</div>
                <div style="font-size:12px;color:#155e75;margin-top:4px;">Practical ideas to stay healthy every day.</div>
              </td>
            </tr>
          </table>
          <div style="text-align:center;">${ctaButton("View New Products", "#c2410c")}</div>
        `,
        footer: commonFooter,
      };

    case "Support Ticket Update":
      return {
        body: `
          <p style="margin:0 0 12px;font-size:15px;color:${brand.lightInk};">Your support case has been updated by our care team.</p>
          <div style="padding:14px;border-radius:12px;background:${theme.soft};border:1px solid #bae6fd;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;font-size:14px;">
              <span style="color:${brand.lightInk};">Ticket ID</span><strong>${escapeHtml(data.ticket_id)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:6px;">
              <span style="color:${brand.lightInk};">Issue</span><strong>${escapeHtml(data.issue_summary)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:6px;">
              <span style="color:${brand.lightInk};">ETA</span><strong>${escapeHtml(data.estimated_resolution)}</strong>
            </div>
          </div>
          ${ctaButton(theme.cta, theme.accent)}
        `,
        footer: commonFooter,
      };

    default:
      return {
        body: `<p style="font-size:15px;color:${brand.lightInk};">This is a generic template preview.</p>`,
        footer: commonFooter,
      };
  }
}

export function buildEmailHtml(emailType, data, fields = []) {
  const theme = THEME_BY_TYPE[emailType] || {
    accent: "#0ea5e9",
    soft: "#e0f2fe",
    cta: "Open",
  };

  const { body, footer } = buildBody(emailType, data, theme);

  const fieldsFooter =
    fields.length > 0
      ? `<p style="margin:12px 0 0;font-size:11px;color:${brand.lightInk};">Detected fields in DOCX: ${escapeHtml(fields.join(", "))}</p>`
      : "";

  return wrapper({
    title: emailType,
    subtitle: `Transactional • ${data.brandName}`,
    body,
    footer: `${footer}${fieldsFooter}`,
    accent: theme.accent,
    soft: theme.soft,
  });
}

export function fileNameForType(emailType) {
  return (
    EMAIL_META[emailType]?.slug ||
    emailType
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}
