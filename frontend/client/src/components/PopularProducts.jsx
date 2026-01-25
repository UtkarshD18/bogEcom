"use client";

import Link from "next/link";
import ProductSlider from "./ProductSlider";

const PopularProducts = () => {
  return (
    <section className="relative py-16 overflow-hidden bg-gradient-to-br from-[#fff7ed] via-[#f3f8ff] to-[#e9f7f2]">
      {/* MODERN BACKGROUND DECOR */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-gradient-to-br from-[#c1591c]/20 to-[#02b290]/10 rounded-full blur-3xl z-0" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-2xl z-0" />

      <div className="relative max-w-7xl mx-auto px-4 z-10">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-12">
          <div className="max-w-lg space-y-3">
            <span className="inline-block text-[13px] tracking-widest uppercase text-[#02b290] font-bold bg-[#e6faf4] px-3 py-1 rounded-full shadow-sm">
              <svg
                className="inline-block mr-1 -mt-1"
                width="18"
                height="18"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" fill="#02b290" opacity=".15" />
                <path
                  d="M12 7v5l3 3"
                  stroke="#02b290"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Trending Now
            </span>

            <h2 className="text-[32px] md:text-[40px] font-extrabold text-gray-900 leading-tight tracking-tight drop-shadow-sm">
              Popular Products
            </h2>

            <p className="text-[17px] text-gray-600 font-medium">
              Discover our most loved peanut butter picks, handpicked for your
              healthy lifestyle.
            </p>
          </div>

          <Link
            href="/products"
            className="self-start md:self-auto px-7 py-2.5 rounded-full border-2 border-[#c1591c] text-[#c1591c] font-semibold bg-white shadow-md hover:bg-[#c1591c] hover:text-white transition-all duration-200 focus:ring-2 focus:ring-[#c1591c]/30"
            style={{ boxShadow: "0 4px 16px 0 rgba(193,89,28,0.07)" }}
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
