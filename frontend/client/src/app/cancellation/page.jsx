"use client";

import { CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";
import { MdInfo } from "react-icons/md";

const API_URL = (
  process.env.NEXT_PUBLIC_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
)
  .trim()
  .replace(/\/+$/, "");

/**
 * Cancellation Information Page
 * Publicly accessible, content fetched from backend
 * Read-only for users
 */
const CancellationPage = () => {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCancellationPolicy();
  }, []);

  const fetchCancellationPolicy = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/cancellation`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Request failed: ${response.status} ${response.statusText} ${text ? `| ${text}` : ""}`.trim(),
        );
      }

      const data = await response.json();

      if (data.success) {
        setContent(data.data.content);
      } else {
        setError("Failed to load cancellation policy");
      }
    } catch (err) {
      console.error("Error fetching cancellation policy:", {
        apiUrl: API_URL,
        error: err,
      });
      setError("Failed to load cancellation policy");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
        <CircularProgress />
      </section>
    );
  }

  if (error) {
    return (
      <section className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 md:p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-orange-100 p-3 rounded-full">
              <MdInfo className="text-orange-600 text-2xl" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
              Cancellation & Return Policy
            </h1>
          </div>
          <p className="text-gray-600 text-sm md:text-base">
            Please read our cancellation and return policy carefully before
            placing an order.
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
          <div className="prose prose-sm md:prose-base max-w-none">
            <div
              className="text-gray-700 leading-relaxed whitespace-pre-line"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {content}
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Have Questions?
          </h3>
          <p className="text-gray-600 text-sm">
            If you have any questions about our cancellation policy, please
            contact our customer support team.
          </p>
        </div>
      </div>
    </section>
  );
};

export default CancellationPage;
