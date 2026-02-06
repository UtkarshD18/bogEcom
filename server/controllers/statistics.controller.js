import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import UserModel from "../models/user.model.js";

const getEffectiveAmountExpression = {
  $cond: [{ $gt: ["$finalAmount", 0] }, "$finalAmount", "$totalAmt"],
};

/**
 * Statistics Controller
 *
 * Provides real-time analytics for admin dashboard
 * Sales data, user metrics, product insights, revenue trends
 */

/**
 * Get overall dashboard statistics
 * @route GET /api/statistics/dashboard
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { period = "month" } = req.query; // month, quarter, year, allTime

    // Calculate date range based on period
    let startDate = new Date();
    switch (period) {
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "quarter":
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case "year":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case "allTime":
        startDate = new Date(2000, 0, 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    // Fetch all stats in parallel
    const [
      totalOrders,
      totalRevenue,
      totalUsers,
      totalProducts,
      averageOrderValue,
      ordersInPeriod,
    ] = await Promise.all([
      OrderModel.countDocuments(),
      OrderModel.aggregate([
        { $match: { order_status: { $ne: "cancelled" } } },
        { $addFields: { effectiveAmount: getEffectiveAmountExpression } },
        {
          $group: {
            _id: null,
            total: { $sum: "$effectiveAmount" },
          },
        },
      ]),
      UserModel.countDocuments(),
      ProductModel.countDocuments(),
      OrderModel.aggregate([
        { $match: { order_status: { $ne: "cancelled" } } },
        { $addFields: { effectiveAmount: getEffectiveAmountExpression } },
        {
          $group: {
            _id: null,
            average: { $avg: "$effectiveAmount" },
          },
        },
      ]),
      OrderModel.countDocuments({ createdAt: { $gte: startDate } }),
    ]);

    // Monthly sales aggregation for dashboard graph
    const monthlySales = await OrderModel.aggregate([
      { $match: { order_status: { $ne: "cancelled" } } },
      { $addFields: { effectiveAmount: getEffectiveAmountExpression } },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          total: { $sum: "$effectiveAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: {
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalUsers,
        totalProducts,
        averageOrderValue: parseFloat(
          (averageOrderValue[0]?.average || 0).toFixed(2),
        ),
        ordersInPeriod,
        period,
        monthlySales, // <-- Add this line
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch dashboard statistics",
    });
  }
};

/**
 * Get sales data by time period (for charts)
 * @route GET /api/statistics/sales-trend
 */
export const getSalesTrend = async (req, res) => {
  try {
    const { period = "month" } = req.query; // month, quarter, year

    let groupBy;
    let dateRange;

    switch (period) {
      case "week":
        groupBy = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        };
        dateRange = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case "month":
        groupBy = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        };
        dateRange = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case "quarter":
        groupBy = {
          $dateToString: { format: "%Y-W%V", date: "$createdAt" },
        };
        dateRange = { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) };
        break;
      case "year":
        groupBy = {
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
        };
        dateRange = { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
        break;
      default:
        groupBy = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        };
        dateRange = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }

    const salesTrend = await OrderModel.aggregate([
      {
        $match: {
          createdAt: dateRange,
          order_status: { $ne: "cancelled" },
        },
      },
      { $addFields: { effectiveAmount: getEffectiveAmountExpression } },
      {
        $group: {
          _id: groupBy,
          totalSales: { $sum: "$effectiveAmount" },
          orderCount: { $sum: 1 },
          averageOrder: { $avg: "$effectiveAmount" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: salesTrend.map((item) => ({
        date: item._id,
        sales: parseFloat(item.totalSales.toFixed(2)),
        orders: item.orderCount,
        average: parseFloat(item.averageOrder.toFixed(2)),
      })),
      period,
    });
  } catch (error) {
    console.error("Error fetching sales trend:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch sales trend",
    });
  }
};

/**
 * Get top selling products
 * @route GET /api/statistics/top-products
 */
export const getTopProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topProducts = await OrderModel.aggregate([
      {
        $match: { order_status: { $ne: "cancelled" } },
      },
      {
        $unwind: "$products",
      },
      {
        $group: {
          _id: "$products.productId",
          totalQuantity: { $sum: "$products.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$products.quantity", "$products.price"] },
          },
          orderCount: { $sum: 1 },
          productName: { $first: "$products.productTitle" },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: topProducts.map((product) => ({
        productId: product._id,
        productName: product.productName,
        totalQuantity: product.totalQuantity,
        totalRevenue: parseFloat(product.totalRevenue.toFixed(2)),
        orderCount: product.orderCount,
      })),
    });
  } catch (error) {
    console.error("Error fetching top products:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch top products",
    });
  }
};

/**
 * Get order status breakdown
 * @route GET /api/statistics/order-status
 */
