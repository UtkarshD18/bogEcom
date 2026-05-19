/**
 * Sitemap Generator
 *
 * Next.js 13+ App Router sitemap configuration
 * This generates a sitemap.xml for search engine optimization
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://healthyonegram.com";
const SITEMAP_REVALIDATE_SECONDS = 3600;

const normalizeBaseUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/+$/, "");

export const revalidate = 3600;

export default async function sitemap() {
  // Static pages
  const staticPages = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/blogs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/membership`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/healthy-peanut-butter-guide`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.65,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Try to include admin-managed SEO pages from settings (seoSettings.pages)
  try {
    const apiBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL || BASE_URL);
    const resp = await fetch(`${apiBase}/api/settings/public`, {
      headers: { "content-type": "application/json" },
      next: { revalidate: SITEMAP_REVALIDATE_SECONDS },
    });

    if (resp.ok) {
      const json = await resp.json();
      const seo = json?.data?.seoSettings;
      if (seo && Array.isArray(seo.pages)) {
        const seoPages = seo.pages
          .filter((p) => p && p.indexable !== false)
          .map((p) => ({
            url: `${BASE_URL}${p.path}`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.7,
          }));

        // Merge and dedupe by URL (seo pages can override static defaults)
        const map = new Map();
        [...staticPages, ...seoPages].forEach((entry) => map.set(entry.url, entry));
        return Array.from(map.values());
      }
    }
  } catch (error) {
    // Fail gracefully to static pages only
    if (process.env.NODE_ENV !== "production") {
      console.error("Error fetching seoSettings for sitemap:", error);
    }
  }

  return staticPages;
}
