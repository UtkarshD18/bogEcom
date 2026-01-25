# 🧪 Complete Testing Guide

**Step-by-step testing procedures for all payment & order functionality**

---

## 🎯 Testing Objectives

✅ Verify order creation works
✅ Verify payment modal opens
✅ Verify payment verification succeeds
✅ Verify order status updates
✅ Verify admin notifications work
✅ Verify customer order tracking works
✅ Verify database synchronization
✅ Verify error handling works

---

## 🚀 Setup for Testing

### **Prerequisites**

- [ ] Server running on `http://localhost:8080`
- [ ] Client running on `http://localhost:3000`
- [ ] Admin running on `http://localhost:3001`
- [ ] MongoDB connected and verified
- [ ] `.env` file has valid Razorpay test credentials
- [ ] Razorpay account created in test mode

### **Environment Check**

```bash
# Terminal 1: Start server
cd server
npm start
# Should see: "Server running on port 8080"

# Terminal 2: Start client
cd frontend/client
npm run dev
# Should see: "Local: http://localhost:3000"

# Terminal 3: Start admin
cd frontend/admin
npm run dev
# Should see: "Local: http://localhost:3001"
```

---

## ✅ Test 1: Order Creation

### **Step 1: Add Products to Cart**

**Action**:

1. Go to `http://localhost:3000`
2. Click on any product
3. Click "Add to Cart"

**Expected**:

- ✅ Product added to cart
- ✅ Cart badge shows item count
- ✅ Product visible in cart page

**Verification**:

```bash
# In browser console
localStorage.getItem('cart')
# Should return array with product

// Or check Redux/Context state
console.log(state.cart)
```

### **Step 2: Proceed to Checkout**

**Action**:

1. Click "Cart" in navbar
2. Click "Proceed to Checkout"

**Expected**:

- ✅ Redirects to `/checkout`
- ✅ Cart items displayed
- ✅ Total amount calculated correctly

**Verification**:

```javascript
// Calculate total
products.forEach((p) => {
  console.log(`${p.productTitle}: ${p.quantity} x ${p.price} = ${p.subTotal}`);
});
// Total = sum of all subTotal
```

### **Step 3: Select Delivery Address**

**Action**:

1. On checkout page, select or add delivery address
2. Verify address details

**Expected**:

- ✅ Address selected successfully
- ✅ Address dropdown shows saved addresses
- ✅ Can add new address

**Verification**:

```javascript
// Check selected address
const selectedAddress = document.querySelector("[data-address-selected]");
console.log(selectedAddress.value); // Should be address ID
```

### **Step 4: Initiate Payment**

**Action**:

1. Click "Proceed to Payment"
2. Observe network request

**Expected**:

- ✅ POST /api/orders request sent
- ✅ Response status: 201 Created
- ✅ Response includes orderId & razorpayOrderId

**Verification - Network Tab**:

```
URL: http://localhost:8080/api/orders
Method: POST
Status: 201 Created
Response:
{
  "error": false,
  "success": true,
  "data": {
    "orderId": "507f1f77bcf86cd799439013",
    "razorpayOrderId": "order_IluGWxBm9U8zJ8",
    "amount": 650,
    "currency": "INR",
    "keyId": "rzp_test_xxxxx"
  }
}
```

**Verification - Database**:

```javascript
// Check MongoDB
db.orders.findOne({ _id: ObjectId("507f1f77bcf86cd799439013") })

// Should return:
{
  _id: ObjectId("507f1f77bcf86cd799439013"),
  order_status: "pending",
  payment_status: "pending",
  products: [...],
  totalAmt: 650,
  createdAt: new Date(),
  ...
}
```

---

## 💳 Test 2: Payment Processing

### **Step 1: Razorpay Modal Opens**

**Action**:

1. "Proceed to Payment" clicked
2. Razorpay modal loads

**Expected**:

- ✅ Modal opens within 2 seconds
- ✅ Modal shows correct amount: 650 INR
- ✅ Payment options visible (Card, UPI, Wallet)
- ✅ Razorpay logo visible

**Verification**:

```javascript
// In console
document.querySelector('iframe[src*="razorpay"]');
// Should return iframe element

// Or check for modal
document.querySelector(".razorpay-container");
```

### **Step 2: Enter Test Payment Details**

**Action**:

1. In modal, select "Card" payment
2. Enter test card details:
   - Card: `4111 1111 1111 1111`
   - Expiry: `12/25` (any future date)
   - CVV: `123` (any 3 digits)
   - Name: `Test User`
3. Click "Pay Now"

**Expected**:

- ✅ Modal accepts card details
- ✅ "Pay Now" button enabled
- ✅ Payment processes within 5 seconds
- ✅ Modal closes automatically

