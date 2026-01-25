"use client";

import { fetchDataFromApi } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/navigation";

const CatSlider = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetchDataFromApi("/api/categories");
        if (response.success && response.data) {
          // Only show parent categories (no parent or parent is null)
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
      <div className="catSlider py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-4 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="min-w-[150px] h-[140px] bg-gray-200 animate-pulse rounded-xl"
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
    <section className="catSlider py-8 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Shop by Category</h2>
          <Link
            href="/products"
            className="text-[#c1591c] font-semibold text-sm hover:underline"
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
          className="!pb-2"
        >
          {categories.map((category) => (
            <SwiperSlide key={category._id}>
              <Link
                href={`/products?category=${category.slug}`}
                className="group block bg-white rounded-2xl p-4 text-center shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-[#c1591c]/20"
              >
                {category.image ? (
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full overflow-hidden bg-gray-100">
                    <img
                      src={getImageUrl(category.image)}
                      alt={category.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="text-4xl mb-3">{category.icon || "🥜"}</div>
                )}
                <p className="text-sm font-semibold text-gray-700 group-hover:text-[#c1591c] transition-colors">
                  {category.name}
                </p>
              </Link>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
};

export default CatSlider;
