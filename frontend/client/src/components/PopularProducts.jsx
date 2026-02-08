"use client";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import Link from "next/link";
import { useContext } from "react";
import ProductSlider from "./ProductSlider";

const PopularProducts = () => {
  const context = useContext(MyContext);
  const flavor = context?.flavor || FLAVORS.creamy;

  return (
    <section
      className="relative py-10 sm:py-14 md:py-18 overflow-hidden transition-all duration-500"
      style={{ background: flavor.gradient }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-16 -right-24 h-64 w-64 rounded-full blur-3xl opacity-30"
          style={{ background: flavor.color }}
        />
        <div
          className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full blur-3xl opacity-25"
          style={{ background: flavor.badge }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 z-10">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 sm:gap-8 mb-6 sm:mb-10">
          <div className="max-w-lg space-y-3">
            <span
              className="inline-flex items-center gap-2 text-[12px] tracking-[0.24em] uppercase font-bold px-3 py-1 rounded-full shadow-sm transition-all duration-300"
              style={{
                color: flavor.color,
                backgroundColor: flavor.glass,
              }}
            >
              <svg
                className="inline-block -mt-0.5"
                width="18"
                height="18"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill={flavor.color}
                  opacity=".15"
                />
                <path
                  d="M12 7v5l3 3"
                  stroke={flavor.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Trending Now
            </span>

            <h2 className="text-[26px] sm:text-[34px] md:text-[42px] font-extrabold text-gray-900 leading-tight tracking-tight drop-shadow-sm">
              Popular Products
            </h2>

            <p className="text-[14px] sm:text-[17px] text-gray-600 font-medium">
              Curated best-sellers with clean ingredients and bold flavor.
            </p>
          </div>

          <Link
            href="/products"
            className="self-start md:self-auto px-7 py-2.5 rounded-full border-2 font-semibold transition-all duration-300 hover:text-white focus:ring-2"
            style={{
              borderColor: flavor.color,
              color: flavor.color,
              backgroundColor: flavor.cardBg,
              boxShadow: `0 4px 16px 0 ${flavor.color}15`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = flavor.color;
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = flavor.cardBg;
              e.currentTarget.style.color = flavor.color;
            }}
          >
            View All
          </Link>
        </div>

        {/* SLIDER */}
        <div
          className="relative animate-fadeUp rounded-3xl p-3 sm:p-4 md:p-5"
          style={{
            backgroundColor: flavor.cardBg,
            border: `1px solid ${flavor.color}1f`,
            boxShadow: `0 12px 30px ${flavor.color}14`,
          }}
        >
          <ProductSlider isFeatured={true} limit={10} />
        </div>
      </div>
    </section>
  );
};

export default PopularProducts;
