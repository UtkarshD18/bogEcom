import FlavorThemeProvider from "@/context/ThemeContext";
import ThemeProvider from "@/context/theme-provider";
import { Inter, Poppins } from "next/font/google";
import Script from "next/script";
import ClientLayout from "./ClientLayout.jsx";
import "./globals.css";
import "../styles/themes.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

const siteUrl = String(
  process.env.NEXT_PUBLIC_SITE_URL || "https://healthyonegram.com",
)
  .trim()
  .replace(/^["']|["']$/g, "")
  .replace(/\/+$/, "");
const defaultMetadata = {
  metadataBase: new URL(siteUrl),
  title: "Healthy One Gram - Premium Peanut Butter Store",
  description:
    "Shop premium quality peanut butter and healthy food products at Healthy One Gram. Natural, organic, and delicious options for a healthier lifestyle.",
  keywords:
    "peanut butter, healthy food, organic, natural, protein, healthy one gram",
  authors: [{ name: "Healthy One Gram" }],
  openGraph: {
    title: "Healthy One Gram - Premium Peanut Butter Store",
    description:
      "Shop premium quality peanut butter and healthy food products. Natural, organic, and delicious options for a healthier lifestyle.",
    url: siteUrl,
    type: "website",
    locale: "en_IN",
    siteName: "Healthy One Gram",
    images: [
      {
        url: "/logo-og-v2.png",
        width: 512,
        height: 512,
        alt: "Healthy One Gram",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Healthy One Gram - Premium Peanut Butter Store",
    description:
      "Shop premium quality peanut butter and healthy food products.",
    images: ["/logo-og-v2.png"],
  },
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png", sizes: "32x32" },
      { url: "/logo.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const headerBackgroundBootstrapScript = `(function () {
  try {
    var key = "hog_header_background_color";
    var color = localStorage.getItem(key) || "";
    var valid = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color);
    if (valid) {
      var normalized = color.toLowerCase();
      if (normalized.length === 4) {
        normalized =
          "#" +
          normalized[1] + normalized[1] +
          normalized[2] + normalized[2] +
          normalized[3] + normalized[3];
      }
      document.documentElement.style.setProperty("--header-bg-color", normalized);
    }
  } catch (e) {}
})();`;

export async function generateMetadata({ request }) {
  try {
    const pathname = request?.nextUrl?.pathname || "/";
    const apiBase = process.env.NEXT_PUBLIC_API_URL || siteUrl;
    const resp = await fetch(`${apiBase}/api/settings/public`, { cache: "no-store" });
    if (!resp.ok) return defaultMetadata;
    const json = await resp.json();
    const seo = json?.data?.seoSettings;
    if (seo && Array.isArray(seo.pages)) {
      // Try exact match first, then startsWith
      let page = seo.pages.find((p) => String(p.path || "") === pathname);
      if (!page) {
        page = seo.pages.find((p) => pathname.startsWith(String(p.path || "")) && p.path !== "/");
      }
      if (page) {
        return {
          metadataBase: defaultMetadata.metadataBase,
          title: page.metaTitle || defaultMetadata.title,
          description: page.metaDescription || defaultMetadata.description,
          keywords: page.keywords || defaultMetadata.keywords,
          openGraph: {
            ...defaultMetadata.openGraph,
            title: page.metaTitle || defaultMetadata.openGraph.title,
            description: page.metaDescription || defaultMetadata.openGraph.description,
          },
          robots: { index: Boolean(page.indexable !== false), follow: true },
        };
      }
    }
  } catch (e) {
    // ignore and return defaults
  }

  return defaultMetadata;
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} ${inter.className}`}>
        <Script
          id="header-bg-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: headerBackgroundBootstrapScript }}
        />
        <FlavorThemeProvider>
          <ThemeProvider>
            <ClientLayout inter={inter}>{children}</ClientLayout>
          </ThemeProvider>
        </FlavorThemeProvider>
      </body>
    </html>
  );
}
