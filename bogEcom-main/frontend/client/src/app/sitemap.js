/**
 * Sitemap Generator
 *
 * Next.js 13+ App Router sitemap configuration
 * This generates a sitemap.xml for search engine optimization
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://healthyonegram.com";

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

  // Dynamic product pages (fetch from API in production)
  // For now, return static pages only
  // In production, you can fetch products and generate URLs dynamically:
  /*
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products?limit=1000`);
    const data = await response.json();
    
    const productPages = data.data?.products?.map((product) => ({
      url: `${BASE_URL}/product/${product._id}`,
      lastModified: new Date(product.updatedAt || product.createdAt),
      changeFrequency: "weekly",
      priority: 0.8,
    })) || [];
    
    return [...staticPages, ...productPages];
  } catch (error) {
    console.error("Error generating sitemap:", error);
    return staticPages;
  }
  */

  return staticPages;
}
