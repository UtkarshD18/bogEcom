"use client";

import { API_BASE_URL } from "@/utils/api";
import cookies from "js-cookie";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = API_BASE_URL;
const ORDER_PENDING_PAYMENT_KEY = "orderPaymentPending";
const COIN_REWARD_KEY = "coinRewardAnimation";

const DEFAULT_PAYTM_STAGE_URL = "https://securestage.paytmpayments.com";

const getStoredAuthToken = () => {
  const cookieToken = cookies.get("accessToken");
  if (cookieToken) return cookieToken;
  if (typeof window === "undefined") return "";
  return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadScript = async (src) =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Script load failed")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Script load failed"));
    document.body.appendChild(script);
  });

const sanitizePath = (value, fallback) => {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/")) return fallback;
  return normalized;
};

const normalizeProvider = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const buildMembershipReturnUrl = (params) => {
  if (typeof window === "undefined") return params.returnPath;
  const target = new URL(params.returnPath, window.location.origin);
  target.searchParams.set("merchantTransactionId", params.orderId);
  if (params.planId) {
    target.searchParams.set("planId", params.planId);
  }
  const provider = normalizeProvider(params.paymentProvider || "PAYTM");
  if (provider) {
    target.searchParams.set("paymentProvider", provider);
  }
  if (params.coins) {
    target.searchParams.set("coins", params.coins);
  }
  return target.toString();
};

const PaytmReturn = () => {
  const [message, setMessage] = useState(
    "We are preparing secure payment. Please wait...",
  );
  const launchedRef = useRef(false);
  const redirectedRef = useRef(false);

  const params = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        mid: "",
        orderId: "",
        txnToken: "",
        amount: "",
        flow: "order",
        returnPath: "/my-orders",
        gatewayBase: DEFAULT_PAYTM_STAGE_URL,
      };
    }

    const search = new URLSearchParams(window.location.search || "");
    return {
      mid: String(search.get("mid") || "").trim(),
      orderId: String(search.get("orderId") || "").trim(),
      txnToken: String(search.get("txnToken") || "").trim(),
      amount: String(search.get("amount") || "").trim(),
      planId: String(search.get("planId") || "").trim(),
      paymentProvider: normalizeProvider(search.get("paymentProvider") || "PAYTM"),
      coins: String(search.get("coins") || "").trim(),
      flow: String(search.get("flow") || "order")
        .trim()
        .toLowerCase(),
      returnPath: sanitizePath(
        search.get("returnPath"),
        search.get("flow") === "membership" ? "/membership/checkout" : "/my-orders",
      ),
      gatewayBase: String(search.get("gatewayBase") || DEFAULT_PAYTM_STAGE_URL)
        .trim()
        .replace(/\/+$/, ""),
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const invokeCheckout = async () => {
      if (launchedRef.current) return;
      if (!params.mid || !params.orderId || !params.txnToken) {
        setMessage("Missing Paytm session details. Please retry checkout.");
        return;
      }

      launchedRef.current = true;
      setMessage("Opening Paytm secure checkout...");

      try {
        const scriptUrl = `${params.gatewayBase}/merchantpgpui/checkoutjs/merchants/${encodeURIComponent(
          params.mid,
        )}.js`;
        await loadScript(scriptUrl);

        if (!window.Paytm?.CheckoutJS) {
          throw new Error("Paytm checkout SDK not available");
        }

        window.Paytm.CheckoutJS.onLoad(async () => {
          if (disposed) return;
          try {
            await window.Paytm.CheckoutJS.init({
              root: "",
              flow: "DEFAULT",
              data: {
                orderId: params.orderId,
                token: params.txnToken,
                tokenType: "TXN_TOKEN",
                ...(params.amount ? { amount: params.amount } : {}),
              },
              handler: {
                notifyMerchant: (eventName) => {
                  if (disposed) return;

                  if (params.flow === "membership") {
                    window.location.href = buildMembershipReturnUrl(params);
                    return;
                  }

                  if (eventName === "APP_CLOSED") {
                    setMessage(
                      "Checkout window closed. We are still verifying your payment status.",
                    );
                  }
                },
              },
            });

            if (!disposed) {
              window.Paytm.CheckoutJS.invoke();
              setMessage("Paytm checkout opened. Complete payment to continue.");
            }
          } catch {
            setMessage("Unable to start Paytm checkout. Please retry from checkout.");
          }
        });
      } catch {
        setMessage("Unable to load Paytm checkout. Please retry from checkout.");
      }
    };

    void invokeCheckout();

    return () => {
      disposed = true;
    };
  }, [params]);

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
      if (params.flow === "membership") {
        return;
      }

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

    void checkStatus();

    return () => {
      disposed = true;
    };
  }, [params.flow]);

  return (
    <section className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-md p-8 max-w-lg text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          Paytm Payment Processing
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

export default PaytmReturn;
