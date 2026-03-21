export const REQUIRED_EMAIL_ORDER = [
  "Email Verification OTP",
  "Password Reset OTP",
  "Order Confirmation",
  "Payment Success",
  "Payment Reminder",
  "Order Cancelled",
  "Feedback Request",
  "Promotional Email",
  "Newsletter Welcome",
  "Support Ticket Update",
];

export const EMAIL_TYPE_DEFINITIONS = [
  {
    name: "Email Verification OTP",
    slug: "email-verification-otp",
    aliases: [
      "email verification otp",
      "verification otp",
      "verify email otp",
      "email otp",
    ],
  },
  {
    name: "Password Reset OTP",
    slug: "password-reset-otp",
    aliases: [
      "password reset otp",
      "reset password otp",
      "forgot password otp",
    ],
  },
  {
    name: "Order Confirmation",
    slug: "order-confirmation",
    aliases: ["order confirmation", "order confirmed"],
  },
  {
    name: "Payment Success",
    slug: "payment-success",
    aliases: ["payment success", "payment successful"],
  },
  {
    name: "Payment Reminder",
    slug: "payment-reminder",
    aliases: ["payment reminder", "pending payment"],
  },
  {
    name: "Order Cancelled",
    slug: "order-cancelled",
    aliases: ["order cancelled", "order canceled", "cancellation"],
  },
  {
    name: "Feedback Request",
    slug: "feedback-request",
    aliases: ["feedback request", "rate your order", "review request"],
  },
  {
    name: "Promotional Email",
    slug: "promotional-email",
    aliases: ["promotional email", "promotion", "offer email"],
  },
  {
    name: "Newsletter Welcome",
    slug: "newsletter-welcome",
    aliases: ["newsletter welcome", "welcome newsletter"],
  },
  {
    name: "Support Ticket Update",
    slug: "support-ticket-update",
    aliases: ["support ticket update", "ticket update", "support update"],
  },
];

export const EMAIL_META = Object.fromEntries(
  EMAIL_TYPE_DEFINITIONS.map((item) => [item.name, item]),
);
