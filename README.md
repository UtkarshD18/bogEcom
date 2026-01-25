# 🛍️ Healthy One Gram - E-Commerce Platform

> **Repository Hygiene & Environment Setup**
>
> - **Sensitive data is never committed.** All secrets and credentials must be placed in `.env` files, which are excluded by `.gitignore`.
> - **`.env.example` files** are provided for each app (server, client, admin). These list all required environment variables with empty placeholder values. Copy to `.env` (server) or `.env.local` (frontends) and fill in your real values.
> - **Ports:**
>   - Backend: `8000` (set in `server/.env`)
>   - Client: `3000` (default Next.js)
>   - Admin: `3001` (set in `frontend/admin/package.json`)
> - **Never commit your actual `.env` or `.env.local` files.** Only `.env.example` is tracked for onboarding and documentation.

**Production-Ready Full-Stack E-Commerce Solution with Razorpay Payment Integration**

![Production Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![Last Audit](https://img.shields.io/badge/Last%20Audit-January%202026-orange)

---

## 🚨 Production Readiness Status

| Component         | Status   | Notes                          |
| ----------------- | -------- | ------------------------------ |
| Backend API       | ✅ Ready | All endpoints functional       |
| Client Frontend   | ✅ Ready | All pages working              |
| Admin Panel       | ✅ Ready | Full CRUD operations           |
| Razorpay Payment  | ✅ Ready | Signature verification working |
| Cloudinary Upload | ✅ Ready | Images upload correctly        |
| Authentication    | ✅ Ready | JWT + Google OAuth             |
| Cart/Wishlist     | ✅ Ready | API + localStorage fallback    |

### Quick Start Commands

```bash
# Backend
cd server && npm install && npm start

# Client (in new terminal)
cd frontend/client && npm install && npm run dev

# Admin (in new terminal)
cd frontend/admin && npm install && npm run dev
```

**Ports:** Backend: 8000 | Client: 3000 | Admin: 3001

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Installation & Setup](#installation--setup)
5. [Environment Configuration](#environment-configuration)
6. [Running the Application](#running-the-application)
7. [API Documentation](#api-documentation)
8. [Payment Gateway Setup](#payment-gateway-setup)
9. [Database Schema](#database-schema)
10. [Features & Workflows](#features--workflows)
11. [Deployment Guide](#deployment-guide)
12. [Troubleshooting](#troubleshooting)

---

## 🎯 Project Overview

**Healthy One Gram** is a premium e-commerce platform specializing in health-conscious food products. The platform features:

- ✅ **Multi-Role System**: Admin, Client, Guest checkout
- ✅ **Razorpay Payment Integration**: Real-time order processing
- ✅ **Real-time Order Tracking**: Admin dashboard with live notifications
- ✅ **Responsive Design**: Mobile-first, optimized UI
- ✅ **Blog Management**: Admin-controlled content
- ✅ **Product Catalog**: Dynamic category and filter system
- ✅ **Wishlist & Cart**: Persistent storage with localStorage
- ✅ **User Authentication**: JWT-based secure login

---

## 🛠️ Tech Stack

### **Backend**

| Technology | Purpose         | Version |
| ---------- | --------------- | ------- |
| Node.js    | Runtime         | 18+     |
| Express.js | Web Framework   | 4.18+   |
| MongoDB    | Database        | 5.0+    |
| Mongoose   | ODM             | 7.0+    |
| Razorpay   | Payment Gateway | -       |
| JWT        | Authentication  | -       |
| Cloudinary | Image Storage   | -       |

### **Frontend (Client)**

| Technology   | Purpose           | Version |
| ------------ | ----------------- | ------- |
| Next.js      | React Framework   | 16.1.4  |
| React        | UI Library        | 19+     |
| Tailwind CSS | Styling           | 3+      |
| Material-UI  | Components        | 5+      |
| Axios        | HTTP Client       | -       |
| js-cookie    | Cookie Management | -       |

### **Frontend (Admin)**

| Technology   | Purpose          | Version |
| ------------ | ---------------- | ------- |
| Next.js      | React Framework  | 16.1.4  |
| React        | UI Library       | 19+     |
| Tailwind CSS | Styling          | 3+      |
| Material-UI  | Components       | 5+      |
| Recharts     | Analytics Charts | -       |

---

## 📁 Project Structure

```
bogEcom/
├── server/                          # Backend (Node.js/Express)
│   ├── config/
│   │   ├── connectDb.js            # MongoDB connection
│   │   ├── cloudinary.js           # Image storage config
│   │   └── emailService.js         # Email configuration
│   ├── controllers/
│   │   ├── order.controller.js     # ⭐ Payment & Order Logic
│   │   ├── product.controller.js
│   │   ├── user.controller.js
│   │   ├── category.controller.js
│   │   ├── cart.controller.js
│   │   ├── wishlist.controller.js
│   │   ├── banner.controller.js
│   │   ├── homeSlide.controller.js
│   │   └── blog.controller.js
│   ├── models/
│   │   ├── order.model.js          # ⭐ Order Schema
│   │   ├── product.model.js
│   │   ├── user.model.js
│   │   ├── category.model.js
│   │   ├── cart.model.js
│   │   ├── wishlist.model.js
│   │   ├── address.model.js
│   │   ├── banner.model.js
│   │   ├── homeSlide.model.js
│   │   ├── blog.model.js
│   │   └── coupon.model.js
│   ├── routes/
│   │   ├── order.route.js          # ⭐ Payment Routes
│   │   ├── product.route.js
│   │   ├── user.route.js
│   │   ├── category.route.js
│   │   ├── cart.route.js
│   │   ├── wishlist.route.js
│   │   ├── banner.route.js
│   │   ├── homeSlide.route.js
│   │   ├── blog.route.js
│   │   └── upload.route.js
│   ├── middlewares/
│   │   ├── auth.js                 # JWT Authentication
│   │   ├── admin.js                # Admin Authorization
│   │   └── optionalAuth.js         # Optional Auth
│   ├── .env                        # ⭐ Environment Variables
│   ├── .env.example                # Template
│   ├── index.js                    # Server Entry Point
│   ├── package.json
│   └── uploads/                    # Product images

├── frontend/                       # Client (Next.js)
│   ├── client/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.js         # Home page
│   │   │   │   ├── layout.js       # Root layout
│   │   │   │   ├── products/
│   │   │   │   ├── checkout/       # ⭐ Checkout Page
│   │   │   │   ├── cart/           # ⭐ Cart Page
│   │   │   │   ├── my-orders/      # ⭐ Orders Page
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   ├── my-account/
│   │   │   │   ├── blogs/
│   │   │   │   ├── about-us/
│   │   │   │   ├── delivery/
│   │   │   │   ├── legal/
│   │   │   │   └── terms/
│   │   │   ├── components/
│   │   │   │   ├── Header.jsx      # ⭐ Navigation
│   │   │   │   ├── Footer.jsx
│   │   │   │   ├── Sidebar.jsx     # Filters
│   │   │   │   ├── ProductItem.jsx
│   │   │   │   ├── ProductSlider.jsx
│   │   │   │   └── ...
│   │   │   ├── hooks/
│   │   │   │   └── usePayment.js   # ⭐ Payment Hook
│   │   │   ├── context/
│   │   │   │   ├── CartContext.jsx
│   │   │   │   ├── WishlistContext.jsx
│   │   │   │   └── ThemeProvider.jsx
│   │   │   └── utils/
│   │   │       └── api.js          # API calls
│   │   ├── .env.local              # ⭐ Frontend Config
│   │   └── package.json
│   │
│   └── admin/                      # Admin Panel (Next.js)
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.js         # Dashboard
│       │   │   ├── orders/         # ⭐ Admin Orders
│       │   │   ├── products-list/
│       │   │   ├── category-list/
│       │   │   ├── banners/
│       │   │   ├── blogs/
│       │   │   ├── users/
│       │   │   └── home-slides/
│       │   ├── components/
│       │   │   ├── Header.jsx      # ⭐ With order notifications
│       │   │   ├── Sidebar.jsx
│       │   │   └── ...
│       │   └── hooks/
│       │       └── useOrderNotifications.js # ⭐ Live notifications
│       └── package.json

├── README.md                       # ⭐ This file
├── .AI-RULES.md                    # ⭐ AI Development Rules
└── PAYMENT_GATEWAY_SETUP.md        # Payment Setup Guide
```

---

## 🚀 Installation & Setup

### **Prerequisites**

- Node.js 18+ installed
- MongoDB Atlas account (free tier available)
- Razorpay account (for payments)
- Cloudinary account (for image storage)
- Git installed

### **Step 1: Clone Repository**

```bash
git clone <repository-url>
cd bogEcom
```

### **Step 2: Install Dependencies**

```bash
# Backend
cd server
npm install

# Frontend Client
cd ../frontend/client
npm install

# Frontend Admin
cd ../admin
npm install
```

### **Step 3: Setup MongoDB**

1. Go to https://mongodb.com/cloud/atlas
2. Create free cluster
3. Get connection string: `mongodb+srv://user:password@cluster.mongodb.net/dbname`

### **Step 4: Get API Keys**

#### **Razorpay** (https://dashboard.razorpay.com/app/keys)

- Key ID
- Key Secret

#### **Cloudinary** (https://cloudinary.com/console)

- Cloud Name
- API Key
- API Secret

#### **Firebase** (https://firebase.google.com/console)

- API Key
- Auth Domain
- Project ID

---

## ⚙️ Environment Configuration

### **Backend: `/server/.env`**

```env
# Server
PORT=8000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/BuyOneGram

# Authentication
SECRET_KEY_ACCESS_TOKEN=your_access_token_secret_32_chars_min
SECRET_KEY_REFRESH_TOKEN=your_refresh_token_secret_32_chars_min
JSON_WEB_TOKEN_SECRET_KEY=your_jwt_secret_32_chars_min

# Email Service
EMAIL=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Cloudinary (Image Storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Razorpay (Payment Gateway)
RAZORPAY_KEY_ID=rzp_test_xxxxx_or_rzp_live_xxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret_key
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Frontend URLs
FRONTEND_URL=http://localhost:3000,http://localhost:3001
```

### **Frontend Client: `/frontend/client/.env.local`**

```env
# Razorpay Public Key
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx_or_rzp_live_xxxxx

# API Base URL
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### **Frontend Admin: `/frontend/admin/.env.local`**

```env
# API Base URL
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### **Copy Template Files**

```bash
cd server
cp .env.example .env

cd ../frontend/client
cp .env.example .env.local

cd ../admin
cp .env.example .env.local
```

> **Note on `.env.example` files:**
> Each app has a `.env.example` file that documents required environment variables with placeholder values.
> These are safe to commit and help new developers understand what configuration is needed.
> Copy them to `.env` (server) or `.env.local` (frontends) and fill in real values.
> Never commit actual `.env` or `.env.local` files.

---

## ▶️ Running the Application

### **Port Configuration**

| App    | Dev Port | Prod Port | Config Location            |
| ------ | -------- | --------- | -------------------------- |
| Server | 8000     | 8000      | `server/.env` → `PORT`     |
| Client | 3000     | 3000      | Default Next.js            |
| Admin  | 3001     | 3001      | `package.json` → `-p 3001` |

> Admin is configured to always use port 3001 via the `dev` and `start` scripts in its `package.json`.
> This prevents port conflicts when running both frontends simultaneously.

### **Development Mode**

**Terminal 1 - Backend**

```bash
cd server
npm run dev
# Server running on http://localhost:8000
```

**Terminal 2 - Frontend Client**

```bash
cd frontend/client
npm run dev
# Client running on http://localhost:3000
```

**Terminal 3 - Admin Panel**

```bash
cd frontend/admin
npm run dev
# Admin running on http://localhost:3001
```

### **Production Build**

```bash
# Backend (no build needed)
npm run start

# Frontend Client
npm run build
npm run start

# Frontend Admin
npm run build
npm run start
```

---

## 📡 API Documentation

### **Base URL**

```
Development: http://localhost:8000/api
Production: https://yourdomain.com/api
```

### **Authentication Headers**

All protected endpoints require:

```javascript
{
  "Authorization": "Bearer {accessToken}",
  "Content-Type": "application/json"
}
```

---

### **🛒 ORDER & PAYMENT ENDPOINTS**

#### **1. Create Order**

```http
POST /api/orders
Content-Type: application/json

Body:
{
  "products": [
    {
      "productId": "507f1f77bcf86cd799439011",
      "productTitle": "Peanut Butter",
      "quantity": 2,
      "price": 300,
      "image": "url",
      "subTotal": 600
    }
  ],
  "totalAmt": 650,
  "delivery_address": "507f1f77bcf86cd799439012" // optional
}

Response: 201
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

**Status Codes:**

- `201` ✅ Order created
- `400` ❌ Invalid input (missing products, invalid amount)
- `500` ❌ Server error

**Flow:** Cart → Create Order → Get Razorpay Order ID → Open Checkout

---

#### **2. Verify Payment**

```http
POST /api/orders/verify-payment
Content-Type: application/json

Body:
{
  "orderId": "507f1f77bcf86cd799439013",
  "razorpayPaymentId": "pay_IluGWxBm9U8zJ8",
  "razorpayOrderId": "order_IluGWxBm9U8zJ8",
  "razorpaySignature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"
}

Response: 200
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

**Status Codes:**

- `200` ✅ Payment verified
- `400` ❌ Invalid signature (fraud attempt)
- `404` ❌ Order not found
- `500` ❌ Server error

**Flow:** User completes payment → Razorpay callback → Verify on backend → Confirm order

---

#### **3. Get User Orders**

```http
GET /api/orders/user/my-orders
Authorization: Bearer {accessToken}

Response: 200
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
          "productTitle": "Peanut Butter",
          "quantity": 2,
          "price": 300,
          "subTotal": 600
        }
      ],
      "paymentId": "pay_IluGWxBm9U8zJ8",
      "payment_status": "paid",
      "order_status": "confirmed",
      "totalAmt": 650,
      "createdAt": "2026-01-25T10:30:00Z",
      "updatedAt": "2026-01-25T10:35:00Z"
    }
  ]
}
```

**Status Codes:**

- `200` ✅ Orders fetched
- `400` ❌ Missing user ID
- `500` ❌ Server error

**Flow:** User login → View orders → See status & details

---

#### **4. Razorpay Webhook** (Production Only)

```http
POST /api/orders/webhook/razorpay
X-Razorpay-Signature: {signature}

Body: (Razorpay sends automatically)
{
  "event": "payment.authorized",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_IluGWxBm9U8zJ8",
        "notes": {
          "order_id": "507f1f77bcf86cd799439013"
        }
      }
    }
  }
}

Response: 200
{
  "error": false,
  "success": true,
  "message": "Webhook processed"
}
```

**Webhook Events Handled:**

- `payment.authorized` → Update order status to "confirmed"
- `payment.failed` → Update order status to "cancelled"

---

### **👥 USER ENDPOINTS**

#### **Register User**

```http
POST /api/user/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}

Response: 201
{
  "error": false,
  "message": "User registered successfully",
  "data": {
    "user": { "_id", "name", "email" }
  }
}
```

#### **Login User**

```http
POST /api/user/login
{
  "email": "john@example.com",
  "password": "securePassword123"
}

Response: 200
{
  "error": false,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGc...",
    "user": { "_id", "name", "email" }
  }
}

Cookies Set:
- accessToken (7 days)
- userName
- userEmail
- userPhoto
```

#### **Logout User**

```http
POST /api/user/logout
Authorization: Bearer {accessToken}

Response: 200
{
  "error": false,
  "message": "Logged out successfully"
}

Cookies Cleared:
- accessToken
- userName
- userEmail
- userPhoto
```

---

### **📦 PRODUCT ENDPOINTS**

#### **Get All Products**

```http
GET /api/products?page=1&limit=15&category=507f1f77bcf86cd799439000&minPrice=100&maxPrice=500

Response: 200
{
  "error": false,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Peanut Butter",
      "price": 300,
      "originalPrice": 400,
      "category": "507f1f77bcf86cd799439000",
      "image": "url",
      "description": "...",
      "rating": 4.5
    }
  ],
  "totalProducts": 45,
  "totalPages": 3
}
```

#### **Get Product Details**

```http
GET /api/products/507f1f77bcf86cd799439011

Response: 200
{
  "error": false,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Peanut Butter",
    "price": 300,
    "description": "...",
    "images": ["url1", "url2"],
    "rating": 4.5,
    "category": { _id, name },
    "inStock": true
  }
}
```

---

### **🛍️ CART ENDPOINTS**

#### **Add to Cart**

```http
POST /api/cart
Authorization: Bearer {accessToken}
{
  "productId": "507f1f77bcf86cd799439011",
  "quantity": 2
}

Response: 200
{
  "error": false,
  "message": "Added to cart",
  "data": { "cartId", "quantity" }
}
```

#### **Get Cart**

```http
GET /api/cart
Authorization: Bearer {accessToken}

Response: 200
{
  "error": false,
  "data": [
    {
      "productId": "507f1f77bcf86cd799439011",
      "quantity": 2,
      "product": { name, price, image }
    }
  ]
}
```

---

### **❤️ WISHLIST ENDPOINTS**

#### **Add to Wishlist**

```http
POST /api/wishlist
Authorization: Bearer {accessToken}
{
  "productId": "507f1f77bcf86cd799439011"
}

Response: 200
{
  "error": false,
  "message": "Added to wishlist"
}
```

---

### **📊 ADMIN ENDPOINTS**

#### **Get All Orders (Admin)**

```http
GET /api/orders/admin/all?page=1&limit=20&status=confirmed&search=pay_xxx
Authorization: Bearer {adminToken}

Response: 200
{
  "error": false,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "user": { name, email },
      "products": [...],
      "order_status": "confirmed",
      "payment_status": "paid",
      "totalAmt": 650,
      "createdAt": "..."
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

#### **Update Order Status**

```http
PUT /api/orders/507f1f77bcf86cd799439013/status
Authorization: Bearer {adminToken}
{
  "order_status": "shipped"
}

Response: 200
{
  "error": false,
  "message": "Order status updated",
  "data": { order }
}
```

#### **Get Dashboard Stats**

```http
GET /api/orders/admin/dashboard-stats
Authorization: Bearer {adminToken}

Response: 200
{
  "error": false,
  "data": {
    "totalOrders": 150,
    "totalProducts": 45,
    "totalCategories": 8,
    "totalUsers": 320,
    "totalRevenue": 45000,
    "recentOrders": [...]
  }
}
```

---

## 💳 Payment Gateway Setup

### **Razorpay Test Mode (Development)**

**Test Cards:**
| Card | Number | CVV | Result |
|------|--------|-----|--------|
| Visa Success | 4111 1111 1111 1111 | Any 3 digits | ✅ Success |
| Visa 3D Secure | 4012 8888 8888 1881 | Any 3 digits | ✅ Success with OTP |
| Declined | 4000 0000 0000 0002 | Any 3 digits | ❌ Declined |

**Expiry:** Any future date (MM/YY format)

### **Production Checklist**

- [ ] Switch Razorpay to live mode
- [ ] Update `RAZORPAY_KEY_ID` to live key
- [ ] Update `RAZORPAY_KEY_SECRET` to live secret
- [ ] Configure webhook in Razorpay dashboard
- [ ] Test payment flow end-to-end
- [ ] Enable HTTPS
- [ ] Setup email notifications
- [ ] Configure database backups
- [ ] Setup logging & monitoring

---

## 💾 Database Schema

### **Order Model**

```javascript
{
  user: ObjectId,                    // Reference to User
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
  paymentId: String,                 // Razorpay Payment ID
  payment_status: String,            // "pending" | "paid" | "failed"
  order_status: String,              // "pending" | "confirmed" | "shipped" | "delivered" | "cancelled"
  delivery_address: ObjectId,        // Reference to Address
  totalAmt: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### **User Model**

```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  avatar: String,
  mobile: String,
  role: String,                      // "User" | "Admin"
  googleId: String (optional),
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### **Product Model**

```javascript
{
  name: String,
  price: Number,
  originalPrice: Number,
  description: String,
  category: ObjectId,                // Reference to Category
  images: [String],
  inStock: Boolean,
  stock: Number,
  rating: Number,
  reviews: [
    {
      user: ObjectId,
      rating: Number,
      comment: String
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔄 Features & Workflows

### **1. Complete Order Flow**

```
Step 1: User adds product to cart (localStorage)
   ↓
Step 2: User goes to checkout page
   ↓
Step 3: User fills address & clicks "Proceed to Payment"
   ↓
Step 4: Frontend calls POST /api/orders
   ↓
Step 5: Backend creates order, generates Razorpay Order ID
   ↓
Step 6: Razorpay checkout opens with order details
   ↓
Step 7: User pays with card/UPI/wallet
   ↓
Step 8: Razorpay returns payment response (success/failure)
   ↓
Step 9: Frontend calls POST /api/orders/verify-payment
   ↓
Step 10: Backend verifies signature, updates order status
   ↓
Step 11: User redirected to My Orders page
   ↓
Step 12: Admin sees order in dashboard (real-time)
```

### **2. Admin Order Management**

```
Admin Dashboard
   ↓
See all orders in real-time
   ↓
Click on order for details
   ↓
Update status (pending → shipped → delivered)
   ↓
System sends notification to user
   ↓
User sees updated status in My Orders
```

### **3. Payment Verification Flow**

```
User Completes Payment
   ↓
Razorpay returns:
- razorpay_payment_id
- razorpay_order_id
- razorpay_signature
   ↓
Frontend sends to backend
   ↓
Backend verifies signature using:
HMAC = SHA256(order_id|payment_id, key_secret)
   ↓
If HMAC matches signature:
- Order status = confirmed
- Payment status = paid
   ↓
If HMAC doesn't match:
- Order cancelled
- User sees error
```

### **4. Real-Time Admin Notifications**

```
Order Created
   ↓
Admin sees notification badge
   ↓
Click notification → See order details
   ↓
Mark as read → Badge disappears
   ↓
Update status → User gets notified
```

### **5. Client-Admin Sync**

```
Database (MongoDB)
   ↓
Orders stored with all details
   ↓
Admin fetches: GET /api/orders/admin/all
   ↓
Displays in dashboard with real-time updates
   ↓
Client fetches: GET /api/orders/user/my-orders
   ↓
Displays in My Orders page
```

---

## 🚀 Deployment Guide

### **Backend Deployment (Heroku/Railway)**

1. Create account on Heroku or Railway
2. Connect GitHub repository
3. Set environment variables:
   ```
   PORT=8000
   MONGODB_URI=...
   RAZORPAY_KEY_ID=...
   RAZORPAY_KEY_SECRET=...
   (etc)
   ```
4. Deploy

### **Frontend Deployment (Vercel)**

```bash
# Client
npm run build
vercel deploy

# Admin
cd ../admin
npm run build
vercel deploy
```

### **Database Backup**

MongoDB Atlas automatically backs up data. For production:

- Enable automated backups
- Setup point-in-time recovery
- Test restore procedures

---

## 🔧 Troubleshooting

### **Payment Issues**

**Problem:** Payment gateway not loading

- Check: `NEXT_PUBLIC_RAZORPAY_KEY_ID` is set
- Verify: Not expired or invalid key
- Check: Browser console for errors

**Problem:** Payment verification failing

- Check: Razorpay credentials in `.env`
- Verify: Order exists in database
- Check: Signature calculation

### **Database Issues**

**Problem:** MongoDB connection failed

- Check: Connection string is correct
- Verify: Whitelist IP in MongoDB Atlas
- Ensure: Network is accessible

**Problem:** Orders not syncing

- Clear browser cache
- Restart backend server
- Check: MongoDB connection status

### **API Issues**

**Problem:** CORS errors

- Verify: Frontend URL in `FRONTEND_URL` env
- Check: Allowed methods in server config
- Ensure: Content-Type header is correct

**Problem:** Authentication failed

- Check: Cookies are set correctly
- Verify: Token not expired
- Clear: Browser cookies and retry

---

## 📞 Support & Contact

For issues or questions:

- Check README section above
- Review API Documentation
- Check server logs: `npm run dev`
- Check browser console: F12

---

## 📄 License

This project is proprietary software. All rights reserved.

---

**Happy Coding! 🚀**

Last Updated: January 25, 2026
