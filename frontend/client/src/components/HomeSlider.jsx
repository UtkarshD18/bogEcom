"use client";

import SeoImage from "@/components/SeoImage";
import { useSettings } from "@/context/SettingsContext";
import { useProducts } from "@/context/ProductContext";
import {
  getHeroImageUrl,
  getHeroMobileImageUrl,
  isCloudinaryUrl,
} from "@/utils/imageUtils";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiArrowUpRight } from "react-icons/fi";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/pagination";

import { Autoplay, EffectFade, Pagination } from "swiper/modules";

const fallbackSlides = [
  {
    image: "/slide_1.jpg",
    title: "Pure Nutrition",
    subtitle: "100% Natural Peanut Butter",
    cta: "Shop Now",
    link: "/products",
  },
  {
    image: "/slide_2.jpg",
    title: "Fuel Your Fitness",
    subtitle: "High Protein | No Sugar",
    cta: "Explore",
    link: "/products?category=protein-peanut-butter",
  },
  {
    image: "/slide_3.jpg",
    title: "Clean Eating",
    subtitle: "No Palm Oil | No Preservatives",
    cta: "Discover",
    link: "/products?category=organic-natural",
  },
];

const formatSlides = (slides = []) =>
  slides.map((slide) => ({
    image: slide.image,
    mobileImage: slide.mobileImage || slide.image,
    title: slide.title,
    subtitle: slide.subtitle || slide.description,
    cta: slide.buttonText || "Shop Now",
    link: slide.buttonLink || "/products",
    backgroundColor: slide.backgroundColor || "#f5f5f5",
  }));

const HERO_TRUST_DEFAULTS = [
  "100% Natural",
  "No Palm Oil",
  "High Protein",
  "Fast Moving Picks",
];

const HERO_TRUST_SETTING_KEYS = [
  "homepage_trust_1_text",
  "homepage_trust_2_text",
  "homepage_trust_3_text",
  "homepage_trust_4_text",
];

const HERO_STATS = [
  { label: "Best Seller", value: "Top Rated" },
  { label: "Clean Label", value: "No Nasties" },
  { label: "Everyday Use", value: "Snack + Fitness" },
];

