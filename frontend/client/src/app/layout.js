import FlavorThemeProvider from "@/context/ThemeContext";
import ThemeProvider from "@/context/theme-provider";
import { Inter, Poppins } from "next/font/google";
import ClientLayout from "./ClientLayout";
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

export const metadata = {
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

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${poppins.variable} ${inter.className}`}>
        <FlavorThemeProvider>
          <ThemeProvider>
            <ClientLayout inter={inter}>{children}</ClientLayout>
          </ThemeProvider>
        </FlavorThemeProvider>
      </body>
    </html>
  );
}
