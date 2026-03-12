"use client";

import { API_BASE_URL } from "@/utils/api";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const API_URL = API_BASE_URL;

const formatInr = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const PayOrderPage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = String(params?.orderId || "").trim();
  const token = String(searchParams?.get("key") || "").trim();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canPay = Boolean(order?.payable);

  useEffect(() => {
    const load = async () => {
      if (!orderId || !token) {
        setError("Missing or invalid payment link.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `${API_URL}/api/orders/pay-order/${encodeURIComponent(
            orderId,
          )}?key=${encodeURIComponent(token)}`,
        );
        const data = await res.json();
        if (!data?.success) {
          throw new Error(data?.message || "Invalid or expired payment link.");
        }
        setOrder(data.data);
        setError("");
      } catch (err) {
        setError(err?.message || "Unable to load order.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [orderId, token]);

  useEffect(() => {
    const loadPaymentStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/payment-status`);
        const data = await res.json();
        if (data?.success) {
          setPaymentStatus(data.data);
          const fallbackProvider =
            data.data?.defaultProvider ||
            data.data?.provider ||
            data.data?.enabledProviders?.[0] ||
            "";
          setSelectedProvider(
            String(fallbackProvider || "").trim().toUpperCase(),
          );
        }
      } catch {
        // Ignore, handled by UI state.
      }
    };

    loadPaymentStatus();
  }, []);

  const availableProviders = useMemo(() => {
    const list = paymentStatus?.enabledProviders || [];
    return Array.isArray(list) ? list : [];
  }, [paymentStatus]);

  const handlePay = async () => {
    if (!orderId || !token || !canPay || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_URL}/api/orders/pay-order/${encodeURIComponent(
          orderId,
        )}/initiate?key=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentProvider: selectedProvider || undefined,
          }),
        },
      );
      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.message || "Failed to initiate payment.");
      }
      const paymentUrl = data?.data?.paymentUrl;
      if (!paymentUrl) {
        throw new Error("Payment URL missing. Please retry.");
      }
      window.location.assign(paymentUrl);
    } catch (err) {
      setError(err?.message || "Failed to initiate payment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Pay Now</h1>
          <p className="text-slate-600">{error}</p>
          <Link href="/" className="inline-block mt-4 text-blue-600 underline">
            Back to store
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Pay for Order</h1>
          <p className="text-slate-600 mt-1">
            Order {order?.displayOrderId || order?.orderId}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Summary</h2>
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>{formatInr(order?.totals?.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Discount</span>
              <span>-{formatInr(order?.totals?.discount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tax</span>
              <span>{formatInr(order?.totals?.tax)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Shipping</span>
              <span>{formatInr(order?.totals?.shipping)}</span>
            </div>
            <div className="flex items-center justify-between font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatInr(order?.totals?.finalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Payment
          </h2>
          {!canPay ? (
            <p className="text-slate-600">
              This order is not payable. Current status:{" "}
              <strong>{order?.paymentStatus}</strong>.
            </p>
          ) : (
            <>
              {availableProviders.length > 1 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select payment method
                  </label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    {availableProviders.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={handlePay}
                disabled={submitting}
                className="w-full rounded-lg bg-blue-600 text-white py-3 font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Redirecting..." : "Pay Now"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PayOrderPage;
