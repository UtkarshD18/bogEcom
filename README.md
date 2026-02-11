# bogEcom Enterprise Upgrade (MERN)

This repository now includes a phased, production-safe enterprise upgrade covering:

1. Wishlist + Product UI improvements
2. Purchase Order (PO) system
3. Centralized GST/Tax engine
4. ExpressBees shipping quote integration
5. Invoice generation + download
6. Dynamic membership discounts
7. Dynamic coin settings + redemption/earning
8. Dynamic Policy CMS + footer sync
9. Guest checkout validation
10. Refund policy sync enforcement
11. Account/logout/settings improvements
12. Service-oriented backend architecture upgrades

## 🔄 Recent Updates
- Added order status timeline with guarded transitions (PENDING → PAYMENT_PENDING → ACCEPTED → IN_WAREHOUSE → SHIPPED → OUT_FOR_DELIVERY → DELIVERED)
- ExpressBees webhook sync with fallback polling for tracking updates, idempotent handling, and RTO safety
- Real-time order updates via Socket.io with client-side order tracker animations
- New admin status update endpoint: `PATCH /api/admin/orders/:id/status` (Zod validated)
- Added user alias endpoint: `GET /api/orders/my-orders`
- Added ExpressBees webhook endpoint: `POST /api/webhooks/expressbees`
- Expanded admin UI status options for Accepted/In Warehouse/Out for Delivery
- Firestore sync updated to mirror status timeline entries
- Production inventory system with atomic reserve/deduct/release/restore and idempotent guards
- Variant-aware inventory tracking with audit trail logging
- Reservation expiry job for unpaid orders (configurable via env flags)
- Low-stock dashboard card + admin filter link
- Inventory audit APIs for admin monitoring

## Phase Plan

### Phase 1
- Policy CMS
- Wishlist upgrades
- Product page UI refresh

### Phase 2
- GST engine centralization
- Shipping quote integration with fallback

### Phase 3
- Purchase Orders
- Invoice persistence + PDF download

### Phase 4
- Membership discount application
- Coin earn/redeem system

Deploy and validate after each phase.

## Architecture Updates

### New backend services
- `server/services/tax.service.js`
- `server/services/refund.service.js`
- `server/services/coin.service.js`
- `server/services/membership.service.js`
- `server/services/shippingRate.service.js`

### Controller/route modularization added
- Policy, Coin, PurchaseOrder, Invoice, Refund modules

### Centralized logic rules
- Tax logic only from `TaxService.calculateTax(subtotal, state)`
- Refund checks only from `RefundService.evaluateRefundEligibility(...)`
- Shipping quote from shipping service with ExpressBees fallback
- Membership discount applied before tax
- Coin redemption applied before tax, capped by admin-defined max %

## Database Blueprint

Core collections:
- Users
- Products
- Orders
- PurchaseOrders
- Invoices
- MembershipPlans
- CoinSettings
- Policies
- Wishlists

### New collections/models
- `PurchaseOrder`
- `Invoice`
- `Policy`
- `CoinSettings`

### Key schema additions
- `Order`: `subtotal`, `gst`, `gstNumber`, `billingDetails`, `guestDetails`, `membershipDiscount`, `membershipPlan`, `coinRedemption`, `coinsAwarded`, `purchaseOrder`
- `User`: `coinBalance`, notification defaults enabled
- `MembershipPlan`: `durationDays`, `discountPercentage`, `active` (legacy compatibility kept)
- `Wishlist`: duplicate protection + indexing

### Indexing and constraints
- Policy slug unique index
- Invoice `orderId` unique, `invoiceNumber` unique
- PurchaseOrder user/status/time indexes
- Order gst/purchaseOrder/invoice indexes
- Wishlist user + item product composite index
- CoinSettings singleton (`isDefault` unique)

## Migration

Enterprise migration script:

```bash
cd server
npm run migrate:enterprise
```

What it does:
- Backfills user coin balances and enabled notification defaults
- Normalizes membership fields
- Ensures default coin settings singleton
- Seeds default policies (`terms-and-conditions`, `return-policy`)
- Backfills order subtotal/GST/billing/coin fields

Inventory backfill migration:

```bash
cd server
node migrations/2026-02-inventory-backfill.mjs
```

What it does:
- Backfills `stock_quantity`, `reserved_quantity`, `track_inventory`, `low_stock_threshold`
- Syncs legacy `stock` values
- Backfills variant stock/reserved fields

## New Environment Variables

Add/update these in `server/.env`:

