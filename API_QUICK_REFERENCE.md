# 📱 API Quick Reference Card

**Complete API endpoint reference for development & testing**

---

## 🔗 Base URLs

```
Development:   http://localhost:8080
Testing:       https://api-test.yourdomain.com
Production:    https://api.yourdomain.com
```

---

## 📊 Complete Endpoint Map

| Method | Endpoint                            | Auth     | Purpose                   | Status   |
| ------ | ----------------------------------- | -------- | ------------------------- | -------- |
| `POST` | `/api/orders`                       | Optional | Create order for checkout | ✅ Ready |
| `POST` | `/api/orders/verify-payment`        | Optional | Verify payment signature  | ✅ Ready |
| `GET`  | `/api/orders/user/my-orders`        | Optional | Fetch user's orders       | ✅ Ready |
| `GET`  | `/api/orders/admin/all`             | Admin    | List all orders           | ✅ Ready |
| `GET`  | `/api/orders/admin/stats`           | Admin    | Get order statistics      | ✅ Ready |
| `GET`  | `/api/orders/admin/dashboard-stats` | Admin    | Get dashboard metrics     | ✅ Ready |
| `PUT`  | `/api/orders/:id/status`            | Admin    | Update order status       | ✅ Ready |
| `GET`  | `/api/orders/admin/:id`             | Admin    | Get specific order        | ✅ Ready |
| `POST` | `/api/orders/webhook/razorpay`      | None     | Razorpay webhook          | ✅ Ready |

---

## 1️⃣ Create Order

```http
POST /api/orders
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN> (optional)

{
  "products": [
    {
      "productId": "507f1f77bcf86cd799439011",
      "productTitle": "Organic Peanut Butter",
      "quantity": 2,
      "price": 300,
      "image": "https://...",
      "subTotal": 600
    }
  ],
  "totalAmt": 650,
  "delivery_address": "507f1f77bcf86cd799439012"
}
```

**Response**: `201 Created`

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

**Error**: `400 Bad Request`

```json
{
  "error": true,
  "success": false,
  "message": "Products are required"
}
```

**cURL:**

```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "products": [{"productId": "...", "quantity": 1, "price": 500, "subTotal": 500}],
    "totalAmt": 500
  }'
```

---

## 2️⃣ Verify Payment

```http
POST /api/orders/verify-payment
Content-Type: application/json

{
  "orderId": "507f1f77bcf86cd799439013",
  "razorpayPaymentId": "pay_IluGWxBm9U8zJ8",
  "razorpayOrderId": "order_IluGWxBm9U8zJ8",
  "razorpaySignature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"
}
```

**Response**: `200 OK`

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

**Error**: `400 Bad Request` (Invalid signature)

```json
{
  "error": true,
  "success": false,
  "message": "Payment verification failed - Invalid signature"
}
```

**cURL:**

```bash
curl -X POST http://localhost:8080/api/orders/verify-payment \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "...",
    "razorpayPaymentId": "pay_...",
    "razorpayOrderId": "order_...",
    "razorpaySignature": "..."
  }'
```

---

## 3️⃣ Get User Orders

```http
GET /api/orders/user/my-orders
Authorization: Bearer <JWT_TOKEN> (optional)
```

**Response**: `200 OK`

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

**cURL:**

```bash
curl -X GET http://localhost:8080/api/orders/user/my-orders \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

## 4️⃣ Get All Orders (Admin)

```http
GET /api/orders/admin/all?page=1&limit=20&status=confirmed&search=pay_xxx
Authorization: Bearer <ADMIN_JWT>
```

**Query Parameters:**

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `status` - Filter by order status (pending, confirmed, shipped, delivered, cancelled, all)
- `search` - Search by payment ID

**Response**: `200 OK`

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
        "avatar": "https://..."
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

**cURL:**

```bash
curl -X GET "http://localhost:8080/api/orders/admin/all?page=1&limit=20&status=confirmed" \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

---

## 5️⃣ Update Order Status (Admin)

```http
PUT /api/orders/507f1f77bcf86cd799439013/status
Authorization: Bearer <ADMIN_JWT>
Content-Type: application/json

{
  "order_status": "shipped"
}
```

**Valid Status Values:**

- `pending` - Awaiting confirmation
- `confirmed` - Payment received
- `shipped` - Sent to customer
- `delivered` - Customer received
- `cancelled` - Order cancelled

**Response**: `200 OK`

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

**cURL:**

```bash
curl -X PUT http://localhost:8080/api/orders/507f1f77bcf86cd799439013/status \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{ "order_status": "shipped" }'
```

---

## 6️⃣ Get Dashboard Stats (Admin)

```http
GET /api/orders/admin/dashboard-stats
Authorization: Bearer <ADMIN_JWT>
```

**Response**: `200 OK`

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
    "recentOrders": [...]
  }
}
```

**cURL:**

```bash
curl -X GET http://localhost:8080/api/orders/admin/dashboard-stats \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

---

## 7️⃣ Razorpay Webhook

```http
POST /api/orders/webhook/razorpay
Content-Type: application/json
X-Razorpay-Signature: <SIGNATURE>

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

**Response**: `200 OK`

```json
{
  "error": false,
  "success": true,
  "message": "Webhook processed"
}
```

---

## 🔑 Authentication

### **JWT Token**

```
Authorization: Bearer <JWT_TOKEN>
```

### **Get JWT Token (Login)**

```http
POST /api/user/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### **Token Contents**

