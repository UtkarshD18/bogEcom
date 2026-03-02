"use client";

import {
  handleRouteChangeTracking,
  initializeBehaviorTracking,
} from "@/utils/analyticsTracker";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

const getPageKey = (pathname, searchParams) => {
  const search = searchParams?.toString() || "";
  return search ? `${pathname}?${search}` : pathname;
};

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageKey = useMemo(
    () => getPageKey(pathname || "/", searchParams),
    [pathname, searchParams],
  );

  useEffect(() => {
    initializeBehaviorTracking().catch(() => {
      // Tracker is best-effort and must never break UI rendering.
    });
  }, []);

  useEffect(() => {
    if (!pageKey) return;
    handleRouteChangeTracking(pageKey);
  }, [pageKey]);

  return null;
}
