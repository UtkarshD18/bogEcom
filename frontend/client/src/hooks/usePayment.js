import { MyContext } from "@/context/ThemeProvider";
import cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";

// Backend API URL
const API_URL = process.env.NEXT_PUBLIC_APP_API_URL || "http://localhost:8000";

/**
 * Custom Hook for Payment Processing
 * Handles Razorpay payment flow with backend integration
 */
export const usePayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const context = useContext(MyContext);
  const router = useRouter();

  /**
   * Initialize Payment
   * @param {Object} paymentDetails - { items, totalAmount, address, orderNotes }
   */
  const initiatePayment = async (paymentDetails) => {
    try {
      setIsProcessing(true);
      setError(null);

      const { items, totalAmount, address, orderNotes = "" } = paymentDetails;

      // Validate inputs
      if (!items || items.length === 0) {
        throw new Error("Cart is empty");
      }

      if (!totalAmount || totalAmount <= 0) {
        throw new Error("Invalid total amount");
      }

      // Step 1: Create order on backend
      console.log("📦 Creating order on backend...");
      const token = cookies.get("accessToken");
      const createOrderResponse = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          products: items.map((item) => ({
            productId: item._id || item.id,
            productTitle: item.name || item.title,
            quantity: item.quantity,
            price: item.price,
            image: item.image,
            subTotal: item.price * item.quantity,
          })),
          totalAmt: totalAmount,
          delivery_address: address?._id || null,
        }),
      });

      if (!createOrderResponse.ok) {
        const errorData = await createOrderResponse.json();
        throw new Error(errorData.message || "Failed to create order");
      }

      const orderResponse = await createOrderResponse.json();
      const { orderId, razorpayOrderId, keyId } = orderResponse.data;

      console.log("✅ Order created:", orderId);

      // Step 2: Open Razorpay Checkout
      console.log("💳 Opening Razorpay checkout...");
      const options = {
        key: keyId, // Get from backend response
        amount: Math.round(totalAmount * 100), // Amount in paise
        currency: "INR",
        name: "Healthy One Gram",
        description: "Purchase Order",
        image: "/logo.png",
        order_id: razorpayOrderId, // Razorpay Order ID from backend
        prefill: {
          name: address?.name || cookies.get("userName") || "Customer",
          email:
            address?.email ||
            cookies.get("userEmail") ||
            "customer@example.com",
          contact: address?.phone || "",
        },
        theme: {
          color: "#c1591c",
        },
        handler: async (response) => {
          try {
            console.log("🔄 Verifying payment...");

            // Step 3: Verify payment on backend
            const verifyResponse = await fetch(
              `${API_URL}/api/orders/verify-payment`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({
                  orderId: orderId,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              },
            );

            if (!verifyResponse.ok) {
              const errorData = await verifyResponse.json();
              throw new Error(
                errorData.message || "Payment verification failed",
              );
            }

            const verifyData = await verifyResponse.json();

            console.log("✅ Payment verified successfully");

            // Save to localStorage for client-side sync
            const completedOrder = {
              ...paymentDetails,
              id: orderId,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
              paymentStatus: "completed",
              createdAt: new Date().toISOString(),
            };

            const existingOrders = JSON.parse(
              localStorage.getItem("orders") || "[]",
            );
            existingOrders.push(completedOrder);
            localStorage.setItem("orders", JSON.stringify(existingOrders));

            // Success notification
            context?.alertBox(
              "success",
              "✅ Payment successful! Order placed.",
            );

            // Redirect after short delay
            setTimeout(() => {
              router.push("/my-orders");
            }, 1500);
          } catch (error) {
            console.error("❌ Payment verification error:", error);
            setError(error.message);
            context?.alertBox(
              "error",
              error.message || "Payment verification failed",
            );
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            console.log("⚠️ Payment modal dismissed");
            context?.alertBox("error", "Payment cancelled");
            setIsProcessing(false);
          },
        },
      };

      // Load and initialize Razorpay
      if (!window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => {
          const rzp = new window.Razorpay(options);
          rzp.open();
        };
        script.onerror = () => {
          const errorMsg = "Failed to load payment gateway";
          setError(errorMsg);
          context?.alertBox("error", errorMsg);
          setIsProcessing(false);
        };
        document.body.appendChild(script);
      } else {
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (error) {
      console.error("❌ Payment initiation error:", error);
      const errorMsg = error.message || "Checkout failed";
      setError(errorMsg);
      context?.alertBox("error", errorMsg);
      setIsProcessing(false);
    }
  };

  return {
    initiatePayment,
    isProcessing,
    error,
  };
};
