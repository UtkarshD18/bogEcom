"use client";

import { API_BASE_URL } from "@/utils/api";
import cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const API_URL = API_BASE_URL;
const PENDING_PAYMENT_KEY = "membershipPaymentPending";

const getStoredAuthToken = () => {
  const cookieToken = cookies.get("accessToken");
  if (cookieToken) return cookieToken;
  if (typeof window === "undefined") return "";
  return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
};

const ensureAccessTokenCookie = (token) => {
  if (!token) return;
  if (!cookies.get("accessToken")) {
    cookies.set("accessToken", token, { expires: 7 });
  }
};

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const DEFAULT_COIN_SUMMARY = {
  usable_coins: 0,
  rupee_value: 0,
  expiring_soon: 0,
  settings: {
    redeemRate: 0,
    maxRedeemPercentage: 0,
  },
};

export default function MembershipCheckoutPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [plan, setPlan] = useState(null);
  const [coinSummary, setCoinSummary] = useState(DEFAULT_COIN_SUMMARY);
  const [useCoins, setUseCoins] = useState(false);
  const [requestedCoins, setRequestedCoins] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const redeemRate = Number(coinSummary?.settings?.redeemRate || 0);
  const maxRedeemPercentage = Number(
    coinSummary?.settings?.maxRedeemPercentage || 0,
  );
  const usableCoins = Math.max(
    Math.floor(Number(coinSummary?.usable_coins || 0)),
    0,
  );
  const planPrice = Number(plan?.price || 0);

  const maxRedeemRupees = useMemo(
    () => round2((planPrice * maxRedeemPercentage) / 100),
    [planPrice, maxRedeemPercentage],
  );
  const maxCoinsByLimit = useMemo(
    () => (redeemRate > 0 ? Math.floor(maxRedeemRupees / redeemRate) : 0),
    [maxRedeemRupees, redeemRate],
  );
  const maxUsableCoins = Math.min(usableCoins, maxCoinsByLimit);

  const effectiveCoins = useCoins
    ? Math.min(Math.max(Math.floor(Number(requestedCoins || 0)), 0), maxUsableCoins)
    : 0;
  const coinRedeemAmount = round2(effectiveCoins * redeemRate);
  const finalPayable = Math.max(round2(planPrice - coinRedeemAmount), 0);

  useEffect(() => {
    setRequestedCoins((prev) =>
      Math.min(Math.max(Math.floor(Number(prev || 0)), 0), maxUsableCoins),
    );
  }, [maxUsableCoins]);

  useEffect(() => {
    const init = async () => {
      const token = getStoredAuthToken();
      if (!token) {
        router.push("/login?redirect=/membership/checkout");
        return;
      }
      ensureAccessTokenCookie(token);

      try {
        const [statusRes, planRes, coinsRes] = await Promise.all([
          fetch(`${API_URL}/api/membership/status`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/membership/active`),
          fetch(`${API_URL}/api/user/coins-summary`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (statusRes.status === 401) {
          router.push("/login?redirect=/membership/checkout");
          return;
        }

        const statusData = await statusRes.json();
        if (
          statusData.success &&
          statusData.data.isMember &&
          !statusData.data.isExpired
        ) {
          router.push("/membership");
          return;
        }

        const planData = await planRes.json();
        if (planData.success) {
          setPlan(planData.data);
        } else {
          setError("No membership plan available");
        }

        if (coinsRes.ok) {
          const coinsData = await coinsRes.json();
          if (coinsData?.success && coinsData?.data) {
            setCoinSummary({
              ...DEFAULT_COIN_SUMMARY,
              ...coinsData.data,
              settings: {
                ...DEFAULT_COIN_SUMMARY.settings,
                ...(coinsData.data.settings || {}),
              },
            });
          }
        }
      } catch {
        setError("Failed to load checkout details");
      }

      setIsLoading(false);
    };

    init();
  }, [router]);

  useEffect(() => {
    const verifyPendingPayment = async () => {
      try {
        if (typeof window === "undefined") return;
        const token = getStoredAuthToken();
        if (!token) return;
        ensureAccessTokenCookie(token);

        const raw = localStorage.getItem(PENDING_PAYMENT_KEY);
        if (!raw) return;

        const pending = JSON.parse(raw);
        if (!pending?.merchantTransactionId || !pending?.planId) {
          localStorage.removeItem(PENDING_PAYMENT_KEY);
          return;
        }

        setIsProcessing(true);
        setError(null);

        const verifyRes = await fetch(`${API_URL}/api/membership/verify-payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            merchantTransactionId: pending.merchantTransactionId,
            planId: pending.planId,
            coinRedeem: {
              coins: Math.max(
                Math.floor(Number(pending?.coinRedeem?.coins || 0)),
                0,
              ),
            },
          }),
        });

        const verifyData = await verifyRes.json();
        if (verifyData.success) {
          localStorage.removeItem(PENDING_PAYMENT_KEY);
          window.dispatchEvent(
            new CustomEvent("coinBalanceRefresh", {
              detail: { source: "membership_verify" },
            }),
          );
          setSuccess(true);
          setTimeout(() => router.push("/membership"), 1500);
        } else {
          setError(
            verifyData.message ||
              "Payment not confirmed yet. Please wait a moment and retry.",
          );
        }
      } catch {
        setError("Failed to verify membership payment.");
      } finally {
        setIsProcessing(false);
      }
    };

    verifyPendingPayment();
  }, [router]);

  const handlePayment = async () => {
    if (!plan) return;

    setIsProcessing(true);
    setError(null);

    const token = getStoredAuthToken();
    if (!token) {
      router.push("/login?redirect=/membership/checkout");
      return;
    }
    ensureAccessTokenCookie(token);

    try {
      const orderRes = await fetch(`${API_URL}/api/membership/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: plan._id,
          coinRedeem: {
            coins: effectiveCoins,
          },
        }),
      });

      const orderData = await orderRes.json();
      if (!orderData.success) {
        setError(orderData.message || "Failed to create order");
        setIsProcessing(false);
        return;
      }

      if (orderData?.data?.membershipActivated) {
        if (typeof window !== "undefined") {
          localStorage.removeItem(PENDING_PAYMENT_KEY);
          window.dispatchEvent(
            new CustomEvent("coinBalanceRefresh", {
              detail: { source: "membership_full_coin" },
            }),
          );
        }
        setSuccess(true);
        setTimeout(() => router.push("/membership"), 1200);
        return;
      }

      const paymentUrl = orderData?.data?.paymentUrl;
      const merchantTransactionId = orderData?.data?.merchantTransactionId;
      if (!paymentUrl) {
        setError("Payment URL not received. Please try again later.");
        setIsProcessing(false);
        return;
      }

      if (typeof window !== "undefined" && merchantTransactionId) {
        localStorage.setItem(
          PENDING_PAYMENT_KEY,
          JSON.stringify({
            merchantTransactionId,
            planId: plan._id,
            coinRedeem: {
              coins: Math.max(
                Math.floor(Number(orderData?.data?.coinRedemption?.coinsUsed || 0)),
                0,
              ),
            },
            createdAt: Date.now(),
          }),
        );
      }

      window.location.href = paymentUrl;
    } catch {
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
        <div style={{ fontSize: "4rem", marginBottom: 20 }}>Success</div>
        <h1 style={{ color: "#10b981", fontSize: "2rem", marginBottom: 10 }}>
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
        <p style={{ color: "#666" }}>{error || "No membership plan available"}</p>
        <button
          onClick={() => router.push("/membership")}
          style={{
            marginTop: 20,
            padding: "12px 24px",
            background: "var(--primary)",
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
        maxWidth: 620,
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
          border: "2px solid var(--primary)",
        }}
      >
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--primary)",
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
          Rs.{plan.price}
          {plan.originalPrice > plan.price && (
            <span
              style={{
                fontSize: "1rem",
                color: "#999",
                textDecoration: "line-through",
                marginLeft: 12,
              }}
            >
              Rs.{plan.originalPrice}
            </span>
          )}
        </div>

        <p style={{ color: "#666", marginBottom: 20 }}>
          Valid for {plan.duration} {plan.durationUnit}
        </p>

        <div
          style={{
            marginBottom: 24,
            border: "1px solid #fde68a",
            borderRadius: 12,
            padding: 14,
            background: "#fffbeb",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span style={{ fontWeight: 700, color: "#92400e" }}>Use Coins</span>
            <input
              type="checkbox"
              checked={useCoins}
              onChange={(event) => {
                const checked = event.target.checked;
                setUseCoins(checked);
                if (checked && requestedCoins <= 0) {
                  setRequestedCoins(maxUsableCoins);
                }
              }}
            />
          </label>

          <div style={{ fontSize: "0.9rem", color: "#92400e" }}>
            Available: <strong>{usableCoins}</strong> coins
          </div>
          <div style={{ fontSize: "0.85rem", color: "#78350f", marginTop: 4 }}>
            Max redeem allowed: Rs.{maxRedeemRupees.toFixed(2)}
          </div>

          {useCoins && (
            <>
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min={0}
                  max={maxUsableCoins}
                  value={effectiveCoins}
                  onChange={(event) => {
                    const next = Math.max(
                      0,
                      Math.floor(Number(event.target.value || 0)),
                    );
                    setRequestedCoins(next);
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    padding: "8px 10px",
                    fontWeight: 600,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setRequestedCoins(maxUsableCoins)}
                  style={{
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontWeight: 700,
                    cursor: "pointer",
                    background: "#fef3c7",
                    color: "#92400e",
                  }}
                >
                  MAX
                </button>
              </div>
              <div style={{ marginTop: 8, fontSize: "0.85rem", color: "#78350f" }}>
                Coins used: <strong>{effectiveCoins}</strong> (Rs.{coinRedeemAmount.toFixed(2)})
              </div>
            </>
          )}
        </div>

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
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
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
                  <span style={{ color: "#10b981" }}>-</span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          style={{
            marginBottom: 18,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: 12,
            background: "#f9fafb",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "#6b7280" }}>Plan Price</span>
            <strong>Rs.{round2(planPrice).toFixed(2)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "#6b7280" }}>Coin Discount</span>
            <strong style={{ color: "#b45309" }}>-Rs.{coinRedeemAmount.toFixed(2)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.05rem" }}>
            <span style={{ color: "#111827", fontWeight: 700 }}>Final Payable</span>
            <strong style={{ color: "#111827" }}>Rs.{finalPayable.toFixed(2)}</strong>
          </div>
        </div>

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
              : "linear-gradient(135deg, var(--flavor-hover) 0%, var(--primary) 100%)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1.1rem",
            borderRadius: 12,
            border: "none",
            cursor: isProcessing ? "not-allowed" : "pointer",
            transition: "all 0.3s ease",
          }}
        >
          {isProcessing ? "Processing..." : finalPayable > 0 ? `Pay Rs.${finalPayable.toFixed(2)}` : "Activate Membership"}
        </button>

        <p
          style={{
            textAlign: "center",
            color: "#999",
            fontSize: "0.8rem",
            marginTop: 16,
          }}
        >
          Secure payment powered by PhonePe
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
        Back to Membership
      </button>
    </main>
  );
}
