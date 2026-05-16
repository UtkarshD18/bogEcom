"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Toaster } from "react-hot-toast";
import ErrorBoundary from "../components/ErrorBoundary";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { CartProvider } from "../context/CartContext";
import { ProductProvider } from "../context/ProductContext";
import { ReferralProvider } from "../context/ReferralContext";
import { SettingsProvider, useSettings } from "../context/SettingsContext";
import { WishlistProvider } from "../context/WishlistContext";
import { startStockSocket } from "../realtime/stockSocket";
import { API_BASE_URL } from "../utils/api";

const AnalyticsTracker = dynamic(
  () => import("../components/AnalyticsTracker"),
  {
    ssr: false,
    loading: () => null,
  },
);
const CartDrawer = dynamic(() => import("../components/CartDrawer"), {
  ssr: false,
  loading: () => null,
});
const CoinRewardLayer = dynamic(() => import("../components/CoinRewardLayer"), {
  ssr: false,
  loading: () => null,
});
const ManagedPopup = dynamic(() => import("../components/ManagedPopup"), {
  ssr: false,
  loading: () => null,
});
const NotificationHandler = dynamic(
  () => import("../components/NotificationHandler"),
  {
    ssr: false,
    loading: () => null,
  },
);
const OfferPopup = dynamic(() => import("../components/OfferPopup"), {
  ssr: false,
  loading: () => null,
});

const API_URL = String(API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");
const FALLBACK_BRAND_NAME =
  process.env.NEXT_PUBLIC_BRAND_NAME ||
  process.env.NEXT_PUBLIC_STORE_NAME ||
  "HealthyOneGram";
const toPollIntervalMs = (value, fallback) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed >= 10000 ? parsed : fallback;
};
const STATUS_POLL_INTERVAL_MS = toPollIntervalMs(
  process.env.NEXT_PUBLIC_MAINTENANCE_POLL_INTERVAL_MS,
  2 * 60 * 1000,
);
const ACTIVE_STATUS_POLL_INTERVAL_MS = toPollIntervalMs(
  process.env.NEXT_PUBLIC_MAINTENANCE_ACTIVE_POLL_INTERVAL_MS,
  30 * 1000,
);
const COUNTDOWN_TICK_MS = 1000;

const buildStatusUrlCandidates = () => {
  const path = "/api/settings/maintenance-status";
  const urls = [];
  if (API_URL) {
    urls.push(`${API_URL}${path}`);
  }
  urls.push(path);
  return [...new Set(urls)];
};

const resolveBrandName = (storeName) => {
  const candidate = String(storeName || "").trim();
  if (!candidate || /^buyonegram$/i.test(candidate)) {
    return FALLBACK_BRAND_NAME;
  }
  return candidate;
};

const formatDateTimeIST = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const toCountdown = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((unit) => String(unit).padStart(2, "0"));
};

const fetchMaintenanceStatus = async () => {
  const candidates = buildStatusUrlCandidates();
  let lastError = null;

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload?.data) {
        throw new Error(
          payload?.message || `Maintenance status failed (${response.status})`,
        );
      }

      return payload.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to resolve maintenance status");
};

const MaintenanceScreen = ({ brandName, status, loading, remainingTimeMs }) => {
  const countdown = useMemo(
    () => toCountdown(remainingTimeMs),
    [remainingTimeMs],
  );
  const startLabel = formatDateTimeIST(status?.maintenanceStartTime);
  const endLabel = formatDateTimeIST(status?.maintenanceEndTime);

  const title = status?.isScheduled
    ? `${brandName} maintenance is scheduled`
    : `${brandName} is under maintenance`;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-3">{title}</h1>
        <p className="text-gray-600 mb-4">
          {String(status?.message || "").trim() ||
            "We are performing a quick update. Please check back soon."}
        </p>

        {status?.isScheduled && startLabel && (
          <p className="text-sm text-gray-600 mb-3">
            Starts at: <span className="font-medium">{startLabel} (IST)</span>
          </p>
        )}

        {status?.isActive && endLabel && (
          <p className="text-sm text-gray-600 mb-3">
            Expected completion:{" "}
            <span className="font-medium">{endLabel} (IST)</span>
          </p>
        )}

        {status?.isActive &&
          status?.showCountdown &&
          status?.maintenanceEndTime && (
            <div className="bg-gray-100 rounded-xl py-3 px-4 mb-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                Time Remaining
              </p>
              <p className="text-2xl font-semibold text-gray-800">
                {countdown[0]}:{countdown[1]}:{countdown[2]}
              </p>
            </div>
          )}

        <div className="text-sm text-gray-500">
          {loading
            ? "Checking maintenance status..."
            : "Thank you for your patience."}
        </div>
      </div>
    </div>
  );
};

