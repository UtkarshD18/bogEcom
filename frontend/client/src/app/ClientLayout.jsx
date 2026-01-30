"use client";

import ErrorBoundary from "@/components/ErrorBoundary";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { CartProvider } from "@/context/CartContext";
import { ProductProvider } from "@/context/ProductContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { Toaster } from "react-hot-toast";

export default function ClientLayout({ children, inter }) {
  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <style>{`body { font-family: inherit; }`}</style>
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
      <ProductProvider>
        <CartProvider>
          <WishlistProvider>
            <ErrorBoundary>
              <Header />
              <main className="min-h-screen pt-[130px] md:pt-[110px] overflow-x-hidden w-full">
                {children}
              </main>
              <Footer />
            </ErrorBoundary>
          </WishlistProvider>
        </CartProvider>
      </ProductProvider>
    </div>
  );
}
