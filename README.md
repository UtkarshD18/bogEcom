# 🛍️ Healthy One Gram - E-Commerce Platform

**Production-Ready Full-Stack E-Commerce Solution with PhonePe Payment Integration**

![Production Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Version](https://img.shields.io/badge/Version-1.2.0-blue)
![Last Audit](https://img.shields.io/badge/Last%20Audit-January%202026-orange)
![Payment](https://img.shields.io/badge/Payment-PhonePe%20Onboarding-yellow)

---

**Quick Start**

```bash
# Backend
cd server && npm install && npm start

# Client (new terminal)
cd frontend/client && npm install && npm run dev

# Admin (new terminal)
cd frontend/admin && npm install && npm run dev
```

Ports: Backend `8000` | Client `3000` | Admin `3001`

Setup notes:
- Use `.env` (server) and `.env.local` (client/admin). Never commit real secrets.
- Copy from `.env.example` files and fill real values.

---

## 🚨 Production Readiness Status

| Component          | Status        | Notes                             |
| ------------------ | ------------- | --------------------------------- |
| Backend API        | ✅ Ready      | All endpoints functional          |
| Client Frontend    | ✅ Ready      | All pages working                 |
| Admin Panel        | ✅ Ready      | Full CRUD operations              |
| PhonePe Payment    | 🟡 Onboarding | Awaiting activation               |
| Coupon System      | ✅ Ready      | Backend validation with affiliate |
| Affiliate Tracking | ✅ Ready      | URL params + coupon integration   |
| Cloudinary Upload  | ✅ Ready      | Images upload correctly           |
| Authentication     | ✅ Ready      | JWT + Google OAuth                |
| Cart/Wishlist      | ✅ Ready      | API + localStorage fallback       |
| Push Notifications | ✅ Ready      | FCM for offers + order updates    |

### ⚠️ PhonePe Payment Gateway Status

> **Current Status:** PhonePe integration is in **onboarding phase**. Payments are temporarily unavailable.
>
> **Checkout Behavior:**
>
> - Clicking "Pay Now" displays a professional modal explaining the situation
> - Users can optionally "Save Order" to create a pending order for later payment
> - No actual payment processing occurs until PhonePe activation is complete
> - Set `PHONEPE_ENABLED=true` in server `.env` when activated

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Installation & Setup](#installation--setup)
5. [Environment Configuration](#environment-configuration)
6. [Running the Application](#running-the-application)
7. [API Documentation](#api-documentation)
8. [Payment Gateway Setup](#payment-gateway-setup)
9. [Coupon System](#coupon-system)
10. [Affiliate Tracking](#affiliate-tracking)
11. [Database Schema](#database-schema)
12. [Features & Workflows](#features--workflows)
13. [Deployment Guide](#deployment-guide)
14. [Troubleshooting](#troubleshooting)

---

## 🔄 Recent Updates

- Influencer portal login + refresh flow added for collaborator access (token-based).
- Referral discount auto-applies only for sessions arriving via `?ref=CODE` (sessionStorage).
- Manual influencer codes now work from the coupon input (fallback validation).
- Influencer links removed from header; portal now uses a "Copy referral link" action.
- Referral redirect guard removed to allow influencers to browse storefront.
- Hardened admin auth logging: token debug output is now dev-only and redacted.
- Unified client API base URL usage and added refresh-token retry in My Orders.
- Fixed delivery address rendering to support `address_line1` / `address_line` / `address`.
- Tightened CORS in production to use only configured origins, with `SITE_BASE_URL` fallback.
- Reduced debug noise in production by gating server logs and muting client-side `console.log/console.warn`.
- Seeder no longer prints the default admin password to the console.
- PhonePe payment hook now documents the legacy Razorpay alias as backward-compatible.
- README emoji/heading encoding cleaned for production polish.

Risky changes handled safely:
- CORS now excludes localhost in production but falls back to `SITE_BASE_URL` if `FRONTEND_URL` is missing.
- Auth token usage now prefers cookies but still falls back to localStorage to avoid breaking older flows.
- Legacy Razorpay-named hook is preserved to avoid breaking existing imports.

Additional fixes:
- My Orders now attempts refresh-token flow before forcing re-login.

New folders/files:
- `_duplicates/` (temporary quarantine for removed duplicate shipping files)

Confirmation:
- No breaking changes introduced.

---

## 🎯 Project Overview

**Healthy One Gram** is a premium e-commerce platform specializing in health-conscious food products. The platform features:

- ✅ **Multi-Role System**: Admin, Client, Guest checkout
- ✅ **PhonePe Payment Integration**: (Onboarding in progress)
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
| PhonePe   | Payment Gateway | -       |
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
│   │   ├── coupon.model.js
│   │   └── settings.model.js       # ⭐ Admin Settings (NEW)
│   ├── routes/
│   │   ├── order.route.js          # ⭐ Payment Routes
│   │   ├── product.route.js
│   │   ├── user.route.js
│   │   ├── category.route.js
│   │   ├── cart.route.js
│   │   ├── wishlist.route.js
│   │   ├── banner.route.js
│   │   ├── homeSlide.route.js
│   │   ├── settings.route.js       # ⭐ Settings Routes (NEW)
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
│   │   │   │   ├── my-orders/      # ⭐ Orders List Page
│   │   │   │   ├── orders/[orderId]/ # ⭐ Order Details Page (NEW)
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
- PhonePe business account (for payments)
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

#### **PhonePe** (https://business.phonepe.com)

- Merchant ID
- Salt Key
- Salt Index
- Environment (UAT/PROD)

#### **Cloudinary** (https://cloudinary.com/console)

- Cloud Name
- API Key
- API Secret

#### **Firebase** (https://firebase.google.com/console)

- API Key
- Auth Domain
- Project ID

------

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

# PhonePe (Payment Gateway)
PHONEPE_ENABLED=false
PHONEPE_MERCHANT_ID=your_merchant_id
PHONEPE_SALT_KEY=your_salt_key
PHONEPE_SALT_INDEX=1
PHONEPE_ENV=UAT
PHONEPE_REDIRECT_URL=http://localhost:3000/payment/phonepe
PHONEPE_CALLBACK_URL=http://localhost:8000/api/orders/webhook/phonepe
PHONEPE_ORDER_REDIRECT_URL=http://localhost:3000/payment/phonepe
PHONEPE_ORDER_CALLBACK_URL=http://localhost:8000/api/orders/webhook/phonepe
PHONEPE_MEMBERSHIP_REDIRECT_URL=http://localhost:3000/membership/checkout
PHONEPE_MEMBERSHIP_CALLBACK_URL=http://localhost:8000/api/membership/verify-payment
PHONEPE_BASE_URL=https://api-preprod.phonepe.com/apis/pg-sandbox
PHONEPE_PAY_PATH=/pg/v1/pay
PHONEPE_STATUS_PATH=/pg/v1/status
BACKEND_URL=http://localhost:8000

# Frontend URLs
FRONTEND_URL=http://localhost:3000,http://localhost:3001
```

### **Frontend Client: `/frontend/client/.env.local`**

```env
# API Base URL
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_API_URL=http://localhost:8000

# Site URL (for SEO)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase VAPID Key
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key
```

### **Frontend Admin: `/frontend/admin/.env.local`**### **Frontend Admin: `/frontend/admin/.env.local`**

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
    "paymentProvider": "PHONEPE",
    "paymentUrl": "https://api.phonepe.com/redirect/...",
    "merchantTransactionId": "BOG_507f1f77bcf86cd799439013"
  }
}
```

**Status Codes:**

- `201` ✅ Order created
- `400` ❌ Invalid input (missing products, invalid amount)
- `500` ❌ Server error

**Flow:** Cart → Create Order → Redirect to PhonePe payment page

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
      "paymentId": "T230412345678",
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

#### **4. Get Single Order Details**

```http
GET /api/orders/user/order/:orderId
Authorization: Bearer {accessToken}

Response: 200
{
  "error": false,
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "user": "507f1f77bcf86cd799439000",
    "products": [...],
    "delivery_address": {...},
    "paymentId": "T230412345678",
    "payment_status": "paid",         // paid, pending, unavailable, failed
    "order_status": "confirmed",      // pending_payment, confirmed, shipped, delivered, cancelled
    "subTotal": 600,
    "tax": 30,
    "shipping": 50,
    "discountAmount": 0,
    "totalAmt": 680,
    "couponCode": null,
    "affiliateCode": null,
    "paymentMethod": "phonepe",
    "createdAt": "2026-01-25T10:30:00Z"
  }
}
```

**Status Codes:**

- `200` ✅ Order fetched
- `401` ❌ Not authenticated
- `403` ❌ Not authorized (not your order)
- `404` ❌ Order not found
- `500` ❌ Server error

**Flow:** User clicks "View Order Details" → Fetch order → Display full details with pending payment notice (if applicable)

---

#### **5. PhonePe Webhook** (Production Only)

```http
POST /api/orders/webhook/phonepe
Content-Type: application/json

Body: (PhonePe sends automatically)
{
  "merchantTransactionId": "BOG_507f1f77bcf86cd799439013",
  "transactionId": "T230412345678",
  "state": "COMPLETED"
}

Response: 200
{
  "error": false,
  "success": true,
  "message": "Webhook processed"
}
```

**Webhook Events Handled:**

- `SUCCESS/COMPLETED` ? Update order status to "confirmed"
- `FAILURE` ? Update order status to "failed"

------

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

### **PhonePe Activation**

When PhonePe onboarding is complete:

1. Set `PHONEPE_ENABLED=true` in server `.env`
2. Add PhonePe credentials:
   ```env
   PHONEPE_MERCHANT_ID=your_merchant_id
   PHONEPE_SALT_KEY=your_salt_key
   PHONEPE_SALT_INDEX=1
   PHONEPE_ENV=PROD
   ```
3. Configure the redirect and callback URLs (defaults used if omitted):
   ```env
   PHONEPE_ORDER_REDIRECT_URL=https://yourdomain.com/payment/phonepe
   PHONEPE_ORDER_CALLBACK_URL=https://yourdomain.com/api/orders/webhook/phonepe
   PHONEPE_MEMBERSHIP_REDIRECT_URL=https://yourdomain.com/membership/checkout
   PHONEPE_MEMBERSHIP_CALLBACK_URL=https://yourdomain.com/api/membership/verify-payment
   ```
4. Restart the server and test a live transaction

### **Production Checklist**

- [ ] Confirm PhonePe UAT -> PROD switch
- [ ] Set `PHONEPE_ENV=PROD`
- [ ] Verify webhook callback URL is reachable
- [ ] Test payment flow end-to-end
- [ ] Enable HTTPS
- [ ] Setup email notifications
- [ ] Configure database backups
- [ ] Setup logging & monitoring

---

## 🎟️ Coupon System

### **Overview**

Backend-validated coupon system with support for:

- Percentage and fixed amount discounts
- Minimum order requirements
- Usage limits (total and per-user)
- Expiration dates
- Affiliate/influencer tracking

### **API Endpoints**

| Method | Endpoint                    | Access | Description                     |
| ------ | --------------------------- | ------ | ------------------------------- |
| POST   | `/api/coupons/validate`     | Public | Validate and calculate discount |
| GET    | `/api/coupons/admin/all`    | Admin  | List all coupons                |
| POST   | `/api/coupons/admin/create` | Admin  | Create new coupon               |
| PUT    | `/api/coupons/admin/:id`    | Admin  | Update coupon                   |
| DELETE | `/api/coupons/admin/:id`    | Admin  | Delete coupon                   |

### **Coupon Validation Request**

```javascript
POST /api/coupons/validate
{
  "code": "SAVE20",
  "orderAmount": 1500
}

// Response
{
  "success": true,
  "data": {
    "code": "SAVE20",
    "discountType": "percentage",
    "discountValue": 20,
    "discountAmount": 300,
    "finalAmount": 1200,
    "isAffiliateCoupon": false
  }
}
```

### **Coupon Schema**

```javascript
{
  code: String,              // Unique, uppercase
  discountType: String,      // "percentage" | "fixed"
  discountValue: Number,
  minOrderAmount: Number,
  maxDiscountAmount: Number,
  usageLimit: Number,
  usedCount: Number,
  perUserLimit: Number,
  expiresAt: Date,
  isActive: Boolean,
  isAffiliate: Boolean,      // For affiliate tracking
  affiliateSource: String,   // "influencer" | "campaign" | "referral"
  createdBy: ObjectId
}
```

---

## 🔗 Affiliate Tracking

### **Overview**

Track referrals and affiliate sales through URL parameters and coupon codes.

### **URL Parameters**

The system automatically captures these URL parameters:

| Parameter   | Example                 | Source Type |
| ----------- | ----------------------- | ----------- |
| `ref`       | `?ref=JOHN2024`         | referral    |
| `affiliate` | `?affiliate=PARTNER123` | influencer  |
| `campaign`  | `?campaign=SUMMER_SALE` | campaign    |

### **How It Works**

1. **User clicks affiliate link:** `https://yoursite.com?ref=INFLUENCER_CODE`
2. **Code is stored:** Saved in sessionStorage (session-only; resets on browser close)
3. **User shops:** Code persists only for the current session
4. **At checkout:** Affiliate data is attached to order
5. **Coupon integration:** Affiliate coupons also set tracking

### **Client Usage**

```javascript
import {
  initAffiliateTracking,
  getStoredAffiliateData,
} from "@/utils/affiliateTracking";

// On page load (automatically captures URL params)
initAffiliateTracking();

// At checkout
const affiliateData = getStoredAffiliateData();
// { code: 'JOHN2024', source: 'referral', timestamp: 1705..., fromUrl: true }
```

### **Order Integration**

Orders include affiliate data:

```javascript
{
  affiliateCode: "JOHN2024",
  affiliateSource: "referral",  // "influencer" | "campaign" | "referral" | "organic"
  // ... other order fields
}
```

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
  paymentId: String,                 // PhonePe transaction ID
  paymentMethod: String,             // "PHONEPE" | "COD" | "PENDING"
  payment_status: String,            // "pending" | "paid" | "failed" | "unavailable"
  order_status: String,              // "pending" | "pending_payment" | "confirmed" | "shipped" | "delivered" | "cancelled"
  delivery_address: ObjectId,        // Reference to Address
  totalAmt: Number,

  // Coupon & Discount
  couponCode: String,
  discountAmount: Number,
  finalAmount: Number,

  // Affiliate Tracking
  affiliateCode: String,
  affiliateSource: String,           // "influencer" | "campaign" | "referral" | "organic"

  // Mock Order Support
  isSavedOrder: Boolean,             // true if saved during PhonePe onboarding

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

## 🔔 Push Notifications System

### **Overview**

The platform uses Firebase Cloud Messaging (FCM) for push notifications with strict separation between offer and order notifications.

| Notification Type | Target         | Trigger                    | Content         |
| ----------------- | -------------- | -------------------------- | --------------- |
| Offer/Coupon      | Guests + Users | Admin creates coupon       | Discount offers |
| Order Update      | Users ONLY     | Admin updates order status | Order status    |

### **Privacy & Security Rules**

- ✅ **Offer notifications do NOT require login**
- ✅ **Order notifications require login**
- ✅ Guests only receive promotional notifications
- ✅ No personal data in offer notifications
- ✅ Backend-only notification sending
- ✅ Tokens stored anonymously for guests

### **Automatic Admin → Notification Flow**

```
Admin creates/activates coupon
   ↓
Coupon saved in MongoDB
   ↓
Backend detects: isActive === true
   ↓
Backend calls sendOfferNotification(coupon)
   ↓
FCM sends to all guest + user tokens
   ↓
Users receive push notification
```

### **Order Update Notification Flow**

```
Admin updates order status
   ↓
updateOrderStatus(orderId, newStatus)
   ↓
Backend fetches user tokens (userId match)
   ↓
sendOrderUpdateNotification(order, newStatus)
   ↓
User receives order status notification
```

### **Frontend Permission Flow**

```
Guest visits site
   ↓
After delay, show Offer Popup
   ↓
User copies coupon code
   ↓
Prompt for notification permission
   ↓
On grant: Register service worker
   ↓
Get FCM token
   ↓
POST /api/notifications/register
   ↓
Token stored with userType="guest"
```

### **API Endpoints**

| Method | Endpoint                            | Auth  | Description               |
| ------ | ----------------------------------- | ----- | ------------------------- |
| POST   | /api/notifications/register         | None  | Register FCM token        |
| DELETE | /api/notifications/unregister       | None  | Unregister token          |
| GET    | /api/notifications/admin/stats      | Admin | Get notification stats    |
| POST   | /api/notifications/admin/send-offer | Admin | Manual offer notification |

### **Environment Variables**

Add to `server/.env`:

```bash
# Firebase Admin SDK (for backend push notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Add to `frontend/client/.env.local`:

```bash
# Firebase VAPID Key (for web push)
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key
```

### **MongoDB Collection: NotificationTokens**

```javascript
{
  token: String (unique, FCM token),
  userId: ObjectId | null,
  userType: "guest" | "user",
  isActive: Boolean,
  platform: "web" | "android" | "ios",
  failureCount: Number,
  lastUsedAt: Date,
  createdAt: Date
}
```

---

## 🔄 Features & Workflows

### **1. Complete Order Flow**

```
Step 1: User adds product to cart (localStorage)
   ->
Step 2: User goes to checkout page
   ->
Step 3: User fills address & clicks "Proceed to Payment"
   ->
Step 4: Frontend calls POST /api/orders
   ->
Step 5: Backend creates order and generates PhonePe payment URL
   ->
Step 6: User is redirected to PhonePe payment page
   ->
Step 7: PhonePe processes payment and redirects back to site
   ->
Step 8: PhonePe webhook updates order status
   ->
Step 9: User sees updated status in My Orders
   ->
Step 10: Admin sees order in dashboard (real-time)
```

### **2. Admin Order Management**### **2. Admin Order Management**

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
   ->
PhonePe webhook posts transaction status
   ->
Backend updates:
- payment_status = paid / failed
- order_status = confirmed (on success)
   ->
Optional status check (server-to-server) via PhonePe Status API
```

### **4. Real-Time Admin Notifications**### **4. Real-Time Admin Notifications**

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

### **6. Order Details Page (NEW)**

```
User clicks "View Order Details" in My Orders
   ↓
Navigate to /orders/{orderId}
   ↓
Frontend calls: GET /api/orders/user/order/:orderId
   ↓
Backend verifies:
- User is authenticated
- User owns this order (userId matches)
   ↓
If order_status = "pending_payment" AND payment_status = "unavailable":
- Show yellow notice: "Payment Pending"
- Explain PhonePe onboarding status
- Show "Retry Payment" button (currently disabled)
   ↓
Display full order details:
- Order ID, date
- Items with quantities and prices
- Subtotal, discount, tax, shipping
- Grand total
- Delivery address
- Order status timeline
- Payment details
```

**Note:** "Retry Payment" button currently shows a modal explaining that payment gateway is under onboarding. Once PhonePe is activated, this will initiate a real payment flow.

---

## 🚀 Deployment Guide

### **Backend Deployment (Heroku/Railway)**

1. Create account on Heroku or Railway
2. Connect GitHub repository
3. Set environment variables:
   ```
   PORT=8000
   MONGODB_URI=...
   PHONEPE_MERCHANT_ID=...
   PHONEPE_SALT_KEY=...
   PHONEPE_SALT_INDEX=...
   PHONEPE_ENV=PROD
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

- Check: `PHONEPE_ENABLED=true` in server `.env`
- Verify: `PHONEPE_MERCHANT_ID`, `PHONEPE_SALT_KEY`, `PHONEPE_SALT_INDEX`
- Check: Server logs for PhonePe request errors

**Problem:** Payment status not updating

- Check: PhonePe webhook callback URL reachable
- Verify: Order exists in database
- Check: `PHONEPE_CALLBACK_URL` in `.env`

### **Database Issues**### **Database Issues**

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

Last Updated: February 6, 2026
