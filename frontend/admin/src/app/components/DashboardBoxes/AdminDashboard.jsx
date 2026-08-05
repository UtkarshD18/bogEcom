import { useAdmin } from "@/context/AdminContext";
import { getDashboardStats } from "@/utils/api";
import { CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FiDollarSign,
  FiShoppingCart,
  FiPackage,
  FiUsers,
  FiAlertTriangle,
} from "react-icons/fi";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function AdminDashboard({ refreshKey = 0 }) {
  const { token } = useAdmin();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = async ({ silent = false } = {}) => {
    if (!token) {
      setLoading(false);
      return;
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await getDashboardStats(token);
      if (res.success) {
        setStats(res.data);
        setError(null);
      } else {
        setError(res.message || "Failed to load stats");
        if (!silent) setStats(null);
      }
    } catch (err) {
      console.error("Dashboard stats error:", err);
      setError(err.message || "Error loading dashboard");
      if (!silent) setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (refreshKey > 0) {
      fetchStats({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (loading) return <CircularProgress />;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!stats) return <div className="text-gray-500 p-4">No data available</div>;

  // Prepare chart data from monthly sales
  const chartData = (stats.monthlySales || []).map((item) => ({
    name: `${item._id.month}/${item._id.year}`,
    Sales: item.total,
    Orders: item.count,
  }));

  return (
    <div className="space-y-8">
      {refreshing ? (
        <div className="text-xs text-[var(--color-text-light)] animate-pulse">Updating live data...</div>
      ) : null}
      
      {/* 5 Premium KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* Card 1: Revenue */}
        <div className="bg-[var(--color-bg-primary)] p-6 rounded-xl border border-[var(--color-bg-tertiary)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-lg bg-[rgba(31,122,99,0.1)] flex items-center justify-center text-[var(--color-secondary)] group-hover:scale-110 transition-transform">
              <FiDollarSign className="text-xl" />
            </div>
            <span className="text-xs font-semibold text-[var(--color-secondary)] bg-[rgba(31,122,99,0.1)] px-2 py-0.5 rounded-full">+14.2%</span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-[var(--color-text-light)]">Total Revenue</h3>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              ₹{stats?.totalRevenue?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-[var(--color-text-light)] mt-2">vs last month</p>
          </div>
        </div>

        {/* Card 2: Orders */}
        <div className="bg-[var(--color-bg-primary)] p-6 rounded-xl border border-[var(--color-bg-tertiary)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center text-[var(--color-accent)] group-hover:scale-110 transition-transform">
              <FiShoppingCart className="text-xl" />
            </div>
            <span className="text-xs font-semibold text-[var(--color-accent)] bg-orange-50 px-2 py-0.5 rounded-full">+8.5%</span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-[var(--color-text-light)]">Total Orders</h3>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              {stats?.totalOrders || 0}
            </p>
            <p className="text-xs text-[var(--color-text-light)] mt-2">vs last week</p>
          </div>
        </div>

        {/* Card 3: Products */}
        <div className="bg-[var(--color-bg-primary)] p-6 rounded-xl border border-[var(--color-bg-tertiary)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <FiPackage className="text-xl" />
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">+3 new</span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-[var(--color-text-light)]">Total Products</h3>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              {stats?.totalProducts || 0}
            </p>
            <p className="text-xs text-[var(--color-text-light)] mt-2">this week</p>
          </div>
        </div>

        {/* Card 4: Users */}
        <div className="bg-[var(--color-bg-primary)] p-6 rounded-xl border border-[var(--color-bg-tertiary)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
              <FiUsers className="text-xl" />
            </div>
            <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">+5.4%</span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-[var(--color-text-light)]">Total Users</h3>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              {stats?.totalUsers || 0}
            </p>
            <p className="text-xs text-[var(--color-text-light)] mt-2">vs last week</p>
          </div>
        </div>

        {/* Card 5: Low Stock */}
        <div className="bg-[var(--color-bg-primary)] p-6 rounded-xl border border-[var(--color-bg-tertiary)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
              (stats?.lowStockCount || 0) > 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
            }`}>
              <FiAlertTriangle className="text-xl" />
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              (stats?.lowStockCount || 0) > 0 ? "bg-red-50 text-red-600 animate-pulse" : "bg-green-50 text-green-600"
            }`}>
              {(stats?.lowStockCount || 0) > 0 ? "Alert" : "Healthy"}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-[var(--color-text-light)]">Low Stock</h3>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              {stats?.lowStockCount || 0}
            </p>
            <Link
              href="/products-list?lowStock=true"
              className="text-xs text-[var(--color-accent)] hover:underline inline-block mt-2 font-semibold focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            >
              View low-stock products →
            </Link>
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-[var(--color-bg-primary)] p-6 rounded-xl border border-[var(--color-bg-tertiary)] shadow-[var(--shadow-sm)]">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Monthly Sales & Orders</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="var(--color-text-light)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--color-text-light)" fontSize={12} tickLine={false} />
                <Tooltip 
                  formatter={(value) => value.toLocaleString()}
                  contentStyle={{
                    backgroundColor: "var(--color-bg-primary)",
                    borderColor: "var(--color-bg-tertiary)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--color-text-primary)"
                  }}
                />
                <Bar dataKey="Sales" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Orders" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-[var(--color-bg-primary)] p-6 rounded-xl border border-[var(--color-bg-tertiary)] shadow-[var(--shadow-sm)]">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Recent Orders</h2>
        {stats.recentOrders && stats.recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] font-semibold">
                  <th className="p-3 text-left">Order ID</th>
                  <th className="p-3 text-left">Customer</th>
                  <th className="p-3 text-left">Amount</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-bg-tertiary)]">
                {stats.recentOrders.map((order) => (
                  <tr key={order._id} className="hover:bg-[var(--color-bg-secondary)] transition-colors">
                    <td className="p-3 text-xs text-[var(--color-text-primary)] font-mono">
                      {order.displayOrderId || order._id?.substring(0, 8) || "N/A"}
                    </td>
                    <td className="p-3 text-[var(--color-text-secondary)]">
                      {order.user?.name || "Unknown"}
                    </td>
                    <td className="p-3 text-[var(--color-text-primary)] font-semibold">
                      ₹{Number(order.displayTotal ?? order.totalAmt ?? 0).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          order.order_status === "delivered"
                            ? "bg-[rgba(31,122,99,0.1)] text-[var(--color-secondary)] border border-[rgba(31,122,99,0.2)]"
                            : order.order_status === "out_for_delivery"
                              ? "bg-teal-50 text-teal-700 border border-teal-100"
                              : order.order_status === "shipped"
                                ? "bg-blue-50 text-blue-700 border border-blue-100"
                                : order.order_status === "in_warehouse"
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                  : ["accepted", "confirmed"].includes(
                                        order.order_status,
                                      )
                                    ? "bg-yellow-50 text-yellow-700 border border-yellow-100"
                                    : "bg-gray-50 text-gray-700 border border-gray-100"
                        }`}
                      >
                        {order.order_status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-[var(--color-text-light)]">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[var(--color-text-light)] text-center py-6">No recent orders</p>
        )}
      </div>
    </div>
  );
}
