"use client";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { useAdmin } from "@/context/AdminContext";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const publicPages = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify",
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const { loading, isAuthenticated } = useAdmin();
  const isPublicPage = publicPages.some((p) => pathname.startsWith(p));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      // Reduce client-side debug noise in production
      console.log = () => {};
      console.warn = () => {};
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reloadKey = "hog_admin_chunk_reload_attempted";
    const shouldReload = (message) =>
      /ChunkLoadError|Loading chunk|failed to fetch dynamically imported module|CSS chunk/i.test(
        String(message || ""),
      );

    const attemptReload = () => {
      const attempts = Number(sessionStorage.getItem(reloadKey) || "0");
      if (attempts >= 1) return;
      sessionStorage.setItem(reloadKey, String(attempts + 1));
      window.location.reload();
    };

    const onError = (event) => {
      if (shouldReload(event?.message)) {
        attemptReload();
      }
    };

    const onRejection = (event) => {
      if (shouldReload(event?.reason?.message || event?.reason)) {
        attemptReload();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-gray-200 border-t-[#5a3a2e]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50" aria-hidden="true" />
    );
  }

  return (
    <div className="flex">
      {sidebarOpen ? (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          aria-label="Close navigation overlay"
        />
      ) : null}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-h-screen bg-gray-50 lg:ml-[250px]">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        {children}
      </div>
    </div>
  );
}
