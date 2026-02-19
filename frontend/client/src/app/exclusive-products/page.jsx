"use client";

import ExclusiveProductCard from "@/components/ExclusiveProductCard";
import MembershipGuard from "@/components/MembershipGuard";
import { fetchDataFromApi } from "@/utils/api";
import { useCallback, useEffect, useState } from "react";

const GridLoader = () => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div
        key={i}
        className="aspect-[3/4] bg-white/70 border border-gray-100 rounded-3xl animate-pulse"
      />
    ))}
  </div>
);

const ExclusiveProductsContent = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetchDataFromApi("/api/products/exclusive");
      if (response?.success) {
        setProducts(Array.isArray(response.data) ? response.data : []);
      } else {
        setProducts([]);
        setError(response?.message || "Failed to load exclusive products.");
      }
    } catch (fetchError) {
      setProducts([]);
      setError(fetchError?.message || "Failed to load exclusive products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return (
    <section className="min-h-screen pb-16 pt-10">
      <div className="container mx-auto px-4">
        <div className="mb-10">
          <span className="inline-flex rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--glass-text)] shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)]">
            Members Zone
          </span>
          <h1 className="mt-3 text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
            Exclusive Products
          </h1>
          <p className="mt-2 text-gray-600 max-w-2xl">
            Premium items available only for active members.
          </p>
        </div>

        {loading ? <GridLoader /> : null}

        {!loading && error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-700 font-medium">{error}</p>
            <button
              type="button"
              onClick={loadProducts}
              className="mt-4 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--glass-border)] bg-[var(--glass-bg)] p-10 text-center shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)]">
            <h2 className="text-xl font-bold text-gray-800">
              No exclusive products available yet
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Check back soon for members-only launches.
            </p>
          </div>
        ) : null}

        {!loading && !error && products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
            {products.map((product) => (
              <ExclusiveProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};

const ExclusiveProductsPage = () => {
  return (
    <MembershipGuard mode="locked" loginRedirect="/exclusive-products">
      <ExclusiveProductsContent />
    </MembershipGuard>
  );
};

export default ExclusiveProductsPage;
