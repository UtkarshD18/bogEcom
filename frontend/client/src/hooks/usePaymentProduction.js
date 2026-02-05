/**
 * Production-Grade Payment Hook
 * Complete payment processing with PhonePe/Razorpay support
 * Includes error handling, retry logic, and state management
 */

import { useCallback, useState } from "react";
import cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_APP_API_URL || "http://localhost:8000";

// ==================== ERROR HANDLING ====================

const PaymentErrors = {
  NETWORK_ERROR: "Network error. Please check your connection.",
  INVALID_INPUT: "Please provide all required information.",
  ORDER_CREATION_FAILED: "Failed to create order. Please try again.",
  PAYMENT_GATEWAY_ERROR: "Payment gateway error. Please try again.",
  PAYMENT_VERIFICATION_FAILED: "Payment verification failed. Please contact support.",
  SIGNATURE_MISMATCH: "Payment signature verification failed.",
  PAYMENT_CANCELLED: "Payment was cancelled.",
  ORDER_NOT_FOUND: "Order not found. Please try again.",
  ADDRESS_REQUIRED: "Please select a delivery address.",
  EMPTY_CART: "Your cart is empty.",
};

// ==================== PAYMENT PROCESSING LOGIC ====================

export const usePayment = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);

  /**
   * Log payment events for debugging and analytics
   */
  const logPaymentEvent = useCallback((eventType, data = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      eventType,
      ...data,
    };

    // Store in localStorage for debugging
    const logs = JSON.parse(localStorage.getItem("paymentLogs") || "[]");
    logs.push(logEntry);
    localStorage.setItem("paymentLogs", JSON.stringify(logs.slice(-50))); // Keep last 50 logs

    console.log(`[Payment Event] ${eventType}:`, logEntry);
  }, []);

  /**
   * Check if payment gateway is available
   */
  const checkPaymentGateway = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/orders/payment-status`);
      if (!response.ok) {
        throw new Error("Failed to check payment status");
      }

      const data = await response.json();
      logPaymentEvent("GATEWAY_CHECK", {
        enabled: data.data.paymentEnabled,
        provider: data.data.provider,
      });

      return data.data;
    } catch (error) {
      logPaymentEvent("GATEWAY_CHECK_ERROR", { error: error.message });
      throw error;
    }
  }, [logPaymentEvent]);

  /**
   * Load Razorpay script dynamically
   */
  const loadRazorpayScript = useCallback(async () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => {
        logPaymentEvent("RAZORPAY_SCRIPT_LOADED");
        resolve(true);
      };
      script.onerror = () => {
        logPaymentEvent("RAZORPAY_SCRIPT_LOAD_FAILED");
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }, [logPaymentEvent]);

  /**
   * Create order on backend
   */
  const createOrderOnBackend = useCallback(
    async (products, totalAmount, deliveryAddress = null, additionalData = {}) => {
      try {
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

        logPaymentEvent("ORDER_CREATION_STARTED", { amount: totalAmount });

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
        logPaymentEvent("ORDER_CREATED", { orderId: data.data.orderId });

        return data.data;
      } catch (error) {
        logPaymentEvent("ORDER_CREATION_ERROR", { error: error.message });
        throw error;
      }
    },
    [logPaymentEvent]
  );

  /**
   * Save order for later (when payments unavailable)
   */
  const saveOrderForLater = useCallback(
    async (
      products,
      totalAmount,
      deliveryAddress = null,
      discounts = {},
      influencerCode = null
    ) => {
      try {
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

        logPaymentEvent("SAVE_ORDER_STARTED", { amount: totalAmount });

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
        logPaymentEvent("ORDER_SAVED", { orderId: data.data.orderId });

        return data.data;
      } catch (error) {
        logPaymentEvent("SAVE_ORDER_ERROR", { error: error.message });
        throw error;
      }
    },
    [logPaymentEvent]
  );

  /**
   * Verify payment signature
   */
  const verifyPayment = useCallback(
    async (orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature) => {
      try {
        const token = cookies.get("accessToken");

        logPaymentEvent("PAYMENT_VERIFICATION_STARTED", { orderId });

        const response = await fetch(`${API_URL}/api/orders/verify-payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            orderId,
            razorpayPaymentId,
            razorpayOrderId,
            razorpaySignature,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || "Payment verification failed"
          );
        }

        const data = await response.json();
        logPaymentEvent("PAYMENT_VERIFIED", {
          orderId,
          paymentId: razorpayPaymentId,
        });

        return data.data;
      } catch (error) {
        logPaymentEvent("PAYMENT_VERIFICATION_ERROR", {
          orderId,
          error: error.message,
        });
        throw error;
      }
    },
    [logPaymentEvent]
  );

  /**
   * Initialize Razorpay payment
   */
  const initiateRazorpayPayment = useCallback(
    async (products, totalAmount, deliveryAddress = null, customerInfo = {}) => {
      try {
        // Validate inputs
        if (!products || products.length === 0) {
          throw new Error(PaymentErrors.EMPTY_CART);
        }

        if (totalAmount <= 0) {
          throw new Error(PaymentErrors.INVALID_INPUT);
        }

        setLoading(true);
        setError(null);
        setPaymentStatus("initiating");

        logPaymentEvent("RAZORPAY_PAYMENT_INITIATED", {
          amount: totalAmount,
          productCount: products.length,
        });

        // Step 1: Create order on backend
        const orderData = await createOrderOnBackend(
          products,
          totalAmount,
          deliveryAddress
        );

        const { orderId, razorpayOrderId, keyId } = orderData;

        // Step 2: Load Razorpay script
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          throw new Error(PaymentErrors.PAYMENT_GATEWAY_ERROR);
        }

        // Step 3: Open Razorpay checkout
        setPaymentStatus("gateway_open");

        const options = {
          key: keyId,
          amount: Math.round(totalAmount * 100), // Amount in paise
          currency: "INR",
          name: "Healthy One Gram",
          description: "Purchase Order",
          image: "/logo.png",
          order_id: razorpayOrderId,
          prefill: {
            name: customerInfo.name || "",
            email: customerInfo.email || "",
            contact: customerInfo.phone || "",
          },
          theme: {
            color: "#059669",
          },
          handler: async (response) => {
            try {
              setPaymentStatus("verifying");
              logPaymentEvent("RAZORPAY_PAYMENT_RESPONSE", {
                paymentId: response.razorpay_payment_id,
              });

              // Step 4: Verify payment on backend
              const verificationResult = await verifyPayment(
                orderId,
                response.razorpay_payment_id,
                response.razorpay_order_id,
                response.razorpay_signature
              );

              setPaymentStatus("verified");
              logPaymentEvent("PAYMENT_SUCCESS", { orderId });

              return {
                success: true,
                orderId,
                paymentId: response.razorpay_payment_id,
                message: "Payment successful!",
              };
            } catch (verifyError) {
              setPaymentStatus("verification_failed");
              setError(verifyError.message);
              logPaymentEvent("PAYMENT_VERIFICATION_FAILED", {
                error: verifyError.message,
              });

              return {
                success: false,
                error: verifyError.message,
              };
            }
          },
          modal: {
            ondismiss: () => {
              setPaymentStatus("cancelled");
              setError(PaymentErrors.PAYMENT_CANCELLED);
              logPaymentEvent("RAZORPAY_MODAL_CLOSED");
            },
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();

        return { success: true, orderId, razorpayOrderId };
      } catch (error) {
        setPaymentStatus("failed");
        setError(error.message);
        logPaymentEvent("RAZORPAY_PAYMENT_ERROR", { error: error.message });

        return {
          success: false,
          error: error.message,
        };
      } finally {
        setLoading(false);
      }
    },
    [
      createOrderOnBackend,
      loadRazorpayScript,
      verifyPayment,
      logPaymentEvent,
    ]
  );

  /**
   * Save order for later when payments are unavailable
   */
  const handleSaveOrderForLater = useCallback(
    async (
      products,
      totalAmount,
      deliveryAddress = null,
      discounts = {},
      influencerCode = null
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

        logPaymentEvent("SAVE_ORDER_FOR_LATER_STARTED", {
          amount: totalAmount,
        });

        const result = await saveOrderForLater(
          products,
          totalAmount,
          deliveryAddress,
          discounts,
          influencerCode
        );

        setPaymentStatus("saved");
        logPaymentEvent("ORDER_SAVED_FOR_LATER", { orderId: result.orderId });

        return {
          success: true,
          orderId: result.orderId,
          message: "Order saved successfully. You can pay later.",
        };
      } catch (error) {
        setPaymentStatus("save_failed");
        setError(error.message);
        logPaymentEvent("SAVE_ORDER_ERROR", { error: error.message });

        return {
          success: false,
          error: error.message,
        };
      } finally {
        setLoading(false);
      }
    },
    [saveOrderForLater, logPaymentEvent]
  );

  /**
   * Retry payment for saved orders
   */
  const retryPayment = useCallback(
    async (orderId) => {
      try {
        setLoading(true);
        setError(null);
        setPaymentStatus("retrying");

        logPaymentEvent("RETRY_PAYMENT_STARTED", { orderId });

        // Fetch order details
        const token = cookies.get("accessToken");
        const orderResponse = await fetch(`${API_URL}/api/orders/${orderId}`, {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });

        if (!orderResponse.ok) {
          throw new Error(PaymentErrors.ORDER_NOT_FOUND);
        }

        const { data: order } = await orderResponse.json();

        // Re-initiate payment
        return await initiateRazorpayPayment(
          order.products,
          order.finalAmount || order.totalAmt,
          order.delivery_address
        );
      } catch (error) {
        setPaymentStatus("retry_failed");
        setError(error.message);
        logPaymentEvent("RETRY_PAYMENT_ERROR", { error: error.message });

        return {
          success: false,
          error: error.message,
        };
      } finally {
        setLoading(false);
      }
    },
    [initiateRazorpayPayment, logPaymentEvent]
  );

  /**
   * Clear payment state
   */
  const clearPaymentState = useCallback(() => {
    setError(null);
    setPaymentStatus(null);
    setLoading(false);
  }, []);

  return {
    // State
    loading,
    error,
    paymentStatus,

    // Methods
    checkPaymentGateway,
    initiateRazorpayPayment,
    handleSaveOrderForLater,
    retryPayment,
    clearPaymentState,

    // Utilities
    logPaymentEvent,
  };
};

export default usePayment;
