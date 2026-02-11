"use client";

import { sanitizeHTML } from "@/utils/sanitize";
import { Alert, CircularProgress } from "@mui/material";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = (
  process.env.NEXT_PUBLIC_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

export default function PolicyPage() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/policies/public/${slug}`);
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.message || "Policy not found");
        }
        setPolicy(data.data);
      } catch (err) {
        setError(err.message || "Failed to load policy");
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchPolicy();
    }
  }, [slug]);

  if (loading) {
    return (
      <section className="min-h-screen bg-slate-50 flex items-center justify-center">
        <CircularProgress />
      </section>
    );
  }

  if (!policy) {
    return (
      <section className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl p-6 shadow-md text-center">
          <Alert severity="error">{error || "Policy not available"}</Alert>
          <div className="mt-5">
            <Link
              href="/"
              className="inline-block px-5 py-2 rounded-lg bg-primary text-white"
            >
              Go Home
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-gradient-to-b from-slate-50 to-emerald-50 py-10">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-900">
            {policy.title}
          </h1>
          <p className="text-sm text-slate-500 mt-3">
            Version {policy.version} | Effective{" "}
            {new Date(policy.effectiveDate).toLocaleDateString("en-IN")}
          </p>

          <article
            className="prose prose-slate max-w-none mt-8"
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(policy.content) }}
          />
        </div>
      </div>
    </section>
  );
}
