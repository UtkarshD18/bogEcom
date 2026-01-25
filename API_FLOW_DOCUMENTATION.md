# 🔄 Production API Flow & Architecture

**Complete Payment Processing & Order Management System**

---

## 📊 End-to-End Order Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER JOURNEY                             │
└─────────────────────────────────────────────────────────────────────┘

USER ADDS TO CART
    ↓
    └─→ ProductItem.jsx → useCart hook → CartContext
    └─→ localStorage.setItem('cart', products)

USER GOES TO CHECKOUT
    ↓
    └─→ Navigate to /checkout
    └─→ Display: Cart items, Address selection, Price breakdown
    └─→ Button: "Proceed to Payment"

USER CLICKS "PROCEED TO PAYMENT"
    ↓
    └─→ Call usePayment hook: initiatePayment()
    └─→ Validate: Address selected, cart not empty

FRONTEND: CREATE ORDER (POST /api/orders)
    ↓
    ├─→ Request Body: { products, totalAmt, delivery_address }
    └─→ Response: { orderId, razorpayOrderId, keyId }

SERVER: CREATE ORDER IN DATABASE
    ↓
    ├─→ Validate: products array, totalAmt > 0
    ├─→ Connect: Razorpay SDK with credentials
    ├─→ Call: razorpay.orders.create({ amount, currency, receipt })
    ├─→ Create: OrderModel document with status "pending"
    ├─→ Save: Order to MongoDB
    └─→ Response: orderId + razorpayOrderId

FRONTEND: OPEN RAZORPAY CHECKOUT
    ↓
    ├─→ Load: https://checkout.razorpay.com/v1/checkout.js
    ├─→ Initialize: Razorpay({ key_id, amount, order_id, ... })
    ├─→ Display: Payment modal (Card, UPI, Wallet, etc.)
    └─→ User selects payment method & enters details

RAZORPAY: PROCESS PAYMENT
    ↓
    ├─→ Validate: Card/UPI/Wallet details
    ├─→ Authorize: Payment with bank
    ├─→ Generate: razorpay_payment_id & razorpay_signature
    └─→ Return: Payment response to frontend

FRONTEND: VERIFY PAYMENT (POST /api/orders/verify-payment)
    ↓
    ├─→ Collect: razorpay_payment_id, razorpay_order_id, razorpay_signature
    ├─→ Send: All details to backend for verification
    └─→ Response: { orderStatus: "confirmed", paymentStatus: "paid" }

SERVER: VERIFY SIGNATURE
    ↓
    ├─→ Compute: HMAC-SHA256(order_id|payment_id, key_secret)
    ├─→ Compare: Generated signature with received signature
    ├─→ If Match:
    │   ├─→ Update: order_status = "confirmed"
    │   ├─→ Update: payment_status = "paid"
    │   ├─→ Update: paymentId = razorpay_payment_id
    │   ├─→ Save: Order document
    │   └─→ Response: { success: true, orderStatus: "confirmed" }
    └─→ If No Match:
        ├─→ Fraud detection: Signature invalid
        ├─→ Update: order_status = "cancelled"
        └─→ Response: { error: true, message: "Payment verification failed" }

FRONTEND: HANDLE RESPONSE
    ↓
    ├─→ If Success:
    │   ├─→ Save: Order to localStorage (backup)
    │   ├─→ Clear: Cart from context & localStorage
    │   ├─→ Show: Success notification
    │   └─→ Redirect: /my-orders page
    └─→ If Failure:
        ├─→ Show: Error message
        ├─→ Keep: Order ID for reference
        └─→ Allow: Retry payment

ADMIN DASHBOARD: REAL-TIME NOTIFICATION
    ↓
    ├─→ useOrderNotifications hook polls database
    ├─→ See: New order notification badge
    ├─→ Click: Open order details
    ├─→ See: Customer info, products, payment status
    ├─→ Update: order_status (pending → shipped → delivered)
    └─→ System: Sends notification to customer

