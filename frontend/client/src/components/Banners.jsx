"use client";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { fetchDataFromApi } from "@/utils/api";
import { getBannerImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useContext, useEffect, useState } from "react";

const Banners = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const context = useContext(MyContext);
  const flavor = context?.flavor || FLAVORS.creamy;

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const response = await fetchDataFromApi("/api/banners");
        if (response.success && response.data) {
          setBanners(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch banners:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  if (loading) {
    return (
      <section
        className="banners py-6 transition-all duration-500"
        style={{ background: flavor.gradient }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-xl"
                style={{ backgroundColor: flavor.glass }}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (banners.length === 0) {
    return null;
  }

  return (
    <section
      className="banners py-8 transition-all duration-500"
      style={{ background: flavor.gradient }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banners.map((banner) => {
            // Route Subscribe & Save banner to membership page
            const bannerLink =
              banner.title?.includes("Subscribe") ||
              banner.title?.includes("Save")
                ? "/membership"
                : banner.link || "/products";

            return (
              <Link
                key={banner._id}
                href={bannerLink}
                className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Banner Image */}
                <div className="relative h-48 md:h-56">
                  <img
                    src={getBannerImageUrl(banner.image)}
                    alt={banner.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />

                  {/* Content */}
                  <div className="absolute inset-0 p-6 flex flex-col justify-center">
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                      {banner.title}
                    </h3>
                    {banner.subtitle && (
                      <p className="text-white/90 text-sm md:text-base mb-4 max-w-xs">
                        {banner.subtitle}
                      </p>
                    )}
                    <span className="inline-flex items-center gap-2 text-white font-semibold text-sm group-hover:gap-3 transition-all">
                      {banner.buttonText || "Shop Now"}
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Banners;
