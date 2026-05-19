# bogEcom

Production-focused MERN commerce platform with:
- Storefront (`frontend/client`)
- Admin panel (`frontend/admin`)
- API and background jobs (`server`)

The repository is structured for real-world operations: auth, checkout, coins, membership, shipping, invoices, support tickets, and Google App Engine deployment.

## System Architecture
```mermaid
flowchart LR
  C[Client Next.js] -->|HTTPS API| B[Express API]
  A[Admin Next.js] -->|HTTPS API| B
  B --> M[(MongoDB)]
  B --> F[(Firebase Admin / FCM)]
  B --> X[(Xpressbees)]
  B --> P[(Paytm)]
  B --> U[(Firebase Storage / Cloudinary Fallback)]
  GH[GitHub Actions] --> AE1[App Engine default]
  GH --> AE2[App Engine client]
  GH --> AE3[App Engine admin]
  GH --> D[App Engine dispatch]
  D --> C
  D --> A
  D --> B
```

## Monorepo Structure
```text
bogEcom/
  frontend/
    client/                  # Customer storefront (Next.js)
    admin/                   # Admin dashboard (Next.js)
  server/                    # Express API, models, services, jobs
  .github/workflows/         # CI + deployment automation
  scripts/                   # Repo-level automation scripts
  dispatch.yaml               # App Engine service routing
```

## Backend Overview
- Entry: `server/index.js`
- Data layer: Mongoose models in `server/models`
- API composition: route modules in `server/routes`
- Business logic: controllers + service layer in `server/controllers` and `server/services`
- Security middleware:
  - `helmet`, `cors`, `cookie-parser`
  - rate limits in `server/middlewares/rateLimiter.js`
  - auth/admin guards in `server/middlewares/auth.js` and `server/middlewares/admin.js`
  - cookie-CSRF origin guard in `server/middlewares/csrfGuard.js`
- Error stack:
  - centralized helpers in `server/utils/errorHandler.js`
  - 404 and global error middleware in `server/index.js`
- Background jobs:
  - reservation expiry
  - membership expiry
  - location log retention
  - Xpressbees polling fallback

## Frontend Overview
### Client (`frontend/client`)
- Next.js App Router storefront
- Checkout, cart, wishlist, policy pages, membership, account, orders
- Firebase auth integration for Google sign-in
- Shared API utility and hooks for token/session handling

### Admin (`frontend/admin`)
- Next.js App Router admin console
- Product/category/banner/blog/content management
- Order and support workflows
- CRM overview, contact list, timeline, and contact updates
- Membership and coin settings management
- Shipping and operational settings screens

## CRM and Customer Operations
- Admin CRM page: `frontend/admin/src/app/crm/page.jsx`
- Public capture endpoint: `POST /api/crm/touchpoint`
- Admin CRM endpoints:
  - `GET /api/admin/crm/overview`
  - `GET /api/admin/crm/contacts`
  - `GET /api/admin/crm/contacts/:contactId/timeline`
  - `PATCH /api/admin/crm/contacts/:contactId`
- Automatic CRM ingestion currently runs from:
  - newsletter subscribe / unsubscribe
  - support ticket create / admin update
  - push token registration
  - order create and paid-order completion
- WhatsApp webhook ingestion is available for Meta-style verification and message/status payloads at `/api/webhooks/whatsapp/meta`.
- Historical CRM backfill script:
  - `npm --prefix server run backfill:crm -- --apply`
- External channels like WhatsApp, Meta, and provider-level email events still require webhook/API integrations before they appear automatically in CRM.

## Authentication Flow
```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant API as Express API
  participant DB as MongoDB

  U->>FE: Login/Register/Google Sign-in
  FE->>API: /api/user/login or /api/user/authWithGoogle
  API->>DB: Validate/create user
  API->>API: Issue JWT access + refresh
  API->>DB: Store hashed refresh token
  API-->>FE: Cookies + auth payload
  FE->>API: Authenticated requests (Bearer/cookies)
  API->>API: Verify access token + role checks
```