CUSTOMER: MY ORDERS PAGE
    ↓
    ├─→ Fetch: GET /api/orders/user/my-orders
    ├─→ Display: All orders with status
    ├─→ Track: Delivery status updates in real-time
    └─→ See: Order details, payment confirmation, tracking info

WEBHOOK (PRODUCTION ONLY)
    ↓
    └─→ Razorpay sends: payment.authorized event
        ├─→ Server verifies: Webhook signature
        ├─→ Updates: Order to "confirmed"
        └─→ Responds: 200 OK to Razorpay
```

---

## 🛠️ Complete API Endpoint Reference

### **1. Order Creation**

**Endpoint:** `POST /api/orders`

**Authentication:** Optional (supports guest & authenticated users)

**Request:**

```json
{
  "products": [
    {
      "productId": "507f1f77bcf86cd799439011",
      "productTitle": "Organic Peanut Butter",
      "quantity": 2,
      "price": 300,
      "image": "https://cdn.example.com/image.jpg",
      "subTotal": 600
    }
  ],
  "totalAmt": 650,
  "delivery_address": "507f1f77bcf86cd799439012"
}
```

**Response (201 Created):**

```json
{
  "error": false,
  "success": true,
  "message": "Order created successfully",
  "data": {
    "orderId": "507f1f77bcf86cd799439013",
    "razorpayOrderId": "order_IluGWxBm9U8zJ8",
    "amount": 650,
    "currency": "INR",
    "keyId": "rzp_test_xxxxx"
  }
}
```

**Process Flow:**

1. Validate products array (must have items)
2. Validate totalAmt (must be > 0)
3. Connect to Razorpay
4. Create Razorpay order with amount in paise
5. Create MongoDB order document
6. Save & return Razorpay Order ID

**Error Responses:**

```json
// Missing products
{
  "error": true,
  "success": false,
  "message": "Products are required",
  "status": 400
}

// Invalid amount
{
  "error": true,
  "success": false,
  "message": "Total amount must be greater than 0",
  "status": 400
}

// Razorpay error
{
  "error": true,
  "success": false,
  "message": "Failed to create order",
  "details": "Razorpay error details"
}
```

---

### **2. Payment Verification**

**Endpoint:** `POST /api/orders/verify-payment`

**Authentication:** Optional

**Request:**

```json
{
  "orderId": "507f1f77bcf86cd799439013",
  "razorpayPaymentId": "pay_IluGWxBm9U8zJ8",
  "razorpayOrderId": "order_IluGWxBm9U8zJ8",
  "razorpaySignature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"
}
```

**Signature Verification Process:**

```
Received from Razorpay:
  razorpay_order_id: "order_IluGWxBm9U8zJ8"
  razorpay_payment_id: "pay_IluGWxBm9U8zJ8"
  razorpay_signature: "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"

Server Calculation:
  body = "order_IluGWxBm9U8zJ8|pay_IluGWxBm9U8zJ8"
  generatedSignature = HMAC-SHA256(body, SECRET_KEY)

  if (generatedSignature === razorpay_signature) {
    Payment is VALID ✅
  } else {
    Payment is FRAUDULENT ❌
  }
```

**Response (200 OK):**

```json
{
  "error": false,
  "success": true,
  "message": "Payment verified and order confirmed",
  "data": {
    "orderId": "507f1f77bcf86cd799439013",
    "orderStatus": "confirmed",
    "paymentStatus": "paid",
    "paymentId": "pay_IluGWxBm9U8zJ8",
    "totalAmount": 650
  }
}
```

**Database Updates:**

```javascript
OrderModel.findByIdAndUpdate(orderId, {
  paymentId: razorpayPaymentId, // Store payment ID
  payment_status: "paid", // Mark as paid
  order_status: "confirmed", // Confirm order
  updatedAt: new Date(),
});
```

**Error Responses:**

```json
// Invalid signature (FRAUD DETECTED)
{
  "error": true,
  "success": false,
  "message": "Payment verification failed - Invalid signature",
  "status": 400
}

