import crypto from "crypto";
import Razorpay from "razorpay";
import CategoryModel from "../models/category.model.js";
import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import UserModel from "../models/user.model.js";

// Check if Razorpay credentials are configured
const isRazorpayConfigured = () => {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
};

// Initialize Razorpay only if credentials are present
let razorpay = null;
if (isRazorpayConfigured()) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  console.log("✓ Razorpay initialized successfully");
} else {
  console.warn(
    "⚠ Razorpay credentials not configured - payment features disabled",
  );
}

/**
 * Order Controller
 *
 * Admin operations for managing orders
 */

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all orders (Admin)
 * @route GET /api/orders/admin/all
 */
export const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};

    // Filter by status
    if (status && status !== "all") {
      filter.order_status = status;
    }

    // Search by orderId or user email
    if (search) {
      filter.$or = [{ paymentId: { $regex: search, $options: "i" } }];
    }

    const [orders, total] = await Promise.all([
      OrderModel.find(filter)
        .populate("user", "name email avatar mobile")
        .populate("delivery_address")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      OrderModel.countDocuments(filter),
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch orders",
      details: error.message,
    });
  }
};

/**
 * Get single order by ID
 * @route GET /api/orders/:id
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await OrderModel.findById(id)
      .populate("user", "name email avatar mobile")
      .populate("delivery_address");

    if (!order) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch order",
    });
  }
};

/**
 * Update order status (Admin)
 * @route PUT /api/orders/:id/status
 * @body { order_status: "pending|confirmed|shipped|delivered|cancelled" }
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { order_status } = req.body;

    // Valid order statuses
    const validStatuses = [
      "pending",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!order_status || !validStatuses.includes(order_status)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: `Invalid order status. Valid values: ${validStatuses.join(", ")}`,
      });
    }

    // Validate MongoDB ID
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await OrderModel.findByIdAndUpdate(
      id,
      {
        order_status: order_status,
        lastUpdatedBy: req.user?.id || null,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true },
    )
      .populate("user", "name email")
      .populate("delivery_address");

    if (!order) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update order status",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get order statistics (Admin)
 * @route GET /api/orders/admin/stats
 */