### Security Notes
- Refresh tokens are now stored hashed (`server/utils/tokenHash.js`) with backward-compatible verification.
- Logout now invalidates refresh tokens reliably even when only refresh cookie is present.
- Password reset OTP expiry logic uses proper timestamp comparison.
- Backup password and password reset flows enforce password complexity.
- JWT secrets are length-validated and access/refresh secrets must differ.

## E-commerce Logic

### Cart System
- Guest + user carts
- Stock-aware add/update
- Variant-aware checks
- Merge logic hardened to cap quantity and skip unavailable products

### Wishlist
- Auth-required wishlist operations
- Product ID validation and active-product enforcement
- Safe move-to-cart with stock and quantity caps

### Membership
- Admin-managed plans (`MembershipPlan`)
- Payment integration path via Paytm (feature-flagged)
- Membership activation and expiry tracked in DB
- Membership discount dynamically applied during checkout calculations

### Coins
- Dynamic coin settings (`CoinSettings`)
- Earn/redeem/expire ledger (`CoinTransaction`)
- FIFO redemption and idempotency safeguards
- Membership bonus multiplier support
- Server-side caps and validation to prevent frontend manipulation

### Shipping (Xpressbees + fallback)
- Quote endpoint with pincode validation
- Xpressbees booking/tracking/cancel/manifest/NDR/reverse flows
- Webhook support with optional secret validation
- Polling fallback for tracking resiliency

### Guest Checkout
- Guest details normalized + validated in middleware
- Backend remains source-of-truth for order totals, discounts, and inventory

## API Flow and Middleware Chain
```mermaid
flowchart TD
  R[Request] --> N[Normalize URL]
  N --> CORS[CORS Validation]
  CORS --> BP[Body Parser + Cookies]
  BP --> CSRF[Cookie CSRF Origin Guard]
  CSRF --> H[Helmet]
  H --> RL[Rate Limiter]
  RL --> AUTH[Auth/OptionalAuth/Admin]
  AUTH --> VAL[Validation Middleware]
  VAL --> CTRL[Controller + Services]
  CTRL --> DB[(MongoDB)]
  CTRL --> RESP[Standard JSON Response]
  RESP --> ERR[Global Error Handler]
```

## CI/CD

### Quality Pipeline (`.github/workflows/ci.yml`)
- Validates env example files
- Runs backend tests
- Builds client and admin
- Runs lint checks (non-blocking step due existing lint debt)

### Deployment Pipelines
- `deploy-client.yml`: deploys `frontend/client` to the App Engine `client` service
- `deploy-admin.yml`: deploys `frontend/admin` to the App Engine `admin` service
- `deploy-backend.yml`: deploys `server` to the App Engine `default` service
- `deploy-dispatch.yml`: deploys `dispatch.yaml` routing for the apex domain

All deploy workflows:
- authenticate using service account secret
- render service-specific App Engine deploy manifests with injected env vars
- deploy via `gcloud app deploy`
- update App Engine dispatch routing for the apex domain

## Environment Variables

### Backend (`server/.env`)
| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | Yes | Runtime mode (`development`/`production`) |
| `PORT` | Yes | API listen port |
| `MONGO_URI` | Yes | MongoDB connection string |
| `ACCESS_TOKEN_SECRET` | Yes | Access JWT secret (32+ chars) |
| `REFRESH_TOKEN_SECRET` | Yes | Refresh JWT secret (32+ chars) |
| `CLIENT_URL` | Yes | Allowed storefront origin(s) |
| `ADMIN_URL` | Yes | Allowed admin origin(s) |
| `CORS_ORIGINS` | No | Extra comma-separated CORS origins |
| `COOKIE_DOMAIN` | No | Cookie domain override in production |
| `EMAIL`, `EMAIL_PASSWORD` | No | SMTP for OTP/support |
| `PAYTM_*` | Conditional | Paytm integration |
| `XPRESSBEES_*` | Conditional | Xpressbees integration |
| `FIREBASE_*` | Conditional | Firebase Admin/FCM and Firebase Storage bucket config |
| `MEDIA_STORAGE_PROVIDER` | No | `firebase` by default, `cloudinary` for legacy fallback |
| `FIREBASE_STORAGE_BUCKET`, `GCS_MEDIA_*` | Conditional | Firebase Storage / GCS media delivery |
| `CLOUDINARY_*` | Optional | Legacy media storage fallback |

