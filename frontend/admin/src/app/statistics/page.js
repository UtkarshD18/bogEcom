"use client";

import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import LoadingSpinner from "../components/LoadingSpinner";

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

export default function StatisticsPage() {
  const [dashboardStats, setDashboardStats] = useState(null);
  const [salesTrend, setSalesTrend] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [orderStatus, setOrderStatus] = useState({});
  const [categoryPerformance, setCategoryPerformance] = useState([]);
  const [userGrowth, setUserGrowth] = useState([]);
  const [customerMetrics, setCustomerMetrics] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAllStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("authToken");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      // Fetch all stats in parallel
      const [
        dashRes,
        trendsRes,
        productsRes,
        statusRes,
        categoryRes,
        userRes,
        metricsRes,
        paymentRes,
      ] = await Promise.all([
        axios.get(`/api/statistics/dashboard?period=${period}`, config),
        axios.get(`/api/statistics/sales-trend?period=${period}`, config),
        axios.get(`/api/statistics/top-products?limit=10`, config),
        axios.get(`/api/statistics/order-status`, config),
        axios.get(`/api/statistics/category-performance`, config),
        axios.get(`/api/statistics/user-growth?period=${period}`, config),
        axios.get(`/api/statistics/customer-metrics`, config),
        axios.get(`/api/statistics/payment-methods`, config),
      ]);

      setDashboardStats(dashRes.data.data);
      setSalesTrend(trendsRes.data.data);
      setTopProducts(productsRes.data.data);

      // Convert order status object to array for pie chart
      const statusArray = Object.entries(statusRes.data.data).map(
        ([key, value]) => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          value: value.count,
          revenue: value.revenue,
        }),
      );
      setOrderStatus(statusArray);

      setCategoryPerformance(categoryRes.data.data);
      setUserGrowth(userRes.data.data);
      setCustomerMetrics(metricsRes.data.data);
      setPaymentMethods(paymentRes.data.data);
    } catch (err) {
      console.error("Error fetching statistics:", err);
      setError(err.response?.data?.message || "Failed to fetch statistics");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAllStats();
  }, [period, fetchAllStats]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sales Analytics</h1>
          <div className="flex gap-2">
            {["week", "month", "quarter", "year"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  period === p
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        {dashboardStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KPICard
              title="Total Revenue"
              value={`₹${dashboardStats.totalRevenue.toLocaleString("en-IN", {
                maximumFractionDigits: 0,
              })}`}
              subtitle="All time"
              icon="💰"
              color="bg-blue-50"
            />
            <KPICard
              title="Total Orders"
              value={dashboardStats.totalOrders}
              subtitle="All time"
              icon="📦"
              color="bg-green-50"
            />
            <KPICard
              title="Total Customers"
              value={dashboardStats.totalUsers}
              subtitle="Registered"
              icon="👥"
              color="bg-purple-50"
            />
            <KPICard
              title="Avg Order Value"
              value={`₹${dashboardStats.averageOrderValue.toLocaleString(
                "en-IN",
                {
                  maximumFractionDigits: 2,
                },
              )}`}
              subtitle="Per order"
              icon="📊"
              color="bg-orange-50"
            />
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Sales Trend */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Sales Trend
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `₹${value.toLocaleString("en-IN")}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#3B82F6"
                  name="Total Sales"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="average"
                  stroke="#10B981"
                  name="Avg Order"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Order Status */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Order Status
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={orderStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {orderStatus.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} orders`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Products */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Top Selling Products
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="productName"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip
                  formatter={(value) => `₹${value.toLocaleString("en-IN")}`}
                />
                <Bar dataKey="totalRevenue" fill="#3B82F6" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Performance */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Category Performance
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `₹${value.toLocaleString("en-IN")}`}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#10B981" name="Revenue" />
                <Bar dataKey="quantity" fill="#F59E0B" name="Units Sold" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* User Growth */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              User Growth
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => `${value} users`} />
                <Line
                  type="monotone"
                  dataKey="newUsers"
                  stroke="#8B5CF6"
                  name="New Users"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Payment Methods */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Payment Method Distribution
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={paymentMethods}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="paymentMethod" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `₹${value.toLocaleString("en-IN")}`}
                />
                <Bar dataKey="totalRevenue" fill="#EC4899" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customer Metrics */}
        {customerMetrics && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Customer Metrics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Customers"
                value={customerMetrics.totalCustomers}
              />
              <MetricCard
                label="Repeat Customers"
                value={`${customerMetrics.repeatCustomers} (${customerMetrics.repeatCustomerPercentage}%)`}
              />
              <MetricCard
                label="Avg Orders/Customer"
                value={customerMetrics.averageOrdersPerCustomer}
              />
              <MetricCard
                label="Avg Lifetime Value"
                value={`₹${customerMetrics.customerLifetimeValue.average.toLocaleString(
                  "en-IN",
                  { maximumFractionDigits: 2 },
                )}`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({ title, value, subtitle, icon, color }) {
  return (
    <div className={`${color} border border-gray-200 rounded-lg p-6`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      <p className="text-gray-600 text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  );
}
