import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import http from "http";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import connectDb from "./config/connectDb.js";
dotenv.config();

// Route imports
import { initSocket } from "./realtime/socket.js";
import aboutPageRouter from "./routes/aboutPage.route.js";
import addressRouter from "./routes/address.route.js";
import adminOrdersRouter from "./routes/adminOrders.route.js";
import adminReviewRouter from "./routes/adminReview.route.js";
import bannerRouter from "./routes/banner.route.js";
import blogRouter from "./routes/blog.route.js";
import cancellationPolicyRouter from "./routes/cancellationPolicy.routes.js";
import cartRouter from "./routes/cart.route.js";
import categoryRouter from "./routes/category.route.js";
import coinRouter from "./routes/coin.route.js";
import couponRouter from "./routes/coupon.route.js";
import homeMembershipContentRouter from "./routes/homeMembershipContent.route.js";
import homeSlideRouter from "./routes/homeSlide.route.js";
import influencerRouter from "./routes/influencer.route.js";
import inventoryAuditRouter from "./routes/inventoryAudit.route.js";
import invoiceRouter from "./routes/invoice.route.js";
import membershipRouter from "./routes/membership.route.js";
import membershipPageRouter from "./routes/membershipPage.route.js";
import newsletterRouter from "./routes/newsletter.route.js";
import notificationRouter from "./routes/notification.route.js";
import orderRouter from "./routes/order.route.js";
import policyRouter from "./routes/policy.route.js";
import productRouter from "./routes/product.route.js";
import purchaseOrderRouter from "./routes/purchaseOrder.route.js";
import refundRouter from "./routes/refund.route.js";
import reviewRouter from "./routes/review.route.js";
import settingsRouter from "./routes/settings.route.js";
import shippingRouter from "./routes/shipping.route.js";
import statisticsRouter from "./routes/statistics.route.js";
import uploadRouter from "./routes/upload.route.js";
import userRouter from "./routes/user.route.js";
import userLocationLogRouter from "./routes/userLocationLog.route.js";
import vendorRouter from "./routes/vendor.routes.js";
import webhookRouter from "./routes/webhook.route.js";
import wishlistRouter from "./routes/wishlist.route.js";
import { startExpressbeesPolling } from "./services/expressbeesPolling.service.js";
import { startInventoryReservationExpiryJob } from "./services/inventoryReservationExpiry.service.js";

// Rate limiting - only import if package is installed
let generalLimiter, authLimiter, paymentLimiter, uploadLimiter, adminLimiter;
try {
  const rateLimitModule = await import("./middlewares/rateLimiter.js");
  generalLimiter = rateLimitModule.generalLimiter;
  authLimiter = rateLimitModule.authLimiter;
  paymentLimiter = rateLimitModule.paymentLimiter;
  uploadLimiter = rateLimitModule.uploadLimiter;
  adminLimiter = rateLimitModule.adminLimiter;
  console.log("✓ Rate limiting enabled");
} catch (e) {
  // express-rate-limit not installed - skip rate limiting
  console.log(
    "⚠ Rate limiting disabled (install express-rate-limit to enable)",
  );
  const noopMiddleware = (req, res, next) => next();
  generalLimiter =
    authLimiter =
    paymentLimiter =
    uploadLimiter =
    adminLimiter =
      noopMiddleware;
}

// Route imports

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Redirect duplicate slashes in request paths (e.g., //api/cart -> /api/cart)
app.use((req, res, next) => {
  const [pathname, query = ""] = req.url.split("?");
  const normalizedPath = pathname.replace(/\/{2,}/g, "/");

  if (normalizedPath !== pathname) {
    const normalizedUrl = query ? `${normalizedPath}?${query}` : normalizedPath;
    return res.redirect(308, normalizedUrl);
  }

  next();
});

// ✅ CORS configuration
const normalizeOrigin = (origin) =>
  String(origin || "")
    .trim()
    .replace(/\/+$/, "");

const envOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map(normalizeOrigin).filter(Boolean)
  : [];
// Fallback to SITE_BASE_URL when FRONTEND_URL is not provided
if (envOrigins.length === 0 && process.env.SITE_BASE_URL) {
  envOrigins.push(normalizeOrigin(process.env.SITE_BASE_URL));
}

const isProduction = process.env.NODE_ENV === "production";
const defaultDevOrigins = ["http://localhost:3000", "http://localhost:3001"];
// In production, only allow explicitly configured origins
const allowedOrigins = Array.from(
  new Set([...envOrigins, ...(isProduction ? [] : defaultDevOrigins)]),
);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Session-Id"],
  }),
);

// middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// Logging: Use 'combined' format in production, 'dev' in development
if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined")); // Apache-style logs for production
} else {
  app.use(morgan("dev")); // Colored concise output for development
}

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

// Serve static files (uploads)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// test route
app.get("/", (req, res) => {
  res.json({
    message: "Server is running",
    port: process.env.PORT,
    version: "1.0.0",
  });
});

// API routes with rate limiting
app.use("/api/about", generalLimiter, aboutPageRouter);
app.use("/api/user", authLimiter, userRouter);
app.use("/api/address", generalLimiter, addressRouter);
app.use("/api/products", generalLimiter, productRouter);
app.use("/api/categories", generalLimiter, categoryRouter);
app.use("/api/banners", adminLimiter, bannerRouter);
app.use("/api/home-slides", adminLimiter, homeSlideRouter);
app.use("/api/blogs", adminLimiter, blogRouter);
app.use("/api/orders", adminLimiter, orderRouter);
app.use("/api/admin/orders", adminLimiter, adminOrdersRouter);
app.use("/api/cart", generalLimiter, cartRouter);
app.use("/api/wishlist", generalLimiter, wishlistRouter);
app.use("/api/upload", uploadLimiter, uploadRouter);
app.use("/api/membership/page", generalLimiter, membershipPageRouter);
app.use(
  "/api/membership/home-content",
  generalLimiter,
  homeMembershipContentRouter,
);
app.use("/api/membership", generalLimiter, membershipRouter);
app.use("/api/statistics", adminLimiter, statisticsRouter);
app.use("/api/coupons", generalLimiter, couponRouter);
app.use("/api/coins", generalLimiter, coinRouter);
app.use("/api/influencers", generalLimiter, influencerRouter);
app.use("/api/invoices", generalLimiter, invoiceRouter);
app.use("/api/settings", adminLimiter, settingsRouter);
app.use("/api/notifications", generalLimiter, notificationRouter);
app.use("/api/newsletter", generalLimiter, newsletterRouter);
app.use("/api/shipping", adminLimiter, shippingRouter);
app.use("/api/webhooks", generalLimiter, webhookRouter);
app.use("/api/policies", generalLimiter, policyRouter);
app.use("/api/cancellation", generalLimiter, cancellationPolicyRouter);
app.use("/api/location-logs", adminLimiter, userLocationLogRouter);
app.use("/api/purchase-orders", generalLimiter, purchaseOrderRouter);
app.use("/api/reviews", generalLimiter, reviewRouter);
app.use("/api/admin/reviews", adminLimiter, adminReviewRouter);
app.use("/api/vendors", adminLimiter, vendorRouter);
app.use("/api/refunds", adminLimiter, refundRouter);
app.use("/api/admin/inventory", adminLimiter, inventoryAuditRouter);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    error: true,
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global error handler - don't leak stack traces in production
app.use((err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === "production";

  // Log error details server-side
  console.error("Global error:", isProduction ? err.message : err);

  res.status(err.status || 500).json({
    error: true,
    success: false,
    message: isProduction
      ? "An unexpected error occurred"
      : err.message || "Internal server error",
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

// Import settings initializer
import { initializeFirebaseAdmin } from "./config/firebaseAdmin.js";
import { initializeSettings } from "./controllers/settings.controller.js";
import { startLocationLogRetentionJob } from "./services/userLocationLog.service.js";

// start server after DB connect
connectDb().then(async () => {
  // Initialize default settings
  await initializeSettings();

  // Initialize Firebase Admin SDK for push notifications
  initializeFirebaseAdmin();

  // Soft-archive expired Google Maps location logs (90-day retention)
  startLocationLogRetentionJob();

  const PORT = process.env.PORT || 8000;
  const server = http.createServer(app);
  initSocket(server, {
    origins: allowedOrigins,
    jwtSecret: process.env.SECRET_KEY_ACCESS_TOKEN,
  });
  server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📦 API Base URL: http://localhost:${PORT}/api`);
  });

  startExpressbeesPolling();
  startInventoryReservationExpiryJob();
});
