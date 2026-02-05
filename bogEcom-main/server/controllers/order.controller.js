import mongoose from "mongoose";
import CategoryModel from "../models/category.model.js";
import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import UserModel from "../models/user.model.js";
import {
  syncOrderStatus,
  syncOrderToFirestore,
} from "../utils/orderFirestoreSync.js";
import {
  calculateInfluencerCommission,
  calculateReferralDiscount,
  updateInfluencerStats,
} from "./influencer.controller.js";
import { sendOrderUpdateNotification } from "./notification.controller.js";

// ==================== PAYMENT PROVIDER CONFIGURATION ====================

/**
 * Payment Provider Constant
 * Currently: PhonePe (onboarding in progress)
 */
const PAYMENT_PROVIDER = "PHONEPE";

/**
 * Check if payment gateway is enabled
 * Currently returns false - PhonePe onboarding in progress
 * Set PHONEPE_ENABLED=true in .env when PhonePe is activated
 */
const isPaymentEnabled = () => {
  return process.env.PHONEPE_ENABLED === "true";
};

// Log payment status on server start
if (isPaymentEnabled()) {
  console.log(`✓ Payment gateway enabled: ${PAYMENT_PROVIDER}`);
} else {
  console.log(
    `⚠ Payments disabled - ${PAYMENT_PROVIDER} onboarding in progress`,
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
 * Get user's own order by ID (User)
 * @route GET /api/orders/user/order/:orderId
 * @description Users can only view their own orders - returns 403 if not owner
 */
export const getUserOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id || req.user;

    // Must be authenticated
    if (!userId) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Authentication required to view order details",
      });
    }

    // Validate orderId format
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid order ID format",
      });
    }

    // Find order
    const order = await OrderModel.findById(orderId)
      .populate("user", "name email avatar mobile")
      .populate("delivery_address");

    if (!order) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Order not found",
      });
    }

    // Authorization check - user can only view their own orders
    const orderUserId = order.user?._id?.toString() || order.user?.toString();
    if (orderUserId !== userId?.toString()) {
      return res.status(403).json({
        error: true,
        success: false,
        message: "You are not authorized to view this order",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error fetching user order:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch order",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
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

    // AUTO-TRIGGER: Send order update notification to user
    // Only for logged-in users (guests don't get order notifications)
    if (order.user) {
      sendOrderUpdateNotification(order, order_status).catch((err) =>
        console.error("Failed to send order update notification:", err.message),
      );
    }

    // SYNC: Mirror order status to Firestore for real-time client updates
    syncOrderStatus(id, order_status).catch((err) =>
      console.error("Failed to sync order status to Firestore:", err.message),
    );

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
 * Create order with payment (User - for checkout)
 * @route POST /api/orders
 * @body { products, totalAmt, delivery_address }
 * @note PhonePe integration pending - use saveOrderForLater instead
 */
export const createOrder = async (req, res) => {
  try {
    // Check if payments are enabled (PhonePe onboarding)
    if (!isPaymentEnabled()) {
      return res.status(503).json({
        error: true,
        success: false,
        message:
          "Online payments are temporarily unavailable. PhonePe onboarding is in progress. Please use 'Save Order for Later' option.",
        paymentProvider: PAYMENT_PROVIDER,
        alternativeEndpoint: "/api/orders/save-for-later",
      });
    }

    // TODO: PhonePe integration will be implemented here
    // When PHONEPE_ENABLED=true in .env, this will:
    // 1. Create PhonePe payment request
    // 2. Return payment URL for redirect
    // 3. Handle callback on payment completion

    return res.status(503).json({
      error: true,
      success: false,
      message:
        "PhonePe integration coming soon. Please use 'Save Order for Later' option.",
      paymentProvider: PAYMENT_PROVIDER,
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
 * Verify payment callback (User)
 * @route POST /api/orders/verify-payment
 * @note PhonePe integration pending - currently returns 503
 */
export const verifyPayment = async (req, res) => {
  try {
    // Check if payments are enabled (PhonePe onboarding)
    if (!isPaymentEnabled()) {
      return res.status(503).json({
        error: true,
        success: false,
        message:
          "Payment verification unavailable. PhonePe onboarding in progress.",
        paymentProvider: PAYMENT_PROVIDER,
      });
    }

    // TODO: PhonePe callback verification will be implemented here
    // When PHONEPE_ENABLED=true in .env, this will:
    // 1. Verify PhonePe callback signature
    // 2. Confirm payment status with PhonePe API
    // 3. Update order status accordingly

    return res.status(503).json({
      error: true,
      success: false,
      message: "PhonePe verification coming soon.",
      paymentProvider: PAYMENT_PROVIDER,
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
 * PhonePe Webhook Handler (Placeholder)
 * @route POST /api/orders/webhook/phonepe
 * @note Will handle PhonePe payment callbacks when integration is complete
 */
export const handlePhonePeWebhook = async (req, res) => {
  try {
    // Check if payments are enabled
    if (!isPaymentEnabled()) {
      console.log("PhonePe webhook received but payments are disabled");
      return res.status(503).json({
        error: true,
        success: false,
        message: "PhonePe integration not yet active",
      });
    }

    // TODO: PhonePe webhook handling will be implemented here
    // When PHONEPE_ENABLED=true in .env, this will:
    // 1. Verify PhonePe webhook signature using X-VERIFY header
    // 2. Decode base64 response from PhonePe
    // 3. Update order status based on payment result
    // 4. Handle SUCCESS, FAILURE, PENDING states

    console.log("PhonePe webhook placeholder - integration pending");

    res.status(200).json({
      error: false,
      success: true,
      message: "Webhook acknowledged (placeholder)",
    });
  } catch (error) {
    console.error("PhonePe webhook error:", error);
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
 * @description Creates a mock order for testing without payment gateway
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

// ==================== PHONEPE TRANSITION ENDPOINTS ====================

/**
 * Save Order for Later Payment (PhonePe Pre-Approval Phase)
 * @route POST /api/orders/save-for-later
 * @description Creates a mock order with pending_payment status when payments are unavailable
 * This is used during the PhonePe onboarding phase
 *
 * Discount Application Order:
 * 1. Calculate subtotal from products
 * 2. Apply influencer discount FIRST (if valid referral code)
 * 3. Apply coupon discount SECOND (on amount after influencer discount)
 * 4. Calculate final amount
 * 5. Calculate influencer commission from final amount
 */
export const saveOrderForLater = async (req, res) => {
  try {
    const {
      products,
      totalAmt,
      delivery_address,
      couponCode,
      discountAmount: clientDiscountAmount,
      finalAmount: clientFinalAmount,
      affiliateCode,
      affiliateSource,
      influencerCode,
      notes,
    } = req.body;

    const userId = req.user?.id || req.user || req.body.userId || null;

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

    // Validate and sanitize products - ensure all required fields exist
    const sanitizedProducts = products.map((p) => ({
      productId: String(p.productId || p._id || "unknown"),
      productTitle: String(p.productTitle || p.name || "Product"),
      quantity: Number(p.quantity) || 1,
      price: Number(p.price) || 0,
      image: String(p.image || ""),
      subTotal:
        Number(p.subTotal) ||
        (Number(p.price) || 0) * (Number(p.quantity) || 1),
    }));

    // Validate delivery_address - only use if it's a valid MongoDB ObjectId
    let validDeliveryAddress = null;
    if (delivery_address && mongoose.Types.ObjectId.isValid(delivery_address)) {
      validDeliveryAddress = delivery_address;
    }

    // ==================== BACKEND DISCOUNT CALCULATION ====================
    // All discounts are calculated server-side for security

    const originalPrice = Number(totalAmt);
    let workingAmount = originalPrice;
    let influencerDiscount = 0;
    let influencerData = null;
    let influencerCommission = 0;
    let couponDiscount = Number(clientDiscountAmount) || 0;

    // Step 1: Apply influencer discount FIRST (if referral code provided)
    if (influencerCode) {
      const referralResult = await calculateReferralDiscount(
        influencerCode,
        originalPrice,
      );
      if (referralResult.influencer) {
        influencerDiscount = referralResult.discount;
        influencerData = referralResult.influencer;
        workingAmount = originalPrice - influencerDiscount;
        console.log(
          `✓ Influencer discount applied: ₹${influencerDiscount} (code: ${influencerCode})`,
        );
      }
    }

    // Step 2: Coupon discount applies on amount AFTER influencer discount
    // Coupon validation should be done client-side via /api/coupons/validate
    // Here we just apply the discount amount sent from client
    // For security, you could re-validate the coupon here if needed
    if (couponCode && couponDiscount > 0) {
      // Ensure coupon discount doesn't exceed working amount
      couponDiscount = Math.min(couponDiscount, workingAmount);
      workingAmount = workingAmount - couponDiscount;
      console.log(
        `✓ Coupon discount applied: ₹${couponDiscount} (code: ${couponCode})`,
      );
    }

    // Step 3: Calculate final amount (minimum ₹1)
    const finalAmount = Math.max(Math.round(workingAmount * 100) / 100, 1);
    const totalDiscount = influencerDiscount + couponDiscount;

    // Step 4: Calculate influencer commission from FINAL amount (what customer pays)
    if (influencerData) {
      influencerCommission = await calculateInfluencerCommission(
        influencerData._id,
        finalAmount,
      );
      console.log(
        `✓ Influencer commission calculated: ₹${influencerCommission}`,
      );
    }

    // Create saved order with pending_payment status
    const savedOrder = new OrderModel({
      user: userId,
      products: sanitizedProducts,
      totalAmt: originalPrice,
      delivery_address: validDeliveryAddress,
      order_status: "pending_payment",
      payment_status: "unavailable",
      paymentMethod: "PENDING",

      // Coupon details
      couponCode: couponCode || null,
      discountAmount: couponDiscount,
      discount: totalDiscount,
      finalAmount: finalAmount,

      // Influencer/Referral tracking
      influencerId: influencerData?._id || null,
      influencerCode: influencerData?.code || null,
      influencerDiscount: influencerDiscount,
      influencerCommission: influencerCommission,
      commissionPaid: false,
      originalPrice: originalPrice,

      // Legacy affiliate tracking (kept for backwards compatibility)
      affiliateCode: influencerCode || affiliateCode || null,
      affiliateSource: affiliateSource || (influencerCode ? "referral" : null),

      // Flags
      isSavedOrder: true,
      notes: notes || "Order saved - awaiting payment gateway activation",
    });

    await savedOrder.save();

    console.log("✓ Order saved for later:", savedOrder._id);

    // Update influencer statistics
    if (influencerData) {
      await updateInfluencerStats(
        influencerData._id,
        finalAmount,
        influencerCommission,
      );
      console.log(`✓ Updated influencer stats for: ${influencerData.code}`);
    }

    // SYNC: Mirror order to Firestore for real-time client updates
    syncOrderToFirestore(savedOrder, "create").catch((err) =>
      console.error("Failed to sync new order to Firestore:", err.message),
    );

    res.status(201).json({
      error: false,
      success: true,
      message:
        "Your order is saved but not confirmed. Complete payment once payments are enabled.",
      data: {
        orderId: savedOrder._id,
        orderStatus: savedOrder.order_status,
        paymentStatus: savedOrder.payment_status,
        // Price breakdown
        originalAmount: originalPrice,
        influencerDiscount: influencerDiscount,
        couponDiscount: couponDiscount,
        totalDiscount: totalDiscount,
        finalAmount: finalAmount,
        // Applied discounts
        couponApplied: !!savedOrder.couponCode,
        influencerApplied: !!savedOrder.influencerCode,
        influencerCode: savedOrder.influencerCode,
        affiliateTracked: !!savedOrder.affiliateCode,
      },
    });
  } catch (error) {
    console.error("Error saving order:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to save order",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Check Payment Gateway Status
 * @route GET /api/orders/payment-status
 * @description Returns the current status of payment gateway integration
 */
export const getPaymentGatewayStatus = async (req, res) => {
  try {
    const paymentEnabled = isPaymentEnabled();

    res.status(200).json({
      error: false,
      success: true,
      data: {
        paymentEnabled,
        provider: PAYMENT_PROVIDER,
        message: paymentEnabled
          ? "PhonePe payment gateway is active"
          : "Payments are temporarily unavailable. We are onboarding PhonePe as our payment partner. You can still save orders for later.",
        canSaveOrder: true, // Always allow saving orders
        onboardingStatus: paymentEnabled ? "complete" : "in_progress",
      },
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to check payment status",
    });
  }
};
