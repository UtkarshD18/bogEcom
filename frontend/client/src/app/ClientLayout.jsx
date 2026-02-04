"use client";

import ErrorBoundary from "@/components/ErrorBoundary";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import NotificationHandler from "@/components/NotificationHandler";
import OfferPopup from "@/components/OfferPopup";
import { CartProvider } from "@/context/CartContext";
import { ProductProvider } from "@/context/ProductContext";
import { ReferralProvider } from "@/context/ReferralContext";
import { SettingsProvider } from "@/context/SettingsContext";
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
      <SettingsProvider>
        <ReferralProvider>
          <ProductProvider>
            <CartProvider>
              <WishlistProvider>
                <ErrorBoundary>
                  <Header />
                  <main className="min-h-screen pt-[130px] md:pt-[110px] overflow-x-hidden w-full">
                    {children}
                  </main>
                  <Footer />
                  {/* Offer Popup for guests/users */}
                  <OfferPopup />
                  {/* Foreground notification handler */}
                  <NotificationHandler />
                </ErrorBoundary>
              </WishlistProvider>
            </CartProvider>
          </ProductProvider>
        </ReferralProvider>
      </SettingsProvider>
    </div>
  );
}
