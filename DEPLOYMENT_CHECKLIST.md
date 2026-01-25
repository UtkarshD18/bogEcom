# 🚀 Production Deployment Checklist

**Final verification before going live with the e-commerce platform**

---

## ✅ Pre-Deployment Requirements

### **1. Environment Configuration**

- [ ] Copy `server/.env.example` to `server/.env`
- [ ] Fill all required variables (Razorpay test mode first)
- [ ] Verify `.env` is in `.gitignore`
- [ ] Test all env variables load correctly
- [ ] Never commit `.env` file to Git

```bash
# Verify environment setup
node -e "console.log(process.env.RAZORPAY_KEY_ID ? '✅ KEY_ID set' : '❌ KEY_ID missing')"
node -e "console.log(process.env.RAZORPAY_KEY_SECRET ? '✅ KEY_SECRET set' : '❌ KEY_SECRET missing')"
node -e "console.log(process.env.JWT_SECRET ? '✅ JWT_SECRET set' : '❌ JWT_SECRET missing')"
node -e "console.log(process.env.MONGO_URI ? '✅ MONGO_URI set' : '❌ MONGO_URI missing')"
```

### **2. Database Setup**

- [ ] MongoDB Atlas cluster created
- [ ] Database user created with strong password
- [ ] IP whitelist configured (production server IP)
- [ ] Connection string tested locally
- [ ] Backup strategy configured
- [ ] Indexes created on OrderModel:
  - [ ] `{ paymentId: 1 }`
  - [ ] `{ user: 1, createdAt: -1 }`
  - [ ] `{ payment_status: 1, order_status: 1 }`

```javascript
// Verify indexes in MongoDB
db.orders.getIndexes();

// Should show:
// _id_ (default)
// paymentId_1 (for fast payment lookup)
// user_1_createdAt_-1 (for user orders with sorting)
// payment_status_1_order_status_1 (for filtering)
```

### **3. Razorpay Setup**

#### **Test Mode (Development)**

- [ ] Create Razorpay Test Account
- [ ] Get Test API Keys:
  - `RAZORPAY_KEY_ID` = Key ID from test dashboard
  - `RAZORPAY_KEY_SECRET` = Key Secret from test dashboard
- [ ] Test payment with test card: `4111 1111 1111 1111`
- [ ] Verify webhook signature verification works

#### **Test Cards**

```
Card: 4111 1111 1111 1111
Expiry: Any future date (e.g., 12/25)
CVV: Any 3 digits (e.g., 123)
Name: Any name

UPI: success@razorpay (for UPI payment)
OTP: 123456 (for any OTP-based payment)
```

#### **Production Mode (Going Live)**

1. [ ] Apply for Razorpay Live Account
2. [ ] Get Production API Keys
3. [ ] In `server/.env`:
   ```
   RAZORPAY_KEY_ID=rzp_live_xxxxx
   RAZORPAY_KEY_SECRET=xxxxx
   NODE_ENV=production
   ```
4. [ ] Set up webhook in Razorpay dashboard:
   - **Webhook URL**: `https://your-api-domain.com/api/orders/webhook/razorpay`
   - **Events**: `payment.authorized`, `payment.failed`
   - **Active**: Yes
5. [ ] Test webhook with Razorpay test event
6. [ ] Get webhook signing secret and update code

---

## 🔐 Security Checklist

### **1. API Security**

- [ ] All payment routes use HTTPS only
- [ ] CORS configured to allow only frontend domains:
  ```javascript
  // server/index.js
  const allowedOrigins = [
    "https://yourdomain.com",
    "https://admin.yourdomain.com",
    "https://www.yourdomain.com",
  ];
  ```
- [ ] Rate limiting enabled on sensitive endpoints:

  ```javascript
  import rateLimit from "express-rate-limit";

  const createOrderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit 10 orders per 15 minutes
    message: "Too many order creation attempts",
  });

  router.post("/", createOrderLimiter, createOrder);
  ```

- [ ] CSRF protection enabled
- [ ] Security headers configured:
  ```javascript
  app.use(helmet()); // Adds security headers
  app.use(
    cors({
      /* config */
    }),
  );
  ```

