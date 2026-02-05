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
      className="relative py-8 sm:py-12 md:py-16 overflow-hidden transition-all duration-500"
      style={{ background: flavor.gradient }}
    >
      <div className="relative max-w-7xl mx-auto px-4 z-10">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 sm:gap-8 mb-6 sm:mb-12">
          <div className="max-w-lg space-y-3">
            <span
              className="inline-block text-[13px] tracking-widest uppercase font-bold px-3 py-1 rounded-full shadow-sm transition-all duration-300"
              style={{
                color: flavor.color,
                backgroundColor: flavor.glass,
              }}
            >
              <svg
                className="inline-block mr-1 -mt-1"
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

            <h2 className="text-[24px] sm:text-[32px] md:text-[40px] font-extrabold text-gray-900 leading-tight tracking-tight drop-shadow-sm">
              Popular Products
            </h2>

            <p className="text-[14px] sm:text-[17px] text-gray-600 font-medium">
              Discover our most loved peanut butter picks, handpicked for your
              healthy lifestyle.
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
        <div className="relative animate-fadeUp">
          <ProductSlider isFeatured={true} limit={10} />
        </div>
      </div>
    </section>
  );
};

export default PopularProducts;