- `SHIPPER_PINCODE` or `XPRESSBEES_ORIGIN_PINCODE`
- `XPRESSBEES_BASE_URL`
- `XPRESSBEES_TOKEN_TTL_MINUTES`
- `XPRESSBEES_TOKEN` or `XPRESSBEES_EMAIL` + `XPRESSBEES_PASSWORD`
- `XPRESSBEES_WEBHOOK_SECRET` (optional)
- `XPRESSBEES_POLL_ENABLED` (optional)
- `XPRESSBEES_POLL_INTERVAL_MINUTES` (optional)
- `XPRESSBEES_POLL_BATCH_SIZE` (optional)
- `INVOICE_SELLER_NAME`
- `INVOICE_SELLER_GSTIN`
- `INVOICE_SELLER_ADDRESS`
- `INVOICE_SELLER_STATE`
- `INVOICE_SELLER_STATE_CODE`
- `INVOICE_SELLER_PHONE`
- `INVOICE_SELLER_EMAIL`
- `INVOICE_CURRENCY_SYMBOL`
- `INVOICE_DEFAULT_HSN`
- `INVOICE_DEFAULT_GST_RATE` (set `5`)
- `PHONEPE_ORDER_REDIRECT_URL` (optional override)
- `PHONEPE_ORDER_CALLBACK_URL` (optional override)
- `INVENTORY_RESERVATION_ENABLED` (optional, default false)
- `INVENTORY_RESERVATION_MINUTES` (optional, default 30)
- `INVENTORY_RESERVATION_INTERVAL_MINUTES` (optional, default 5)
- `INVENTORY_RESERVATION_BATCH_SIZE` (optional, default 50)

## GST Rules

Tax rate: `5%`

- Rajasthan: `CGST 2.5% + SGST 2.5%`
- Other states: `IGST 5%`

Formula:

`tax = subtotal * 5 / 100`

## Shipping Rules

- Pincode must be 6 digits
- ExpressBees quote attempted first
- Fallback amount returned from admin shipping settings when API fails
- Quote responses are cached in-memory for performance

## Refund Policy Enforcement

Current enforced policy:
- Prepaid orders only
- Manual approval required
- No standard returns flow
- Refundable amount = product cost only
- Shipping is non-refundable

Endpoint:
- `POST /api/refunds/evaluate` (admin-authenticated)

## Policy CMS

Public:
- `GET /api/policies/public`
- `GET /api/policies/public/:slug`

Admin:
- `GET /api/policies/admin/all`
- `POST /api/policies/admin`
- `PUT /api/policies/admin/:id`
- `PATCH /api/policies/admin/:id/toggle`
- `DELETE /api/policies/admin/:id`

Frontend:
- Dynamic policy page: `/policy/[slug]`
- Footer links synced dynamically to policy slugs

## Purchase Order + Invoice APIs

Purchase order:
- `POST /api/purchase-orders`
- `GET /api/purchase-orders/:id`
- `GET /api/purchase-orders/:id/pdf`
- `POST /api/purchase-orders/:id/convert`

Invoice:
- `GET /api/invoices/order/:orderId`
- `GET /api/invoices/order/:orderId/download`
- Existing download route also available: `GET /api/orders/:orderId/invoice`

## Inventory APIs (Admin)

- `GET /api/admin/inventory/audit`
- `GET /api/admin/inventory/audit/:productId`

## Guest Checkout

Required fields:
- `fullName`
- `phone`
- `address`
- `pincode`
- `state`
- `email`

Optional:
- `gst`

Validated in frontend and backend.

## Validation Checklist

Manual regression checklist:
- Guest checkout with required fields
- GST split in Rajasthan
- GST as IGST for non-Rajasthan
- Shipping quote + fallback behavior
- Coin redemption cap
- Membership discount before tax
- PO creation and conversion
- Invoice generation and PDF download
- Dynamic policy rendering by slug
- Footer policy links resolve dynamically
- Refund eligibility matches policy
- Inventory reserve on order creation
- Inventory deduct on payment success
- Inventory release on payment failure/cancel
- Reservation expiry auto-release (if enabled)
- Low-stock dashboard count updates
- Inventory audit entries created

## Deployment Safety Plan

1. Backup database and export current indexes
2. Deploy backend with feature flags/env set
3. Run migration: `npm run migrate:enterprise`
4. Smoke test APIs (policy, tax, shipping quote, order flow)
5. Deploy client and admin frontend
6. Run checkout and order lifecycle tests in staging
7. Enable phase-wise rollout to production
8. Monitor logs and payment/shipping error rates
9. Roll back by disabling new routes/features via config if required

## Risk Analysis

### GST miscalculation
- Mitigation: single tax service used by Order + PO + Invoice

### Discount stacking conflicts
- Mitigation: deterministic sequence
  membership -> influencer -> coupon -> coin redemption -> tax

### Coin abuse
- Mitigation: server-side coin cap, balance validation, post-payment deduction

### Shipping API downtime
- Mitigation: fallback shipping calculation + cache

### Duplicate invoice creation
- Mitigation: invoice upsert keyed by `orderId`

### Policy XSS risk
- Mitigation: sanitize HTML before save and before render

## Notes

- Existing routes were preserved; new capabilities were added modularly.
- Lint output currently includes pre-existing repo-wide issues unrelated to this upgrade; server-side syntax checks pass for upgraded modules.
