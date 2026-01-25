import ErrorBoundary from "@/components/ErrorBoundary";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { CartProvider } from "@/context/CartContext";
import { ProductProvider } from "@/context/ProductContext";
import ThemeProvider from "@/context/ThemeContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
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
          <ProductProvider>
            <CartProvider>
              <WishlistProvider>
                <ErrorBoundary>
                  <Toaster
                    position="top-right"
                    toastOptions={{
                      duration: 3000,
                      style: {
                        background: "#333",
                        color: "#fff",
                      },
                    }}
                  />
                  <Header />
                  <div className="pt-[140px] md:pt-[160px]">{children}</div>
                  <Footer />
                </ErrorBoundary>
              </WishlistProvider>
            </CartProvider>
          </ProductProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
