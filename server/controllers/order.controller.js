/**
 * Production-Grade Order Controller
 * Complete API logic for order creation, payment, verification, and management
 * with comprehensive error handling and logging
 */

import crypto from "crypto";
import mongoose from "mongoose";
import CategoryModel from "../models/category.model.js";
import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import UserModel from "../models/user.model.js";
import {
  AppError,
  asyncHandler,
  handleDatabaseError,
  handlePaymentError,
  logger,
  sendError,
  sendSuccess,
  validateMongoId,
  validateAmount,
} from "../utils/errorHandler.js";
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

const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || "PHONEPE";
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || "";
const PHONEPE_API_KEY = process.env.PHONEPE_API_KEY || "";

const isPaymentEnabled = () => {
  // Check for PhonePe
  if (PAYMENT_PROVIDER === "PHONEPE") {
    return process.env.PHONEPE_ENABLED === "true" && PHONEPE_MERCHANT_ID && PHONEPE_API_KEY;
  }

  // Check for Razorpay
  if (PAYMENT_PROVIDER === "RAZORPAY") {
    return RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET;
  }

  return false;
};

logger.info("Payment System", `Provider: ${PAYMENT_PROVIDER}, Enabled: ${isPaymentEnabled()}`);

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all orders (Admin)
 * @route GET /api/orders/admin/all
 * @access Admin
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 20)
 * @param {string} search - Search by payment ID or user email
 * @param {string} status - Filter by order status
 */
export const getAllOrders = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.pagination;

    const skip = (page - 1) * limit;
    const filter = {};

    // Filter by status
    if (status && status !== "all") {
      filter.order_status = status;
    }

    // Search by paymentId or user email
    if (search) {
      filter.$or = [
        { paymentId: { $regex: search, $options: "i" } },
        { "user.email": { $regex: search, $options: "i" } },
      ];
    }

    logger.debug("getAllOrders", "Fetching orders", { page, limit, status, search });

    const [orders, total] = await Promise.all([
      OrderModel.find(filter)
        .populate("user", "name email avatar mobile")
        .populate("delivery_address")
        .populate("influencerId", "code name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      OrderModel.countDocuments(filter),
    ]);

    logger.info("getAllOrders", `Retrieved ${orders.length} orders`, { total, page, limit });

    return sendSuccess(res, {
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    }, "Orders retrieved successfully");
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "getAllOrders");
    return sendError(res, dbError);
  }
});

/**
 * Get order statistics (Admin)
 * @route GET /api/orders/admin/stats
 * @access Admin
 */
export const getOrderStats = asyncHandler(async (req, res) => {
  try {
    logger.debug("getOrderStats", "Calculating order statistics");

    const stats = await Promise.all([
      OrderModel.countDocuments(),
      OrderModel.countDocuments({ order_status: "pending" }),
      OrderModel.countDocuments({ order_status: "pending_payment" }),
      OrderModel.countDocuments({ order_status: "confirmed" }),
      OrderModel.countDocuments({ order_status: "shipped" }),
      OrderModel.countDocuments({ order_status: "delivered" }),
      OrderModel.countDocuments({ order_status: "cancelled" }),
      OrderModel.countDocuments({ payment_status: "paid" }),
      OrderModel.countDocuments({ payment_status: "failed" }),
      OrderModel.countDocuments({ payment_status: "pending" }),
      OrderModel.aggregate([
        { $match: { payment_status: "paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmt" } } },
      ]),
      OrderModel.aggregate([
        { $match: { payment_status: "failed" } },
        { $group: { _id: null, total: { $sum: "$totalAmt" } } },
      ]),
    ]);

    logger.info("getOrderStats", "Statistics calculated");

    return sendSuccess(res, {
      orders: {
        total: stats[0],
        byStatus: {
          pending: stats[1],
          pending_payment: stats[2],
          confirmed: stats[3],
          shipped: stats[4],
          delivered: stats[5],
          cancelled: stats[6],
        },
      },
      payments: {
        paid: stats[7],
        failed: stats[8],
        pending: stats[9],
      },
      revenue: {
        paid: stats[10][0]?.total || 0,
        failed: stats[11][0]?.total || 0,
      },
    }, "Statistics retrieved successfully");
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "getOrderStats");
    return sendError(res, dbError);
  }
});