### Client (`frontend/client/.env.local`)
| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | API base URL |
| `NEXT_PUBLIC_APP_API_URL` | No | Explicit app API override |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public canonical site URL |
| `NEXT_PUBLIC_FIREBASE_*` | Conditional | Firebase Web SDK config |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Optional | Push messaging |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional | Maps/address helpers |

### Admin (`frontend/admin/.env.local`)
| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | API base URL |
| `NEXT_PUBLIC_FIREBASE_*` | Conditional | Firebase Web SDK config |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Optional | Analytics |

## Local Development

1. Install dependencies:
```bash
npm ci
npm --prefix server ci
npm --prefix frontend/client ci
npm --prefix frontend/admin ci
```

2. Configure env files from examples:
- `server/.env`
- `frontend/client/.env.local`
- `frontend/admin/.env.local`

3. Run services:
```bash
npm --prefix server run dev
npm --prefix frontend/client run dev
npm --prefix frontend/admin run dev
```

4. Validate env docs:
```bash
node scripts/validate-env-examples.mjs
```

## Production Setup (App Engine)

1. Configure GitHub secrets required by deploy workflows.
2. Configure the App Engine custom domain and `dispatch.yaml` routes for `healthyonegram.com`.
3. Push to `main` (path-based workflows deploy changed service).
4. Optionally run `workflow_dispatch` for manual deploy.
5. Verify App Engine service health, routing, and the configured media bucket/CDN URLs.

## Docker Support
- Backend container spec added:
  - `server/Dockerfile`
  - `server/.dockerignore`

Example build/run:
```bash
cd server
docker build -t bogecom-api .
docker run --env-file .env -p 8080:8080 bogecom-api
```

## Security Measures Implemented
- Hashed refresh token persistence and secure verification
- JWT secret strength enforcement
- CORS allowlist enforcement
- Cookie-auth CSRF origin guard for mutating routes
- Helmet security headers
- Route-level rate limiting
- Input validation and sanitization in key checkout/support/auth paths
- Admin route protection with auth + role checks
- Global error handling and controlled error responses in production

## Performance and Reliability
- Mongoose indexes on key query paths (orders/products/coins/wishlist/support/etc.)
- Shipping config caching and settings cache
- Idempotent coin and inventory operations
- Reservation expiry jobs for stale checkouts
- Firestore sync hooks for realtime visibility

## API Documentation (High-level)

### Auth/User
- `POST /api/user/register`
- `POST /api/user/login`
- `POST /api/user/refresh-token`
- `GET /api/user/logout`
- `POST /api/user/authWithGoogle`

### Orders/Checkout
- `POST /api/orders`
- `POST /api/orders/save-for-later`
- `GET /api/orders/payment-status`
- `POST /api/orders/webhook/paytm`

### Membership/Coins
- `GET /api/membership/active`
- `POST /api/membership/create-order`
- `POST /api/membership/verify-payment`
- `GET /api/coins/settings/public`
- `GET /api/user/coins-summary`

### Shipping
- `POST /api/shipping/quote`
- `GET /api/shipping/display-metrics`
- `POST /api/webhooks/expressbees`

### Admin
- `GET /api/orders/admin/all`
- `PATCH /api/admin/orders/:id/status`
- `GET /api/settings/admin/all`
- `GET /api/support/admin/all`

## Current Gaps / Future Improvements
- Gradually convert client/admin lint warnings into blocking CI
- Add Redis cache for rate-limits/session-scale
- Add queue workers (BullMQ) for async jobs and retries
- Add structured logging transport (Winston + GCP logging)
- Add Prometheus/OpenTelemetry metrics and alerting
- Break out auth and notification services for microservice evolution

## Additional Study Material
- Deep technical walkthrough: `PROJECT_DEEP_STUDY_GUIDE.md`

