/**
 * Robots.txt Configuration
 *
 * Next.js 13+ App Router robots configuration
 * This controls search engine crawling behavior
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://healthyonegram.com";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/my-list",
          "/cart",
          "/checkout",
          "/my-orders",
          "/my-profile",
          "/address",
          "/settings",
          "/verify",
          "/reset-password",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