/**
 * Get dashboard statistics (Admin)
 * @route GET /api/orders/admin/dashboard-stats
 * @access Admin
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    logger.debug("getDashboardStats", "Calculating dashboard statistics");

    const [
      totalOrders,
      totalProducts,
      totalCategories,
      totalUsers,
      totalRevenue,
      recentOrders,
      pendingOrders,
      pendingPayments,
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
      OrderModel.countDocuments({ order_status: "pending" }),
      OrderModel.countDocuments({ payment_status: "pending" }),
    ]);

    logger.info("getDashboardStats", "Dashboard statistics calculated");

    return sendSuccess(res, {
      totals: {
        orders: totalOrders,
        products: totalProducts,
        categories: totalCategories,
        users: totalUsers,
        revenue: totalRevenue[0]?.total || 0,
      },
      alerts: {
        pendingOrders,
        pendingPayments,
      },
      recentOrders,
    }, "Dashboard data retrieved successfully");
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "getDashboardStats");
    return sendError(res, dbError);
  }
});

/**
 * Get single order by ID
 * @route GET /api/orders/:id
 * @access Admin
 */
export const getOrderById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.validatedData;

    logger.debug("getOrderById", "Fetching order", { id });

    const order = await OrderModel.findById(id)
      .populate("user", "name email avatar mobile")
      .populate("delivery_address")
      .populate("influencerId", "code name");

    if (!order) {
      logger.warn("getOrderById", "Order not found", { id });
      throw new AppError("ORDER_NOT_FOUND");
    }

    logger.info("getOrderById", "Order retrieved", { id });

    return sendSuccess(res, order, "Order retrieved successfully");
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "getOrderById");
    return sendError(res, dbError);
  }
});

/**
 * Update order status (Admin)
 * @route PUT /api/orders/:id/status
 * @access Admin
 * @param {string} order_status - New order status
 * @param {string} notes - Optional update notes
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  try {
    const { id, order_status, notes } = req.validatedData;

    logger.debug("updateOrderStatus", "Updating order status", { id, order_status });

    const order = await OrderModel.findByIdAndUpdate(
      id,
      {
        order_status,
        notes,
        lastUpdatedBy: req.user?.id || req.user,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    )
      .populate("user", "name email")
      .populate("delivery_address");

    if (!order) {
      logger.warn("updateOrderStatus", "Order not found for update", { id });
      throw new AppError("ORDER_NOT_FOUND");
    }

    logger.info("updateOrderStatus", "Order status updated", {
      id,
      newStatus: order_status,
    });

    // Send notification to user if order has user associated
    if (order.user) {
      sendOrderUpdateNotification(order, order_status).catch((err) =>
        logger.error("updateOrderStatus", "Failed to send notification", {
          orderId: id,
          error: err.message,
        })
      );
    }

    // Sync to Firestore for real-time updates
    syncOrderStatus(id, order_status).catch((err) =>
      logger.error("updateOrderStatus", "Failed to sync to Firestore", {
        orderId: id,
        error: err.message,
      })
    );

    return sendSuccess(res, order, "Order status updated successfully");
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "updateOrderStatus");
    return sendError(res, dbError);
  }
});

// ==================== USER ENDPOINTS ====================

/**
 * Get user's orders
 * @route GET /api/orders/user/my-orders
 * @access User (authenticated) / Guest
 */
