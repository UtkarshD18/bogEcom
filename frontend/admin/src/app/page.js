"use client";
import AdminDashboardComponent from "@/app/components/DashboardBoxes/AdminDashboard";
import { useAdmin } from "@/context/AdminContext";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useLiveRefreshSetting } from "@/hooks/useLiveRefreshSetting";
import { getData } from "@/utils/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheckCircle,
  FiClock,
  FiGrid,
  FiImage,
  FiPackage,
  FiShoppingCart,
  FiUsers,
  FiXCircle,
} from "react-icons/fi";
import { MdOutlineSlideshow } from "react-icons/md";
import { RiVipCrownLine } from "react-icons/ri";

const MAX_FEED_ITEMS = 30;

const normalizePagePath = (pageUrl) => {
  const value = String(pageUrl || "").trim();
  if (!value) return "-";
  try {
    const parsed = new URL(value);
    return `${parsed.pathname || "/"}${parsed.search || ""}`;
  } catch {
    return value;
  }
};

export default function AdminDashboard() {
  const { admin, loading, isAuthenticated, token } = useAdmin();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCategories: 0,
    totalOrders: 0,
    pendingOrders: 0,
    successfulOrders: 0,
    failedOrders: 0,
    totalUsers: 0,
    totalRevenue: 0,
  });
  const [membershipStats, setMembershipStats] = useState({
    activeMembers: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [liveFeed, setLiveFeed] = useState([]);
  const [livePulse, setLivePulse] = useState({
    lastEventAt: null,
    eventsPerMinute: 0,
    sessionsPerMinute: 0,
    lastUserType: "Guest",
  });
  const pulseBucketsRef = useRef([]);
  const { intervalMs, setIntervalMs, options: refreshOptions } =
    useLiveRefreshSetting();

  const refreshConfig = useMemo(
    () => ({
      minIntervalMs: intervalMs,
      fallbackIntervalMs: Math.max(intervalMs * 30, 30000),
    }),
    [intervalMs],
  );

  const lastEventLabel = useMemo(() => {
    if (!livePulse.lastEventAt) return "Waiting for activity...";
    return new Date(livePulse.lastEventAt).toLocaleTimeString();
  }, [livePulse.lastEventAt]);

  const fetchStats = useCallback(async () => {
    try {
      const [dashboardResponse, membershipResponse] = await Promise.all([
        getData("/api/statistics/dashboard", token),
        getData("/api/admin/membership-analytics", token),
      ]);

      if (dashboardResponse.success) {
        setStats(dashboardResponse.data);
      }

      if (membershipResponse.success) {
        setMembershipStats({
          activeMembers: Number(
            membershipResponse?.data?.summary?.activeMembers || 0,
          ),
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
    setLoadingStats(false);
  }, [token]);

  const { trigger: triggerRefresh } = useLiveRefresh(
    () => {
      fetchStats();
      setRefreshKey((prev) => prev + 1);
    },
    refreshConfig,
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchStats();
    }
  }, [isAuthenticated, token, fetchStats]);

  const handleOrderUpdate = useCallback(() => {
    triggerRefresh();
  }, [triggerRefresh]);

  const handleAnalyticsBatch = useCallback(
    (payload) => {
      const now = Date.now();
      const eventCount = Number(payload?.eventCount || 0);
      const sessionStarts = Number(payload?.eventTypes?.session_start || 0);
      const userType = payload?.userId ? "Logged In" : "Guest";
      const previews = Array.isArray(payload?.eventsPreview)
        ? payload.eventsPreview
        : [];

      if (previews.length > 0) {
        const mapped = previews
          .slice()
          .reverse()
          .map((event, index) => ({
            id: `${event.sessionId || "session"}-${event.timestamp || now}-${index}`,
            eventType: String(event.eventType || "unknown").replace(/_/g, " "),
            page: normalizePagePath(event.pageUrl),
            timestamp: event.timestamp || new Date(now).toISOString(),
            sessionId: event.sessionId || "-",
            userType: event.userId ? "Logged In" : "Guest",
          }));

        setLiveFeed((prev) => {
          const next = [...mapped, ...prev];
          return next.slice(0, MAX_FEED_ITEMS);
        });
      }

      pulseBucketsRef.current = [
        ...pulseBucketsRef.current,
        {
          ts: now,
          events: Number.isFinite(eventCount) ? eventCount : 0,
          sessions: Number.isFinite(sessionStarts) ? sessionStarts : 0,
        },
      ].filter((bucket) => now - bucket.ts <= 60000);

      const aggregate = pulseBucketsRef.current.reduce(
        (acc, bucket) => {
          acc.events += bucket.events;
          acc.sessions += bucket.sessions;
          return acc;
        },
        { events: 0, sessions: 0 },
      );

      setLivePulse({
        lastEventAt: now,
        eventsPerMinute: aggregate.events,
        sessionsPerMinute: aggregate.sessions,
        lastUserType: userType,
      });

      triggerRefresh();
    },
    [triggerRefresh],
  );

  useAdminRealtime({
    token,
    onOrderUpdate: handleOrderUpdate,
    onAnalyticsBatch: handleAnalyticsBatch,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const menuItems = [
    {
      name: "Products",
      icon: FiPackage,
      href: "/products-list",
      color: "bg-blue-500",
      description: "Manage your products",
    },
    {
      name: "Categories",
      icon: FiGrid,
      href: "/category-list",
      color: "bg-green-500",
      description: "Manage categories",
    },
    {
      name: "Home Slides",
      icon: MdOutlineSlideshow,
      href: "/home-slides",
      color: "bg-purple-500",
      description: "Manage homepage slider",
    },
    {
      name: "Banners",
      icon: FiImage,
      href: "/banners",
      color: "bg-orange-500",
      description: "Manage banners",
    },
    {
      name: "Orders",
      icon: FiShoppingCart,
      href: "/orders",
      color: "bg-pink-500",
      description: "View and manage orders",
    },
    {
      name: "Notifications",
      icon: FiUsers,
      href: "/notifications",
      color: "bg-indigo-500",
      description: "Send offer notifications",
    },
    {
      name: "Newsletter",
      icon: FiUsers,
      href: "/newsletter",
      color: "bg-amber-500",
      description: "Manage subscribers",
    },
    {
      name: "Users",
      icon: FiUsers,
      href: "/users",
      color: "bg-cyan-500",
      description: "Manage user accounts",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Main Content */}
      <main className="w-full max-w-none px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {admin?.name || admin?.userName || "Admin"}!
          </h1>
          <p className="text-blue-100">
            Manage your BuyOneGram store from here.
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Live Activity
              </h2>
              <p className="text-xs text-gray-500">
                Real-time updates from guest and logged-in visitors.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Last event: {lastEventLabel}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Events/min</div>
              <div className="text-xl font-bold text-gray-900">
                {livePulse.eventsPerMinute}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Sessions/min</div>
              <div className="text-xl font-bold text-gray-900">
                {livePulse.sessionsPerMinute}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Latest visitor</div>
              <div className="text-xl font-bold text-gray-900">
                {livePulse.lastUserType}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Live refresh</span>
            {refreshOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setIntervalMs(option.value)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                  intervalMs === option.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Live Activity Feed
              </h2>
              <p className="text-xs text-gray-500">
                Latest {MAX_FEED_ITEMS} events from guests and logged-in users.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Refresh: {Math.round(intervalMs / 1000)}s
            </div>
          </div>
          <div className="mt-4 max-h-80 overflow-auto divide-y divide-gray-100">
            {liveFeed.length === 0 ? (
              <div className="text-sm text-gray-500 py-6 text-center">
                Waiting for live events...
              </div>
            ) : (
              liveFeed.map((event) => (
                <div
                  key={event.id}
                  className="py-3 flex flex-wrap items-center gap-3 text-sm text-gray-700"
                >
                  <span className="text-xs text-gray-400 min-w-[90px]">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                    {event.eventType}
                  </span>
                  <span className="text-xs text-gray-500">
                    {event.userType}
                  </span>
                  <span className="text-xs text-gray-500 truncate max-w-[340px]">
                    {event.page}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FiPackage className="text-blue-600 text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {loadingStats ? "..." : stats.totalProducts}
                </p>
                <p className="text-sm text-gray-500">Products</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FiGrid className="text-green-600 text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {loadingStats ? "..." : stats.totalCategories}
                </p>
                <p className="text-sm text-gray-500">Categories</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
                <FiUsers className="text-cyan-600 text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {loadingStats ? "..." : stats.totalUsers}
                </p>
                <p className="text-sm text-gray-500">Users</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <RiVipCrownLine className="text-amber-600 text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {loadingStats ? "..." : membershipStats.activeMembers}
                </p>
                <p className="text-sm text-gray-500">Active Members</p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <Link href="/orders" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                  <FiShoppingCart className="text-pink-600 text-xl" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">
                    {loadingStats ? "..." : stats.totalOrders}
                  </p>
                  <p className="text-sm text-gray-500">Total Orders</p>
                </div>
              </div>
            </div>
          </Link>
          <Link href="/orders?status=pending" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <FiClock className="text-amber-600 text-xl" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">
                    {loadingStats ? "..." : stats.pendingOrders}
                  </p>
                  <p className="text-sm text-gray-500">Pending Orders</p>
                </div>
              </div>
            </div>
          </Link>
          <Link href="/orders?status=successful" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <FiCheckCircle className="text-emerald-600 text-xl" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">
                    {loadingStats ? "..." : stats.successfulOrders}
                  </p>
                  <p className="text-sm text-gray-500">Successful Orders</p>
                </div>
              </div>
            </div>
          </Link>
          <Link href="/orders?status=failed" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center">
                  <FiXCircle className="text-rose-600 text-xl" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">
                    {loadingStats ? "..." : stats.failedOrders}
                  </p>
                  <p className="text-sm text-gray-500">Failed Orders</p>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Production Dashboard with Charts & Real Data */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Analytics & Reports
          </h2>
          <AdminDashboardComponent refreshKey={refreshKey} />
        </div>

        {/* Menu Grid */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 ${item.color} rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform`}
                >
                  <item.icon className="text-xl" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">
                    {item.name}
                  </h3>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
