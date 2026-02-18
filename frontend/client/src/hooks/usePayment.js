import { MyContext } from "@/context/ThemeProvider";
import { API_BASE_URL } from "@/utils/api";
import cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";

// Backend API URL
const API_URL = API_BASE_URL;

/**
 * Custom Hook for Payment Processing
 * PhonePe-first flow with backend integration
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

      // Check payment gateway status
      const statusResponse = await fetch(`${API_URL}/api/orders/payment-status`);
      const statusData = await statusResponse.json();
      if (!statusData?.data?.paymentEnabled) {
        throw new Error(
          statusData?.data?.message ||
            "Payments are temporarily unavailable. Please try later.",
        );
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
          notes: orderNotes,
        }),
      });

      if (!createOrderResponse.ok) {
        const errorData = await createOrderResponse.json();
        throw new Error(errorData.message || "Failed to create order");
      }

      const orderResponse = await createOrderResponse.json();
      const { orderId, paymentUrl } = orderResponse.data || {};

      if (!paymentUrl) {
        throw new Error("PhonePe payment URL not received.");
      }

      console.log("✅ Order created:", orderId);
      console.log("🔁 Redirecting to PhonePe...");

      window.location.href = paymentUrl;
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
