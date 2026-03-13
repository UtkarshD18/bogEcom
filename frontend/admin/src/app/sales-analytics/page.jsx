"use client";

import { useAdmin } from "@/context/AdminContext";
import AdminSalesAnalytics from "@/components/AdminSalesAnalytics";
import LoadingSpinner from "../components/LoadingSpinner";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SalesAnalyticsPage() {
  const { token, isAuthenticated, loading: authLoading } = useAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return <LoadingSpinner label="Loading admin session..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <AdminSalesAnalytics token={token} />;
}