### **2. Payment Security**

- [ ] Signature verification always on server-side
- [ ] Razorpay secret key never exposed in frontend code
- [ ] Signature verification code reviewed
- [ ] Test signature verification with invalid signature
- [ ] Amount validation checks product prices

### **3. Authentication Security**

- [ ] JWT secret key strong (32+ characters)
- [ ] JWT tokens have expiration (1 hour)
- [ ] Refresh tokens for long-lived sessions
- [ ] Password hashing implemented (bcrypt)
- [ ] Admin routes protected with auth middleware
- [ ] User can only see their own orders

```javascript
// Verify user can only access own orders
const userId = req.user?.id; // From JWT
const orders = await OrderModel.find({ user: userId });
```

### **4. Data Protection**

- [ ] Sensitive data never logged to console
- [ ] Error messages don't expose system details
- [ ] Database credentials not in code
- [ ] API keys not in version control
- [ ] Passwords hashed before storage
- [ ] Email data encrypted

### **5. SSL/TLS**

- [ ] HTTPS certificate obtained (Let's Encrypt recommended)
- [ ] Certificate auto-renewal configured
- [ ] HSTS header enabled:
  ```javascript
  app.use(
    helmet.hsts({
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    }),
  );
  ```

---

## 📊 API Endpoints Verification

### **POST /api/orders (Create Order)**

```bash
# Test creating order
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "productId": "507f1f77bcf86cd799439011",
        "productTitle": "Test Product",
        "quantity": 1,
        "price": 500,
        "subTotal": 500
      }
    ],
    "totalAmt": 500,
    "delivery_address": "507f1f77bcf86cd799439012"
  }'

# Expected response:
# {
#   "error": false,
#   "success": true,
#   "data": {
#     "orderId": "...",
#     "razorpayOrderId": "order_...",
#     "keyId": "rzp_test_..."
#   }
# }
```

- [ ] Returns 201 Created
- [ ] Contains razorpayOrderId
- [ ] Contains keyId
- [ ] Order saved to MongoDB
- [ ] Invalid totalAmt rejected

### **POST /api/orders/verify-payment (Verify Payment)**

```bash
# Test payment verification
curl -X POST http://localhost:8080/api/orders/verify-payment \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "...",
    "razorpayPaymentId": "pay_...",
    "razorpayOrderId": "order_...",
    "razorpaySignature": "..."
  }'

# Expected response:
# {
#   "error": false,
#   "success": true,
#   "data": {
#     "orderStatus": "confirmed",
#     "paymentStatus": "paid"
#   }
# }
```

- [ ] Returns 200 OK on valid signature
- [ ] Returns 400 on invalid signature
- [ ] order_status updated to "confirmed"
- [ ] payment_status updated to "paid"
- [ ] paymentId stored correctly

### **GET /api/orders/user/my-orders (User Orders)**

```bash
# Test fetching user orders
curl -X GET "http://localhost:8080/api/orders/user/my-orders" \
  -H "Authorization: Bearer <JWT_TOKEN>"

# Expected response:
# {
#   "error": false,
#   "success": true,
#   "data": [
#     {
#       "_id": "...",
#       "order_status": "confirmed",
#       "payment_status": "paid",
#       "totalAmt": 500,
#       "createdAt": "..."
#     }
#   ]
# }
```

- [ ] Returns 200 OK
- [ ] Returns user's orders only
- [ ] Guest users get empty array
- [ ] Filters by user ID correctly

### **GET /api/orders/admin/all (All Orders - Admin)**

```bash
# Test admin orders list
curl -X GET "http://localhost:8080/api/orders/admin/all?page=1&limit=20" \
  -H "Authorization: Bearer <ADMIN_JWT>"

# With filters:
curl -X GET "http://localhost:8080/api/orders/admin/all?status=confirmed&search=pay_xxx"
```

- [ ] Returns 200 OK
- [ ] Pagination works (page, limit)
- [ ] Status filter works
- [ ] Search by paymentId works
- [ ] Non-admin gets 403 Forbidden

### **PUT /api/orders/:id/status (Update Status - Admin)**

```bash
# Test status update
curl -X PUT "http://localhost:8080/api/orders/507f1f77bcf86cd799439013/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -d '{ "order_status": "shipped" }'

# Expected response:
# {
#   "error": false,
#   "success": true,
#   "data": {
#     "order_status": "shipped",
#     "updatedAt": "..."
#   }
# }
```

- [ ] Returns 200 OK
- [ ] Validates status enum (pending, confirmed, shipped, delivered, cancelled)
- [ ] Rejects invalid status
- [ ] Updates database
- [ ] Tracks admin who updated

### **GET /api/orders/admin/dashboard-stats (Stats - Admin)**

```bash
curl -X GET "http://localhost:8080/api/orders/admin/dashboard-stats" \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

- [ ] Returns total orders
- [ ] Returns orders by status
- [ ] Returns total revenue
- [ ] Returns payment metrics (paidOrders, failedPayments)
- [ ] Returns recent orders

### **POST /api/orders/webhook/razorpay (Webhook)**

- [ ] Webhook endpoint accessible without auth
- [ ] Validates Razorpay signature
- [ ] Handles payment.authorized event
- [ ] Handles payment.failed event
- [ ] Returns 200 OK to Razorpay
- [ ] Updates order status correctly

---

## 🎨 Frontend Verification

### **Client (Customer)**

- [ ] `/` page loads without errors
- [ ] Product listing works
- [ ] Add to cart works
- [ ] Cart page displays items
- [ ] Checkout page shows address selection
- [ ] Payment button initiates Razorpay modal
- [ ] Modal closes on cancel
- [ ] Payment success redirects to /my-orders
- [ ] Payment failure shows error message
- [ ] `/my-orders` displays user's orders
- [ ] Order details show correct status
- [ ] Status updates in real-time

### **Admin**

- [ ] `/admin` dashboard loads
- [ ] Orders list shows all orders
- [ ] Pagination works
- [ ] Status filtering works
- [ ] Search by payment ID works
- [ ] Order details modal opens
- [ ] Status can be updated
- [ ] Dashboard stats display correctly
- [ ] Real-time notification badge appears
- [ ] New orders notification works

---

## 📦 Build & Deployment

### **Server Build**

```bash
# Test build
npm run build

# Run production build
npm run start

# Verify server starts without errors
# Check logs for any warnings
```

- [ ] No build errors
- [ ] No console warnings (production-safe)
- [ ] Server starts successfully
- [ ] Port configured correctly
- [ ] Health check endpoint returns 200

### **Frontend Build (Client)**

```bash
# Test build
npm run build

# Check build size
ls -lh .next/

# Verify build succeeds
npm run start
```

- [ ] Build succeeds without errors
- [ ] Build size reasonable (< 500KB gzipped)
- [ ] No console errors
- [ ] No unminified code in production
- [ ] All environment variables resolved

### **Admin Build**

```bash
npm run build
npm run start
```

- [ ] Same checks as client
- [ ] Admin routes protected
- [ ] Environment variables correct

### **Docker (Optional)**

If using Docker:

```bash
# Build image
docker build -t ecom-api .

# Run container
docker run -p 8080:8080 --env-file .env ecom-api

# Verify logs show server running
```

- [ ] Dockerfile present and functional
- [ ] Environment variables injected
- [ ] Health check working
- [ ] No hardcoded credentials in image

---

## 📈 Performance & Monitoring

### **Load Testing**

```bash
# Install artillery for load testing
npm install -g artillery

# Create test config
# artillery.yml
# scenarios:
#   - flow:
#       - post:
#           url: "/api/orders"
#           json: { /* payload */ }

# Run test
artillery run artillery.yml --target http://localhost:8080
```

- [ ] API handles 100 requests/second
- [ ] Response time < 500ms
- [ ] No timeouts
- [ ] Database doesn't crash

### **Monitoring Setup**

- [ ] Error tracking (Sentry/DataDog)
- [ ] Performance monitoring (New Relic)
- [ ] Database monitoring (MongoDB Atlas alerts)
- [ ] Log aggregation (ELK Stack/Datadog)
- [ ] Uptime monitoring (Pingdom/StatusPage)
- [ ] Real-time alerts configured

### **Key Metrics**

- [ ] API response time (target: < 200ms)
- [ ] Database query time (target: < 100ms)
- [ ] Payment success rate (target: > 95%)
- [ ] Order processing time (target: < 5s)
- [ ] Error rate (target: < 0.1%)

---

## 🔍 Final Testing Checklist

### **End-to-End Test Scenario**

1. [ ] Customer adds products to cart
2. [ ] Customer goes to checkout
3. [ ] Customer selects delivery address
4. [ ] Customer clicks "Pay with Razorpay"
5. [ ] Razorpay modal opens with correct amount
6. [ ] Customer enters payment details (test card)
7. [ ] Payment processes successfully
8. [ ] Modal closes automatically
9. [ ] Page redirects to /my-orders
10. [ ] New order appears in user's order list
11. [ ] Order shows "confirmed" status
12. [ ] Payment status shows "paid"
13. [ ] Admin sees new order notification
14. [ ] Admin can open order details
15. [ ] Admin can update order to "shipped"
16. [ ] Customer sees status update in real-time

### **Error Scenario Testing**

1. [ ] Test with invalid payment credentials
   - Expected: Payment fails, order status = "cancelled"
2. [ ] Test signature verification with tampered data
   - Expected: Payment verification fails, error message
3. [ ] Test with invalid totalAmt
   - Expected: Order creation fails
4. [ ] Test with missing required fields
   - Expected: 400 Bad Request
5. [ ] Test unauthorized admin access
   - Expected: 403 Forbidden
6. [ ] Test network timeout during verification
   - Expected: Graceful error handling, retry option

### **Edge Cases**

- [ ] Zero amount order (should fail)
- [ ] Negative amount (should fail)
- [ ] Empty products array (should fail)
- [ ] Duplicate payment verification (handle idempotency)
- [ ] User without authentication (handle guest checkout)
- [ ] Admin updating order multiple times (track all updates)

---

## 🌐 Domain & DNS Setup

- [ ] Domain registered
- [ ] DNS records configured:
  ```
  api.yourdomain.com  → API server IP
  admin.yourdomain.com → Admin server IP
  www.yourdomain.com → Client server IP
  ```
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] Certificate configured on servers
- [ ] HTTPS redirects from HTTP
- [ ] Certificate auto-renewal configured

---

## 📝 Documentation

- [ ] README.md complete with:
  - [ ] Setup instructions
  - [ ] API documentation
  - [ ] Database schema
  - [ ] Deployment guide
  - [ ] Troubleshooting section
- [ ] API Flow documentation (API_FLOW_DOCUMENTATION.md)
- [ ] AI Rules documentation (.AI-RULES.md)
- [ ] Environment template (.env.example)
- [ ] CHANGELOG.md with version history

---

## ✨ Post-Deployment (Day 1-7)

- [ ] Monitor error logs hourly
- [ ] Check payment success rate
- [ ] Verify all orders in database
- [ ] Test customer notifications
- [ ] Check admin notifications
- [ ] Monitor database performance
- [ ] Review API response times
- [ ] Verify backup systems
- [ ] Test disaster recovery
- [ ] Gather user feedback

---

## 🆘 Rollback Plan

If critical issues found after deployment:

1. **Immediate**: Disable payment processing

   ```
   RAZORPAY_ENABLED=false
   ```

2. **Notify**: Alert customers and team

3. **Investigate**: Check logs for root cause

4. **Fix**: Deploy hotfix to staging, test thoroughly

5. **Redeploy**: Push fixed version to production

6. **Verify**: Run full test suite

7. **Re-enable**: Turn payment back on

---

## 🎯 Success Criteria

✅ All endpoints respond correctly
✅ Payments process successfully  
✅ Orders saved to database
✅ Admin receives notifications
✅ Customer can track orders
✅ No sensitive data exposed
✅ Performance meets targets
✅ Error handling works correctly
✅ Documentation is complete
✅ Team trained on system

---

**Last Updated**: January 25, 2026

**Status**: ✅ Ready for Production Deployment
