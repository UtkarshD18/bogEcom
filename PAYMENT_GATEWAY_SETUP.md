# 🎯 Complete Payment Gateway Setup Guide

## **What's Included**

✅ **Backend Payment APIs**

- POST /api/orders - Create order with Razorpay integration
- POST /api/orders/verify-payment - Verify payment with signature
- POST /api/orders/webhook/razorpay - Handle payment events
- GET /api/orders/user/my-orders - Fetch user orders

✅ **Frontend Payment Hook**

- Location: `/src/hooks/usePayment.js`
- Handles complete payment flow
- Error handling & logging
- localStorage persistence

✅ **Updated Components**

- Checkout page using payment hook
- Order creation and verification
- Proper error handling

---

## **Step 1: Get Razorpay Credentials**

### A. Create Razorpay Account

1. Go to https://razorpay.com
2. Sign up with email (use test mode first)
3. Navigate to https://dashboard.razorpay.com/app/keys

### B. Copy Keys

```
Key ID: rzp_test_xxxxx (if in test mode) or rzp_live_xxxxx
Key Secret: xxxxxxxxxxxxxxxx (Keep this SECRET!)
Webhook Secret: (Generate from Settings > Webhooks)
```

---

## **Step 2: Update Environment Variables**

### Backend (.env)

```bash
# Add these lines to d:\projects\bogEcom\server\.env

RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

### Frontend (.env.local)

```bash
# d:\projects\bogEcom\frontend\client\.env.local

NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

---

## **Step 3: Install Razorpay Package**

```bash
cd d:\projects\bogEcom\server
npm install razorpay
```

---

## **Step 4: Test the Payment Flow**

### A. Start Backend

```bash
cd d:\projects\bogEcom\server
npm run dev
# Should see: 🚀 Server is running on port 8000
```

### B. Start Frontend

```bash
cd d:\projects\bogEcom\frontend\client
npm run dev
# Should see: ▲ Next.js x.x.x (http://localhost:3000)
```

### C. Test Flow

1. Add products to cart
2. Click "Proceed to Checkout"
3. Select address
4. Click "Proceed to Payment"
5. Use test card: **4111 1111 1111 1111**
6. Any future expiry date, any CVV
7. Click Pay

---

## **Step 5: API Endpoints Reference**

### Create Order

```http
POST /api/orders
Content-Type: application/json

{
  "products": [
    {
      "productId": "123",
      "productTitle": "Peanut Butter",
      "quantity": 2,
      "price": 300,
      "image": "url",
      "subTotal": 600
    }
  ],
  "totalAmt": 650,
  "delivery_address": null
}

Response:
{
  "error": false,
  "success": true,
  "data": {
    "orderId": "507f1f77bcf86cd799439011",
    "razorpayOrderId": "order_1Aa00000000001",
    "amount": 650,
    "keyId": "rzp_test_xxxxx"
  }
}
```

### Verify Payment

```http
POST /api/orders/verify-payment
Content-Type: application/json

{
  "orderId": "507f1f77bcf86cd799439011",
  "razorpayPaymentId": "pay_1Aa00000000001",
  "razorpayOrderId": "order_1Aa00000000001",
  "razorpaySignature": "signature_hash_here"
}

Response:
{
  "error": false,
  "success": true,
  "data": {
    "orderId": "507f1f77bcf86cd799439011",
    "orderStatus": "confirmed",
    "paymentStatus": "paid",
    "paymentId": "pay_1Aa00000000001",
    "totalAmount": 650
  }
}
```

### Get User Orders

```http
GET /api/orders/user/my-orders

Response:
{
  "error": false,
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "products": [...],
      "totalAmt": 650,
      "order_status": "confirmed",
      "payment_status": "paid",
      "createdAt": "2026-01-25T..."
    }
  ]
}
```

---

## **Step 6: Using the Payment Hook**

### Import Hook

```javascript
import { usePayment } from "@/hooks/usePayment";
```

### Use in Component

