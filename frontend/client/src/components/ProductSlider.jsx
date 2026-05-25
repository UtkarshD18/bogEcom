"use client";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import {
  fetchDataFromApi,
  PUBLIC_SECTION_REQUEST_TIMEOUT_MS,
} from "@/utils/api";
import { useContext, useEffect, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { Autoplay, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import ProductItem from "./ProductItem";

import "swiper/css";
import "swiper/css/navigation";

const clampSlides = (target, total) => {
  if (!total || total <= 0) return 1;
  return Math.max(1, Math.min(target, total));
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundUpPercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.ceil(parsed);
};

const isNewArrivalProduct = (product) =>
  Boolean(product?.newArrival ?? product?.isNewArrival);

const prioritizeNewArrivals = (products = []) =>
  [...products].sort((a, b) => {
    const aNewArrival = isNewArrivalProduct(a);
    const bNewArrival = isNewArrivalProduct(b);
    if (aNewArrival === bNewArrival) return 0;
    return aNewArrival ? -1 : 1;
  });

const resolveComboImage = (combo) =>
  combo?.thumbnail ||
  combo?.comboThumbnail ||
  combo?.image ||
  combo?.images?.[0] ||
  combo?.comboImages?.[0] ||
  "/product_1.webp";

const toComboCardPayload = (combo) => {
  const price = toNumber(
    combo?.price ?? combo?.comboPrice ?? combo?.finalPrice,
    0,
  );
  const originalPrice = toNumber(
    combo?.originalPrice ?? combo?.originalTotal ?? combo?.mrp ?? price,
    price,
  );
  const computedDiscount =
    originalPrice > price && originalPrice > 0
      ? roundUpPercent(((originalPrice - price) / originalPrice) * 100)
      : 0;

  return {
    ...combo,
    _id: combo?._id,
    itemType: "combo",
    brand: combo?.brand || "Buy One Gram",
    price,
    originalPrice,
    discount:
      roundUpPercent(combo?.discountPercentage) ||
      roundUpPercent(computedDiscount),
    rating: toNumber(combo?.adminStarRating ?? combo?.rating, 0),
    reviewCount: toNumber(combo?.reviewCount, 0),
    images: [resolveComboImage(combo)].filter(Boolean),
    image: resolveComboImage(combo),
    stock: toNumber(combo?.availableStock ?? combo?.stockQuantity, 0),
    stock_quantity: toNumber(combo?.availableStock ?? combo?.stockQuantity, 0),
  };
};

const normalizeProductCards = (items = []) =>
  prioritizeNewArrivals(
    Array.isArray(items)
      ? items.filter(
          (product) =>
            product?.isExclusive !== true &&
            String(product?.itemType || "product") !== "combo",
        )
      : [],
  );

const normalizeAvailableCombos = (items = []) =>
  (Array.isArray(items) ? items : []).filter((combo) => {
    const status = String(combo?.status || "")
      .trim()
      .toLowerCase();
    const source = String(combo?.source || "")
      .trim()
      .toLowerCase();
    const comboType = String(combo?.comboType || "")
      .trim()
      .toLowerCase();
    const hasItems = Array.isArray(combo?.items) && combo.items.length > 0;

    if (combo?.isActive === false || combo?.isVisible === false) return false;
    if (status && status !== "active") return false;
    if (source === "ai" || comboType === "ai_suggested") return false;
    if (!hasItems) return false;

    const available = Number(
      combo?.availableStock ?? combo?.availability?.available ?? combo?.stockQuantity ?? 0,
    );
    return Number.isFinite(available) ? available > 0 : true;
  });

const rankCombos = (items = []) =>
  [...normalizeAvailableCombos(items)].sort((a, b) => {
    const bestSellerWeight =
      Number(Boolean(b?.isBestSeller)) - Number(Boolean(a?.isBestSeller));
    if (bestSellerWeight !== 0) return bestSellerWeight;
    const priorityDelta = toNumber(b?.priority, 0) - toNumber(a?.priority, 0);
    if (priorityDelta !== 0) return priorityDelta;
    return (
      new Date(b?.createdAt || 0).getTime() -
      new Date(a?.createdAt || 0).getTime()
    );
  });

const buildSliderItems = ({
  fetchedProducts = [],
  fetchedCombos = [],
  includeCombos = false,
  productLimit = 5,
  comboLimit = 2,
}) => {
  const prioritizedProducts = normalizeProductCards(fetchedProducts);
  if (!includeCombos) {
    return prioritizedProducts;
  }

  const topProducts = prioritizedProducts.slice(
    0,
    Math.max(Number(productLimit) || 0, 0),
  );
  const topCombos = rankCombos(fetchedCombos)
    .slice(0, Math.max(Number(comboLimit) || 0, 0))
    .map(toComboCardPayload);

  return [...topProducts, ...topCombos];
};

const ProductSlider = ({
  title,
  categorySlug,
  limit = 10,
  includeCombos = false,
  productLimit = 5,
  comboLimit = 2,
  sortBy = "createdAt",
  order = "desc",
  separateVariants = false,
  initialProducts = [],
  initialCombos = [],
}) => {
  const [products, setProducts] = useState(() =>
    buildSliderItems({
      fetchedProducts: initialProducts,
      fetchedCombos: initialCombos,
      includeCombos,
      productLimit,
      comboLimit,
    }),
  );
  const [loading, setLoading] = useState(
    initialProducts.length === 0 && initialCombos.length === 0,
  );
  const context = useContext(MyContext);
  const flavor = context?.flavor || FLAVORS.creamy;
  const prevRef = useRef(null);
  const nextRef = useRef(null);
  const [swiperReady, setSwiperReady] = useState(false);
  const [hoverPrev, setHoverPrev] = useState(false);
  const [hoverNext, setHoverNext] = useState(false);

  useEffect(() => {
    if (initialProducts.length > 0 || initialCombos.length > 0) {
      setProducts(
        buildSliderItems({
          fetchedProducts: initialProducts,
          fetchedCombos: initialCombos,
          includeCombos,
          productLimit,
          comboLimit,
        }),
      );
      setLoading(false);
      return undefined;
    }

    const fetchProducts = async () => {
      try {
        const params = [];
        if (categorySlug)
          params.push(`category=${encodeURIComponent(categorySlug)}`);
        params.push(
          `sortBy=${encodeURIComponent(String(sortBy || "createdAt"))}`,
        );
        params.push(`order=${encodeURIComponent(String(order || "desc"))}`);
        if (separateVariants) {
          params.push("separateVariants=true");
        }
        params.push("includeCombos=false");
        params.push(`limit=${encodeURIComponent(String(limit || 10))}`);

        const productsUrl = `/api/products?${params.join("&")}`;
        const productsRequest = fetchDataFromApi(productsUrl, {
          timeoutMs: PUBLIC_SECTION_REQUEST_TIMEOUT_MS,
        });
        const combosRequest = includeCombos
          ? fetchDataFromApi(
              `/api/combos?sort=priority&limit=${Math.max(comboLimit * 5, 10)}`,
              {
                timeoutMs: PUBLIC_SECTION_REQUEST_TIMEOUT_MS,
              },
            )
          : Promise.resolve(null);

        const [productResult, combosResult] = await Promise.allSettled([
          productsRequest,
          combosRequest,
        ]);
        const productResponse =
          productResult.status === "fulfilled" ? productResult.value : null;
        const combosResponse =
          combosResult.status === "fulfilled" ? combosResult.value : null;
        const fetchedProducts =
          productResponse?.success && Array.isArray(productResponse?.data)
            ? productResponse.data
            : [];
        const comboItemsRaw =
          combosResponse?.success && Array.isArray(combosResponse?.data?.items)
            ? combosResponse.data.items
            : [];

        setProducts(
          buildSliderItems({
            fetchedProducts,
            fetchedCombos: comboItemsRaw,
            includeCombos,
            productLimit,
            comboLimit,
          }),
        );
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [
    categorySlug,
    limit,
    includeCombos,
    productLimit,
    comboLimit,
    sortBy,
    order,
    separateVariants,
    initialProducts,
    initialCombos,
  ]);

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

  const totalProducts = products.length;
  const useStaticGrid = totalProducts <= 4;
  const navBtnBase =
    "absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer";
  const responsiveSlides = {
    480: { slidesPerView: Math.min(2.2, totalProducts) },
    640: { slidesPerView: clampSlides(3, totalProducts) },
    768: { slidesPerView: clampSlides(4, totalProducts) },
    1024: { slidesPerView: clampSlides(5, totalProducts) },
  };

  if (useStaticGrid) {
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

        <button
          ref={prevRef}
          className={navBtnBase + " left-1 sm:left-0 md:-left-4"}
          style={{
            backgroundColor: hoverPrev ? flavor.color : "white",
            color: hoverPrev ? "white" : flavor.color,
            borderWidth: "2px",
            borderStyle: "solid",
            borderColor: hoverPrev ? flavor.color : flavor.glass,
            boxShadow: hoverPrev
              ? `0 4px 15px ${flavor.glass}`
              : "0 2px 8px rgba(0,0,0,0.08)",
            transform: `translateY(-50%) scale(${hoverPrev ? 1.1 : 1})`,
          }}
          onMouseEnter={() => setHoverPrev(true)}
          onMouseLeave={() => setHoverPrev(false)}
          aria-label="Previous"
        >
          <FiChevronLeft size={18} />
        </button>
        <button
          ref={nextRef}
          className={navBtnBase + " right-1 sm:right-0 md:-right-4"}
          style={{
            backgroundColor: hoverNext ? flavor.color : "white",
            color: hoverNext ? "white" : flavor.color,
            borderWidth: "2px",
            borderStyle: "solid",
            borderColor: hoverNext ? flavor.color : flavor.glass,
            boxShadow: hoverNext
              ? `0 4px 15px ${flavor.glass}`
              : "0 2px 8px rgba(0,0,0,0.08)",
            transform: `translateY(-50%) scale(${hoverNext ? 1.1 : 1})`,
          }}
          onMouseEnter={() => setHoverNext(true)}
          onMouseLeave={() => setHoverNext(false)}
          aria-label="Next"
        >
          <FiChevronRight size={18} />
        </button>

        <div className="flex gap-4 overflow-x-auto py-5 snap-x snap-mandatory scroll-smooth"> 
          {products.map((product) => (
            <div key={product._id} className="flex-shrink-0 w-[260px]">
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
                compactListing
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

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
        className={navBtnBase + " left-1 sm:left-0 md:-left-4"}
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
        className={navBtnBase + " right-1 sm:right-0 md:-right-4"}
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
        spaceBetween={12}
        slidesPerView={Math.min(2.05, totalProducts)}
        navigation={{
          prevEl: prevRef.current,
          nextEl: nextRef.current,
        }}
        onBeforeInit={(swiper) => {
          swiper.params.navigation.prevEl = prevRef.current;
          swiper.params.navigation.nextEl = nextRef.current;
        }}
        onSwiper={() => setSwiperReady(true)}
        autoplay={{ delay: 7000, disableOnInteraction: true, pauseOnMouseEnter: true }}
        breakpoints={responsiveSlides}
        className="px-0.5 sm:px-1!"
      >
        {products.map((product) => (
          <SwiperSlide key={product._id} className="h-auto!">
            <div className="h-full">
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
                compactListing
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default ProductSlider;
