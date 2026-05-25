const collapseWhitespace = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const deriveExcerpt = (text, maxLength = 150) => {
  const normalized = collapseWhitespace(text);
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;

  const truncated = normalized.slice(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(" ");
  return `${(lastSpaceIndex > 60 ? truncated.slice(0, lastSpaceIndex) : truncated).trim()}...`;
};

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

export const extractImageCandidatesFromBlogHtml = (html) => {
  if (typeof window === "undefined" || !window.DOMParser) {
    return Array.from(
      new Set(
        String(html || "")
          .match(/(?:src|content)=["']([^"']+)["']/gi)
          ?.map((entry) => normalizeImageCandidate(entry.split(/["']/)[1]))
          .filter(Boolean) || [],
      ),
    );
  }

  const parser = new window.DOMParser();
  const documentNode = parser.parseFromString(String(html || ""), "text/html");
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (value) => {
    const candidate = normalizeImageCandidate(value);
    if (!candidate || isLikelyBrokenImageCandidate(candidate) || seen.has(candidate)) {
      return;
    }
    seen.add(candidate);
    candidates.push(candidate);
  };

  pushCandidate(
    documentNode
      .querySelector('meta[property="og:image"]')
      ?.getAttribute("content"),
  );
  pushCandidate(
    documentNode
      .querySelector('meta[name="twitter:image"]')
      ?.getAttribute("content"),
  );
  documentNode.querySelectorAll("img[src]").forEach((imageNode) => {
    pushCandidate(imageNode.getAttribute("src"));
  });

  return candidates;
};

export const readBlogHtmlFile = async (file) => {
  if (!file) {
    throw new Error("No HTML file selected");
  }

  return file.text();
};

export const extractBlogHtmlImportData = (html, fileName = "") => {
  const fallbackTitle = String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

  if (typeof window === "undefined" || !window.DOMParser) {
    const plainText = collapseWhitespace(String(html || "").replace(/<[^>]+>/g, " "));
    return {
      documentTitle: fallbackTitle,
      plainText,
      excerpt: deriveExcerpt(plainText),
    };
  }

  const parser = new window.DOMParser();
  const documentNode = parser.parseFromString(String(html || ""), "text/html");
  const bodyText = collapseWhitespace(documentNode.body?.textContent || "");
  const documentTitle = collapseWhitespace(documentNode.title || fallbackTitle);
  const imageCandidates = extractImageCandidatesFromBlogHtml(html);

  return {
    documentTitle,
    plainText: bodyText,
    excerpt: deriveExcerpt(bodyText),
    imageCandidates,
  };
};
