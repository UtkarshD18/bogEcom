import AdminLayout from "@/components/AdminLayout";
import { AdminProvider } from "@/context/AdminContext";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const adminUrl = String(
  process.env.NEXT_PUBLIC_ADMIN_URL || "https://healthyonegram.com/admin",
)
  .trim()
  .replace(/^["']|["']$/g, "")
  .replace(/\/+$/, "");

export const metadata = {
  metadataBase: new URL(adminUrl),
  title: "BuyOneGram Admin Panel",
  description: "Admin dashboard for BuyOneGram Peanut Butter Store",
  openGraph: {
    title: "BuyOneGram Admin Panel",
    description: "Admin dashboard for BuyOneGram Peanut Butter Store",
    url: adminUrl,
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "BuyOneGram Admin",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BuyOneGram Admin Panel",
    description: "Admin dashboard for BuyOneGram Peanut Butter Store",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AdminProvider>
          <Toaster position="top-right" />
          <AdminLayout>{children}</AdminLayout>
        </AdminProvider>
      </body>
    </html>
  );
}
