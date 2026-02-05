// Sample monthly sales data for graph demo
export const sampleDashboardStats = {
  totalRevenue: 45000,
  totalOrders: 18,
  totalProducts: 13,
  totalUsers: 3,
  monthlySales: [
    { _id: { month: 10, year: 2025 }, total: 12000, count: 5 },
    { _id: { month: 11, year: 2025 }, total: 15000, count: 7 },
    { _id: { month: 12, year: 2025 }, total: 18000, count: 6 },
  ],
  recentOrders: [
    {
      _id: "ORD001",
      user: { name: "Alice" },
      totalAmt: 3500,
      order_status: "delivered",
      createdAt: "2025-12-15T10:00:00Z",
    },
    {
      _id: "ORD002",
      user: { name: "Bob" },
      totalAmt: 4200,
      order_status: "shipped",
      createdAt: "2025-12-18T14:30:00Z",
    },
  ],
};