**Verification**:

```javascript
// Modal should close
document.querySelector(".razorpay-container") === null;
// Should return true
```

### **Step 3: Payment Response**

**Expected**:

- ✅ Success notification appears
- ✅ Page redirects to `/my-orders`
- ✅ Cart cleared
- ✅ No console errors

**Verification - Network Tab**:

```
URL: http://localhost:8080/api/orders/verify-payment
Method: POST
Status: 200 OK
Response:
{
  "error": false,
  "success": true,
  "data": {
    "orderStatus": "confirmed",
    "paymentStatus": "paid"
  }
}
```

---

## ✅ Test 3: Payment Verification

### **Step 1: Verify in Database**

**Action**:

1. Check MongoDB for updated order

**Expected Order State**:

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439013"),
  order_status: "confirmed",        // ✅ Updated from pending
  payment_status: "paid",           // ✅ Updated from pending
  paymentId: "pay_IluGWxBm9U8zJ8",  // ✅ Now has payment ID
  razorpaySignature: "...",         // ✅ Signature stored
  updatedAt: Date                   // ✅ Updated timestamp
}
```

**Verification Query**:

```javascript
db.orders.findOne({
  paymentId: "pay_IluGWxBm9U8zJ8",
});

// Should return order with:
// - payment_status: "paid"
// - order_status: "confirmed"
```

### **Step 2: Verify Signature Check**

**Action**:

1. Review server logs for signature verification

**Expected Logs**:

```
✅ Order created successfully - orderId: 507f1f77bcf86cd799439013
✅ Payment initiated - razorpayOrderId: order_IluGWxBm9U8zJ8
✅ Signature verified successfully
✅ Order status updated to confirmed
✅ Payment status updated to paid
```

**Verification**:

- [ ] No "Invalid signature" errors
- [ ] No "Signature mismatch" warnings
- [ ] All updates logged successfully

---

## 📱 Test 4: Customer Order Tracking

### **Step 1: View My Orders Page**

**Action**:

1. Redirected to `/my-orders` after payment
2. Page loads order list

**Expected**:

- ✅ Page title: "My Orders"
- ✅ Order appears in list
- ✅ Shows correct amount: 650 INR
- ✅ Shows status: "confirmed"
- ✅ Shows payment status: "paid"

**Verification**:

```javascript
// Check API call
GET http://localhost:8080/api/orders/user/my-orders
// Response should include created order
```

### **Step 2: Order Details**

**Action**:

1. Click on order in list
2. View order details

**Expected Details**:

- ✅ Order ID displayed
- ✅ Order date correct
- ✅ Products listed with quantities
- ✅ Total amount: 650 INR
- ✅ Payment status: "paid"
- ✅ Order status: "confirmed"

**Verification**:

```javascript
// Order should have all fields
{
  _id: "507f1f77bcf86cd799439013",
  products: [
    {
      productTitle: "...",
      quantity: 2,
      price: 300,
      subTotal: 600
    }
  ],
  totalAmt: 650,
  payment_status: "paid",
  order_status: "confirmed",
  createdAt: "2026-01-25T10:30:00Z"
}
```

---

## 👨‍💼 Test 5: Admin Dashboard

### **Step 1: Admin Notification Badge**

**Action**:

1. Keep admin dashboard open: `http://localhost:3001`
2. Complete customer order (Test 2)
3. Watch notification badge

**Expected**:

- ✅ Notification badge appears
- ✅ Badge shows count (e.g., "1")
- ✅ Badge appears within 5 seconds
- ✅ Click badge shows new orders

**Verification**:

```javascript
// Check notification count
const badge = document.querySelector("[data-notification-badge]");
console.log(badge.textContent); // Should show "1"

// Or check hook state
console.log(notificationCount); // Should be > 0
```

### **Step 2: View Order in Admin List**

**Action**:

1. Click on "Orders" in admin menu
2. View orders list
3. Find newly created order

**Expected**:

- ✅ New order appears at top
- ✅ Shows customer name
- ✅ Shows order amount: 650 INR
- ✅ Shows status: "confirmed"
- ✅ Shows payment status: "paid"

**Verification**:

```javascript
// Orders API call
GET http://localhost:8080/api/orders/admin/all?page=1&limit=20
Status: 200 OK

// Response should include new order
{
  data: [
    {
      _id: "507f1f77bcf86cd799439013",
      user: { name: "John Doe", email: "john@example.com" },
      products: [...],
      order_status: "confirmed",
      payment_status: "paid",
      totalAmt: 650
    }
  ]
}
```

### **Step 3: Update Order Status**

**Action**:

1. Click on order in admin list
2. Click "Update Status"
3. Select "shipped"
4. Save

