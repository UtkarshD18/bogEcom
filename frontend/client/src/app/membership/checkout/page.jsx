"use client";

import cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function MembershipCheckoutPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const token = cookies.get("accessToken");
      if (!token) {
        router.push("/login?redirect=/membership/checkout");
        return;
      }

      // Check if already a member
      try {
        const statusRes = await fetch(`${API_URL}/api/membership/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const statusData = await statusRes.json();
        if (
          statusData.success &&
          statusData.data.isMember &&
          !statusData.data.isExpired
        ) {
          router.push("/membership");
          return;
        }
      } catch (err) {
        console.error("Status check failed:", err);
      }

      // Fetch active plan
      try {
        const planRes = await fetch(`${API_URL}/api/membership/active`);
        const planData = await planRes.json();
        if (planData.success) {
          setPlan(planData.data);
        } else {
          setError("No membership plan available");
        }
      } catch (err) {
        setError("Failed to load membership plan");
      }

      setIsLoading(false);
    };

    init();
  }, [router]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    if (!plan) return;

    setIsProcessing(true);
    setError(null);

    const token = cookies.get("accessToken");
    if (!token) {
      router.push("/login?redirect=/membership/checkout");
      return;
    }

    // Load Razorpay script
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setError("Payment gateway failed to load");
      setIsProcessing(false);
      return;
    }

    try {
      // Create order
      const orderRes = await fetch(`${API_URL}/api/membership/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId: plan._id }),
      });

      const orderData = await orderRes.json();
      if (!orderData.success) {
        setError(orderData.message || "Failed to create order");
        setIsProcessing(false);
        return;
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.data.keyId,
        amount: orderData.data.amount * 100,
        currency: orderData.data.currency,
        name: "Healthy One Gram",
        description: `Membership: ${orderData.data.planName}`,
        order_id: orderData.data.orderId,
        handler: async function (response) {
          // Verify payment
          try {
            const verifyRes = await fetch(
              `${API_URL}/api/membership/verify-payment`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpaySignature: response.razorpay_signature,
                  planId: plan._id,
                }),
              },
            );

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setSuccess(true);
              setTimeout(() => {
                router.push("/membership");
              }, 2000);
            } else {
              setError(verifyData.message || "Payment verification failed");
            }
          } catch (err) {
            setError("Payment verification failed");
          }
          setIsProcessing(false);
        },
        prefill: {
          email: cookies.get("userEmail") || "",
          name: cookies.get("userName") || "",
        },
        theme: {
          color: "#059669",
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      console.error("Payment error:", err);
      setError("Payment failed. Please try again.");
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          textAlign: "center",
          paddingTop: "150px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        Loading...
      </div>
    );
  }

  if (success) {
    return (
      <div
        style={{
          textAlign: "center",
          paddingTop: "150px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: "4rem",
            marginBottom: 20,
          }}
        >
          🎉
        </div>
        <h1
          style={{
            color: "#10b981",
            fontSize: "2rem",
            marginBottom: 10,
          }}
        >
          Membership Activated!
        </h1>
        <p style={{ color: "#666" }}>Redirecting to membership page...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div
        style={{
          textAlign: "center",
          paddingTop: "150px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <p style={{ color: "#666" }}>
          {error || "No membership plan available"}
        </p>
        <button
          onClick={() => router.push("/membership")}
          style={{
            marginTop: 20,
            padding: "12px 24px",
            background: "#059669",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <main
      style={{
        maxWidth: 600,
        margin: "120px auto 3rem auto",
        padding: "2rem",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          fontSize: "2rem",
          fontWeight: 700,
          marginBottom: 30,
          color: "#333",
        }}
      >
        Complete Your Membership
      </h1>

      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          border: "2px solid #059669",
        }}
      >
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "#059669",
            marginBottom: 16,
          }}
        >
          {plan.name}
        </h2>

        {plan.description && (
          <p style={{ color: "#666", marginBottom: 20 }}>{plan.description}</p>
        )}

        <div
          style={{
            fontSize: "2.5rem",
            fontWeight: 800,
            color: "#333",
            marginBottom: 8,
          }}
        >
          ₹{plan.price}
          {plan.originalPrice > plan.price && (
            <span
              style={{
                fontSize: "1rem",
                color: "#999",
                textDecoration: "line-through",
                marginLeft: 12,
              }}
            >
              ₹{plan.originalPrice}
            </span>
          )}
        </div>

        <p style={{ color: "#666", marginBottom: 24 }}>
          Valid for {plan.duration} {plan.durationUnit}
        </p>

        {plan.benefits && plan.benefits.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                marginBottom: 12,
                color: "#333",
              }}
            >
              Benefits:
            </h3>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
              }}
            >
              {plan.benefits.map((benefit, i) => (
                <li
                  key={i}
                  style={{
                    padding: "8px 0",
                    color: "#555",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "#10b981" }}>✓</span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              padding: 12,
              borderRadius: 8,
              marginBottom: 20,
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handlePayment}
          disabled={isProcessing}
          style={{
            width: "100%",
            padding: "16px",
            background: isProcessing
              ? "#ccc"
              : "linear-gradient(135deg, #059669 0%, #059669 100%)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1.1rem",
            borderRadius: 12,
            border: "none",
            cursor: isProcessing ? "not-allowed" : "pointer",
            transition: "all 0.3s ease",
          }}
        >
          {isProcessing ? "Processing..." : `Pay ₹${plan.price}`}
        </button>

        <p
          style={{
            textAlign: "center",
            color: "#999",
            fontSize: "0.8rem",
            marginTop: 16,
          }}
        >
          Secure payment powered by Razorpay
        </p>
      </div>

      <button
        onClick={() => router.push("/membership")}
        style={{
          display: "block",
          margin: "20px auto 0",
          padding: "10px 20px",
          background: "transparent",
          color: "#666",
          border: "1px solid #ddd",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        ← Back to Membership
      </button>
    </main>
  );
}
