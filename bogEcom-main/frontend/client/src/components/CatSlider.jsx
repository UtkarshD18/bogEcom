"use client";
import FlavorSwitcherBar from "./FlavorSwitcherBar";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { fetchDataFromApi } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useContext, useEffect, useState } from "react";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/navigation";

const CatSlider = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const context = useContext(MyContext);
  const flavor = context?.flavor || FLAVORS.creamy;

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetchDataFromApi("/api/categories");
        if (response.success && response.data) {
          const parentCategories = response.data.filter((cat) => !cat.parent);
          setCategories(parentCategories);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  if (loading) {
    return (
      <div
        className="catSlider py-6 transition-all duration-500"
        style={{ background: flavor.gradient }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-4 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="min-w-37.5 h-35 animate-pulse rounded-xl"
                style={{ backgroundColor: flavor.glass }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <div>
      <FlavorSwitcherBar />
      <section
        className="catSlider py-4 sm:py-6 md:py-8 transition-all duration-500"
        style={{ background: flavor.gradient }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2
              className="text-lg sm:text-xl md:text-2xl font-bold transition-colors duration-300"
              style={{ color: flavor.color }}
            >
              Shop by Category
            </h2>
            <Link
              href="/products"
              className="font-semibold text-sm transition-colors duration-300 hover:underline"
              style={{ color: flavor.color }}
            >
              View All
            </Link>
          </div>
          <Swiper
            spaceBetween={16}
            slidesPerView={2}
            navigation
            modules={[Navigation]}
            breakpoints={{
              480: { slidesPerView: 3 },
              640: { slidesPerView: 4 },
              768: { slidesPerView: 5 },
              1024: { slidesPerView: 6 },
            }}
            className="pb-2!"
          >
            {categories.map((category) => (
              <SwiperSlide key={category._id}>
                <Link
                  href={`/products?category=${category._id}`}
                  className="group block rounded-2xl p-4 text-center shadow-sm hover:shadow-lg transition-all duration-300 border"
                  style={{
                    backgroundColor: flavor.cardBg,
                    borderColor: `${flavor.color}20`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${flavor.color}40`;
                    e.currentTarget.style.boxShadow = `0 8px 24px ${flavor.color}15`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = `${flavor.color}20`;
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  {category.image ? (
                    <div
                      className="w-16 h-16 mx-auto mb-3 rounded-full overflow-hidden transition-all duration-300"
                      style={{ backgroundColor: flavor.glass }}
                    >
                      <img
                        src={getImageUrl(category.image)}
                        alt={category.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="text-4xl mb-3">{category.icon || "🥜"}</div>
                  )}
                  <p
                    className="text-sm font-semibold text-gray-700 transition-colors duration-300"
                    style={{}}
                  >
                    <span className="group-hover:hidden">{category.name}</span>
                    <span
                      className="hidden group-hover:inline"
                      style={{ color: flavor.color }}
                    >
                      {category.name}
                    </span>
                  </p>
                </Link>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </section>
    </div>
  );
};

export default CatSlider;