**Expected**:

- ✅ Status dropdown shows options
- ✅ Can select "shipped"
- ✅ Save button works
- ✅ Toast notification shows success
- ✅ Order status updated in list

**Verification - Network Tab**:

```
URL: http://localhost:8080/api/orders/507f1f77bcf86cd799439013/status
Method: PUT
Status: 200 OK
Body: { "order_status": "shipped" }

Response:
{
  "error": false,
  "success": true,
  "data": {
    "order_status": "shipped",
    "updatedAt": "2026-01-25T11:00:00Z"
  }
}
```

**Verification - Database**:

```javascript
db.orders.findById("507f1f77bcf86cd799439013");
// Should show: order_status: "shipped"
```

### **Step 4: Customer Sees Status Update**

**Action**:

1. Switch to customer My Orders page
2. Refresh page
3. View updated order status

**Expected**:

- ✅ Status updated to "shipped"
- ✅ Update visible within 5 seconds
- ✅ Date/time shows recent update
- ✅ No page refresh needed (if real-time)

**Verification**:

```javascript
// Order status should be "shipped"
const order = orders.find((o) => o._id === "507f1f77bcf86cd799439013");
console.log(order.order_status); // Should be "shipped"
```

---

## ❌ Test 6: Error Handling

### **Test 6.1: Invalid Signature**

**Action**:

1. Create order normally
2. Tamper with signature before verification
3. Send verification request with fake signature

**Expected**:

- ✅ Server rejects payment
- ✅ Error message: "Payment verification failed"
- ✅ Order status remains "pending"
- ✅ Payment status remains "pending"
- ✅ Order NOT confirmed

**Verification**:

```javascript
// Request with invalid signature
POST /api/orders/verify-payment
{
  "orderId": "507f1f77bcf86cd799439013",
  "razorpayPaymentId": "pay_IluGWxBm9U8zJ8",
  "razorpayOrderId": "order_IluGWxBm9U8zJ8",
  "razorpaySignature": "invalid_signature_xxx"  // Tampered
}

// Response
Status: 400 Bad Request
{
  "error": true,
  "success": false,
  "message": "Payment verification failed - Invalid signature"
}

// Database should show
order_status: "pending"
payment_status: "pending"
```

### **Test 6.2: Missing Required Fields**

**Action**:

1. Try to create order without required fields
2. Send request with empty products array
3. Send request with totalAmt = 0

**Expected - Missing Products**:

```
Status: 400 Bad Request
{
  "error": true,
  "success": false,
  "message": "Products are required"
}
```

**Expected - Invalid Amount**:

```
Status: 400 Bad Request
{
  "error": true,
  "success": false,
  "message": "Total amount must be greater than 0"
}
```

### **Test 6.3: Unauthorized Admin Access**

**Action**:

1. Try to access admin endpoints as regular user
2. Try to update order status without JWT
3. Try to view all orders as customer

**Expected**:

```
Status: 403 Forbidden
{
  "error": true,
  "success": false,
  "message": "Not authorized to access this resource"
}
```

### **Test 6.4: Network Timeout**

**Action**:

1. Disconnect internet during order creation
2. Reconnect and retry

**Expected**:

- ✅ Error notification shown
- ✅ User can retry
- ✅ Order not created twice

---

## 📊 Test 7: Dashboard Statistics

### **Step 1: View Dashboard Stats**

**Action**:

1. Go to admin dashboard
2. View statistics section

**Expected Stats Visible**:

- ✅ Total Orders
- ✅ Orders by Status (pending, confirmed, shipped, delivered, cancelled)
- ✅ Total Revenue (sum of paid orders)
- ✅ Paid Orders count
- ✅ Failed Payments count
- ✅ Recent Orders list

**Verification API**:

```javascript
GET http://localhost:8080/api/orders/admin/dashboard-stats
Status: 200 OK

Response:
{
  "error": false,
  "success": true,
  "data": {
    "totalOrders": 1,
    "pendingOrders": 0,
    "confirmedOrders": 1,
    "shippedOrders": 0,
    "deliveredOrders": 0,
    "cancelledOrders": 0,
    "totalRevenue": 650,
    "paidOrders": 1,
    "failedPayments": 0,
    "recentOrders": [...]
  }
}
```

### **Step 2: After Multiple Orders**

**Action**:

1. Complete 3 more orders
2. Update statuses (1 shipped, 1 delivered)
3. Check updated statistics

**Expected**:

```javascript
{
  totalOrders: 4,
  confirmedOrders: 2,
  shippedOrders: 1,
  deliveredOrders: 1,
  totalRevenue: 2600,  // 650 * 4
  paidOrders: 4,
  recentOrders: [...]  // Latest first
}
```