const ClientShell = ({ children, isAffiliateRoute, enhancementsReady }) => {
  const { storeInfo } = useSettings();
  const [maintenanceStatus, setMaintenanceStatus] = useState({
    isMaintenanceMode: false,
    maintenanceEnabled: false,
    isScheduled: false,
    maintenanceStartTime: null,
    maintenanceEndTime: null,
    message: "",
    showCountdown: true,
    remainingTime: null,
  });
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [statusFetchFailed, setStatusFetchFailed] = useState(false);
  const [remainingTimeMs, setRemainingTimeMs] = useState(0);

  const refreshStatus = async () => {
    try {
      const data = await fetchMaintenanceStatus();

      setMaintenanceStatus({
        isMaintenanceMode: !!data.isMaintenanceMode,
        maintenanceEnabled: !!data.maintenanceEnabled,
        isScheduled: !!data.isScheduled,
        maintenanceStartTime: data.maintenanceStartTime || null,
        maintenanceEndTime: data.maintenanceEndTime || null,
        message: String(data.message || "").trim(),
        showCountdown: data.showCountdown !== false,
        remainingTime: Number(data.remainingTime || 0),
      });
      setRemainingTimeMs(Number(data.remainingTime || 0));
      setStatusFetchFailed(false);
    } catch (_error) {
      setMaintenanceStatus({
        isMaintenanceMode: false,
        maintenanceEnabled: false,
        isScheduled: false,
        maintenanceStartTime: null,
        maintenanceEndTime: null,
        message: "",
        showCountdown: true,
        remainingTime: null,
      });
      setRemainingTimeMs(0);
      setStatusFetchFailed(true);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    const safeRefresh = async ({ force = false } = {}) => {
      if (!alive) return;
      if (!force && typeof document !== "undefined" && document.hidden) {
        return;
      }
      await refreshStatus();
    };

    const pollIntervalMs =
      maintenanceStatus?.isMaintenanceMode || maintenanceStatus?.isScheduled
        ? ACTIVE_STATUS_POLL_INTERVAL_MS
        : STATUS_POLL_INTERVAL_MS;

    void safeRefresh({ force: true });
    const pollId = window.setInterval(() => {
      void safeRefresh();
    }, pollIntervalMs);

    const handleFocus = () => {
      void safeRefresh({ force: true });
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void safeRefresh({ force: true });
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      alive = false;
      window.clearInterval(pollId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [maintenanceStatus?.isMaintenanceMode, maintenanceStatus?.isScheduled]);

  useEffect(() => {
    if (
      maintenanceStatus?.isMaintenanceMode &&
      maintenanceStatus?.maintenanceEndTime &&
      remainingTimeMs <= 0
    ) {
      refreshStatus();
    }
  }, [
    maintenanceStatus?.isMaintenanceMode,
    maintenanceStatus?.maintenanceEndTime,
    remainingTimeMs,
  ]);

  useEffect(() => {
    if (
      !maintenanceStatus?.isMaintenanceMode ||
      !maintenanceStatus?.showCountdown
    ) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setRemainingTimeMs((previous) =>
        Math.max(0, previous - COUNTDOWN_TICK_MS),
      );
    }, COUNTDOWN_TICK_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [maintenanceStatus?.isMaintenanceMode, maintenanceStatus?.showCountdown]);

  const showMaintenancePage =
    !isAffiliateRoute &&
    !statusFetchFailed &&
    (maintenanceStatus?.isMaintenanceMode || maintenanceStatus?.isScheduled);

  if (showMaintenancePage) {
    return (
      <MaintenanceScreen
        brandName={resolveBrandName(storeInfo?.name)}
        status={{
          isActive: !!maintenanceStatus?.isMaintenanceMode,
          isScheduled: !!maintenanceStatus?.isScheduled,
          maintenanceStartTime: maintenanceStatus?.maintenanceStartTime,
          maintenanceEndTime: maintenanceStatus?.maintenanceEndTime,
          message: maintenanceStatus?.message,
          showCountdown: maintenanceStatus?.showCountdown,
        }}
        loading={maintenanceLoading}
        remainingTimeMs={remainingTimeMs}
      />
    );
  }

  return (
    <>
      <Header />
      {enhancementsReady ? <CoinRewardLayer /> : null}
      <main
        className="min-h-screen overflow-x-hidden w-full"
        style={{ paddingTop: "var(--header-height, 128px)" }}
      >
        {children}
      </main>
      <Footer />
      {enhancementsReady ? (
        <>
          <ManagedPopup />
          <OfferPopup />
          <NotificationHandler />
        </>
      ) : null}
      <CartDrawer />
    </>
  );
};

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const isAffiliateRoute = pathname?.startsWith("/affiliate");
  const [enhancementsReady, setEnhancementsReady] = useState(false);

  useEffect(() => {
    if (isAffiliateRoute) return;
    startStockSocket();
  }, [isAffiliateRoute]);

  useEffect(() => {
    let disposed = false;
    const markReady = () => {
      if (!disposed) {
        setEnhancementsReady(true);
      }
    };

    if (
      typeof window !== "undefined" &&
      typeof window.requestIdleCallback === "function"
    ) {
      const idleId = window.requestIdleCallback(markReady, { timeout: 1800 });
      return () => {
        disposed = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = window.setTimeout(markReady, 450);
    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

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
        position="top-right"
        toastOptions={{
          duration: 5500,
          style: {
            background: "#472c23",
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
                  {enhancementsReady ? (
                    <Suspense fallback={null}>
                      <AnalyticsTracker />
                    </Suspense>
                  ) : null}
                  <ClientShell
                    isAffiliateRoute={isAffiliateRoute}
                    enhancementsReady={enhancementsReady}
                  >
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
