"use client";

import { API_BASE_URL } from "@/utils/api";
import cookies from "js-cookie";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = API_BASE_URL;
const ORDER_PENDING_PAYMENT_KEY = "orderPaymentPending";
const COIN_REWARD_KEY = "coinRewardAnimation";

const getStoredAuthToken = () => {
  const cookieToken = cookies.get("accessToken");
  if (cookieToken) return cookieToken;
  if (typeof window === "undefined") return "";
  return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizePath = (value, fallback) => {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/")) return fallback;
  return normalized;
};

const PhonePeReturn = () => {
  const [message, setMessage] = useState(
    "We are verifying your payment status. Please wait...",
  );
  const redirectedRef = useRef(false);

  const params = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        merchantOrderId: "",
        flow: "order",
        returnPath: "/my-orders",
      };
    }

    const search = new URLSearchParams(window.location.search || "");
    return {
      merchantOrderId: String(
        search.get("merchantOrderId") || search.get("orderId") || "",
      ).trim(),
      flow: String(search.get("flow") || "order")
        .trim()
        .toLowerCase(),
      returnPath: sanitizePath(
        search.get("returnPath"),
        search.get("flow") === "membership" ? "/membership/checkout" : "/my-orders",
      ),
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const syncWebhook = async () => {
      if (!params.merchantOrderId) {
        setMessage("Missing PhonePe session details. Please retry checkout.");
        return;
      }

      setMessage("Payment completed. Syncing with server...");

      try {
        await fetch(`${API_URL}/api/orders/webhook/phonepe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            merchantOrderId: params.merchantOrderId,
            source: "return_page",
          }),
        });
      } catch {
        // Webhook sync is best-effort; polling below still handles final state.
      }

      if (disposed) return;
      setMessage("Checking payment confirmation...");
    };

    void syncWebhook();

    return () => {
      disposed = true;
    };
  }, [params.merchantOrderId]);

  useEffect(() => {
    let disposed = false;

    const verifyPendingOrder = async () => {
      if (typeof window === "undefined") return false;
      if (params.flow !== "order") return false;

      const raw = localStorage.getItem(ORDER_PENDING_PAYMENT_KEY);
      if (!raw) return false;

      let pending = null;
      try {
        pending = JSON.parse(raw);
      } catch {
        localStorage.removeItem(ORDER_PENDING_PAYMENT_KEY);
        return false;
      }

      const orderId = String(pending?.orderId || "").trim();
      if (!orderId) {
        localStorage.removeItem(ORDER_PENDING_PAYMENT_KEY);
        return false;
      }

      const token = getStoredAuthToken();
      if (!token) return false;

      setMessage("Payment received. Verifying your order status...");

      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (disposed) return true;

        try {
          const response = await fetch(`${API_URL}/api/orders/user/order/${orderId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            credentials: "include",
          });

          if (response.ok) {
            const data = await response.json();
            const order = data?.data;
            const paid = String(order?.payment_status || "").toLowerCase() === "paid";

            if (paid) {
              localStorage.removeItem(ORDER_PENDING_PAYMENT_KEY);

              const coinsAwarded = Math.max(
                Math.floor(Number(order?.coinsAwarded || 0)),
                0,
              );

              if (coinsAwarded > 0) {
                const payload = {
                  orderId: String(order?._id || orderId),
                  coins: coinsAwarded,
                };
                localStorage.setItem(COIN_REWARD_KEY, JSON.stringify(payload));
                window.dispatchEvent(
                  new CustomEvent("coinRewardAnimation", {
                    detail: payload,
                  }),
                );
              }

              if (!disposed) {
                const resolvedOrderId = String(order?._id || orderId).trim();
                setMessage("Payment confirmed. Redirecting to your order...");
                if (
                  resolvedOrderId &&
                  params.flow === "order" &&
                  !redirectedRef.current
                ) {
                  redirectedRef.current = true;
                  setTimeout(() => {
                    window.location.href = `/orders/${encodeURIComponent(
                      resolvedOrderId,
                    )}`;
                  }, 900);
                }
              }
              return true;
            }
          }
        } catch {
          // keep polling briefly
        }

        await wait(1800);
      }

      return false;
    };

    const checkStatus = async () => {
      const verified = await verifyPendingOrder();
      if (verified || disposed) return;

      setMessage("Payment status is being updated. Please check your orders shortly.");
    };

    void checkStatus();

    return () => {
      disposed = true;
    };
  }, [params.flow]);

  return (
    <section className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-md p-8 max-w-lg text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          PhonePe Payment Processing
        </h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={params.flow === "membership" ? "/membership/checkout" : "/my-orders"}
            className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:brightness-110"
          >
            {params.flow === "membership" ? "Back to Membership" : "View My Orders"}
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Go Home
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PhonePeReturn;
