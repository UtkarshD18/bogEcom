"use client";

import { API_BASE_URL } from "@/utils/api";
import cookies from "js-cookie";
import Link from "next/link";
import { useEffect, useState } from "react";

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

const PhonePeReturn = () => {
  const [message, setMessage] = useState(
    "We are confirming your payment. Please wait...",
  );

  useEffect(() => {
    let disposed = false;

    const verifyPendingOrder = async () => {
      if (typeof window === "undefined") return false;

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

      for (let attempt = 0; attempt < 6; attempt += 1) {
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
                setMessage("Payment confirmed. Your order is successful.");
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

      try {
        const res = await fetch(`${API_URL}/api/orders/payment-status`);
        const data = await res.json();
        if (!data?.data?.paymentEnabled) {
          setMessage(
            "Payments are currently unavailable. If your payment went through, it will update shortly.",
          );
        } else {
          setMessage(
            "Payment status is being updated. Please check your orders in a moment.",
          );
        }
      } catch {
        setMessage(
          "Payment status is being updated. Please check your orders in a moment.",
        );
      }
    };

    checkStatus();

    return () => {
      disposed = true;
    };
  }, []);

  return (
    <section className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-md p-8 max-w-lg text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          Payment Processing
        </h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/my-orders"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:brightness-110"
          >
            View My Orders
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
