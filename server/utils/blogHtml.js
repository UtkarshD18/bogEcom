const DISALLOWED_BLOG_HTML_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*>/gi,
  /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
  /<base\b[^<]*>/gi,
  /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi,
  /on\w+\s*=\s*(['"]).*?\1/gi,
  /on\w+\s*=\s*[^\s>]+/gi,
  /javascript:/gi,
  /vbscript:/gi,
];

const collapseWhitespace = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeImageCandidate = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^(https?:)?\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith("data:image/")) return normalized;
  if (normalized.startsWith("/")) return normalized;
  return "";
};

const isLikelyBrokenImageCandidate = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return true;

  return [
    "/placeholder/",
    "placeholder=",
    "placeholder.",
    "image-not-found",
    "no-image",
    "not-found",
    "/missing/",
    "/dummy/",
  ].some((token) => normalized.includes(token));
};

export const sanitizeBlogHtmlDocument = (html) => {
  if (typeof html !== "string") return "";

  let sanitized = html;
  for (const pattern of DISALLOWED_BLOG_HTML_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  return sanitized.trim();
};

export const stripTextFromBlogHtml = (html) => {
  if (typeof html !== "string") return "";

  const textOnly = html
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return collapseWhitespace(textOnly);
};

export const extractTitleFromBlogHtml = (html) => {
  if (typeof html !== "string") return "";

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return collapseWhitespace(titleMatch?.[1] || "");
};

export const extractImageCandidatesFromBlogHtml = (html) => {
  if (typeof html !== "string" || !html.trim()) return [];

  const seen = new Set();
  const candidates = [];
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(html))) {
      const candidate = normalizeImageCandidate(match[1]);
      if (
        !candidate ||
        isLikelyBrokenImageCandidate(candidate) ||
        seen.has(candidate)
      ) {
        continue;
      }
      seen.add(candidate);
      candidates.push(candidate);
    }
  });

  return candidates;
};

export const resolveBlogContentFormat = (value, html = "") => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (normalizedValue === "html") return "html";
  if (normalizedValue === "plain") return "plain";
  return String(html || "").trim() ? "html" : "plain";
};