export const getOrderStatus = async (req, res) => {
  try {
    const statusBreakdown = await OrderModel.aggregate([
      {
        $group: {
          _id: "$order_status",
          count: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [{ $gt: ["$finalAmount", 0] }, "$finalAmount", "$totalAmt"],
            },
          },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    const statuses = [
      "pending",
      "pending_payment",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
    ];
    const result = {};

    statuses.forEach((status) => {
      const statusData = statusBreakdown.find((s) => s._id === status);
      result[status] = {
        count: statusData?.count || 0,
        revenue: parseFloat((statusData?.totalRevenue || 0).toFixed(2)),
      };
    });

    res.status(200).json({
      error: false,
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching order status:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch order status breakdown",
    });
  }
};

/**
 * Get category performance
 * @route GET /api/statistics/category-performance
 */
export const getCategoryPerformance = async (req, res) => {
  try {
    const categoryPerformance = await OrderModel.aggregate([
      {
        $match: { order_status: { $ne: "cancelled" } },
      },
      {
        $unwind: "$products",
      },
      {
        $addFields: {
          productObjectId: {
            $convert: {
              input: "$products.productId",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "productObjectId",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      {
        $unwind: {
          path: "$productInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$productInfo.category",
          totalRevenue: {
            $sum: { $multiply: ["$products.quantity", "$products.price"] },
          },
          totalQuantity: { $sum: "$products.quantity" },
          orderCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      {
        $unwind: {
          path: "$categoryInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          totalRevenue: 1,
          totalQuantity: 1,
          orderCount: 1,
          categoryName: "$categoryInfo.name",
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: categoryPerformance.map((cat) => ({
        category: cat.categoryName || "Uncategorized",
        revenue: parseFloat(cat.totalRevenue.toFixed(2)),
        quantity: cat.totalQuantity,
        orders: cat.orderCount,
      })),
    });
  } catch (error) {
    console.error("Error fetching category performance:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch category performance",
    });
  }
};

/**
 * Get user growth statistics
 * @route GET /api/statistics/user-growth
 */
export const getUserGrowth = async (req, res) => {
  try {
    const { period = "month" } = req.query;

    let groupBy;
    let dateRange;

    switch (period) {
      case "week":
        groupBy = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        };
        dateRange = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case "month":
        groupBy = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        };
        dateRange = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case "year":
        groupBy = {
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
        };
        dateRange = { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
        break;
      default:
        groupBy = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        };
        dateRange = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }

    const userGrowth = await UserModel.aggregate([
      {
        $match: { createdAt: dateRange },
      },
      {
        $group: {
          _id: groupBy,
          newUsers: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: userGrowth.map((item) => ({
        date: item._id,
        newUsers: item.newUsers,
      })),
      period,
    });
  } catch (error) {
    console.error("Error fetching user growth:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch user growth statistics",
    });
  }
};

/**
 * Get customer metrics
 * @route GET /api/statistics/customer-metrics
 */
export const getCustomerMetrics = async (req, res) => {
  try {
    const totalUsers = await UserModel.countDocuments();
    const totalOrders = await OrderModel.countDocuments();
    const averageOrdersPerUser = totalOrders / totalUsers || 0;

    // Get repeat customers (more than 1 order)
    const repeatCustomers = await OrderModel.aggregate([
      {
        $group: {
          _id: "$user",
          orderCount: { $sum: 1 },
        },
      },
      {
        $match: { orderCount: { $gt: 1 } },
      },
      {
        $count: "total",
      },
    ]);

    // Get customer lifetime value
    const customerLifetimeValue = await OrderModel.aggregate([
      {
        $match: { order_status: { $ne: "cancelled" } },
      },
      { $addFields: { effectiveAmount: getEffectiveAmountExpression } },
      {
        $group: {
          _id: "$user",
          totalSpent: { $sum: "$effectiveAmount" },
          orderCount: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          averageLTV: { $avg: "$totalSpent" },
          maxLTV: { $max: "$totalSpent" },
          minLTV: { $min: "$totalSpent" },
        },
      },
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: {
        totalCustomers: totalUsers,
        totalOrders,
        averageOrdersPerCustomer: parseFloat(averageOrdersPerUser.toFixed(2)),
        repeatCustomers: repeatCustomers[0]?.total || 0,
        repeatCustomerPercentage: parseFloat(
          (((repeatCustomers[0]?.total || 0) / totalUsers) * 100).toFixed(2),
        ),
        customerLifetimeValue: {
          average: parseFloat(
            (customerLifetimeValue[0]?.averageLTV || 0).toFixed(2),
          ),
          max: parseFloat((customerLifetimeValue[0]?.maxLTV || 0).toFixed(2)),
          min: parseFloat((customerLifetimeValue[0]?.minLTV || 0).toFixed(2)),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching customer metrics:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch customer metrics",
    });
  }
};

/**
 * Get revenue breakdown by payment method
 * @route GET /api/statistics/payment-methods
 */
export const getPaymentMethods = async (req, res) => {
  try {
    const paymentBreakdown = await OrderModel.aggregate([
      {
        $match: { order_status: { $ne: "cancelled" } },
      },
      { $addFields: { effectiveAmount: getEffectiveAmountExpression } },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$effectiveAmount" },
          averageOrder: { $avg: "$effectiveAmount" },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: paymentBreakdown.map((method) => ({
        paymentMethod: method._id || "Unknown",
        orderCount: method.count,
        totalRevenue: parseFloat(method.totalRevenue.toFixed(2)),
        averageOrder: parseFloat(method.averageOrder.toFixed(2)),
      })),
    });
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch payment method breakdown",
    });
  }
};

export default {
  getDashboardStats,
  getSalesTrend,
  getTopProducts,
  getOrderStatus,
  getCategoryPerformance,
  getUserGrowth,
  getCustomerMetrics,
  getPaymentMethods,
};
