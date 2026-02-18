"use client";
import AdminDashboardComponent from "@/app/components/DashboardBoxes/AdminDashboard";
import { useAdmin } from "@/context/AdminContext";
import { getData } from "@/utils/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  FiGrid,
  FiImage,
  FiPackage,
  FiShoppingCart,
  FiUsers,
} from "react-icons/fi";
import { MdOutlineSlideshow } from "react-icons/md";
import { RiVipCrownLine } from "react-icons/ri";

export default function AdminDashboard() {
  const { admin, loading, isAuthenticated, token } = useAdmin();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCategories: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalRevenue: 0,
  });
  const [membershipStats, setMembershipStats] = useState({
    activeMembers: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

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

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchStats();
    }
  }, [isAuthenticated, token, fetchStats]);

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
      name: "Shipping",
      icon: FiPackage,
      href: "/shipping",
      color: "bg-emerald-500",
      description: "Book, track, and manage shipments",
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {admin?.name}!
          </h1>
          <p className="text-blue-100">
            Manage your BuyOneGram store from here.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
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
              <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                <FiShoppingCart className="text-pink-600 text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {loadingStats ? "..." : stats.totalOrders}
                </p>
                <p className="text-sm text-gray-500">Orders</p>
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

        {/* Production Dashboard with Charts & Real Data */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Analytics & Reports
          </h2>
          <AdminDashboardComponent />
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
