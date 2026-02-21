import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import http from "http";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import {
  ACCESS_TOKEN_SECRET_KEYS,
  REFRESH_TOKEN_SECRET_KEYS,
  getAccessTokenSecret,
  getRefreshTokenSecret,
} from "./config/authSecrets.js";
import connectDb from "./config/connectDb.js";
import createCookieCsrfGuard from "./middlewares/csrfGuard.js";
import {
  adminLimiter,
  authLimiter,
  generalLimiter,
  uploadLimiter,
} from "./middlewares/rateLimiter.js";
import { UPLOAD_ROOT } from "./middlewares/upload.js";

dotenv.config();

const normalizeEnvValue = (value) => {
  let normalized = String(value || "").trim();

  const hasWrappedDoubleQuotes =
    normalized.startsWith('"') && normalized.endsWith('"');
  const hasWrappedSingleQuotes =
    normalized.startsWith("'") && normalized.endsWith("'");

  if (hasWrappedDoubleQuotes || hasWrappedSingleQuotes) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
};

const isValidMongoUri = (value) => /^mongodb(\+srv)?:\/\//.test(value);
const primaryMongoUri = normalizeEnvValue(process.env.MONGO_URI);
const fallbackMongoUri = normalizeEnvValue(process.env.MONGODB_URI);
const normalizedMongoUri = isValidMongoUri(primaryMongoUri)
  ? primaryMongoUri
  : isValidMongoUri(fallbackMongoUri)
    ? fallbackMongoUri
    : "";

if (!normalizedMongoUri) {
  if (!primaryMongoUri && !fallbackMongoUri) {
    throw new Error(
      "Database URI is missing. Set MONGO_URI or MONGODB_URI in environment variables.",
    );
  }

  throw new Error(
    "Invalid MongoDB URI format. Set MONGO_URI or MONGODB_URI to a value that starts with mongodb:// or mongodb+srv://",
  );
}

process.env.MONGO_URI = normalizedMongoUri;

const runtimeIsProduction = process.env.NODE_ENV === "production";
const normalizeOriginEnv = (value) =>
  normalizeEnvValue(value).replace(/\/+$/, "");
const isValidHttpUrl = (value) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const fallbackClientUrl = "http://localhost:3000";
const fallbackAdminUrl = "http://localhost:3001";

let normalizedClientUrl = normalizeOriginEnv(process.env.CLIENT_URL);
let normalizedAdminUrl = normalizeOriginEnv(process.env.ADMIN_URL);

if (!isValidHttpUrl(normalizedClientUrl)) {
  if (runtimeIsProduction) {
    throw new Error("CLIENT_URL is not defined or invalid");
  }
  normalizedClientUrl = fallbackClientUrl;
  console.warn(
    `CLIENT_URL is missing/invalid; defaulting to ${normalizedClientUrl} for local development.`,
  );
}

if (!isValidHttpUrl(normalizedAdminUrl)) {
  if (runtimeIsProduction) {
    throw new Error("ADMIN_URL is not defined or invalid");
  }
  normalizedAdminUrl = fallbackAdminUrl;
  console.warn(
    `ADMIN_URL is missing/invalid; defaulting to ${normalizedAdminUrl} for local development.`,
  );
}

process.env.CLIENT_URL = normalizedClientUrl;
process.env.ADMIN_URL = normalizedAdminUrl;

const accessTokenSecret = getAccessTokenSecret();
if (!accessTokenSecret) {
  throw new Error(
    `Access token secret is not configured. Set one of: ${ACCESS_TOKEN_SECRET_KEYS.join(", ")}`,
  );
}

const refreshTokenSecret = getRefreshTokenSecret();
if (!refreshTokenSecret) {
  throw new Error(
    `Refresh token secret is not configured. Set one of: ${REFRESH_TOKEN_SECRET_KEYS.join(", ")}`,
  );
}

const MIN_JWT_SECRET_LENGTH = 32;
if (accessTokenSecret.length < MIN_JWT_SECRET_LENGTH) {
  throw new Error(
    `Access token secret must be at least ${MIN_JWT_SECRET_LENGTH} characters long.`,
  );
}
if (refreshTokenSecret.length < MIN_JWT_SECRET_LENGTH) {
  throw new Error(
    `Refresh token secret must be at least ${MIN_JWT_SECRET_LENGTH} characters long.`,
  );
}
if (accessTokenSecret === refreshTokenSecret) {
  throw new Error(
    "Access and refresh token secrets must be different values.",
  );
}

// Route imports
import { initSocket } from "./realtime/socket.js";
import aboutPageRouter from "./routes/aboutPage.route.js";
import addressRouter from "./routes/address.route.js";
import adminMembershipRouter from "./routes/adminMembership.route.js";
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
import supportRouter from "./routes/support.route.js";
import statisticsRouter from "./routes/statistics.route.js";
import uploadRouter from "./routes/upload.route.js";
import userRouter from "./routes/user.route.js";
import userLocationLogRouter from "./routes/userLocationLog.route.js";
import vendorRouter from "./routes/vendor.routes.js";
import webhookRouter from "./routes/webhook.route.js";
import wishlistRouter from "./routes/wishlist.route.js";
import { startExpressbeesPolling } from "./services/expressbeesPolling.service.js";
import { startInventoryReservationExpiryJob } from "./services/inventoryReservationExpiry.service.js";
import { startMembershipExpiryJob } from "./services/membershipExpiry.service.js";
import { startLocationLogRetentionJob } from "./services/userLocationLog.service.js";

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
app.disable("x-powered-by");

