"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getData, API_BASE_URL } from "@/utils/api";
import OrdersTable from "./OrdersTable";
import SalesChart from "./SalesChart";
import LoadingSpinner from "@/app/components/LoadingSpinner";

const buildApiUrl = (path) => {
  const base = String(API_BASE_URL || "").replace(/\/+$/, "");
  const normalized = path?.startsWith("/") ? path : `/${path || ""}`;
  if (/\/api$/i.test(base) && /^\/api(\/|$)/i.test(normalized)) {
    return base.replace(/\/api$/i, "") + normalized;
  }
  return base + normalized;
};

const formatDateInput = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const buildDefaultRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
  };
};

export default function AdminSalesAnalytics({ token }) {
  const defaults = useMemo(() => buildDefaultRange(), []);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
  });
  const [chartData, setChartData] = useState([]);
  const [chartInterval, setChartInterval] = useState("daily");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [includeRtoExport, setIncludeRtoExport] = useState(false);
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search) params.set("search", search);
    return params.toString();
  }, [startDate, endDate, page, limit, search]);

  const fetchReport = useCallback(async () => {
    if (!token || !startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      setError("Start date must be before end date.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await getData(
        `/api/admin/orders/report?${queryString}`,
        token,
      );
      if (!response?.success) {
        throw new Error(response?.message || "Failed to fetch report");
      }
      setOrders(response?.data?.orders || []);
      setPagination({
        total: response?.data?.pagination?.total || 0,
        totalPages: response?.data?.pagination?.totalPages || 1,
      });
      setChartData(response?.data?.chart?.data || []);
      setChartInterval(response?.data?.chart?.interval || "daily");
    } catch (err) {
      console.error("Sales analytics report error:", err);
      setError(err?.message || "Failed to load sales analytics");
      setOrders([]);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate, queryString]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleExport = async () => {
    if (!token || !startDate || !endDate || exporting) return;
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("startDate", startDate);
      params.set("endDate", endDate);
      if (search) params.set("search", search);
      if (includeRtoExport) params.set("includeRto", "true");
      const url = buildApiUrl(`/api/admin/orders/export?${params.toString()}`);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Export failed");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename =
        match?.[1] ||
        `order-report-${startDate}_to_${endDate}.xlsx`;
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Export failed:", err);
      setError(err?.message || "Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading sales analytics..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sales Analytics</h1>
            <p className="text-sm text-gray-600">
              Monitor confirmed vs RTO orders and export detailed reports.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-600 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setPage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-600 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setPage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-600 mb-1">
                Search
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSearch();
                  }}
                  placeholder="Order ID or Product ID"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[220px]"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100"
                >
                  Apply
                </button>
              </div>
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                <input
                  type="checkbox"
                  checked={includeRtoExport}
                  onChange={(event) => setIncludeRtoExport(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Include RTO orders
              </label>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  exporting
                    ? "bg-gray-200 text-gray-600"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {exporting ? "Exporting..." : "Export to Excel"}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        ) : null}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <SalesChart data={chartData} interval={chartInterval} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <OrdersTable
            orders={orders}
            page={page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