```javascript
const { initiatePayment, isProcessing, error } = usePayment();

const handleCheckout = () => {
  initiatePayment({
    items: cartItems,
    totalAmount: totalPrice,
    address: selectedAddress,
    orderNotes: "Special instructions",
  });
};
```

---

## **Step 7: Database Schema**

### Order Model

```javascript
{
  user: ObjectId,
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
  paymentId: String,           // Razorpay Payment ID
  payment_status: String,      // "pending", "paid", "failed"
  order_status: String,        // "pending", "confirmed", "shipped", "cancelled"
  delivery_address: ObjectId,
  totalAmt: Number,
  createdAt: Date,
  updatedAt: Date
}
```

---

## **Step 8: Webhook Setup (Optional)**

For production, set up webhook in Razorpay Dashboard:

1. Go to Settings > Webhooks
2. Add webhook URL: `https://yourdomain.com/api/orders/webhook/razorpay`
3. Select events:
   - payment.authorized
   - payment.failed
4. Copy Webhook Secret
5. Add to `.env`: `RAZORPAY_WEBHOOK_SECRET=...`

---

## **Step 9: Security Checklist**

✅ Never expose `RAZORPAY_KEY_SECRET` in frontend code
✅ Always verify signatures server-side
✅ Use HTTPS in production
✅ Validate amount server-side
✅ Use secure database for orders
✅ Implement rate limiting on payment endpoints
✅ Log payment events for audit trail
✅ Set up alerts for failed payments

---

## **Step 10: Troubleshooting**

### Payment Gateway Not Loading

- Check: `NEXT_PUBLIC_RAZORPAY_KEY_ID` is set correctly
- Verify: No console errors in browser devtools
- Check: Network tab - script loads from cdn.razorpay.com

### Payment Verification Failed

- Check: Signatures match (server-side validation)
- Verify: Order ID exists in database
- Check: Razorpay credentials are correct

### Orders Not Saving

- Check: MongoDB connection
- Verify: OrderModel fields match
- Check: Backend logs for errors

### Webhook Not Triggering

- Verify: Webhook URL is accessible
- Check: Razorpay dashboard for webhook logs
- Ensure: Webhook secret is correct

---

## **Testing Cards (Test Mode)**

| Card Type     | Card Number      | Result             |
| ------------- | ---------------- | ------------------ |
| Success       | 4111111111111111 | ✅ Payment Success |
| 3D Secure     | 4012888888881881 | ✅ With OTP        |
| Declined      | 4000000000000002 | ❌ Declined        |
| Network Error | 4000000000000010 | ⚠️ Error           |

Use any future expiry date and any 3-digit CVV

---

## **Folder Structure**

```
/bogEcom
├── /server
│   ├── .env                    (Update with Razorpay keys)
│   ├── /controllers
│   │   └── order.controller.js (✅ Updated with Razorpay)
│   ├── /routes
│   │   └── order.route.js      (✅ Updated with webhook)
│   └── /models
│       └── order.model.js      (OrderModel)
│
├── /frontend/client
│   ├── .env.local              (✅ Created - add KEY_ID)
│   ├── /src
│   │   ├── /hooks
│   │   │   └── usePayment.js   (✅ New payment hook)
│   │   └── /app
│   │       ├── /checkout
│   │       │   └── page.jsx    (✅ Updated to use hook)
│   │       └── /my-orders
│   │           └── page.jsx    (Displays orders)
```

---

## **Next Steps**

1. ✅ Get Razorpay credentials
2. ✅ Update .env variables
3. ✅ Run `npm install razorpay` in server
4. ✅ Start backend and frontend
5. ✅ Test with test cards
6. ✅ Switch to live mode when ready

---

## **Support Resources**

- Razorpay Docs: https://razorpay.com/docs/
- Test Credentials: https://razorpay.com/docs/payments/payment-gateway/test-keys/
- Webhook Setup: https://razorpay.com/docs/webhooks/
- Integration Guide: https://razorpay.com/docs/payments/payment-gateway/web-integration/