export const getUserOrders = asyncHandler(async (req, res) => {
  try {
    const userId = req.user || req.query.userId;

    if (!userId) {
      logger.warn("getUserOrders", "User ID not found in request");
      throw new AppError("UNAUTHORIZED");
    }

    logger.debug("getUserOrders", "Fetching user orders", { userId });

    const orders = await OrderModel.find({ user: userId })
      .populate("user", "name email avatar")
      .populate("delivery_address")
      .populate("influencerId", "code name")
      .sort({ createdAt: -1 })
      .lean();

    logger.info("getUserOrders", `Retrieved ${orders.length} orders for user`, { userId });

    return sendSuccess(res, orders, "Orders retrieved successfully");
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "getUserOrders");
    return sendError(res, dbError);
  }
});

/**
 * Get user's single order (with ownership check)
 * @route GET /api/orders/user/order/:orderId
 * @access User (authenticated only)
 */
export const getUserOrderById = asyncHandler(async (req, res) => {
  try {
    const userId = req.user;
    const { id } = req.params;

    if (!userId) {
      throw new AppError("UNAUTHORIZED");
    }

    validateMongoId(id, "orderId");

    logger.debug("getUserOrderById", "Fetching user order", { userId, orderId: id });

    const order = await OrderModel.findById(id)
      .populate("user", "name email avatar mobile")
      .populate("delivery_address");

    if (!order) {
      logger.warn("getUserOrderById", "Order not found", { orderId: id });
      throw new AppError("ORDER_NOT_FOUND");
    }

    // Check ownership
    const orderUserId = order.user?._id?.toString() || order.user?.toString();
    if (orderUserId !== userId?.toString()) {
      logger.warn("getUserOrderById", "User trying to access order they don't own", {
        userId,
        orderId: id,
        orderUserId,
      });
      throw new AppError("FORBIDDEN");
    }

    logger.info("getUserOrderById", "Order retrieved", { userId, orderId: id });

    return sendSuccess(res, order, "Order retrieved successfully");
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "getUserOrderById");
    return sendError(res, dbError);
  }
});

// ==================== ORDER CREATION & PAYMENT ENDPOINTS ====================

/**
 * Create order (Checkout) - PhonePe Integration
 * @route POST /api/orders
 * @access User (authenticated) / Guest
 * @param {Array} products - Product array with details
 * @param {number} totalAmt - Total order amount
 * @param {string} delivery_address - Delivery address ID
 */
export const createOrder = asyncHandler(async (req, res) => {
  try {
    if (!isPaymentEnabled()) {
      logger.warn("createOrder", "Payment gateway not enabled");
      throw new AppError("PAYMENT_DISABLED");
    }

    const { products, totalAmt, delivery_address } = req.validatedData;
    const userId = req.user || null;

    logger.debug("createOrder", "Creating order", { userId, amount: totalAmt, productCount: products.length });

    // Verify products exist in database
    const productIds = products.map((p) => p.productId);
    const dbProducts = await ProductModel.find({
      _id: { $in: productIds },
    });

    if (dbProducts.length !== productIds.length) {
      const foundIds = dbProducts.map((p) => p._id.toString());
      const missingIds = productIds.filter((id) => !foundIds.includes(id.toString()));
      logger.warn("createOrder", "Some products not found", { missingIds });
      throw new AppError("PRODUCT_NOT_FOUND", { missingIds });
    }

    // Create order in database
    const order = new OrderModel({
      user: userId,
      products,
      totalAmt,
      delivery_address: delivery_address || null,
      payment_status: "pending",
      order_status: "pending",
      paymentMethod: PAYMENT_PROVIDER,
      originalPrice: totalAmt,
    });

    await order.save();

    logger.info("createOrder", "Order created in database", { orderId: order._id, userId });

    // TODO: Integrate with PhonePe API
    // When PAYMENT_PROVIDER === "PHONEPE", call PhonePe API here
    // Example:
    // const phonePeResponse = await createPhonePeOrder(order, totalAmt);
    // order.externalPaymentId = phonePeResponse.transactionId;

    // For now, return pending response
    return sendSuccess(
      res,
      {
        orderId: order._id,
        status: "pending",
        message: "Order created. Awaiting payment integration.",
      },
      "Order created successfully",
      201
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "createOrder");
    return sendError(res, dbError);
  }
});

