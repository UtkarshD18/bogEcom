"use client";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { fetchDataFromApi } from "@/utils/api";
import Link from "next/link";
import { useContext, useEffect, useState } from "react";
import ProductItem from "./ProductItem";

/**
 * ProductRow Component
 * A grid-based product display section
 * Mobile-optimized with responsive grid layout
 *
 * @param {Object} props
 * @param {string} props.title - Section title
 * @param {string} props.subtitle - Section subtitle/description
 * @param {string} props.categorySlug - Filter by category
 * @param {boolean} props.isFeatured - Show only featured products
 * @param {boolean} props.isNewArrivals - Show newest products
 * @param {boolean} props.isBestSeller - Show best sellers
 * @param {number} props.limit - Number of products to fetch
 * @param {string} props.viewAllLink - Link for "View All" button
 */
const ProductRow = ({
  title = "Featured Products",
  subtitle = "Discover our handpicked selection of premium products",
  categorySlug,
  isFeatured = false,
  isNewArrivals = false,
  isBestSeller = false,
  limit = 10,
  viewAllLink = "/products",
}) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const context = useContext(MyContext);
  const flavor = context?.flavor || FLAVORS.creamy;

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        let url = "/api/products?";
        const params = [];

        if (categorySlug) params.push(`category=${categorySlug}`);
        if (isFeatured) params.push("isFeatured=true");
        if (isNewArrivals) params.push("sortBy=createdAt&order=desc");
        if (isBestSeller) params.push("sortBy=soldCount&order=desc");
        params.push(`limit=${limit}`);

        url += params.join("&");

        const response = await fetchDataFromApi(url);
        if (response.success && response.data) {
          setProducts(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [categorySlug, isFeatured, isNewArrivals, isBestSeller, limit]);

  // Loading skeleton
  if (loading) {
    return (
      <section
        className="py-6 sm:py-10 md:py-14 transition-all duration-500"
        style={{ background: flavor.gradient }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          {/* Header skeleton */}
          <div className="flex justify-between items-end mb-4 sm:mb-8">
            <div className="space-y-2 sm:space-y-3">
              <div
                className="h-4 sm:h-5 w-20 sm:w-24 rounded-full animate-pulse"
                style={{ backgroundColor: flavor.glass }}
              />
              <div
                className="h-6 sm:h-8 w-36 sm:w-48 rounded-lg animate-pulse"
                style={{ backgroundColor: flavor.glass }}
              />
              <div
                className="h-3 sm:h-4 w-48 sm:w-64 rounded animate-pulse hidden sm:block"
                style={{ backgroundColor: flavor.glass }}
              />
            </div>
            <div
              className="h-9 sm:h-10 w-20 sm:w-24 rounded-full animate-pulse"
              style={{ backgroundColor: flavor.glass }}
            />
          </div>
          {/* Products skeleton grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
            {[...Array(limit)].map((_, i) => (
              <div
                key={i}
                className="h-[220px] sm:h-[280px] md:h-[320px] rounded-xl sm:rounded-2xl animate-pulse"
                style={{ backgroundColor: flavor.glass }}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section
      className="relative py-6 sm:py-10 md:py-14 overflow-hidden transition-all duration-500"
      style={{ background: flavor.gradient }}
    >
      <div className="relative max-w-7xl mx-auto px-3 sm:px-4">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 mb-4 sm:mb-8">
          <div className="flex-1 min-w-0">
            {/* Badge */}
            <span
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 mb-2 sm:mb-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-full transition-all duration-300"
              style={{
                color: flavor.color,
                backgroundColor: flavor.glass,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: flavor.color }}
              />
              {isFeatured
                ? "Featured"
                : isNewArrivals
                  ? "New Arrivals"
                  : isBestSeller
                    ? "Best Sellers"
                    : "Shop Now"}
            </span>

            {/* Title */}
            <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight tracking-tight">
              {title}
            </h2>

            {/* Subtitle - hidden on mobile */}
            <p className="hidden sm:block text-sm md:text-base text-gray-500 mt-1 md:mt-2 line-clamp-2">
              {subtitle}
            </p>
          </div>

          {/* View All Button */}
          <Link
            href={viewAllLink}
            className="flex-shrink-0 px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-full border-2 transition-all duration-300 hover:scale-105 active:scale-95"
            style={{
              borderColor: flavor.color,
              color: flavor.color,
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = flavor.color;
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = flavor.color;
            }}
          >
            View All
          </Link>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          {products.map((product, index) => (
            <div
              key={product._id}
              className="transform transition-all duration-300 hover:-translate-y-1"
              style={{
                animation: "fadeInUp 0.4s ease-out forwards",
                animationDelay: `${index * 50}ms`,
                opacity: 0,
              }}
            >
              <ProductItem
                id={product._id}
                name={product.name}
                brand={product.brand || "Buy One Gram"}
                price={product.price}
                originalPrice={product.originalPrice}
                discount={product.discount}
                rating={product.rating}
                image={product.thumbnail || product.images?.[0]}
                inStock={product.stock > 0}
                product={product}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Fade-in animation */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
};

export default ProductRow;
