"use client";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { fetchDataFromApi } from "@/utils/api";
import { useContext, useEffect, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { Autoplay, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import ProductItem from "./ProductItem";

import "swiper/css";
import "swiper/css/navigation";

const ProductSlider = ({ title, categorySlug, isFeatured, limit = 10 }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const context = useContext(MyContext);
  const flavor = context?.flavor || FLAVORS.creamy;
  const prevRef = useRef(null);
  const nextRef = useRef(null);
  const [swiperReady, setSwiperReady] = useState(false);
  const [hoverPrev, setHoverPrev] = useState(false);
  const [hoverNext, setHoverNext] = useState(false);

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
          const safeProducts = Array.isArray(response.data)
            ? response.data.filter((product) => product?.isExclusive !== true)
            : [];
          setProducts(safeProducts);
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
            className="min-w-50 h-75 animate-pulse rounded-lg"
            style={{ backgroundColor: flavor.glass }}
          />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  const navBtnBase = "absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer";

  return (
    <div className="productSlider py-5 relative">
      {title && (
        <h3
          className="text-xl font-bold mb-4 transition-colors duration-300"
          style={{ color: flavor.color }}
        >
          {title}
        </h3>
      )}

      {/* Custom Navigation Arrows — always visible, flavor-colored on hover */}
      <button
        ref={prevRef}
        className={navBtnBase + " left-0 md:-left-4"}
        style={{
          backgroundColor: hoverPrev ? flavor.color : "white",
          color: hoverPrev ? "white" : flavor.color,
          borderWidth: "2px",
          borderStyle: "solid",
          borderColor: hoverPrev ? flavor.color : flavor.glass,
          boxShadow: hoverPrev
            ? `0 4px 15px ${flavor.glass}`
            : "0 2px 8px rgba(0,0,0,0.08)",
          transform: `translateY(-50%) scale(${hoverPrev ? 1.15 : 1})`,
        }}
        onMouseEnter={() => setHoverPrev(true)}
        onMouseLeave={() => setHoverPrev(false)}
        aria-label="Previous"
      >
        <FiChevronLeft size={18} />
      </button>
      <button
        ref={nextRef}
        className={navBtnBase + " right-0 md:-right-4"}
        style={{
          backgroundColor: hoverNext ? flavor.color : "white",
          color: hoverNext ? "white" : flavor.color,
          borderWidth: "2px",
          borderStyle: "solid",
          borderColor: hoverNext ? flavor.color : flavor.glass,
          boxShadow: hoverNext
            ? `0 4px 15px ${flavor.glass}`
            : "0 2px 8px rgba(0,0,0,0.08)",
          transform: `translateY(-50%) scale(${hoverNext ? 1.15 : 1})`,
        }}
        onMouseEnter={() => setHoverNext(true)}
        onMouseLeave={() => setHoverNext(false)}
        aria-label="Next"
      >
        <FiChevronRight size={18} />
      </button>

      <Swiper
        modules={[Navigation, Autoplay]}
        spaceBetween={16}
        slidesPerView={2}
        navigation={{
          prevEl: prevRef.current,
          nextEl: nextRef.current,
        }}
        onBeforeInit={(swiper) => {
          swiper.params.navigation.prevEl = prevRef.current;
          swiper.params.navigation.nextEl = nextRef.current;
        }}
        onSwiper={() => setSwiperReady(true)}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        breakpoints={{
          480: { slidesPerView: 2 },
          640: { slidesPerView: 3 },
          768: { slidesPerView: 4 },
          1024: { slidesPerView: 5 },
        }}
        className="!px-1"
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
              product={product}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default ProductSlider;
