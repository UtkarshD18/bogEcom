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

export const metadata = {
  title: "BuyOneGram Admin Panel",
  description: "Admin dashboard for BuyOneGram Peanut Butter Store",
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
