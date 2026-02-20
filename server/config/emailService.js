import {
  initializeEmailService,
  sendEmail as sendEmailObjectApi,
  sendTemplatedEmail,
  renderEmailTemplate,
} from "../services/EmailService.js";

export { initializeEmailService, sendTemplatedEmail, renderEmailTemplate };

// Backward-compatible and modern signatures:
// - sendEmail({ to, subject, text, html, context, from })
// - sendEmail(to, subject, text, html, options)
export const sendEmail = async (...args) => {
  if (
    args.length === 1 &&
    args[0] &&
    typeof args[0] === "object" &&
    !Array.isArray(args[0])
  ) {
    return sendEmailObjectApi(args[0]);
  }

  const [to, subject, text, html, options = {}] = args;
  return sendEmailObjectApi({
    to,
    subject,
    text,
    html,
    context: options?.context || "legacy",
    from: options?.from || null,
  });
};
