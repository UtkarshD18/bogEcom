import ThemeProvider from "@/context/ThemeContext";
import { Inter } from "next/font/google";
import ClientLayout from "./ClientLayout";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata = {
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
    type: "website",
    locale: "en_IN",
    siteName: "Healthy One Gram",
  },
  twitter: {
    card: "summary_large_image",
    title: "Healthy One Gram - Premium Peanut Butter Store",
    description:
      "Shop premium quality peanut butter and healthy food products.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className}`}>
        <ThemeProvider>
          <ClientLayout inter={inter}>{children}</ClientLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
