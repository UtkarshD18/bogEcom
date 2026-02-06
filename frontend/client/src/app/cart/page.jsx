"use client";
import { useCart } from "@/context/CartContext";
import { Button, CircularProgress } from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MdRemoveShoppingCart } from "react-icons/md";
import CartItems from "./cartItems";

const Cart = () => {
  const { cartItems, cartCount, cartTotal, loading, clearCart } = useCart();
  const router = useRouter();

  // Calculate totals
  const subtotal = cartItems.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0,
  );
  const shipping = subtotal > 500 ? 0 : 50; // Free shipping over ₹500
  const total = subtotal + shipping;

  if (loading && cartItems.length === 0) {
    return (
      <section className="bg-gray-100 py-8 min-h-[60vh]">
        <div className="container mx-auto px-4 flex items-center justify-center">
          <CircularProgress style={{ color: "#059669" }} />
        </div>
      </section>
    );
  }

  if (cartItems.length === 0) {
    return (
      <section className="bg-gray-100 py-8 min-h-[60vh]">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-10 text-center max-w-lg mx-auto">
            <MdRemoveShoppingCart className="text-8xl text-gray-300 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">
              Your Cart is Empty
            </h2>
            <p className="text-gray-500 mb-6">
              Looks like you haven't added anything to your cart yet.
            </p>
            <Link href="/products">
              <Button
                sx={{
                  backgroundColor: "#059669",
                  color: "white",
                  textTransform: "none",
                  fontWeight: 600,
                  padding: "12px 32px",
                  borderRadius: "8px",
                  "&:hover": {
                    backgroundColor: "#a04a17",
                  },
                }}
              >
                Start Shopping
              </Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gray-100 py-4 sm:py-8 min-h-[60vh]">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex flex-col lg:flex-row w-full gap-4 sm:gap-8 items-start">
          {/* Cart Items */}
          <div className="col1 bg-white rounded-lg shadow-md flex-1 w-full">
            <div className="p-3 sm:p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl text-gray-800 font-semibold">
                  Shopping Cart
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {cartCount} {cartCount === 1 ? "item" : "items"} in your cart
                </p>
              </div>
              <Button
                variant="text"
                onClick={clearCart}
                disabled={loading}
                sx={{
                  color: "#dc2626",
                  textTransform: "none",
                  fontSize: "14px",
                  "&:hover": {
                    backgroundColor: "rgba(220, 38, 38, 0.05)",
                  },
                }}
              >
                Clear Cart
              </Button>
            </div>

            {/* Cart Items List */}
            <div className="divide-y divide-gray-100">
              {cartItems.map((item, index) => (
                <CartItems
                  key={item.product?._id || item.product || index}
                  item={item}
                />
              ))}
            </div>

            {/* Continue Shopping */}
            <div className="p-5 border-t border-gray-200">
              <Link href="/products">
                <Button
                  variant="outlined"
                  sx={{
                    borderColor: "#059669",
                    color: "#059669",
                    textTransform: "none",
                    fontWeight: 500,
                    "&:hover": {
                      borderColor: "#a04a17",
                      backgroundColor: "rgba(193, 89, 28, 0.05)",
                    },
                  }}
                >
                  ← Continue Shopping
                </Button>
              </Link>
            </div>
          </div>

          {/* Cart Summary */}
          <div className="col2 w-full lg:w-[350px]">
            <div
              className="bg-white rounded-lg shadow-md sticky"
              style={{ top: "calc(var(--header-height, 60px) + 20px)" }}
            >
              <div className="p-5 border-b border-gray-200">
                <h2 className="text-xl text-gray-800 font-semibold">
                  Order Summary
                </h2>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between text-gray-600">
                  <span>Subtotal ({cartCount} items)</span>
                  <span className="font-medium">
                    ₹{subtotal.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-gray-600">
                  <span>Shipping</span>
                  <span
                    className={`font-medium ${shipping === 0 ? "text-green-600" : ""}`}
                  >
                    {shipping === 0 ? "FREE" : `₹${shipping}`}
                  </span>
                </div>

                {subtotal > 0 && subtotal < 500 && (
                  <p className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">
                    Add ₹{(500 - subtotal).toLocaleString()} more for FREE
                    shipping!
                  </p>
                )}

                <div className="border-t pt-4 flex items-center justify-between text-lg font-bold text-gray-800">
                  <span>Total</span>
                  <span className="text-[#059669]">
                    ₹{total.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="p-5 pt-0">
                <Link href="/checkout" className="block">
                  <Button
                    fullWidth
                    disabled={loading || cartItems.length === 0}
                    sx={{
                      backgroundColor: "#059669",
                      color: "white",
                      textTransform: "none",
                      fontWeight: 600,
                      padding: "14px 20px",
                      borderRadius: "8px",
                      fontSize: "16px",
                      "&:hover": {
                        backgroundColor: "#a04a17",
                      },
                      "&:disabled": {
                        backgroundColor: "#ccc",
                        color: "#666",
                      },
                    }}
                  >
                    Proceed to Checkout
                  </Button>
                </Link>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                  <span>🔒</span>
                  <span>Secure checkout with PhonePe</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Cart;
