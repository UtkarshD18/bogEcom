# Testing Orders Without Razorpay Setup

Since Razorpay isn't configured yet, you can create **test orders directly in your database** to test the "My Orders" page and admin dashboard features.

## Quick Start

### Step 1: Get Your User ID

1. Register a new user on the client frontend
2. Login to the client
3. Open browser DevTools (F12) → Console
4. Run:
   ```javascript
   localStorage.getItem("userId");
   ```
5. Copy the `userId` value (it's a MongoDB ID like `507f1f77bcf86cd799439011`)

### Step 2: Create Test Orders

Use the test endpoint to create mock orders for your user:

#### Using Postman / Thunder Client:

```
POST http://localhost:8000/api/orders/test/create
Content-Type: application/json

{
  "userId": "YOUR_USER_ID_HERE"
}
```

#### Using cURL:

```bash
curl -X POST http://localhost:8000/api/orders/test/create \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"YOUR_USER_ID_HERE\"}"
```

#### Using Browser Console:

```javascript
fetch("http://localhost:8000/api/orders/test/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: localStorage.getItem("userId") }),
})
  .then((r) => r.json())
  .then((d) => console.log(d));
```

### Step 3: Test My Orders Page

1. Go to `http://localhost:3001` (client frontend)
2. Login with your account
3. Click "My Orders" or navigate to `/my-orders`
4. You should see the test order you created!

### Step 4: Create Multiple Test Orders

Run the test endpoint multiple times to create several orders:

```javascript
// Create 5 test orders
for (let i = 0; i < 5; i++) {
  setTimeout(() => {
    fetch("http://localhost:8000/api/orders/test/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: localStorage.getItem("userId") }),
    })
      .then((r) => r.json())
      .then((d) => console.log(`Order ${i + 1} created:`, d.orderId));
  }, i * 500);
}
```

## What Gets Created

Each test order includes:

- ✅ Random products from your database (1-3 items)
- ✅ Realistic pricing and quantities
- ✅ Marked as "paid" and "confirmed" status
- ✅ Test payment ID: `TEST_<timestamp>`
- ✅ Mock delivery address
- ✅ Linked to your real user account

## Test Admin Dashboard

Once you have test orders, they'll automatically appear in:

1. **Admin Dashboard Stats**:
   - Total Sales (sum of all orders)
   - Total Orders count
   - Monthly Sales chart

2. **Admin Orders List**:
   - All test orders visible
   - Can view details and change status

Navigate to `http://localhost:3002` (admin panel) and login to see the dashboard.

## Security Note

⚠️ The test endpoint:

- Only works in **development mode** (`NODE_ENV !== 'production'`)
- Is **automatically disabled** in production builds
- Creates orders with test identifiers (`TEST_` prefix)

## Manual MongoDB Insert (Alternative)

If the endpoint doesn't work, you can manually insert test data using MongoDB Compass:

1. Open MongoDB Compass
2. Connect to your database
3. Go to `orders` collection
4. Insert this document (replace `USER_ID_HERE`):

```json
{
  "user": { "$oid": "USER_ID_HERE" },
  "products": [
    {
      "productId": "PRODUCT_ID",
      "productTitle": "Test Product",
      "quantity": 2,
      "price": 999,
      "image": "https://example.com/image.jpg",
      "subTotal": 1998
    }
  ],
  "totalAmt": 1998,
  "payment_status": "paid",
  "order_status": "confirmed",
  "paymentId": "TEST_MANUAL_123",
  "razorpayOrderId": "TEST_ORDER_123",
  "delivery_address": {
    "name": "Test User",
    "address": "123 Test Street",
    "city": "Test City",
    "state": "Test State",
    "pincode": "123456",
    "phone": "9999999999"
  },
  "createdAt": new Date(),
  "updatedAt": new Date()
}
```

## Testing Checklist

- [ ] Server running on `localhost:8000`
- [ ] Products seeded in database
- [ ] User created and logged in
- [ ] Test order created successfully
- [ ] My Orders page shows the order
- [ ] Order details display correctly
- [ ] Status badges show correct colors
- [ ] Admin dashboard shows order stats
- [ ] Multiple orders sort by date correctly

## Next Steps

Once Razorpay is set up:

1. Update `.env` with Razorpay keys
2. Test actual checkout flow
3. Verify webhook integration
4. Remove test orders from production
