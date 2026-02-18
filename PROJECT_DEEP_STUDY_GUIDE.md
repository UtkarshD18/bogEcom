# PROJECT_DEEP_STUDY_GUIDE.md

This guide explains how `bogEcom` works end-to-end, from request flow to scaling strategy.

## 1. Repository Map and Purpose

## Root
- `frontend/`: all user-facing web applications
- `server/`: backend API and domain/business logic
- `.github/workflows/`: CI/CD automation
- `scripts/`: repository-level helper scripts
- `dispatch.yaml`: App Engine dispatch routing across services
- `package.json`: root utility scripts for env validation and orchestration

## Frontend
- `frontend/client/`: customer storefront
- `frontend/admin/`: operations/admin dashboard

### Client Important Paths
- `frontend/client/src/app/`: Next.js App Router pages
- `frontend/client/src/components/`: reusable UI and domain components
- `frontend/client/src/context/`: global state (cart, referral, settings, wishlist, theme)
- `frontend/client/src/hooks/`: custom async/business hooks (payments, notifications)
- `frontend/client/src/utils/`: API wrappers, pricing helpers, sanitization, shipping display
- `frontend/client/src/firebase.js`: Firebase client bootstrap

### Admin Important Paths
- `frontend/admin/src/app/`: route pages for admin modules
- `frontend/admin/src/components/`: dashboard widgets and shared UI
- `frontend/admin/src/context/AdminContext.jsx`: session/auth context for admin
- `frontend/admin/src/utils/api.js`: HTTP client wrapper for admin APIs
- `frontend/admin/src/firebase.js`: admin-side Firebase auth setup

## Backend
- `server/index.js`: bootstrap, middleware chain, route mounting, job startup
- `server/config/`: DB, email, cloud, auth, Firebase config
- `server/controllers/`: request handlers (HTTP adaptation + orchestration)
- `server/services/`: business/domain logic abstractions
- `server/models/`: MongoDB schema definitions + indexes
- `server/routes/`: route to controller wiring
- `server/middlewares/`: auth/admin/validation/upload/rate-limiting/security middleware
- `server/utils/`: shared helpers (error handler, token hash, invoice generation, etc.)
- `server/validation/`: schema-level validation modules
- `server/tests/`: backend test suite
- `server/migrations/`: upgrade and data migration scripts
- `server/realtime/`: Socket.IO initialization and event emitters

## Infrastructure and Automation
- `.github/workflows/ci.yml`: quality checks (env validation, tests, builds, lint pass-through)
- `.github/workflows/deploy-client.yml`: deploy client service
- `.github/workflows/deploy-admin.yml`: deploy admin service
- `.github/workflows/deploy-backend.yml`: deploy backend service
- `server/Dockerfile`: backend container image definition
- `server/.dockerignore`: backend container context pruning

## 2. Backend Request Lifecycle

Flow in `server/index.js`:
1. Environment normalization and required secret checks.
2. DB URI validation and startup guard rails.
3. CORS origin construction from `CLIENT_URL`, `ADMIN_URL`, optional extras.
4. Middleware chain:
   - URL normalization
   - CORS
   - JSON/urlencoded parser
   - cookie parser
   - cookie CSRF origin guard (`createCookieCsrfGuard`)
   - helmet
   - morgan
5. Route-level mounting with dedicated rate limiters.
6. 404 handler.
7. Global error handler.
8. `connectDb()` then start jobs + socket server + HTTP listener.

Why this is important:
- Fail-fast startup prevents insecure runtime with missing secrets.
- CORS + CSRF origin guard defends both API and cookie-auth channels.
- Route-level limiter composition provides differentiated protection.

## 3. Database Connection and Schema Strategy

## DB connection
- File: `server/config/connectDb.js`
- Validates URI prefix (`mongodb://` or `mongodb+srv://`)
- Normalizes quoted env values
- Throws actionable startup errors when invalid

## Schema strategy
- Mongoose models with selective indexing for hot paths:
  - Orders: user/date/status/payment indexes
  - Products: search, category, inventory, featured indexes
  - Coins: user/type/source/reference indexes
  - Wishlist/cart: user and user-product indexes
  - Support tickets: status/date and user/date indexes