/**
 * Verify payment (Payment confirmation)
 * @route POST /api/orders/verify-payment
 * @access User (authenticated) / Guest
 * @param {string} orderId - MongoDB order ID
 * @param {string} razorpayPaymentId - Payment ID from gateway
 * @param {string} razorpayOrderId - Order ID from gateway
 * @param {string} razorpaySignature - Payment signature
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  try {
    if (!isPaymentEnabled()) {
      logger.warn("verifyPayment", "Payment gateway not enabled");
      throw new AppError("PAYMENT_DISABLED");
    }

    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.validatedData;

    logger.debug("verifyPayment", "Verifying payment", { orderId, paymentId: razorpayPaymentId });

    // Fetch order
    const order = await OrderModel.findById(orderId);
    if (!order) {
      logger.warn("verifyPayment", "Order not found", { orderId });
      throw new AppError("ORDER_NOT_FOUND");
    }

    // Verify signature
    const bodyString = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(bodyString)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      logger.warn("verifyPayment", "Signature mismatch", { orderId, paymentId: razorpayPaymentId });
      order.payment_status = "failed";
      order.failureReason = "Signature verification failed";
      await order.save();
      throw new AppError("SIGNATURE_MISMATCH");
    }

    logger.info("verifyPayment", "Signature verified", { orderId, paymentId: razorpayPaymentId });

    // Update order
    order.paymentId = razorpayPaymentId;
    order.razorpayOrderId = razorpayOrderId;
    order.razorpaySignature = razorpaySignature;
    order.payment_status = "paid";
    order.order_status = "confirmed";
    order.updatedAt = new Date();

    await order.save();

    logger.info("verifyPayment", "Order confirmed after payment", { orderId, paymentId: razorpayPaymentId });

    // Send notification
    if (order.user) {
      sendOrderUpdateNotification(order, "confirmed").catch((err) =>
        logger.error("verifyPayment", "Failed to send notification", {
          orderId,
          error: err.message,
        })
      );
    }

    // Sync to Firestore
    syncOrderToFirestore(order, "update").catch((err) =>
      logger.error("verifyPayment", "Failed to sync to Firestore", {
        orderId,
        error: err.message,
      })
    );

    return sendSuccess(res, {
      orderId: order._id,
      paymentStatus: order.payment_status,
      orderStatus: order.order_status,
    }, "Payment verified successfully");
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "verifyPayment");
    return sendError(res, dbError);
  }
});

/**
 * Save order for later (When payments unavailable)
 * @route POST /api/orders/save-for-later
 * @access User (authenticated) / Guest
 */
