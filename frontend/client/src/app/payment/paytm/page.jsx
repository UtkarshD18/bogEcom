"use client";

import { API_BASE_URL } from "@/utils/api";
import cookies from "js-cookie";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = API_BASE_URL;
const ORDER_PENDING_PAYMENT_KEY = "orderPaymentPending";
const COIN_REWARD_KEY = "coinRewardAnimation";

const DEFAULT_PAYTM_STAGE_URL = "https://securestage.paytmpayments.com";
const DEFAULT_PAYTM_PROD_URL = "https://secure.paytmpayments.com";
const LEGACY_PAYTM_STAGE_URL = "https://securegw-stage.paytm.in";
const LEGACY_PAYTM_PROD_URL = "https://securegw.paytm.in";

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

const waitFor = async (predicate, { timeoutMs = 4500, intervalMs = 120 } = {}) =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const tick = () => {
      try {
        if (predicate()) {
          resolve(true);
          return;
        }
      } catch {
        // keep polling until timeout
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("Timed out waiting for Paytm SDK"));
        return;
      }

      setTimeout(tick, intervalMs);
    };

    tick();
  });

const sanitizePath = (value, fallback) => {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/")) return fallback;
  return normalized;
};

const sanitizePaytmBase = (value) => {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return "";
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
};

const resolvePaytmBaseCandidates = (preferredBase) => {
  const candidates = [
    sanitizePaytmBase(preferredBase),
    DEFAULT_PAYTM_PROD_URL,
    DEFAULT_PAYTM_STAGE_URL,
    LEGACY_PAYTM_PROD_URL,
    LEGACY_PAYTM_STAGE_URL,
  ].filter(Boolean);

  return [...new Set(candidates)];
};

const buildScriptCandidates = (mid, preferredBase) => {
  const safeMid = encodeURIComponent(String(mid || "").trim());
  if (!safeMid) return [];

  return resolvePaytmBaseCandidates(preferredBase).map(
    (base) => `${base}/merchantpgpui/checkoutjs/merchants/${safeMid}.js`,
  );
};

const buildHostedFallbackUrl = ({ mid, orderId, txnToken, gatewayBase }) => {
  const fallbackBase =
    sanitizePaytmBase(gatewayBase) || DEFAULT_PAYTM_PROD_URL;
  const query = new URLSearchParams({
    mid: String(mid || "").trim(),
    orderId: String(orderId || "").trim(),
  });
  const normalizedToken = String(txnToken || "").trim();
  if (normalizedToken) {
    query.set("txnToken", normalizedToken);
  }

  // processTransaction + txnToken renders Paytm hosted checkout reliably.
  return `${fallbackBase}/theia/processTransaction?${query.toString()}`;
};

const isVisibleElement = (element) => {
  if (!element || typeof window === "undefined") return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity || 1) > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
};

const hasPaytmOverlayMounted = () => {
  if (typeof document === "undefined") return false;

  const selectors = [
    "iframe[src*='paytm']",
    "iframe[name*='paytm']",
    "iframe[id*='paytm']",
    "iframe[class*='paytm']",
  ];

  return selectors.some((selector) =>
    Array.from(document.querySelectorAll(selector)).some(isVisibleElement),
  );
};

const normalizeProvider = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizePaymentState = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getFailureMessage = (state) =>
  normalizePaymentState(state).includes("cancel")
    ? "Payment was cancelled. No amount was charged."
    : "Payment failed. Please retry from your order page.";
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
  if (params.paymentState) {
    target.searchParams.set("paymentState", normalizePaymentState(params.paymentState));
  }
  return target.toString();
};

