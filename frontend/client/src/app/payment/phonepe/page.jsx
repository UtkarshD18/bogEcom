"use client";

import { API_BASE_URL } from "@/utils/api";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = API_BASE_URL;

const PhonePeReturn = () => {
  const [message, setMessage] = useState(
    "We are confirming your payment. Please wait…",
  );

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/payment-status`);
        const data = await res.json();
        if (!data?.data?.paymentEnabled) {
          setMessage(
            "Payments are currently unavailable. If your payment went through, it will update shortly.",
          );
        }
      } catch {
        setMessage(
          "Payment status is being updated. Please check your orders in a moment.",
        );
      }
    };

    checkStatus();
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
