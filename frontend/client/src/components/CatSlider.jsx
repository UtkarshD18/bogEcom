"use client";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { fetchDataFromApi } from "@/utils/api";
import { getCategoryImageUrl } from "@/utils/imageUtils";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useContext, useEffect, useRef, useState } from "react";
import { FiArrowRight, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import PopularProducts from "./PopularProducts";

import "swiper/css";
import "swiper/css/navigation";

const CatSlider = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const context = useContext(MyContext);
  const flavor = context?.flavor || FLAVORS.creamy;
  const prevRef = useRef(null);
  const nextRef = useRef(null);
  const [hoverPrev, setHoverPrev] = useState(false);
  const [hoverNext, setHoverNext] = useState(false);

  const resolveComboLink = (category) => {
    const name = String(category?.name || "").toLowerCase();
    const slug = String(category?.slug || "").toLowerCase();
    const comboKeys = [
      "combo-packs",
      "combo-pack",
      "combo-deals",
      "combo-deal",
      "combos",
    ];
    const isCombo =
      comboKeys.includes(slug) ||
      name.includes("combo pack") ||
      name.includes("combo packs") ||
      name.includes("combo deal") ||
      name.includes("combo deals");

    return isCombo ? "/combo-deals" : `/products?category=${category?._id}`;
  };

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
      <div className="py-12 bg-gray-50/50">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="h-40 w-40 animate-pulse rounded-3xl bg-gray-200"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (categories.length === 0) return null;

  const navBtnBase =
    "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full transition-all duration-300 md:h-11 md:w-11";
  const useCenteredGrid = categories.length <= 3;

  const renderCategoryCard = (
    category,
    index,
    { compact = false } = {},
  ) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      whileInView={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay: index * 0.06 }}
      viewport={{ once: true }}
      className="h-full"
    >
      <Link
        href={resolveComboLink(category)}
        className={`group flex h-full w-full flex-col items-center justify-center border border-white/75 text-center shadow-[0_16px_42px_rgba(90,58,34,0.08)] transition-all duration-500 hover:-translate-y-2 hover:border-primary/25 hover:shadow-[0_24px_56px_rgba(90,58,34,0.14)] ${
          compact
            ? "min-h-[176px] rounded-[1.6rem] px-4 py-5"
            : "min-h-[230px] rounded-[2rem] p-6"
        }`}
        style={{
          background: `linear-gradient(180deg, rgba(255,255,255,0.99) 0%, ${flavor.cardBg || "#FCF8F6"} 100%)`,
        }}
      >
        <div
          className={`relative mb-5 flex items-center justify-center overflow-hidden border border-white/80 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_28px_rgba(90,58,34,0.08)] ring-8 ring-transparent transition-transform duration-500 group-hover:scale-105 group-hover:ring-primary/15 ${
            compact
              ? "h-20 w-20 rounded-[1.35rem]"
              : "h-24 w-24 rounded-[1.75rem] sm:h-28 sm:w-28"
          }`}
        >
          {category.image ? (
            <Image
              src={getCategoryImageUrl(category.image)}
              alt={category.name}
              fill
              sizes="(max-width: 640px) 80px, 112px"
              className="object-cover p-2"
            />
          ) : (
            <span className="text-sm font-black tracking-[0.28em] text-primary/75">
              PB
            </span>
          )}
        </div>

        <h3
          className={`text-slate-800 transition-colors group-hover:text-primary ${
            compact
              ? "min-h-[38px] text-[11px] font-black uppercase tracking-[0.16em]"
              : "min-h-[42px] text-[13px] font-black uppercase tracking-[0.18em]"
          }`}
        >
          {category.name}
        </h3>
      </Link>
    </motion.div>
  );

  return (
    <div>
      <PopularProducts />

      <section
        className="relative overflow-hidden border-y border-black/[0.03] py-12 sm:py-16"
        style={{
          background:
            "linear-gradient(180deg, #ffffff 0%, #fffdf9 58%, #f8f3eb 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-0 top-0 h-24 w-full"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, transparent 100%)",
            }}
          />
          <div
            className="absolute -right-24 top-16 h-56 w-56 rounded-full blur-[95px]"
            style={{
              background: "var(--flavor-glass, rgba(90,58,46,0.12))",
            }}
          />
          <div
            className="absolute -left-16 bottom-8 h-48 w-48 rounded-full blur-[90px]"
            style={{
              background: "rgba(255, 244, 224, 0.72)",
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative z-10 mx-auto max-w-7xl px-4"
        >
          <div className="mb-8 flex items-center justify-between gap-3">
            <h2
              className="text-[1.55rem] font-extrabold tracking-tight transition-colors duration-500 sm:text-3xl"
              style={{ color: "var(--color-primary)" }}
            >
              Shop by Category
            </h2>

            <Link
              href="/products"
              className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-lg shadow-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95 sm:px-7 sm:py-3.5 sm:text-sm"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary) 0%, var(--flavor-hover) 100%)",
              }}
            >
              View All
              <FiArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div
            className="-mx-4 overflow-x-auto px-4 pb-3 sm:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="flex w-max snap-x snap-mandatory gap-4 pr-4">
              {categories.map((category, index) => (
                <div
                  key={category._id}
                  className="w-[182px] shrink-0 snap-start"
                >
                  {renderCategoryCard(category, index, { compact: true })}
                </div>
              ))}
            </div>
          </div>

          {useCenteredGrid ? (
            <div className="mx-auto hidden max-w-5xl items-stretch justify-center gap-4 sm:flex md:gap-6 lg:max-w-6xl lg:gap-8">
              {categories.map((category, index) => (
                <div
                  key={category._id}
                  className="min-w-0 flex-1 sm:max-w-[190px] md:w-[220px] md:max-w-[220px] md:flex-none lg:w-[250px] lg:max-w-[250px] xl:w-[290px] xl:max-w-[290px]"
                >
                  {renderCategoryCard(category, index)}
                </div>
              ))}
            </div>
          ) : (
            <div className="relative mx-auto hidden max-w-6xl overflow-visible px-10 sm:block md:px-14">
              <button
                ref={prevRef}
                className={`${navBtnBase} left-0`}
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
                className={`${navBtnBase} right-0`}
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
                spaceBetween={18}
                slidesPerView={"auto"}
                centerInsufficientSlides={true}
                navigation={{
                  prevEl: prevRef.current,
                  nextEl: nextRef.current,
                }}
                onBeforeInit={(swiper) => {
                  swiper.params.navigation.prevEl = prevRef.current;
                  swiper.params.navigation.nextEl = nextRef.current;
                }}
                modules={[Navigation]}
                breakpoints={{
                  480: { spaceBetween: 14 },
                  640: { spaceBetween: 18 },
                  768: { spaceBetween: 20 },
                  1024: { spaceBetween: 24 },
                  1280: { spaceBetween: 28 },
                }}
                className="!overflow-visible !pb-2"
              >
                {categories.map((category, index) => (
                  <SwiperSlide
                    key={category._id}
                    className="!h-auto py-1 !w-[220px] sm:!w-[240px] md:!w-[260px] lg:!w-[300px]"
                  >
                    {renderCategoryCard(category, index)}
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          )}
        </motion.div>
      </section>
    </div>
  );
};

export default CatSlider;
