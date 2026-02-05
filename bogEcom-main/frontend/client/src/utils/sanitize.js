/**
 * HTML Sanitization Utility
 *
 * SECURITY: Sanitizes HTML content to prevent XSS attacks.
 * Removes potentially dangerous tags and attributes while preserving
 * safe formatting (bold, italic, lists, paragraphs, links).
 */

// Allowed HTML tags for rich content
const ALLOWED_TAGS = [
  "p",
  "br",
  "b",
  "i",
  "u",
  "strong",
  "em",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "div",
  "blockquote",
  "pre",
  "code",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "hr",
  "sup",
  "sub",
];

// Allowed attributes per tag
const ALLOWED_ATTRIBUTES = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height"],
  span: ["class", "style"],
  div: ["class", "style"],
  p: ["class", "style"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
};

// Dangerous patterns to remove
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*>/gi,
  /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /data:/gi,
  /on\w+\s*=/gi, // Event handlers like onclick=, onerror=
  /expression\s*\(/gi, // CSS expressions
];

/**
 * Sanitizes HTML string by removing dangerous content
 * @param {string} html - Raw HTML string
 * @returns {string} Sanitized HTML string
 */
export function sanitizeHTML(html) {
  if (!html || typeof html !== "string") {
    return "";
  }

  let sanitized = html;

  // Remove dangerous patterns
  DANGEROUS_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, "");
  });

  // Create a temporary DOM element to parse and sanitize
  if (typeof window !== "undefined" && window.DOMParser) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(sanitized, "text/html");

      // Remove disallowed tags
      const allElements = doc.body.getElementsByTagName("*");
      const toRemove = [];

      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        const tagName = el.tagName.toLowerCase();

        if (!ALLOWED_TAGS.includes(tagName)) {
          toRemove.push(el);
          continue;
        }

        // Remove disallowed attributes
        const allowedAttrs = ALLOWED_ATTRIBUTES[tagName] || [];
        const attrs = Array.from(el.attributes);

        attrs.forEach((attr) => {
          if (!allowedAttrs.includes(attr.name.toLowerCase())) {
            el.removeAttribute(attr.name);
          } else {
            // Additional validation for href/src
            if (attr.name === "href" || attr.name === "src") {
              const value = attr.value.toLowerCase().trim();
              if (
                value.startsWith("javascript:") ||
                value.startsWith("vbscript:") ||
                value.startsWith("data:")
              ) {
                el.removeAttribute(attr.name);
              }
            }
            // Sanitize style attribute
            if (attr.name === "style") {
              const styleValue = attr.value.toLowerCase();
              if (
                styleValue.includes("expression") ||
                styleValue.includes("javascript") ||
                styleValue.includes("url(")
              ) {
                el.removeAttribute(attr.name);
              }
            }
          }
        });

        // Force safe link targets
        if (tagName === "a") {
          el.setAttribute("rel", "noopener noreferrer");
          if (el.getAttribute("target") === "_blank") {
            // Already safe with rel attribute
          }
        }
      }

      // Remove elements marked for deletion (replace with text content)
      toRemove.forEach((el) => {
        if (el.parentNode) {
          const text = document.createTextNode(el.textContent || "");
          el.parentNode.replaceChild(text, el);
        }
      });

      sanitized = doc.body.innerHTML;
    } catch (e) {
      // If DOM parsing fails, fall back to pattern removal only
      console.warn(
        "HTML sanitization DOM parsing failed, using pattern-only sanitization",
      );
    }
  }

  return sanitized;
}

/**
 * Strips all HTML tags, returning plain text only
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
export function stripHTML(html) {
  if (!html || typeof html !== "string") {
    return "";
  }

  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, "");

  // Decode HTML entities
  if (typeof window !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    text = textarea.value;
  }

  return text.trim();
}

export default sanitizeHTML;