const PaytmReturn = () => {
  const [message, setMessage] = useState(
    "We are preparing secure payment. Please wait...",
  );
  const launchedRef = useRef(false);
  const redirectedRef = useRef(false);
  const hostedFallbackTriggeredRef = useRef(false);

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
      paymentState: normalizePaymentState(search.get("paymentState") || ""),
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
    let hostedFallbackTimer = null;

    const gotoHostedFallback = () => {
      if (disposed || hostedFallbackTriggeredRef.current) return;
      hostedFallbackTriggeredRef.current = true;
      setMessage("Checkout script unavailable. Redirecting to secure Paytm page...");
      if (typeof window !== "undefined") {
        window.location.assign(
          buildHostedFallbackUrl({
            mid: params.mid,
            orderId: params.orderId,
            txnToken: params.txnToken,
            gatewayBase: params.gatewayBase,
          }),
        );
      }
    };

    const invokeCheckout = async () => {
      if (launchedRef.current) return;
      if (!params.mid || !params.orderId || !params.txnToken) {
        setMessage("Missing Paytm session details. Please retry checkout.");
        return;
      }

      launchedRef.current = true;
      setMessage("Opening Paytm secure checkout...");

      try {
        let loadedScriptUrl = "";
        const scriptCandidates = buildScriptCandidates(params.mid, params.gatewayBase);
        let lastLoadError = null;

        for (const scriptUrl of scriptCandidates) {
          try {
            await loadScript(scriptUrl);
            await waitFor(() => Boolean(window.Paytm?.CheckoutJS), {
              timeoutMs: 3500,
              intervalMs: 120,
            });
            loadedScriptUrl = scriptUrl;
            lastLoadError = null;
            break;
          } catch (loadError) {
            lastLoadError = loadError;
          }
        }

        if (!loadedScriptUrl || !window.Paytm?.CheckoutJS) {
          throw lastLoadError || new Error("Paytm checkout SDK not available");
        }

        const initAndInvokeCheckout = async () => {
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

              // Some browsers load CheckoutJS but never render the popup.
              // In that case, force hosted Paytm fallback instead of keeping user stuck.
              hostedFallbackTimer = window.setTimeout(() => {
                const stillOnBridgePage =
                  typeof window !== "undefined" &&
                  window.location.pathname.includes("/payment/paytm");
                if (stillOnBridgePage && !hasPaytmOverlayMounted()) {
                  gotoHostedFallback();
                }
              }, 2200);
            }
          } catch {
            gotoHostedFallback();
          }
        };

        const checkoutSdk = window.Paytm.CheckoutJS;
        if (typeof checkoutSdk.onLoad === "function") {
          let bootstrapped = false;
          checkoutSdk.onLoad(async () => {
            if (bootstrapped) return;
            bootstrapped = true;
            await initAndInvokeCheckout();
          });

          window.setTimeout(() => {
            if (!bootstrapped) {
              bootstrapped = true;
              void initAndInvokeCheckout();
            }
          }, 1400);
        } else {
          await initAndInvokeCheckout();
        }
      } catch {
        gotoHostedFallback();
      }
    };

    void invokeCheckout();

    return () => {
      disposed = true;
      if (hostedFallbackTimer) {
        window.clearTimeout(hostedFallbackTimer);
      }
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

      setMessage("Verifying your order payment status...");

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
            const paymentStatus = normalizePaymentState(order?.payment_status);
            const paid = paymentStatus === "paid";

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

            if (
              paymentStatus === "failed" ||
              paymentStatus === "cancelled" ||
              paymentStatus === "canceled" ||
              paymentStatus === "unavailable"
            ) {
              localStorage.removeItem(ORDER_PENDING_PAYMENT_KEY);

              if (!disposed) {
                const resolvedOrderId = String(order?._id || orderId).trim();
                setMessage(getFailureMessage(paymentStatus));
                if (
                  resolvedOrderId &&
                  params.flow === "order" &&
                  !redirectedRef.current
                ) {
                  redirectedRef.current = true;
                  setTimeout(() => {
                    window.location.href = `/orders/${encodeURIComponent(
                      resolvedOrderId,
                    )}?paymentProvider=PAYTM&paymentState=${encodeURIComponent(paymentStatus)}`;
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
        if (
          params.paymentState === "failed" ||
          params.paymentState === "cancelled" ||
          params.paymentState === "canceled"
        ) {
          setMessage(getFailureMessage(params.paymentState));
        }
        return;
      }

      if (
        params.paymentState === "failed" ||
        params.paymentState === "cancelled" ||
        params.paymentState === "canceled"
      ) {
        localStorage.removeItem(ORDER_PENDING_PAYMENT_KEY);
        setMessage(getFailureMessage(params.paymentState));
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          setTimeout(() => {
            window.location.href = `/my-orders?paymentProvider=PAYTM&paymentState=${encodeURIComponent(
              params.paymentState,
            )}`;
          }, 900);
        }
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
  }, [params.flow, params.paymentState]);

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