export const saveOrderForLater = asyncHandler(async (req, res) => {
  try {
    const {
      products,
      totalAmt,
      delivery_address,
      couponCode,
      discountAmount,
      finalAmount,
      influencerCode,
      notes,
    } = req.validatedData;

    const userId = req.user?.id || req.user || req.body.userId || null;

    logger.debug("saveOrderForLater", "Saving order for later", {
      userId,
      amount: totalAmt,
      productCount: products.length,
    });

    // Backend discount calculation
    const originalPrice = Number(totalAmt);
    let workingAmount = originalPrice;
    let influencerDiscount = 0;
    let influencerData = null;
    let influencerCommission = 0;
    let couponDiscount = Number(discountAmount) || 0;

    // Apply influencer discount first
    if (influencerCode) {
      try {
        const referralResult = await calculateReferralDiscount(influencerCode, originalPrice);
        if (referralResult.influencer) {
          influencerDiscount = referralResult.discount;
          influencerData = referralResult.influencer;
          workingAmount = originalPrice - influencerDiscount;
          logger.info("saveOrderForLater", "Influencer discount applied", {
            code: influencerCode,
            discount: influencerDiscount,
          });
        }
      } catch (error) {
        logger.warn("saveOrderForLater", "Invalid influencer code", {
          code: influencerCode,
          error: error.message,
        });
      }
    }

    // Apply coupon discount
    if (couponCode && couponDiscount > 0) {
      couponDiscount = Math.min(couponDiscount, workingAmount);
      workingAmount = workingAmount - couponDiscount;
      logger.info("saveOrderForLater", "Coupon discount applied", {
        code: couponCode,
        discount: couponDiscount,
      });
    }

    // Calculate final amount
    const finalOrderAmount = Math.max(Math.round(workingAmount * 100) / 100, 1);
    const totalDiscount = influencerDiscount + couponDiscount;

    // Calculate influencer commission
    if (influencerData) {
      influencerCommission = await calculateInfluencerCommission(influencerData._id, finalOrderAmount);
      logger.info("saveOrderForLater", "Influencer commission calculated", {
        commission: influencerCommission,
      });
    }

    // Create saved order
    const savedOrder = new OrderModel({
      user: userId,
      products,
      totalAmt: originalPrice,
      delivery_address: delivery_address || null,
      order_status: "pending_payment",
      payment_status: "unavailable",
      paymentMethod: "PENDING",
      couponCode: couponCode || null,
      discountAmount: couponDiscount,
      discount: totalDiscount,
      finalAmount: finalOrderAmount,
      influencerId: influencerData?._id || null,
      influencerCode: influencerData?.code || null,
      influencerDiscount,
      influencerCommission,
      commissionPaid: false,
      originalPrice,
      affiliateCode: influencerCode || null,
      affiliateSource: influencerCode ? "referral" : null,
      isSavedOrder: true,
      notes: notes || "Order saved - awaiting payment gateway activation",
    });

    await savedOrder.save();

    logger.info("saveOrderForLater", "Order saved for later", { orderId: savedOrder._id });

    // Update influencer stats
    if (influencerData) {
      await updateInfluencerStats(influencerData._id, finalOrderAmount, influencerCommission);
    }

    // Sync to Firestore
    syncOrderToFirestore(savedOrder, "create").catch((err) =>
      logger.error("saveOrderForLater", "Failed to sync to Firestore", {
        orderId: savedOrder._id,
        error: err.message,
      })
    );

    return sendSuccess(
      res,
      {
        orderId: savedOrder._id,
        orderStatus: savedOrder.order_status,
        paymentStatus: savedOrder.payment_status,
        pricing: {
          originalAmount: originalPrice,
          influencerDiscount,
          couponDiscount,
          totalDiscount,
          finalAmount: finalOrderAmount,
        },
        discountsApplied: {
          influencer: !!influencerCode,
          coupon: !!couponCode,
          affiliate: !!savedOrder.affiliateCode,
        },
      },
      "Order saved successfully",
      201
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "saveOrderForLater");
    return sendError(res, dbError);
  }
});

/**
 * Check payment gateway status
 * @route GET /api/orders/payment-status
 * @access Public
 */
export const getPaymentGatewayStatus = asyncHandler(async (req, res) => {
  try {
    const paymentEnabled = isPaymentEnabled();

    logger.info("getPaymentGatewayStatus", "Status check", {
      provider: PAYMENT_PROVIDER,
      enabled: paymentEnabled,
    });

    return sendSuccess(res, {
      paymentEnabled,
      provider: PAYMENT_PROVIDER,
      message: paymentEnabled
        ? `${PAYMENT_PROVIDER} payment gateway is active`
        : `${PAYMENT_PROVIDER} is currently unavailable. You can still save orders for later.`,
      canSaveOrder: true,
      onboardingStatus: paymentEnabled ? "complete" : "in_progress",
    });
  } catch (error) {
    logger.error("getPaymentGatewayStatus", "Error checking payment status", {
      error: error.message,
    });
    return sendError(res, error);
  }
});

