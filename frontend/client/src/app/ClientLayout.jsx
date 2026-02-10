"use client";

import CartDrawer from "@/components/CartDrawer";
import ErrorBoundary from "@/components/ErrorBoundary";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import NotificationHandler from "@/components/NotificationHandler";
import OfferPopup from "@/components/OfferPopup";
import { CartProvider } from "@/context/CartContext";
import { ProductProvider } from "@/context/ProductContext";
import { ReferralProvider } from "@/context/ReferralContext";
import { SettingsProvider, useSettings } from "@/context/SettingsContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";

const MaintenanceScreen = ({ storeName }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          {storeName || "Store"} is under maintenance
        </h1>
        <p className="text-gray-600 mb-6">
          We are performing a quick update. Please check back soon.
        </p>
        <div className="text-sm text-gray-500">
          Thank you for your patience.
        </div>
      </div>
    </div>
  );
};

const ClientShell = ({ children, isAffiliateRoute }) => {
  const { maintenanceMode, storeInfo } = useSettings();

  if (maintenanceMode && !isAffiliateRoute) {
    return <MaintenanceScreen storeName={storeInfo?.name} />;
  }

  if (isAffiliateRoute) {
    return <main className="min-h-screen bg-gray-50">{children}</main>;
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-[130px] md:pt-[110px] overflow-x-hidden w-full">
        {children}
      </main>
      <Footer />
      <OfferPopup />
      <NotificationHandler />
      <CartDrawer />
    </>
  );
};

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const isAffiliateRoute = pathname?.startsWith("/affiliate");

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      // Reduce client-side debug noise in production
      console.log = () => {};
      console.warn = () => {};
    }
  }, []);

  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <style>{`body { font-family: inherit; }`}</style>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 1800,
          style: {
            background: "#1f2937",
            color: "#fff",
            fontSize: "14px",
            borderRadius: "10px",
            padding: "10px 16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            maxWidth: "340px",
          },
          success: {
            iconTheme: {
              primary: "#059669",
              secondary: "#fff",
            },
          },
        }}
        containerStyle={{
          bottom: 24,
          right: 16,
        }}
      />
      <SettingsProvider>
        <ReferralProvider>
          <ProductProvider>
            <CartProvider>
              <WishlistProvider>
                <ErrorBoundary>
                  <ClientShell isAffiliateRoute={isAffiliateRoute}>
                    {children}
                  </ClientShell>
                </ErrorBoundary>
              </WishlistProvider>
            </CartProvider>
          </ProductProvider>
        </ReferralProvider>
      </SettingsProvider>
    </div>
  );
}
