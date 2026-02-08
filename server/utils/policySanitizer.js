const DISALLOWED_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*>/gi,
  /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
  /on\w+\s*=\s*(['"]).*?\1/gi,
  /on\w+\s*=\s*[^\s>]+/gi,
  /javascript:/gi,
  /vbscript:/gi,
];

export const sanitizePolicyHtml = (html) => {
  if (typeof html !== "string") return "";
  let sanitized = html;
  for (const pattern of DISALLOWED_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }
  return sanitized.trim();
};

export const slugifyPolicyTitle = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export default {
  sanitizePolicyHtml,
  slugifyPolicyTitle,
};