// Order not found
{
  "error": true,
  "success": false,
  "message": "Order not found",
  "status": 404
}

// Missing payment details
{
  "error": true,
  "success": false,
  "message": "All payment details are required",
  "status": 400
}
```

---

### **3. Fetch User Orders**

**Endpoint:** `GET /api/orders/user/my-orders`

**Authentication:** Optional (if authenticated, shows user's orders)

**Query Parameters:** None

**Response (200 OK):**

```json
{
  "error": false,
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "user": "507f1f77bcf86cd799439000",
      "products": [
        {
          "productId": "507f1f77bcf86cd799439011",
          "productTitle": "Organic Peanut Butter",
          "quantity": 2,
          "price": 300,
          "image": "url",
          "subTotal": 600
        }
      ],
      "paymentId": "pay_IluGWxBm9U8zJ8",
      "razorpayOrderId": "order_IluGWxBm9U8zJ8",
      "payment_status": "paid",
      "order_status": "confirmed",
      "totalAmt": 650,
      "createdAt": "2026-01-25T10:30:00Z",
      "updatedAt": "2026-01-25T10:35:00Z"
    }
  ]
}
```

**Filtering Logic:**

```javascript
if (userId) {
  orders = OrderModel.find({ user: userId });
} else {
  orders = []; // Guest users don't see saved orders
}
```

---

### **4. Admin: Get All Orders**

**Endpoint:** `GET /api/orders/admin/all`

**Authentication:** Required (admin only)

**Query Parameters:**

```
?page=1&limit=20&status=confirmed&search=pay_xxx
```

**Response (200 OK):**

```json
{
  "error": false,
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "user": {
        "_id": "507f1f77bcf86cd799439000",
        "name": "John Doe",
        "email": "john@example.com",
        "avatar": "url"
      },
      "products": [...],
      "paymentId": "pay_IluGWxBm9U8zJ8",
      "payment_status": "paid",
      "order_status": "confirmed",
      "totalAmt": 650,
      "createdAt": "2026-01-25T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

**Filtering & Pagination:**

```javascript
// Filter by status
?status=confirmed  → filter: { order_status: "confirmed" }
?status=shipped    → filter: { order_status: "shipped" }

// Filter by search (Payment ID)
?search=pay_xxx    → filter: { paymentId: { $regex: "pay_xxx" } }

// Pagination
?page=2&limit=20   → skip: 20, limit: 20
```

---

### **5. Admin: Update Order Status**

**Endpoint:** `PUT /api/orders/:id/status`

**Authentication:** Required (admin only)

**Request:**

```json
{
  "order_status": "shipped"
}
```

**Valid Status Values:**

- `pending` - Order awaiting confirmation
- `confirmed` - Payment received, ready to ship
- `shipped` - Package sent to customer
- `delivered` - Customer received package
- `cancelled` - Order cancelled

**Response (200 OK):**

```json
{
  "error": false,
  "success": true,
  "message": "Order status updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "order_status": "shipped",
    "updatedAt": "2026-01-25T11:00:00Z",
    "lastUpdatedBy": "507f1f77bcf86cd799439099"
  }
}
```

**State Transitions:**

```
pending ──→ confirmed ──→ shipped ──→ delivered
                    │
                    └──→ cancelled
```

---

### **6. Admin: Dashboard Statistics**

**Endpoint:** `GET /api/orders/admin/dashboard-stats`

**Authentication:** Required (admin only)

**Response (200 OK):**

```json
{
  "error": false,
  "success": true,
  "data": {
    "totalOrders": 156,
    "totalProducts": 45,
    "totalCategories": 8,
    "totalUsers": 320,
    "totalRevenue": 4560000,
    "pendingOrders": 12,
    "confirmedOrders": 98,
    "shippedOrders": 35,
    "deliveredOrders": 10,
    "cancelledOrders": 1,
    "paidOrders": 145,
    "failedPayments": 2,
    "recentOrders": [
      {
        "_id": "507f1f77bcf86cd799439013",
        "user": { "name": "John Doe", "email": "john@example.com" },
        "totalAmt": 650,
        "order_status": "confirmed",
        "payment_status": "paid",
        "createdAt": "2026-01-25T10:30:00Z"
      }
    ]
  }
}
```

---

### **7. Razorpay Webhook (Production Only)**

**Endpoint:** `POST /api/orders/webhook/razorpay`

**Authentication:** Webhook signature verification

**Razorpay Sends:**

```json
{
  "event": "payment.authorized",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_IluGWxBm9U8zJ8",
        "order_id": "order_IluGWxBm9U8zJ8",
        "status": "captured",
        "amount": 65000,
        "currency": "INR",
        "notes": {
          "order_id": "507f1f77bcf86cd799439013"
        }
      }
    }
  }
}
```

**Server Verification:**

```javascript
const body = JSON.stringify(req.body);
const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
hmac.update(body);
const signature = hmac.digest("hex");

if (signature !== req.headers["x-razorpay-signature"]) {
  return res.status(400).json({ error: true, message: "Invalid signature" });
}
```

**Server Response (200 OK):**

```json
{
  "error": false,
  "success": true,
  "message": "Webhook processed"
}
```

---

## 🔄 Database Sync Flow

### **Order Creation → Payment → Confirmation**

```
Frontend (Client)
│
├─→ localStorage.setItem('orders', [...])  // Client-side backup
│
↓
API: POST /api/orders
│
↓
Backend (Server)
│
├─→ OrderModel.create({...})               // Save to MongoDB
├─→ razorpay.orders.create({...})          // Create Razorpay order
├─→ Return: razorpayOrderId
│
↓
Frontend Opens Razorpay Checkout
│
├─→ User pays
├─→ Razorpay returns response
│
↓
API: POST /api/orders/verify-payment
│
↓
Backend (Server)
│
├─→ Verify signature
├─→ Update: order_status = "confirmed"
├─→ Update: payment_status = "paid"
├─→ Save to MongoDB
│
↓
Frontend Updates State
│
├─→ Clear cart from context
├─→ Clear cart from localStorage
├─→ Update: orders in localStorage
├─→ Navigate to /my-orders
│
↓
Admin Dashboard
│
├─→ useOrderNotifications polls database
├─→ See notification badge
├─→ Fetch updated orders
├─→ Update status → shipped/delivered
│
↓
Customer My Orders Page
│
└─→ Fetch: GET /api/orders/user/my-orders
    └─→ Display updated status
```

---

## ⚠️ Error Handling & Recovery

### **Common Failure Scenarios**

**Scenario 1: Razorpay Order Creation Fails**

```javascript
try {
  const razorpayOrder = await razorpay.orders.create({...});
} catch (error) {
  // Don't create MongoDB order if Razorpay fails
  return res.status(500).json({
    error: true,
    message: "Failed to initialize payment",
    details: error.message
  });
}
```

**Scenario 2: Signature Verification Fails**

```javascript
if (generatedSignature !== receivedSignature) {
  // Potential fraud attempt
  // Cancel order to prevent unauthorized purchases
  await OrderModel.findByIdAndUpdate(orderId, {
    order_status: "cancelled",
    payment_status: "failed",
    failureReason: "Signature verification failed",
  });

  return res.status(400).json({
    error: true,
    message: "Payment verification failed",
  });
}
```

**Scenario 3: User Closes Payment Modal**

```javascript
// Frontend handles this:
modal: {
  ondismiss: () => {
    // Order still exists in database with "pending" status
    // User can retry payment later
    context?.alertBox("error", "Payment cancelled");
  };
}
```

**Scenario 4: Network Failure During Verification**

```javascript
// Frontend retries:
const MAX_RETRIES = 3;
for (let i = 0; i < MAX_RETRIES; i++) {
  try {
    const response = await fetch("/api/orders/verify-payment");
    if (response.ok) break;
  } catch (error) {
    if (i === MAX_RETRIES - 1) throw error;
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
}
```

---

## 🔐 Security Measures

### **Payment Security**

1. **Server-Side Signature Verification**
   - Never trust frontend signature
   - Always verify on backend using HMAC-SHA256

2. **Amount Validation**
   - Validate totalAmt on backend
   - Check against product prices
   - Prevent price manipulation

3. **User Authorization**
   - Verify user owns the order
   - Check admin permissions before status updates
   - Prevent access to others' orders

4. **Secret Management**
   - Never expose RAZORPAY_KEY_SECRET
   - Store in .env (git ignored)
   - Rotate regularly in production

5. **HTTPS Only**
   - All payment endpoints over HTTPS
   - Prevent man-in-the-middle attacks
   - Enable HSTS headers

---

## 📈 Performance Optimization

### **Query Optimization**

```javascript
// Use indexes for fast lookups
orderSchema.index({ paymentId: 1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ payment_status: 1, order_status: 1 });

// Use lean() for read-only queries
const orders = await OrderModel.find()
  .lean()
  .select('totalAmt order_status payment_status createdAt');

// Use pagination to limit results
GET /api/orders/admin/all?page=1&limit=20
```

### **Caching Strategy**

```javascript
// Cache admin stats (update every 5 minutes)
const cachedStats = {};
const CACHE_DURATION = 5 * 60 * 1000;

if (
  cachedStats.timestamp &&
  Date.now() - cachedStats.timestamp < CACHE_DURATION
) {
  return cachedStats.data;
} else {
  const stats = await getDashboardStats();
  cachedStats.data = stats;
  cachedStats.timestamp = Date.now();
  return stats;
}
```

---

## 📊 Monitoring & Alerts

### **Key Metrics to Monitor**

- Total orders per day
- Payment success rate
- Average order value
- Failed payment reasons
- Order fulfillment time
- Payment processing time

### **Alerts to Setup**

- Payment failure spike (> 5% failures)
- Order without payment confirmation
- Signature verification failure
- Database connection issues
- API response time > 5 seconds

---

## 🏆 Membership System API Flow

The membership system enables users to purchase and manage premium membership plans, with all plan details and offers controlled by the admin panel. The flow is as follows:

### 1. Admin: Manage Membership Plans

- **Create/Update/Delete Plans:** Admins can create, edit, or remove membership plans via the admin panel. Only one plan can be active at a time; activating a new plan automatically deactivates others.
- **Activate/Deactivate Plan:** Admins can set which plan is currently available for users to purchase.
- **View Membership Stats:** Admins can view statistics on total, active, and expired members.

### 2. Client: Fetch Active Plan (Public)

- The client fetches the currently active membership plan to display pricing, duration, and benefits to all users (no authentication required).

### 3. User: Membership Purchase & Status

- **Get Membership Status:** Authenticated users can check if they are a member, their plan details, and expiry date.
- **Purchase Membership:** Authenticated users initiate a membership purchase, which creates a payment order (Razorpay integration).
- **Verify Payment:** After successful payment, the client verifies the payment with the backend, which activates the membership for the user.

### 4. End-to-End Sequence

1. **Admin** creates and activates a membership plan.
2. **Client** fetches and displays the active plan.
3. **User** logs in and initiates membership purchase.
4. **Payment** is processed via Razorpay; backend verifies and activates membership.
5. **User** can view their membership status and expiry.
6. **Admin** can monitor membership statistics and manage plans as needed.

---

**This document defines the complete production-ready payment API flow. Always refer to this for implementation details.**

Last Updated: January 25, 2026