Design outcome:
- Query latency stays stable under moderate growth
- Common admin listing endpoints stay index-backed

## 4. Auth and Token Internals

## JWT access tokens
- Issued via `server/utils/generateAccessToken.js`
- 15 minute expiry
- Signed with validated access secret

## Refresh tokens
- Issued via `server/utils/generateRefreshToken.js`
- 7 day expiry
- Stored hashed in DB (`tokenHash.js`)
- Verification supports both hashed and legacy plaintext for migration safety

## Middleware behavior
- `auth.js`: strict auth, rejects missing/expired/invalid token
- `authOptional.js` and `optionalAuth.js`: best-effort identity extraction
- `admin.js`: enforces active user + `role === "Admin"`

## Cookie behavior
- HTTP-only cookies for access and refresh
- `SameSite=None` + `secure=true` in production
- Optional `COOKIE_DOMAIN` support

## Logout hardening
- `logoutController` now:
  - clears auth cookies
  - invalidates refresh token by user id or token hash lookup fallback

## Password security
- Complexity check in registration/reset/backup password
- Bcrypt hashing for stored passwords

## 5. Refresh Token Security Model

Implemented in this hardening pass:
- `server/utils/tokenHash.js`
  - `hashTokenValue`
  - `matchesStoredToken` (timing-safe compare for hashed values + legacy compatibility)
- Updated:
  - `server/utils/generateRefreshToken.js`
  - `server/utils/generateInfluencerRefreshToken.js`
  - `server/controllers/user.controller.js`
  - `server/controllers/influencer.controller.js`

Security gain:
- DB leak no longer directly exposes reusable refresh tokens.

## 6. Middleware Pipeline Deep Dive

## Security middleware
- `helmet`: secure headers
- `cors`: explicit allowlist and credentials handling
- `createCookieCsrfGuard`: blocks cross-origin cookie-auth state-changing requests

## Validation middleware
- `orderValidation.js`: normalizes and validates checkout payloads
- `zodValidate.js`: schema-driven route validation helper
- upload validators (`upload.js`, `supportUpload.js`) enforce file type and size

## Rate limiting
- `generalLimiter`: broad API traffic
- `authLimiter`: login/refresh-sensitive paths
- `adminLimiter`: admin-heavy workflows
- `uploadLimiter`, `supportLimiter`: targeted abuse protection

## 7. Payment Logic (PhonePe)

Primary files:
- `server/services/phonepe.service.js`
- `server/controllers/order.controller.js`
- `server/controllers/membership.controller.js`

Core behavior:
- Payment provider flag controls readiness (`PHONEPE_ENABLED`)
- Order and membership payment initialization are guarded by feature flag + credentials
- Webhook-driven reconciliation updates payment and order status

Safety mechanisms:
- Idempotent order/payment transitions
- Inventory reserve/release/confirm tied to payment outcomes
- Coin redemption deducted only after successful payment

## 8. Shipping Logic (Xpressbees)

Primary files:
- `server/services/xpressbees.service.js`
- `server/controllers/shipping.controller.js`
- `server/controllers/expressbeesWebhook.controller.js`
- `server/services/expressbeesPolling.service.js`

Flow:
1. Validate pincode/phone/payment type
2. Call Xpressbees API endpoints
3. Normalize statuses
4. Update order shipping and status timeline
5. Sync to Firestore + emit realtime update

Resiliency:
- Webhook endpoint with optional secret validation
- Polling fallback for delivery state convergence

## 9. Membership Logic (Dynamic + Admin-Controlled)

Primary files:
- `server/controllers/membership.controller.js`
- `server/services/membershipUser.service.js`
- `server/models/membershipPlan.model.js`
- `server/models/membershipUser.model.js`

Behavior:
- Active plan fetched from DB
- Membership checkout supports coin offset
- On successful payment (or zero payable coin flow), membership is activated with computed expiry
- Admin can create/update/activate plans dynamically

## 10. Coin Logic (Dynamic + Tamper Resistant)

Primary files:
- `server/services/coin.service.js`
- `server/controllers/coin.controller.js`
- `server/models/coinSettings.model.js`
- `server/models/coinTransaction.model.js`

