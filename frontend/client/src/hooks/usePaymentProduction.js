/**
 * Production-Grade Payment Hook
 * PhonePe-first flow with safe fallbacks and logging.
 */

import { useCallback, useState } from "react";
import cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_APP_API_URL || "http://localhost:8000";

const PaymentErrors = {
  NETWORK_ERROR: "Network error. Please check your connection.",
  INVALID_INPUT: "Please provide all required information.",
  ORDER_CREATION_FAILED: "Failed to create order. Please try again.",
  PAYMENT_GATEWAY_ERROR: "Payment gateway error. Please try again.",
  PAYMENT_CANCELLED: "Payment was cancelled.",
  ORDER_NOT_FOUND: "Order not found. Please try again.",
  ADDRESS_REQUIRED: "Please select a delivery address.",
  EMPTY_CART: "Your cart is empty.",
};

export const usePayment = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);

  const logPaymentEvent = useCallback((eventType, data = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, eventType, ...data };
    const logs = JSON.parse(localStorage.getItem("paymentLogs") || "[]");
    logs.push(logEntry);
    localStorage.setItem("paymentLogs", JSON.stringify(logs.slice(-50)));
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Payment Event] ${eventType}:`, logEntry);
    }
  }, []);

  const checkPaymentGateway = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/orders/payment-status`);
    const data = await response.json();
    logPaymentEvent("GATEWAY_CHECK", {
      enabled: data?.data?.paymentEnabled,
      provider: data?.data?.provider,
    });
    return data?.data;
  }, [logPaymentEvent]);

  const createOrderOnBackend = useCallback(
    async (products, totalAmount, deliveryAddress = null, additionalData = {}) => {
      const token = cookies.get("accessToken");

      const payload = {
        products: products.map((item) => ({
          productId: item._id || item.id,
          productTitle: item.name || item.title,
          quantity: item.quantity,
          price: item.price,
          image: item.image,
          subTotal: item.price * item.quantity,
        })),
        totalAmt: totalAmount,
        delivery_address: deliveryAddress || null,
        ...additionalData,
      };

      const response = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create order");
      }

      const data = await response.json();
      return data.data;
    },
    [],
  );

  const initiatePhonePePayment = useCallback(
    async (products, totalAmount, deliveryAddress = null) => {
      try {
        if (!products || products.length === 0) {
          throw new Error(PaymentErrors.EMPTY_CART);
        }

        if (totalAmount <= 0) {
          throw new Error(PaymentErrors.INVALID_INPUT);
        }

        setLoading(true);
        setError(null);
        setPaymentStatus("initiating");

        const gateway = await checkPaymentGateway();
        if (!gateway?.paymentEnabled) {
          throw new Error(
            gateway?.message ||
              "Payments are temporarily unavailable. Please try later.",
          );
        }

        const orderData = await createOrderOnBackend(
          products,
          totalAmount,
          deliveryAddress,
        );

        const paymentUrl = orderData?.paymentUrl;
        if (!paymentUrl) {
          throw new Error(PaymentErrors.PAYMENT_GATEWAY_ERROR);
        }

        setPaymentStatus("redirecting");
        window.location.href = paymentUrl;

        return { success: true, orderId: orderData.orderId };
      } catch (err) {
        setPaymentStatus("failed");
        setError(err.message);
        logPaymentEvent("PHONEPE_PAYMENT_ERROR", { error: err.message });
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [checkPaymentGateway, createOrderOnBackend, logPaymentEvent],
  );

  const handleSaveOrderForLater = useCallback(
    async (
      products,
      totalAmount,
      deliveryAddress = null,
      discounts = {},
      influencerCode = null,
    ) => {
      try {
        if (!products || products.length === 0) {
          throw new Error(PaymentErrors.EMPTY_CART);
        }

        if (totalAmount <= 0) {
          throw new Error(PaymentErrors.INVALID_INPUT);
        }

        setLoading(true);
        setError(null);
        setPaymentStatus("saving");

        const token = cookies.get("accessToken");
        const payload = {
          products: products.map((item) => ({
            productId: item._id || item.id,
            productTitle: item.name || item.title,
            quantity: item.quantity,
            price: item.price,
            image: item.image,
            subTotal: item.price * item.quantity,
          })),
          totalAmt: totalAmount,
          delivery_address: deliveryAddress || null,
          couponCode: discounts.couponCode || null,
          discountAmount: discounts.discountAmount || 0,
          finalAmount: discounts.finalAmount || totalAmount,
          influencerCode: influencerCode || null,
        };

        const response = await fetch(`${API_URL}/api/orders/save-for-later`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to save order");
        }

        const data = await response.json();
        setPaymentStatus("saved");
        return {
          success: true,
          orderId: data?.data?.orderId,
          message: "Order saved successfully. You can pay later.",
        };
      } catch (err) {
        setPaymentStatus("save_failed");
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const retryPayment = useCallback(
    async () => {
      setError("Retry payment is not available until PhonePe is enabled.");
      return { success: false, error: "Payment retry unavailable" };
    },
    [],
  );

  const clearPaymentState = useCallback(() => {
    setError(null);
    setPaymentStatus(null);
    setLoading(false);
  }, []);

  return {
    loading,
    error,
    paymentStatus,

    checkPaymentGateway,
    initiatePhonePePayment,
    // Backward-compatible alias for older Razorpay naming (do not remove)
    initiateRazorpayPayment: initiatePhonePePayment,
    handleSaveOrderForLater,
    retryPayment,
    clearPaymentState,

    logPaymentEvent,
  };
};

export default usePayment;
