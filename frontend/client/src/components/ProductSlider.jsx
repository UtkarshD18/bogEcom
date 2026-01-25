"use client";

import { fetchDataFromApi } from "@/utils/api";
import { useEffect, useState } from "react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import ProductItem from "./ProductItem";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

const ProductSlider = ({ title, categorySlug, isFeatured, limit = 10 }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        let url = "/api/products?";
        const params = [];

        if (categorySlug) params.push(`category=${categorySlug}`);
        if (isFeatured) params.push("isFeatured=true");
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
  }, [categorySlug, isFeatured, limit]);

  if (loading) {
    return (
      <div className="flex gap-4 overflow-hidden py-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="min-w-[200px] h-[300px] bg-gray-200 animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="productSlider py-5">
      {title && (
        <h3 className="text-xl font-bold text-gray-800 mb-4">{title}</h3>
      )}
      <Swiper
        modules={[Navigation, Pagination, Autoplay]}
        spaceBetween={16}
        slidesPerView={2}
        navigation
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        breakpoints={{
          480: { slidesPerView: 2 },
          640: { slidesPerView: 3 },
          768: { slidesPerView: 4 },
          1024: { slidesPerView: 5 },
        }}
        className="!pb-10"
      >
        {products.map((product) => (
          <SwiperSlide key={product._id}>
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
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default ProductSlider;