Core principles:
- Server computes earn/redeem amounts
- FIFO redemption across unexpired earn buckets
- Ledger-first consistency with optional legacy sync
- Idempotent source/reference behavior for repeat calls

Admin controls:
- `coinsPerRupee`
- `redeemRate`
- `maxRedeemPercentage`
- `expiryDays`

## 11. Guest Checkout Security Model

Implemented in order validation + controller:
- Required guest fields enforced
- phone/email/pincode format checks
- order totals recalculated server-side
- products and pricing derived from DB, not trusted from client

## 12. Policy/Content/Support Subsystems

## Policy pages
- Managed in DB and rendered dynamically by slug
- Sanitization utilities included for safe output

## Support ticketing
- Strong text sanitization
- upload constraints for images/video
- admin ticket updates with outbound email notifications

## 13. CI/CD Deep Dive

## CI (`ci.yml`)
- Validates env example completeness
- Runs backend tests
- Builds client and admin
- Runs lint in non-blocking mode

## Deploy workflows
- Path-scoped triggers reduce unnecessary deploys
- Secrets are injected into temporary deployment yaml
- Deploy target: Google App Engine services (`client`, `admin`, `default`)

## Why updates appear without manual redeploy
- Pushes to matching paths in `main/master` auto-trigger deployment workflows.
- Example:
  - only `frontend/client/**` changed -> only client service deploys.
  - only `server/**` changed -> backend service deploys.

## 14. Deployment Model

Current production style:
- Service-per-app on App Engine:
  - client frontend
  - admin frontend
  - backend API
- Shared custom domain routes through dispatch/service mapping

Container option:
- Backend container can be built from `server/Dockerfile` for portability.

## 15. Scaling to 10k+ Users (Practical Plan)

Phase 1 (immediate):
- Keep App Engine autoscaling enabled
- Move heavy read patterns to cache (Redis)
- Convert expensive list endpoints to cursor pagination where needed
- Introduce centralized structured logging

Phase 2:
- Queue async workloads (BullMQ or Cloud Tasks) for:
  - email notifications
  - invoice generation
  - webhook retries
  - analytics aggregation

Phase 3:
- Split backend into service domains:
  - auth-service
  - order-service
  - inventory-service
  - notification-service
- Add API gateway + service-to-service auth

## 16. Microservices Migration Blueprint

Suggested extraction order:
1. Notification service
2. Shipping/integration service
3. Auth/session service
4. Orders + inventory service split

Shared contracts:
- Event-driven communication via queue/pubsub
- Shared schema contracts (OpenAPI + JSON schema)
- Idempotency keys and tracing correlation ids

## 17. High-Risk Areas to Watch

- Checkout and inventory state consistency under concurrent purchases
- Webhook replay and out-of-order event handling
- Session/token lifecycle during auth migrations
- Large image/video uploads and storage pressure
- Lint debt causing silent quality drift over time

## 18. Interview Questions From This Project

1. How do you prevent refresh token replay after DB compromise?
2. Why combine CORS with CSRF protections for cookie-auth APIs?
3. How is idempotency handled in payment webhook flows?
4. How does FIFO coin redemption avoid race conditions?
5. What are trade-offs of storing auth tokens in cookies vs localStorage?
6. How do you design order-status transitions to prevent illegal jumps?
7. Where should rate limiting live in distributed deployments?
8. How would you split this monolith into microservices incrementally?
9. How do you ensure price integrity when frontend sends checkout payloads?
10. How would you observe and debug production incidents in this architecture?

## 19. Study Checklist

- Trace one full login -> refresh -> logout cycle.
- Trace one full guest checkout -> order -> webhook -> invoice flow.
- Trace coin earn + redeem and verify ledger state.
- Review CI workflows and map each job to failure blast radius.
- Run migrations in a staging DB and inspect index changes.

## 20. Recommended Next Enhancements

- Make lint blocking once top errors are resolved.
- Add integration tests for auth + checkout + webhook replay.
- Add Redis-backed rate limiting for multi-instance fairness.
- Add OpenTelemetry instrumentation across API and background jobs.