---

## 🔄 Test 8: Database Sync

### **Step 1: Create Order**

**Action**:

1. Create order (don't verify payment yet)
2. Check database immediately

**Expected in Database**:

```javascript
{
  _id: ObjectId(...),
  order_status: "pending",
  payment_status: "pending",
  razorpayOrderId: "order_xxx",
  products: [...],
  totalAmt: 650
}
```

### **Step 2: Verify Payment**

**Action**:

1. Complete payment verification
2. Check database immediately

**Expected in Database**:

```javascript
{
  _id: ObjectId(...),
  order_status: "confirmed",      // ✅ Updated
  payment_status: "paid",         // ✅ Updated
  paymentId: "pay_xxx",           // ✅ Added
  razorpaySignature: "...",       // ✅ Added
  updatedAt: new Date()           // ✅ Updated timestamp
}
```

### **Step 3: Update Status**

**Action**:

1. Admin updates order to "shipped"
2. Check database immediately

**Expected in Database**:

```javascript
{
  _id: ObjectId(...),
  order_status: "shipped",        // ✅ Updated
  lastUpdatedBy: ObjectId(...),   // ✅ Admin ID
  updatedAt: new Date()           // ✅ New timestamp
}
```

### **Step 4: Verify Sync Across Applications**

**Action**:

1. Order visible in Customer's My Orders
2. Order visible in Admin's Orders List
3. Statistics updated in Admin Dashboard
4. Notification badge shows accurate count

**Expected**:

- ✅ All applications show same order
- ✅ All applications show same status
- ✅ All statistics accurate
- ✅ Updates reflect within 5 seconds

---

## 📋 Test Checklist

### **Complete Test Flow**

- [ ] **Test 1 - Order Creation**
  - [ ] Add product to cart
  - [ ] Proceed to checkout
  - [ ] Select delivery address
  - [ ] Initiate payment (POST /api/orders returns 201)
  - [ ] Verify order in database

- [ ] **Test 2 - Payment Processing**
  - [ ] Razorpay modal opens
  - [ ] Enter test card details
  - [ ] Payment processes successfully
  - [ ] Modal closes automatically
  - [ ] Redirects to /my-orders

- [ ] **Test 3 - Payment Verification**
  - [ ] Order status updated to "confirmed"
  - [ ] Payment status updated to "paid"
  - [ ] Payment ID stored in database
  - [ ] Signature verified correctly
  - [ ] Signature stored in database

- [ ] **Test 4 - Customer Order Tracking**
  - [ ] Order appears in My Orders
  - [ ] Order details correct
  - [ ] Total amount correct
  - [ ] Payment status shows "paid"
  - [ ] Order status shows "confirmed"

- [ ] **Test 5 - Admin Dashboard**
  - [ ] Notification badge appears
  - [ ] Order visible in admin list
  - [ ] Can update order status
  - [ ] Status updates reflected
  - [ ] Customer sees status update

- [ ] **Test 6 - Error Handling**
  - [ ] Invalid signature rejected
  - [ ] Missing fields rejected
  - [ ] Unauthorized access blocked
  - [ ] Error messages clear
  - [ ] No double ordering

- [ ] **Test 7 - Dashboard Stats**
  - [ ] Total orders counted
  - [ ] Revenue calculated
  - [ ] Status breakdown correct
  - [ ] Payment metrics accurate
  - [ ] Recent orders displayed

- [ ] **Test 8 - Database Sync**
  - [ ] Database updates on order creation
  - [ ] Database updates on payment verification
  - [ ] Database updates on status change
  - [ ] All apps see same data
  - [ ] Updates propagate within 5 seconds

---

## 🚀 Production Testing

### **Before Deploying to Production**

1. [ ] Run all tests with real Razorpay test account
2. [ ] Test with actual payment processing
3. [ ] Verify webhook configuration
4. [ ] Test with multiple concurrent orders
5. [ ] Load test the API
6. [ ] Verify all error cases
7. [ ] Test on actual server
8. [ ] Verify SSL certificate
9. [ ] Check CORS configuration
10. [ ] Monitor logs for 24 hours

### **Switching to Live Mode**

1. [ ] Update Razorpay keys to live mode
2. [ ] Update API endpoint to production
3. [ ] Enable webhook in Razorpay
4. [ ] Monitor payment success rate
5. [ ] Check for errors in logs
6. [ ] Verify customer notifications
7. [ ] Track first 100 orders
8. [ ] Confirm database backups
9. [ ] Set up alerts
10. [ ] Document any issues

---

**All tests should pass before production deployment**

**Last Updated**: January 25, 2026

**Status**: ✅ Ready for Testing
