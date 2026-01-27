"use client";

import ErrorBoundary from "@/components/ErrorBoundary";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { CartProvider } from "@/context/CartContext";
import { ProductProvider } from "@/context/ProductContext";
import ThemeProvider from "@/context/ThemeContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { Toaster } from "react-hot-toast";

export default function ClientLayout({ children }) {
  return (
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
              <div className="pt-35 md:pt-40">{children}</div>
              <Footer />
            </ErrorBoundary>
          </WishlistProvider>
        </CartProvider>
      </ProductProvider>
    </ThemeProvider>
  );
}