```javascript
{
  "id": "507f1f77bcf86cd799439000",
  "email": "user@example.com",
  "name": "John Doe",
  "isAdmin": false,
  "iat": 1674662400,
  "exp": 1674666000  // 1 hour expiry
}
```

---

## ✅ Response Format

### **Success Response**

```json
{
  "error": false,
  "success": true,
  "message": "Operation successful",
  "data": {
    /* response data */
  }
}
```

### **Error Response**

```json
{
  "error": true,
  "success": false,
  "message": "Error description",
  "status": 400,
  "details": "Additional error info (development only)"
}
```

---

## 🔍 Common Filters & Searches

### **Order Status Filter**

```
?status=pending     // Awaiting payment
?status=confirmed   // Payment received
?status=shipped     // On the way
?status=delivered   // Delivered to customer
?status=cancelled   // Order cancelled
?status=all         // All orders (default)
```

### **Payment Status Filter**

```
?payment_status=pending   // Payment not yet made
?payment_status=paid      // Payment successful
?payment_status=failed    // Payment failed
```

### **Search & Sort**

```
?search=pay_xxx     // Search by payment ID
?search=order_yyy   // Search by order ID
?sort=-createdAt    // Sort by date (newest first)
?sort=totalAmt      // Sort by amount (ascending)
```

### **Pagination**

```
?page=1&limit=20    // First 20 items
?page=2&limit=50    // Next 50 items
```

---

## 🧪 Test Data

### **Test Card (Razorpay)**

```
Card Number: 4111 1111 1111 1111
Expiry Date: 12/25 (any future date)
CVV: 123 (any 3 digits)
Name: Test User (any name)
```

### **Test Payment IDs**

```
Order ID: order_IluGWxBm9U8zJ8
Payment ID: pay_IluGWxBm9U8zJ8
Signature: (Generated by HMAC-SHA256)
```

---

## 📊 Status Codes

| Code | Meaning      | Common Reason              |
| ---- | ------------ | -------------------------- |
| 200  | OK           | Successful request         |
| 201  | Created      | Resource created           |
| 400  | Bad Request  | Invalid input data         |
| 401  | Unauthorized | Missing/invalid token      |
| 403  | Forbidden    | Not authorized (not admin) |
| 404  | Not Found    | Resource doesn't exist     |
| 500  | Server Error | Backend error              |

---

## 🔒 Security Headers

Every request should include:

```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>  (for authenticated endpoints)
Origin: https://yourdomain.com
```

Every response includes:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
```

---

## 💾 Database Collections

### **Orders Collection**

```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  products: [
    {
      productId: String,
      productTitle: String,
      quantity: Number,
      price: Number,
      image: String,
      subTotal: Number
    }
  ],
  paymentId: String (Razorpay Payment ID),
  razorpayOrderId: String,
  razorpaySignature: String,
  payment_status: enum[pending, paid, failed],
  order_status: enum[pending, confirmed, shipped, delivered, cancelled],
  delivery_address: ObjectId (ref: Address),
  totalAmt: Number,
  discount: Number,
  tax: Number,
  shipping: Number,
  notes: String,
  failureReason: String,
  lastUpdatedBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🚀 Quick Start Example

```javascript
// Frontend: Create order and process payment
const response = await fetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    products: [...],
    totalAmt: 650,
    delivery_address: addressId
  })
});

const { data } = await response.json();
const { orderId, razorpayOrderId, keyId } = data;

// Open Razorpay
const options = {
  key: keyId,
  amount: 65000,
  currency: 'INR',
  order_id: razorpayOrderId,
  handler: async (response) => {
    // Verify payment
    const verify = await fetch('/api/orders/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpayOrderId: response.razorpay_order_id,
        razorpaySignature: response.razorpay_signature
      })
    });

    const result = await verify.json();
    if (result.success) {
      // Order confirmed!
      navigate('/my-orders');
    }
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

---

## 🏆 Membership API Endpoints

| Method | Endpoint                                 | Auth  | Description                                |
| ------ | ---------------------------------------- | ----- | ------------------------------------------ |
| GET    | /api/membership/active                   | No    | Get currently active membership plan       |
| GET    | /api/membership/status                   | Yes   | Get authenticated user's membership status |
| POST   | /api/membership/create-order             | Yes   | Create payment order for membership        |
| POST   | /api/membership/verify-payment           | Yes   | Verify membership payment and activate     |
| GET    | /api/membership/admin/plans              | Admin | List all membership plans                  |
| POST   | /api/membership/admin/plans              | Admin | Create a new membership plan               |
| PUT    | /api/membership/admin/plans/:id          | Admin | Update a membership plan                   |
| DELETE | /api/membership/admin/plans/:id          | Admin | Delete a membership plan                   |
| PUT    | /api/membership/admin/plans/:id/activate | Admin | Activate (and deactivate others)           |
| GET    | /api/membership/admin/stats              | Admin | Get membership statistics                  |

---

**Last Updated**: January 25, 2026

**Status**: ✅ Production Ready

_For detailed documentation, see [README.md](README.md) and [API_FLOW_DOCUMENTATION.md](API_FLOW_DOCUMENTATION.md)_