export const getOrderStats = async (req, res) => {
  try {
    const [
      totalOrders,
      pendingOrders,
      confirmedOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue,
      paidOrders,
      failedPayments,
    ] = await Promise.all([
      OrderModel.countDocuments(),
      OrderModel.countDocuments({ order_status: "pending" }),
      OrderModel.countDocuments({ order_status: "confirmed" }),
      OrderModel.countDocuments({ order_status: "shipped" }),
      OrderModel.countDocuments({ order_status: "delivered" }),
      OrderModel.countDocuments({ order_status: "cancelled" }),
      OrderModel.aggregate([
        { $match: { payment_status: "paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmt" } } },
      ]),
      OrderModel.countDocuments({ payment_status: "paid" }),
      OrderModel.countDocuments({ payment_status: "failed" }),
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        confirmedOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        paidOrders,
        failedPayments,
      },
    });
  } catch (error) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch order statistics",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get dashboard statistics (Admin)
 * @route GET /api/orders/admin/dashboard-stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalOrders,
      totalProducts,
      totalCategories,
      totalUsers,
      totalRevenue,
      recentOrders,
    ] = await Promise.all([
      OrderModel.countDocuments(),
      ProductModel.countDocuments(),
      CategoryModel.countDocuments(),
      UserModel.countDocuments(),
      OrderModel.aggregate([
        { $match: { order_status: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$totalAmt" } } },
      ]),
      OrderModel.find()
        .populate("user", "name email avatar")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    res.status(200).json({
      error: false,
      success: true,
      data: {
        totalOrders,
        totalProducts,
        totalCategories,
        totalUsers,
        totalRevenue: totalRevenue[0]?.total || 0,
        recentOrders,
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

// ==================== USER ENDPOINTS ====================

/**
 * Create order (User - for checkout)
 * @route POST /api/orders
 * @body { products, totalAmt, delivery_address }
 */
export const createOrder = async (req, res) => {
  try {
    const { products, totalAmt, delivery_address } = req.body;
    const userId = req.user?.id || req.body.userId;

    // Check if Razorpay is configured
    if (!razorpay) {
      return res.status(503).json({
        error: true,
        success: false,
        message: "Payment service is not configured. Please contact support.",
      });
    }

    // Validate required fields
    if (!products || products.length === 0) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Products are required",
      });
    }

    if (!totalAmt || totalAmt <= 0) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Total amount must be greater than 0",
      });
    }

    // Step 1: Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmt * 100), // Amount in paise
      currency: "INR",
      receipt: `order_${Date.now()}`,
      payment_capture: 1, // Auto-capture payment
    });

    // Step 2: Create order in database
    const newOrder = new OrderModel({
      user: userId || null,
      products,
      totalAmt,
      delivery_address: delivery_address || null,
      order_status: "pending",
      payment_status: "pending",
      paymentId: razorpayOrder.id, // Razorpay Order ID
    });

    const savedOrder = await newOrder.save();

    res.status(201).json({
      error: false,
      success: true,
      message: "Order created successfully",
      data: {
        orderId: savedOrder._id,
        razorpayOrderId: razorpayOrder.id,
        amount: totalAmt,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create order",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Verify payment and confirm order (User)
 * @route POST /api/orders/verify-payment
 * @body { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature }
 */
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } =
      req.body;

    // Check if Razorpay is configured
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        error: true,
        success: false,
        message: "Payment service is not configured. Please contact support.",
      });
    }

    // Validate required fields
    if (
      !orderId ||
      !razorpayPaymentId ||
      !razorpayOrderId ||
      !razorpaySignature
    ) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "All payment details are required",
      });
    }

    // Step 1: Verify signature on server-side
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    hmac.update(body);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Payment verification failed - Invalid signature",
      });
    }

    // Step 2: Fetch order from database
    const order = await OrderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Order not found",
      });
    }

    // Step 3: Update order status
    order.paymentId = razorpayPaymentId;
    order.payment_status = "paid";
    order.order_status = "confirmed";
    await order.save();

    // Step 4: Fetch updated order with relations
    const updatedOrder = await OrderModel.findById(orderId)
      .populate("user", "name email")
      .populate("delivery_address");

    res.status(200).json({
      error: false,
      success: true,
      message: "Payment verified and order confirmed",
      data: {
        orderId: updatedOrder._id,
        orderStatus: updatedOrder.order_status,
        paymentStatus: updatedOrder.payment_status,
        paymentId: updatedOrder.paymentId,
        totalAmount: updatedOrder.totalAmt,
      },
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to verify payment",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get user's orders
 * @route GET /api/orders/user/my-orders
 */
export const getUserOrders = async (req, res) => {
  try {
    // req.user is set directly to the ID string by auth middleware
    const userId = req.user || req.query.userId;

    console.log("getUserOrders Debug:", {
      reqUser: req.user,
      queryUserId: req.query.userId,
      finalUserId: userId,
      hasUserId: !!userId,
    });

    if (!userId) {
      console.log("❌ No userId provided - returning 400");
      return res.status(400).json({
        error: true,
        success: false,
        message: "User ID is required",
      });
    }

    console.log("✓ Fetching orders for userId:", userId);
    const orders = await OrderModel.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    console.log("✓ Found", orders.length, "orders");
    res.status(200).json({
      error: false,
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch orders",
      details: error.message,
    });
  }
};

/**
 * Razorpay Webhook Handler
 * @route POST /api/orders/webhook/razorpay
 * Webhook for payment.authorized and payment.failed events
 */
export const handleRazorpayWebhook = async (req, res) => {
  try {
    const event = req.body;

    // Verify webhook signature
    const razorpaySignature = req.headers["x-razorpay-signature"];
    const body = JSON.stringify(event);

    const hmac = crypto.createHmac(
      "sha256",
      process.env.RAZORPAY_WEBHOOK_SECRET,
    );
    hmac.update(body);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpaySignature) {
      console.warn("Webhook signature verification failed");
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid webhook signature",
      });
    }

    // Handle payment events
    if (event.event === "payment.authorized") {
      const paymentId = event.payload.payment.entity.id;
      const orderId = event.payload.payment.entity.notes.order_id;

      // Update order with payment ID
      await OrderModel.findByIdAndUpdate(
        orderId,
        {
          paymentId: paymentId,
          payment_status: "paid",
          order_status: "confirmed",
        },
        { new: true },
      );

      console.log(`✅ Payment authorized for order: ${orderId}`);
    } else if (event.event === "payment.failed") {
      const orderId = event.payload.payment.entity.notes.order_id;

      // Mark order as payment failed
      await OrderModel.findByIdAndUpdate(
        orderId,
        {
          payment_status: "failed",
          order_status: "cancelled",
        },
        { new: true },
      );

      console.log(`❌ Payment failed for order: ${orderId}`);
    }

    // Send 200 OK to Razorpay
    res.status(200).json({
      error: false,
      success: true,
      message: "Webhook processed",
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Webhook processing failed",
    });
  }
};

/**
 * Create Test Order (For Development/Testing - Admin Only)
 * @route POST /api/orders/test/create
 * @description Creates a mock order for testing without Razorpay
 * Only works in development mode or for admins
 */
export const createTestOrder = async (req, res) => {
  try {
    // Security check - only allow in development
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        error: true,
        success: false,
        message: "Test orders not allowed in production",
      });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "userId is required",
      });
    }

    // Verify user exists
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "User not found",
      });
    }

    // Get some products for the test order
    const products = await ProductModel.find().limit(3);
    if (products.length === 0) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "No products found in database. Please seed products first.",
      });
    }

    // Create order items from products
    const orderProducts = products.map((product) => ({
      productId: product._id.toString(),
      productTitle: product.name,
      quantity: Math.floor(Math.random() * 3) + 1,
      price: product.price,
      image: product.image,
      subTotal: product.price * (Math.floor(Math.random() * 3) + 1),
    }));

    const totalAmount = orderProducts.reduce(
      (sum, item) => sum + item.subTotal,
      0,
    );

    // Create test order with "paid" status
    const testOrder = new OrderModel({
      user: userId,
      products: orderProducts,
      totalAmt: totalAmount,
      payment_status: "paid", // Mark as paid for testing
      order_status: "confirmed", // Mark as confirmed
      paymentId: `TEST_${Date.now()}`, // Test payment ID
      razorpayOrderId: `TEST_ORDER_${Date.now()}`,
      // Note: delivery_address is optional (default: null)
      // Don't include it since it's an ObjectId reference to address model
    });

    await testOrder.save();

    console.log("✓ Test order created:", testOrder._id);

    res.status(201).json({
      error: false,
      success: true,
      message: "Test order created successfully",
      orderId: testOrder._id,
      order: testOrder,
    });
  } catch (error) {
    console.error("Test order creation error:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create test order",
      error: error.message,
    });
  }
};
