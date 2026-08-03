"use client";
import { useAdmin } from "@/context/AdminContext";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const MANAGER_ROUTE_PERMISSION_RULES = [
  {
    permission: "manage_users",
    prefixes: ["/users"],
  },
  {
    permission: "view_analytics",
    prefixes: ["/analytics", "/behavior-analytics", "/sales-analytics"],
  },
  {
    permission: "manage_crm",
    prefixes: [
      "/crm",
      "/customer-care",
      "/notifications",
      "/newsletter",
      "/email-templates",
    ],
  },
  {
    permission: "manage_shipping",
    prefixes: ["/orders", "/shipping", "/purchase-orders"],
  },
  {
    permission: "manage_membership",
    prefixes: ["/membership", "/coins"],
  },
];

const resolveRequiredManagerPermission = (pathname) => {
  const normalizedPath = String(pathname || "").trim();
  if (!normalizedPath || normalizedPath === "/") return null;

  for (const rule of MANAGER_ROUTE_PERMISSION_RULES) {
    if (rule.prefixes.some((prefix) => normalizedPath.startsWith(prefix))) {
      return rule.permission;
    }
  }

  return "manage_settings";
};

const Sidebar = dynamic(() => import("@/components/Sidebar"), {
  ssr: false,
  loading: () => (
    <div className="hidden lg:block fixed top-0 left-0 h-screen w-[250px] border-r border-border-light bg-bg-primary" />
  ),
});

const Header = dynamic(() => import("@/components/Header"), {
  ssr: false,
  loading: () => <div className="h-[60px] w-full bg-bg-primary border-b border-border-light shadow-sm" />,
});

const publicPages = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify",
];

const stripAdminBasePath = (pathname) => {
  const normalized = String(pathname || "").trim();
  if (!normalized) return "/";
  if (normalized === "/admin") return "/";
  if (normalized.startsWith("/admin/")) {
    return normalized.slice("/admin".length) || "/";
  }
  return normalized;
};

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, loading, isAuthenticated, hasPermission } = useAdmin();
  const normalizedPathname = useMemo(
    () => stripAdminBasePath(pathname),
    [pathname],
  );
  const isPublicPage = publicPages.some((p) =>
    normalizedPathname.startsWith(p),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isManager =
    String(admin?.role || "")
      .trim()
      .toLowerCase() === "manager";
  const requiredPermission = useMemo(
    () => resolveRequiredManagerPermission(normalizedPathname),
    [normalizedPathname],
  );
  const hasRoutePermission =
    !isManager || !requiredPermission || hasPermission(requiredPermission);

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

  useEffect(() => {
    if (!loading && !isAuthenticated && !isPublicPage) {
      router.replace("/login");
    }
  }, [isAuthenticated, isPublicPage, loading, router]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-border-light border-t-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-border-light border-t-primary" />
      </div>
    );
  }

  if (!hasRoutePermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary px-4">
        <div className="max-w-md w-full rounded-xl border border-error/20 bg-bg-primary p-6 text-center shadow-card">
          <h1 className="text-lg font-semibold text-text-primary">
            Access Restricted
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            You do not have permission to open this admin module.
          </p>
        </div>
      </div>
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
      <div className="flex-1 min-h-screen bg-bg-secondary lg:ml-[250px]">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        {children}
      </div>
    </div>
  );
}
