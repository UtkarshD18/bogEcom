"use client";
import ProductContext from "@/context/ProductContext";
import { MyContext } from "@/context/ThemeProvider";
import { usePayment } from "@/hooks/usePayment";
import { Button } from "@mui/material";
import Radio from "@mui/material/Radio";
import Link from "next/link";
import { useContext, useState } from "react";
import { FiPlus } from "react-icons/fi";

const Checkout = () => {
  const context = useContext(MyContext);
  const productContext = useContext(ProductContext);
  const { initiatePayment, isProcessing: paymentProcessing } = usePayment();
  const [selectedAddress, setSelectedAddress] = useState(0);
  const [orderNotes, setOrderNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [addresses, setAddresses] = useState([
    {
      id: 1,
      label: "Home",
      name: "Your Name",
      address: "Your Address Here",
      phone: "+91 9876543210",
    },
  ]);

  const cart = productContext?.cart || [];

  // Calculate totals
  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const shipping = subtotal > 500 ? 0 : 100;
  const tax = Math.round(subtotal * 0.05); // 5% tax
  const total = subtotal + shipping + tax - discount;

  const handlePayment = async () => {
    if (!selectedAddress) {
      context?.alertBox("error", "Please select a delivery address");
      return;
    }

    // Use the payment hook to initiate payment
    await initiatePayment({
      items: cart,
      totalAmount: total,
      address: addresses[selectedAddress],
      orderNotes: orderNotes,
      discount: discount,
      tax: tax,
      shipping: shipping,
      subtotal: subtotal,
    });
  };

  const applyCoupon = () => {
    // Example coupon logic
    if (couponCode === "SAVE10") {
      setDiscount(Math.round(subtotal * 0.1));
    } else if (couponCode === "SAVE20") {
      setDiscount(Math.round(subtotal * 0.2));
    } else {
      alert("Invalid coupon code");
      setDiscount(0);
    }
    setCouponCode("");
  };
  if (!cart || cart.length === 0) {
    return (
      <>
        <section className="min-h-screen bg-gray-100 py-12">
          <div className="container mx-auto text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              Your cart is empty
            </h1>
            <p className="text-gray-600 mb-6">
              Add items to your cart to proceed with checkout
            </p>
            <Link href="/products">
              <Button className="btn-g">Continue Shopping</Button>
            </Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="bg-gray-50 py-8 min-h-screen">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">Checkout</h1>

          <div className="grid grid-cols-3 gap-6">
            {/* Left Column - Address & Items */}
            <div className="col-span-2 space-y-6">
              {/* Delivery Address */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Delivery Address
                  </h2>
                  <Button
                    variant="outlined"
                    onClick={() => context?.isOpenAddressPanel(true)}
                    className="text-orange-600! border-orange-600!"
                  >
                    <FiPlus className="mr-2" /> Add Address
                  </Button>
                </div>

                <div className="space-y-3">
                  {addresses.map((addr, index) => (
                    <label
                      key={addr.id}
                      className="flex items-start p-4 border-2 rounded-lg cursor-pointer hover:border-orange-500 transition"
                      style={{
                        borderColor:
                          selectedAddress === index ? "#c1591c" : "#e5e7eb",
                      }}
                    >
                      <Radio
                        checked={selectedAddress === index}
                        onChange={() => setSelectedAddress(index)}
                      />
                      <div className="ml-4 flex-1">
                        <h3 className="font-semibold text-gray-800">
                          {addr.label}
                        </h3>
                        <p className="text-gray-600">{addr.name}</p>
                        <p className="text-gray-600">{addr.address}</p>
                        <p className="text-gray-600">{addr.phone}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Order Items */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Order Summary
                </h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={item._id}
                      className="flex items-center gap-4 pb-3 border-b"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">
                          {item.name}
                        </h3>
                        <p className="text-gray-600">
                          Qty: {item.quantity} × ₹{item.price}
                        </p>
                      </div>
                      <span className="font-semibold text-gray-800">
                        ₹{item.price * item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Notes */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Order Notes (Optional)
                </h2>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Add special instructions for your order..."
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows="3"
                />
              </div>
            </div>

            {/* Right Column - Payment Summary */}
            <div className="space-y-6">
              {/* Coupon Section */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="font-semibold text-gray-800 mb-3">Promo Code</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter coupon code"
                    className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <Button onClick={applyCoupon} className="btn-g py-2!">
                    Apply
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Try: SAVE10 or SAVE20
                </p>
              </div>

              {/* Price Summary */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="font-semibold text-gray-800 mb-4">
                  Order Total
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tax (5%)</span>
                    <span>₹{tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span
                      className={
                        shipping === 0 ? "text-green-600 font-semibold" : ""
                      }
                    >
                      {shipping === 0 ? "FREE" : `₹${shipping}`}
                    </span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-₹{discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t pt-3 flex justify-between font-bold text-gray-800">
                    <span>Total</span>
                    <span className="text-orange-600 text-lg">
                      ₹{total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Button */}
              <Button
                onClick={handlePayment}
                disabled={paymentProcessing || !cart.length}
                className="btn-g w-full py-3! font-bold!"
              >
                {paymentProcessing ? "Processing..." : "Proceed to Payment"}
              </Button>

              {/* Security Badge */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600">
                  🔒 Your payment information is secure and encrypted. We use
                  industry-standard security protocols.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Checkout;