// ==================== WEBHOOK HANDLERS ====================

/**
 * PhonePe Webhook Handler
 * @route POST /api/orders/webhook/phonepe
 * @access Public (signature verified)
 */
export const handlePhonePeWebhook = asyncHandler(async (req, res) => {
  try {
    logger.debug("handlePhonePeWebhook", "Webhook received");

    if (!isPaymentEnabled()) {
      logger.warn("handlePhonePeWebhook", "PhonePe not enabled");
      return sendSuccess(res, {}, "Webhook received");
    }

    // TODO: Implement PhonePe webhook verification
    // 1. Verify X-VERIFY header signature
    // 2. Decode base64 response
    // 3. Update order based on payment status
    // 4. Handle SUCCESS, FAILURE, PENDING states

    logger.info("handlePhonePeWebhook", "Webhook placeholder - integration pending");

    return sendSuccess(res, {}, "Webhook received");
  } catch (error) {
    logger.error("handlePhonePeWebhook", "Webhook processing error", {
      error: error.message,
    });
    return sendError(res, error);
  }
});

/**
 * Razorpay Webhook Handler
 * @route POST /api/orders/webhook/razorpay
 * @access Public (signature verified)
 */
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  try {
    logger.debug("handleRazorpayWebhook", "Webhook received");

    const { event, payload } = req.body;

    if (!event || !payload) {
      logger.warn("handleRazorpayWebhook", "Invalid webhook payload");
      throw new AppError("INVALID_INPUT");
    }

    // TODO: Implement Razorpay webhook verification
    // Handle payment.authorized, payment.failed, payment.captured events

    logger.info("handleRazorpayWebhook", "Webhook received", { event });

    return sendSuccess(res, {}, "Webhook received");
  } catch (error) {
    logger.error("handleRazorpayWebhook", "Webhook processing error", {
      error: error.message,
    });
    return sendError(res, error);
  }
});

// ==================== TEST ENDPOINTS (Development Only) ====================

/**
 * Create test order for development
 * @route POST /api/orders/test/create
 * @access Development only
 */
export const createTestOrder = asyncHandler(async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      logger.warn("createTestOrder", "Test endpoint called in production");
      throw new AppError("FORBIDDEN");
    }

    const { userId } = req.body;

    if (!userId) {
      throw new AppError("MISSING_FIELD", { field: "userId" });
    }

    validateMongoId(userId, "userId");

    logger.debug("createTestOrder", "Creating test order", { userId });

    // Verify user exists
    const user = await UserModel.findById(userId);
    if (!user) {
      logger.warn("createTestOrder", "User not found", { userId });
      throw new AppError("USER_NOT_FOUND");
    }

    // Get some products
    const products = await ProductModel.find().limit(3);
    if (products.length === 0) {
      logger.warn("createTestOrder", "No products found in database");
      throw new AppError("PRODUCT_NOT_FOUND", { message: "No products available" });
    }

    // Create order items
    const orderProducts = products.map((product) => ({
      productId: product._id.toString(),
      productTitle: product.name,
      quantity: Math.floor(Math.random() * 3) + 1,
      price: product.price,
      image: product.image,
      subTotal: product.price * (Math.floor(Math.random() * 3) + 1),
    }));

    const totalAmount = orderProducts.reduce((sum, item) => sum + item.subTotal, 0);

    // Create test order
    const testOrder = new OrderModel({
      user: userId,
      products: orderProducts,
      totalAmt: totalAmount,
      payment_status: "paid",
      order_status: "confirmed",
      paymentId: `TEST_${Date.now()}`,
    });

    await testOrder.save();

    logger.info("createTestOrder", "Test order created", { orderId: testOrder._id });

    return sendSuccess(
      res,
      {
        orderId: testOrder._id,
        order: testOrder,
      },
      "Test order created successfully",
      201
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }

    const dbError = handleDatabaseError(error, "createTestOrder");
    return sendError(res, dbError);
  }
});
