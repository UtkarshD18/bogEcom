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
    <>
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
              <div className="pt-4">{children}</div>
              <Footer />
            </ErrorBoundary>
          </WishlistProvider>
        </CartProvider>
      </ProductProvider>
    </>
  );
}