const HomeSlider = ({ initialSlides = [] }) => {
  const { homeSlides = [], fetchHomeSlides } = useProducts();
  const { settings } = useSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const displaySlides = useMemo(() => {
    if (homeSlides?.length > 0) {
      return formatSlides(homeSlides);
    }

    if (initialSlides.length > 0) {
      return formatSlides(initialSlides);
    }

    return fallbackSlides;
  }, [homeSlides, initialSlides]);

  const motionEnabled = !prefersReducedMotion;
  const heroTrustItems = useMemo(
    () =>
      HERO_TRUST_SETTING_KEYS.map(
        (key, index) =>
          String(settings?.[key] ?? "").trim() || HERO_TRUST_DEFAULTS[index],
      ),
    [settings],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => {
      setPrefersReducedMotion(motionQuery.matches);
    };

    syncMotionPreference();

    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", syncMotionPreference);
      return () =>
        motionQuery.removeEventListener("change", syncMotionPreference);
    }

    motionQuery.addListener(syncMotionPreference);
    return () => motionQuery.removeListener(syncMotionPreference);
  }, []);

  useEffect(() => {
    if (!homeSlides?.length && !initialSlides?.length) {
      fetchHomeSlides();
    }
  }, [fetchHomeSlides, homeSlides?.length, initialSlides?.length]);

  return (
    <section className="relative overflow-hidden rounded-b-[2rem] bg-[#1a120d] shadow-[0_40px_120px_rgba(26,18,13,0.16)] md:rounded-b-[3rem]">
      <Swiper
        speed={motionEnabled ? 850 : 500}
        spaceBetween={0}
        slidesPerView={1}
        loop={true}
        effect="fade"
        fadeEffect={{ crossFade: true }}
        autoplay={
          motionEnabled
            ? {
                delay: 5600,
                disableOnInteraction: false,
              }
            : false
        }
        pagination={{
          clickable: true,
          bulletClass: "swiper-pagination-bullet home-slide-bullet",
          bulletActiveClass:
            "swiper-pagination-bullet-active home-slide-bullet-active",
        }}
        modules={[Autoplay, Pagination, EffectFade]}
        className="h-[62vh] min-h-[34rem] w-full md:h-[88vh] md:min-h-[46rem] homeSlider"
        onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
      >
        {displaySlides.map((slide, index) => (
          <SwiperSlide
            key={`${slide.title || "slide"}-${index}`}
            className="relative h-full w-full"
          >
            <div className="relative h-full w-full overflow-hidden">
              <motion.div
                className="absolute inset-0"
                initial={false}
                animate={{ scale: 1.02 }}
                transition={
                  motionEnabled
                    ? { duration: 5.6, ease: "easeOut" }
                    : { duration: 0.18 }
                }
              >
                {(() => {
                  const desktopSrc = getHeroImageUrl(slide.image);
                  const mobileSrc = getHeroMobileImageUrl(
                    slide.mobileImage || slide.image,
                  );
                  const desktopCloudinary = isCloudinaryUrl(desktopSrc);
                  const mobileCloudinary = isCloudinaryUrl(mobileSrc);

                  return (
                    <>
                      <div
                        className="absolute inset-0 hidden md:block"
                        style={{
                          backgroundColor: slide.backgroundColor || "#f5f5f5",
                        }}
                      >
                        <SeoImage
                          src={desktopSrc}
                          fallbackAlt={slide.title}
                          fill
                          priority={index === 0}
                          sizes="100vw"
                          fetchPriority={index === 0 ? "high" : undefined}
                          loading={index === 0 ? "eager" : "lazy"}
                          unoptimized={desktopCloudinary}
                          className="object-cover"
                        />
                      </div>
                      <div
                        className="absolute inset-0 md:hidden"
                        style={{
                          backgroundColor: slide.backgroundColor || "#f5f5f5",
                        }}
                      >
                        <SeoImage
                          src={mobileSrc}
                          fallbackAlt={slide.title}
                          fill
                          priority={index === 0}
                          sizes="100vw"
                          fetchPriority={index === 0 ? "high" : undefined}
                          loading={index === 0 ? "eager" : "lazy"}
                          unoptimized={mobileCloudinary}
                          className="object-cover"
                        />
                      </div>
                    </>
                  );
                })()}
              </motion.div>

              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(115deg, rgba(15,10,7,0.78) 0%, rgba(15,10,7,0.44) 34%, rgba(15,10,7,0.18) 62%, transparent 82%), linear-gradient(to top, rgba(0,0,0,0.74) 0%, rgba(0,0,0,0.24) 38%, transparent 72%)",
                }}
              />
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#1d140f]/60 to-transparent" />
            </div>

            <div className="pointer-events-none absolute inset-0">
              <div className="mx-auto flex h-full max-w-7xl items-end px-4 pb-24 pt-24 sm:pb-28 md:items-center md:pb-20">
                <motion.div
                  key={`hero-panel-${activeIndex}-${index}`}
                  initial={
                    motionEnabled
                      ? { opacity: 0, y: 24, scale: 0.98 }
                      : { opacity: 0 }
                  }
                  animate={
                    motionEnabled
                      ? { opacity: 1, y: 0, scale: 1 }
                      : { opacity: 1 }
                  }
                  transition={
                    motionEnabled
                      ? { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
                      : { duration: 0.18 }
                  }
                  className="pointer-events-auto relative max-w-[35rem] overflow-hidden rounded-[2rem] border border-white/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.1)_46%,rgba(255,255,255,0.08)_100%)] px-5 py-5 text-white shadow-[0_32px_90px_-44px_rgba(0,0,0,0.82)] backdrop-blur-md sm:px-6 sm:py-6 md:rounded-[2.25rem] md:px-8 md:py-8"
                >
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-[-8%] top-[-16%] h-28 w-32 rounded-full bg-white/24 blur-2xl" />
                    <div className="absolute bottom-[-20%] right-[-8%] h-32 w-36 rounded-full bg-[rgba(255,255,255,0.14)] blur-3xl" />
                    <div className="absolute inset-x-7 top-0 h-px bg-white/30" />
                  </div>

                  <div className="relative z-10">
                    <span className="inline-flex items-center rounded-full border border-white/15 bg-[rgba(121,80,41,0.24)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-white/90">
                      Bestseller Range
                    </span>

                    <h1 className="mt-4 text-[2.35rem] font-black leading-[0.95] tracking-[-0.05em] text-white drop-shadow-[0_12px_32px_rgba(0,0,0,0.28)] sm:text-[2.9rem] md:text-[3.45rem]">
                      {slide.title}
                    </h1>

                    <p className="mt-4 max-w-[28rem] text-sm font-medium leading-6 text-white/82 sm:text-base">
                      {slide.subtitle}
                    </p>

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <Link
                        href={slide.link}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#352116] shadow-[0_18px_45px_-30px_rgba(255,255,255,0.4)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#fff6ea] sm:px-6"
                      >
                        {slide.cta}
                        <FiArrowUpRight size={16} />
                      </Link>

                      <Link
                        href="/products"
                        className="inline-flex items-center gap-2 rounded-full border border-white/24 bg-white/10 px-4 py-3 text-sm font-semibold text-white/90 transition duration-300 hover:bg-white/16"
                      >
                        View catalog
                      </Link>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {HERO_STATS.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-[1.1rem] border border-white/12 bg-white/8 px-4 py-3"
                        >
                          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/58">
                            {item.label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white/90">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      <div className="pointer-events-none absolute inset-x-0 bottom-12 z-20 hidden px-4 sm:block">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-3 rounded-full border border-white/18 bg-black/20 px-4 py-3 text-white/88 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          {heroTrustItems.map((item) => (
            <span
              key={item}
              className="rounded-full bg-white/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.2em]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <style jsx global>{`
        .homeSlider .swiper-pagination {
          bottom: 18px !important;
        }
        .home-slide-bullet {
          width: 32px !important;
          height: 4px !important;
          border-radius: 4px !important;
          background: rgba(255, 255, 255, 0.35) !important;
          opacity: 1 !important;
          transition:
            width 0.32s cubic-bezier(0.4, 0, 0.2, 1),
            background-color 0.24s ease,
            box-shadow 0.24s ease !important;
          margin: 0 4px !important;
        }
        .home-slide-bullet-active {
          width: 48px !important;
          background: var(--color-primary, #00d89e) !important;
          box-shadow: 0 0 12px var(--color-primary, #00d89e) !important;
        }
      `}</style>
    </section>
  );
};

export default HomeSlider;
