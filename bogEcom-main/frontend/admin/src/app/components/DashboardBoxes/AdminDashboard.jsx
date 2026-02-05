import { useAdmin } from "@/context/AdminContext";
import { getDashboardStats } from "@/utils/api";
import { CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function AdminDashboard() {
  const { token } = useAdmin();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    getDashboardStats(token)
      .then((res) => {
        if (res.success) {
          setStats(res.data);
          setError(null);
        } else {
          setError(res.message || "Failed to load stats");
          setStats(null);
        }
      })
      .catch((err) => {
        console.error("Dashboard stats error:", err);
        setError(err.message || "Error loading dashboard");
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

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
    <div className="p-4">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-gray-500 text-sm">Total Revenue</div>
          <div className="text-2xl font-bold text-green-600">
            ₹{stats?.totalRevenue?.toLocaleString() || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-gray-500 text-sm">Total Orders</div>
          <div className="text-2xl font-bold text-blue-600">
            {stats?.totalOrders || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-gray-500 text-sm">Total Products</div>
          <div className="text-2xl font-bold text-purple-600">
            {stats?.totalProducts || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-gray-500 text-sm">Total Users</div>
          <div className="text-2xl font-bold text-orange-600">
            {stats?.totalUsers || 0}
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-white p-4 rounded shadow mb-6">
          <h2 className="text-lg font-bold mb-4">Monthly Sales & Orders</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => value.toLocaleString()} />
              <Bar dataKey="Sales" fill="#c1591c" />
              <Bar dataKey="Orders" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-bold mb-4">Recent Orders</h2>
        {stats.recentOrders && stats.recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left border">Order ID</th>
                  <th className="p-2 text-left border">Customer</th>
                  <th className="p-2 text-left border">Amount</th>
                  <th className="p-2 text-left border">Status</th>
                  <th className="p-2 text-left border">Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.map((order) => (
                  <tr key={order._id} className="hover:bg-gray-50">
                    <td className="p-2 border text-xs">
                      {order._id?.substring(0, 8) || "N/A"}
                    </td>
                    <td className="p-2 border">
                      {order.user?.name || "Unknown"}
                    </td>
                    <td className="p-2 border font-semibold">
                      ₹{order.totalAmt?.toLocaleString() || 0}
                    </td>
                    <td className="p-2 border">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          order.order_status === "delivered"
                            ? "bg-green-100 text-green-700"
                            : order.order_status === "shipped"
                              ? "bg-blue-100 text-blue-700"
                              : order.order_status === "confirmed"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {order.order_status}
                      </span>
                    </td>
                    <td className="p-2 border text-xs">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No recent orders</p>
        )}
      </div>
    </div>
  );
}