if (isProductionEnv) {
  app.set("trust proxy", 1);
}

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
    origin: function (origin, callback) {
      const normalized = normalizeOrigin(origin);
      if (
        !origin ||
        allowedOrigins.includes(normalized) ||
        (!isProductionEnv && isDevLocalhostOrigin(normalized))
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Session-Id"],
  }),
);

const shouldCaptureRawBody = (req) => {
  const requestPath = String(req?.originalUrl || req?.url || "");
  return requestPath.startsWith("/api/webhooks/");
};

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      if (!buf || buf.length === 0) return;
      if (shouldCaptureRawBody(req)) {
        req.rawBody = buf.toString("utf8");
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(
  createCookieCsrfGuard({
    allowedOrigins,
    isProduction: isProductionEnv,
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// Serve uploaded files from the same root multer writes to.
app.use("/uploads", express.static(UPLOAD_ROOT));

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
app.use("/api/orders", generalLimiter, orderRouter);
app.use("/api/admin/orders", adminLimiter, adminOrdersRouter);
app.use("/api/admin", adminLimiter, adminMembershipRouter);
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
app.use("/api/notifications", generalLimiter, notificationRouter);
app.use("/api/newsletter", generalLimiter, newsletterRouter);
app.use("/api/settings", generalLimiter, settingsRouter);
app.use("/api/shipping", generalLimiter, shippingRouter);
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
app.use("/api/support", generalLimiter, supportRouter);

app.use((req, res, next) => {
  res.status(404).json({
    error: true,
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

app.use((err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === "production";
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

const DEFAULT_PORT = 8000;
const MAX_PORT_RETRIES = 10;

const getRequestedPort = () => {
  const parsedPort = Number.parseInt(process.env.PORT, 10);
  if (Number.isInteger(parsedPort) && parsedPort > 0) {
    return parsedPort;
  }
  return DEFAULT_PORT;
};

const parseBooleanEnv = (value) =>
  /^(1|true|yes|on)$/i.test(String(value || "").trim());

const isPortFallbackEnabled = (isProduction) =>
  !isProduction && parseBooleanEnv(process.env.ALLOW_PORT_FALLBACK);

const wrapAddressInUseError = (error, port) => {
  if (error?.code !== "EADDRINUSE") {
    return error;
  }

  const wrappedError = new Error(
    `[startup] Port ${port} is already in use. Stop the process using this port, or set ALLOW_PORT_FALLBACK=true to auto-try the next available port in development.`,
  );
  wrappedError.code = error.code;
  wrappedError.cause = error;
  return wrappedError;
};

const listenWithPortPolicy = ({
  serverInstance,
  startPort,
  allowPortFallback,
}) =>
  new Promise((resolve, reject) => {
    let attempts = 0;
    let currentPort = startPort;

    const tryListen = () => {
      attempts += 1;

      const onError = (error) => {
        serverInstance.off("listening", onListening);

        const canRetry =
          allowPortFallback &&
          error?.code === "EADDRINUSE" &&
          attempts <= MAX_PORT_RETRIES;

        if (canRetry) {
          const blockedPort = currentPort;
          currentPort += 1;
          console.warn(
            `[startup] Port ${blockedPort} is in use. Retrying on ${currentPort}...`,
          );
          tryListen();
          return;
        }

        reject(wrapAddressInUseError(error, currentPort));
      };

      const onListening = () => {
        serverInstance.off("error", onError);
        resolve(currentPort);
      };

      serverInstance.once("error", onError);
      serverInstance.once("listening", onListening);
      serverInstance.listen(currentPort);
    };

    tryListen();
  });

connectDb().then(async () => {
  await initializeSettings();

  // Firebase is optional in production; skip initialization when credentials are absent.
  if (process.env.FIREBASE_PRIVATE_KEY) {
    try {
      initializeFirebaseAdmin();
    } catch (error) {
      console.error(
        "Firebase initialization skipped due to configuration error:",
        error?.message || error,
      );
    }
  } else {
    console.log(
      "Firebase credentials not provided; push notifications are disabled.",
    );
  }

  startLocationLogRetentionJob();

  const requestedPort = getRequestedPort();

  initSocket(server, {
    origins: allowedOrigins,
    jwtSecret: accessTokenSecret,
  });

  const allowPortFallback = isPortFallbackEnabled(isProductionEnv);

  if (allowPortFallback) {
    console.warn(
      "[startup] ALLOW_PORT_FALLBACK=true. Server will retry on the next port if the requested one is busy.",
    );
  }

  const boundPort = await listenWithPortPolicy({
    serverInstance: server,
    startPort: requestedPort,
    allowPortFallback,
  });
  process.env.PORT = String(boundPort);
  console.log(`Server is running on port ${boundPort}`);
  console.log("API service started");

  try {
    startExpressbeesPolling();
  } catch (error) {
    console.error(
      "Xpressbees polling startup skipped due to configuration error:",
      error?.message || error,
    );
  }
  startInventoryReservationExpiryJob();
  startMembershipExpiryJob();
}).catch((error) => {
  console.error(
    "Server startup failed:",
    error?.message || error,
  );
  process.exit(1);
});
