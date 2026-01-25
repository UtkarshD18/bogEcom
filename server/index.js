import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import connectDb from "./config/connectDb.js";
dotenv.config();

// Route imports
import bannerRouter from "./routes/banner.route.js";
import blogRouter from "./routes/blog.route.js";
import cartRouter from "./routes/cart.route.js";
import categoryRouter from "./routes/category.route.js";
import homeSlideRouter from "./routes/homeSlide.route.js";
import membershipRouter from "./routes/membership.route.js";
import orderRouter from "./routes/order.route.js";
import productRouter from "./routes/product.route.js";
import uploadRouter from "./routes/upload.route.js";
import userRouter from "./routes/user.route.js";
import wishlistRouter from "./routes/wishlist.route.js";

// Rate limiting - only import if package is installed
let generalLimiter, authLimiter, paymentLimiter, uploadLimiter;
try {
  const rateLimitModule = await import("./middlewares/rateLimiter.js");
  generalLimiter = rateLimitModule.generalLimiter;
  authLimiter = rateLimitModule.authLimiter;
  paymentLimiter = rateLimitModule.paymentLimiter;
  uploadLimiter = rateLimitModule.uploadLimiter;
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
      noopMiddleware;
}

// Route imports

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ CORS configuration
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"]
  : ["http://localhost:3000", "http://localhost:3001"];

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
app.use(morgan("dev"));
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
app.use("/api/user", authLimiter, userRouter);
app.use("/api/products", generalLimiter, productRouter);
app.use("/api/categories", generalLimiter, categoryRouter);
app.use("/api/banners", generalLimiter, bannerRouter);
app.use("/api/home-slides", generalLimiter, homeSlideRouter);
app.use("/api/blogs", generalLimiter, blogRouter);
app.use("/api/orders", paymentLimiter, orderRouter);
app.use("/api/cart", generalLimiter, cartRouter);
app.use("/api/wishlist", generalLimiter, wishlistRouter);
app.use("/api/upload", uploadLimiter, uploadRouter);
app.use("/api/membership", paymentLimiter, membershipRouter);

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

// start server after DB connect
connectDb().then(() => {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📦 API Base URL: http://localhost:${PORT}/api`);
  });
});
