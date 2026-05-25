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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiArrowLeft,
  FiArrowRight,
  FiArrowUpRight,
  FiX,
} from "react-icons/fi";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/pagination";

import { Autoplay, EffectFade, Pagination } from "swiper/modules";

const fallbackSlides = [
  {
    image: "/slide_1.webp",
    title: "Pure Nutrition",
    subtitle: "100% Natural Peanut Butter",
    cta: "Shop Now",
    link: "/products",
    stayDurationMs: 5600,
  },
  {
    image: "/slide_2.webp",
    title: "Fuel Your Fitness",
    subtitle: "High Protein | No Sugar",
    cta: "Explore",
    link: "/products?category=protein-peanut-butter",
    stayDurationMs: 5600,
  },
  {
    image: "/slide_3.webp",
    title: "Clean Eating",
    subtitle: "No Palm Oil | No Preservatives",
    cta: "Discover",
    link: "/products?category=organic-natural",
    stayDurationMs: 5600,
  },
];

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

const normalizeSlideText = (value, fallback = "") =>
  String(value ?? fallback).trim() || fallback;

const normalizeSlideLink = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "/products";
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }
  return `/${trimmed.replace(/^\/+/, "")}`;
};

const formatSlides = (slides = []) =>
  slides.map((slide) => ({
    image: slide.image,
    mobileImage: slide.mobileImage || slide.image,
    title: normalizeSlideText(slide.title, "Featured Pick"),
    subtitle: normalizeSlideText(slide.subtitle || slide.description, ""),
    cta: normalizeSlideText(slide.buttonText, "Shop Now"),
    link: normalizeSlideLink(slide.buttonLink),
    backgroundColor: slide.backgroundColor || "#f5f5f5",
    stayDurationMs: Math.max(
      Number(
        slide.stayDurationMs ||
          (Number(slide.stayDuration || 0) > 0
            ? Number(slide.stayDuration) * 1000
            : 5600),
      ) || 5600,
      2000,
    ),
    offerEnabled: Boolean(slide.offerEnabled || slide.offerEndsAt),
    offerBadgeText: slide.offerBadgeText || "",
    offerEndsAt: slide.offerEndsAt || null,
    offerTimerPosition: slide.offerTimerPosition || "top-right",
  }));

const HERO_STATS = [
  { label: "Best Seller", value: "Top Rated" },
  { label: "Clean Label", value: "No Nasties" },
  { label: "Everyday Use", value: "Snack + Fitness" },
];

const getOfferTimeLeft = (endsAt, nowMs) => {
  if (!Number.isFinite(nowMs)) return "";
  const endMs = new Date(endsAt || "").getTime();
  const remainingMs = endMs - nowMs;
  if (!Number.isFinite(endMs) || remainingMs <= 0) return "";

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h`;
  }

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
};

const getTimerPositionClass = (position) => {
  switch (position) {
    case "top-left":
      return "left-4 top-4 sm:left-6 sm:top-6";
    case "bottom-left":
      return "bottom-16 left-4 sm:bottom-20 sm:left-6";
    case "bottom-right":
      return "bottom-16 right-4 sm:bottom-20 sm:right-6";
    case "top-right":
    default:
      return "right-4 top-4 sm:right-6 sm:top-6";
  }
};

const getSlideAutoplayDelay = (slides, slideIndex) =>
  Math.max(Number(slides?.[slideIndex]?.stayDurationMs) || 5600, 2000);

const syncAutoplayDelay = (swiper, slides, slideIndex) => {
  if (!swiper?.params?.autoplay) return;

  swiper.params.autoplay.delay = getSlideAutoplayDelay(slides, slideIndex);
  if (swiper.autoplay) {
    swiper.autoplay.stop();
    swiper.autoplay.start();
  }
};

const HomeSlider = ({ initialSlides = [], initialSettings = null }) => {
  const { homeSlides = [], fetchHomeSlides } = useProducts();
  const { settings } = useSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isHeroPanelDismissed, setIsHeroPanelDismissed] = useState(false);
  const [nowMs, setNowMs] = useState(null);
  const swiperRef = useRef(null);

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
  const hasMultipleSlides = displaySlides.length > 1;
  const activeSlide = displaySlides[activeIndex] || displaySlides[0] || null;
  const heroTrustItems = useMemo(
    () =>
      HERO_TRUST_SETTING_KEYS.map(
        (key, index) =>
          String(initialSettings?.[key] ?? settings?.[key] ?? "").trim() ||
          HERO_TRUST_DEFAULTS[index],
      ).filter(Boolean),
    [initialSettings, settings],
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
    if (!homeSlides?.length) {
      void fetchHomeSlides();
    }
  }, [fetchHomeSlides, homeSlides?.length]);

  useEffect(() => {
    const hasActiveOffer = displaySlides.some(
      (slide) => slide.offerEnabled && slide.offerEndsAt,
    );
    if (!hasActiveOffer) {
      setNowMs(null);
      return undefined;
    }

    setNowMs(Date.now());

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [displaySlides]);

  useEffect(() => {
    if (!swiperRef.current || !displaySlides.length) return;
    syncAutoplayDelay(
      swiperRef.current,
      displaySlides,
      swiperRef.current.realIndex || 0,
    );
  }, [displaySlides]);

  useEffect(() => {
    if (!displaySlides.length) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((currentIndex) =>
      currentIndex >= displaySlides.length ? 0 : currentIndex,
    );
  }, [displaySlides.length]);

  const handlePreviousSlide = () => {
    swiperRef.current?.slidePrev();
  };

  const handleNextSlide = () => {
    swiperRef.current?.slideNext();
  };

  return (
    <section className="relative z-10 px-3 sm:px-4 md:px-0">
      <div className="w-full">
        <div className="overflow-hidden rounded-[1.6rem] bg-[#120c09] shadow-[0_32px_90px_rgba(26,18,13,0.16)] sm:rounded-[2rem] md:rounded-none">
          <div className="relative aspect-[4/3] w-full sm:aspect-[5/4] md:aspect-[16/9]">
            <Swiper
              speed={motionEnabled ? 850 : 500}
              spaceBetween={0}
              slidesPerView={1}
              loop={hasMultipleSlides}
              effect="fade"
              fadeEffect={{ crossFade: true }}
              autoplay={
                motionEnabled && hasMultipleSlides
                  ? {
                      delay: displaySlides[0]?.stayDurationMs || 5600,
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
              className="homeSlider h-full w-full"
              onSwiper={(swiper) => {
                swiperRef.current = swiper;
                syncAutoplayDelay(swiper, displaySlides, swiper.realIndex || 0);
              }}
              onSlideChange={(swiper) => {
                setActiveIndex(swiper.realIndex);
                syncAutoplayDelay(swiper, displaySlides, swiper.realIndex);
              }}
            >
              {displaySlides.map((slide, index) => (
                <SwiperSlide
                  key={`${slide.title || "slide"}-${index}`}
                  className="relative h-full w-full"
                  data-swiper-autoplay={slide.stayDurationMs || 5600}
                >
                  <div className="relative h-full w-full overflow-hidden bg-[#120c09]">
                    <motion.div
                      className="absolute inset-0 z-0"
                      initial={false}
                      animate={{ scale: motionEnabled ? 1.02 : 1 }}
                      transition={
                        motionEnabled
                          ? {
                              duration: Math.max(
                                (slide.stayDurationMs || 5600) / 1000,
                                0.2,
                              ),
                              ease: "easeOut",
                            }
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
                                backgroundColor:
                                  slide.backgroundColor || "#f5f5f5",
                              }}
                            >
                              <div
                                aria-hidden="true"
                                className="absolute inset-0 scale-110 bg-cover bg-center opacity-70 blur-2xl"
                                style={{
                                  backgroundImage: `url("${desktopSrc}")`,
                                }}
                              />
                              <SeoImage
                                src={desktopSrc}
                                fallbackAlt={slide.title}
                                fill
                                priority={index === 0}
                                sizes="100vw"
                                fetchPriority={index === 0 ? "high" : undefined}
                                loading={index === 0 ? "eager" : "lazy"}
                                unoptimized={desktopCloudinary}
                                className="object-cover object-center"
                              />
                            </div>
                            <div
                              className="absolute inset-0 md:hidden"
                              style={{
                                backgroundColor:
                                  slide.backgroundColor || "#f5f5f5",
                              }}
                            >
                              <div
                                aria-hidden="true"
                                className="absolute inset-0 scale-110 bg-cover bg-top opacity-75 blur-2xl"
                                style={{
                                  backgroundImage: `url("${mobileSrc}")`,
                                }}
                              />
                              <SeoImage
                                src={mobileSrc}
                                fallbackAlt={slide.title}
                                fill
                                priority={index === 0}
                                sizes="100vw"
                                fetchPriority={index === 0 ? "high" : undefined}
                                loading={index === 0 ? "eager" : "lazy"}
                                unoptimized={mobileCloudinary}
                                className="object-contain object-top"
                              />
                            </div>
                          </>
                        );
                      })()}
                    </motion.div>

                    <div
                      className="absolute inset-0 z-10"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(12,9,7,0.76) 0%, rgba(12,9,7,0.48) 24%, rgba(12,9,7,0.14) 58%, rgba(12,9,7,0.24) 100%), linear-gradient(to top, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.08) 42%, transparent 72%)",
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#1d140f]/50 to-transparent" />

                    {slide.offerEnabled &&
                    getOfferTimeLeft(slide.offerEndsAt, nowMs) ? (
                      <Link
                        href={slide.link}
                        className={`absolute z-20 transition duration-300 hover:-translate-y-0.5 ${getTimerPositionClass(
                          slide.offerTimerPosition,
                        )}`}
                        aria-label={`View ${slide.title} offer`}
                      >
                        <div className="rounded-2xl border border-white/20 bg-black/46 px-3 py-2 text-right text-white shadow-xl backdrop-blur-md">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ffe2a8]">
                            {slide.offerBadgeText || "Offer ends in"}
                          </p>
                          <p className="mt-0.5 text-sm font-black">
                            {getOfferTimeLeft(slide.offerEndsAt, nowMs)}
                          </p>
                        </div>
                      </Link>
                    ) : null}

                  </div>
                </SwiperSlide>
              ))}
            </Swiper>

            {hasMultipleSlides ? (
              <>
                <button
                  type="button"
                  onClick={handlePreviousSlide}
                  className="absolute left-4 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-black/28 text-white shadow-[0_16px_36px_rgba(0,0,0,0.24)] backdrop-blur-md transition hover:-translate-y-[52%] hover:bg-black/40 md:inline-flex lg:left-5"
                  aria-label="Previous home slide"
                >
                  <FiArrowLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleNextSlide}
                  className="absolute right-4 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-black/28 text-white shadow-[0_16px_36px_rgba(0,0,0,0.24)] backdrop-blur-md transition hover:-translate-y-[52%] hover:bg-black/40 md:inline-flex lg:right-5"
                  aria-label="Next home slide"
                >
                  <FiArrowRight size={18} />
                </button>

                <button
                  type="button"
                  onClick={handlePreviousSlide}
                  className="absolute left-4 top-1/2 z-30 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-black/38 text-white shadow-[0_14px_30px_rgba(0,0,0,0.24)] backdrop-blur-md transition hover:bg-black/48 md:hidden"
                  aria-label="Previous home slide"
                >
                  <FiArrowLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleNextSlide}
                  className="absolute right-4 top-1/2 z-30 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-black/38 text-white shadow-[0_14px_30px_rgba(0,0,0,0.24)] backdrop-blur-md transition hover:bg-black/48 md:hidden"
                  aria-label="Next home slide"
                >
                  <FiArrowRight size={16} />
                </button>
              </>
            ) : null}

            <div className="pointer-events-none absolute inset-0 z-20 hidden md:block">
              <div className="flex h-full items-center px-6 py-8 lg:px-10 xl:px-14">
                {!isHeroPanelDismissed && activeSlide ? (
                  <div
                    key={`hero-panel-${activeIndex}`}
                    className="pointer-events-auto relative max-w-[24rem] overflow-hidden rounded-[1.5rem] border border-white/14 bg-[linear-gradient(150deg,rgba(20,14,10,0.78)_0%,rgba(20,14,10,0.48)_100%)] px-5 py-5 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.82)] backdrop-blur-sm lg:max-w-[28rem] lg:rounded-[1.8rem] lg:px-6 lg:py-6"
                  >
                    <button
                      type="button"
                      onClick={() => setIsHeroPanelDismissed(true)}
                      className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/14 bg-black/20 text-white/84 transition hover:bg-black/35"
                      aria-label="Hide hero details"
                    >
                      <FiX size={15} />
                    </button>

                    <div className="relative z-10">
                      <span className="inline-flex items-center rounded-full border border-white/12 bg-[rgba(121,80,41,0.2)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/88">
                        Bestseller Range
                      </span>

                      <h1 className="mt-4 max-w-[14ch] text-[2rem] font-black leading-[0.92] tracking-[-0.05em] text-white drop-shadow-[0_12px_32px_rgba(0,0,0,0.28)] lg:text-[2.5rem]">
                        {activeSlide.title}
                      </h1>

                      <p className="mt-3 max-w-[28rem] text-sm font-medium leading-6 text-white/78 lg:text-[15px]">
                        {activeSlide.subtitle}
                      </p>

                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <Link
                          href={activeSlide.link}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#352116] shadow-[0_18px_45px_-30px_rgba(255,255,255,0.4)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#fff6ea]"
                        >
                          {activeSlide.cta}
                          <FiArrowUpRight size={16} />
                        </Link>

                        <Link
                          href="/products"
                          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-4 py-3 text-sm font-semibold text-white/90 transition duration-300 hover:bg-white/14"
                        >
                          View catalog
                        </Link>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-3">
                        {HERO_STATS.map((item) => (
                          <div
                            key={item.label}
                            className="rounded-[1rem] border border-white/10 bg-white/6 px-4 py-3"
                          >
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/56">
                              {item.label}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white/88">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsHeroPanelDismissed(false)}
                    className="pointer-events-auto inline-flex items-center rounded-full border border-white/16 bg-[rgba(20,14,10,0.62)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(0,0,0,0.26)] backdrop-blur-sm transition hover:bg-[rgba(20,14,10,0.78)]"
                  >
                    Show slide details
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-20 mx-auto -mt-14 max-w-7xl px-4 md:hidden">
          {isHeroPanelDismissed ? (
            <button
              type="button"
              onClick={() => setIsHeroPanelDismissed(false)}
              className="inline-flex items-center rounded-full border border-[#2c1e15]/12 bg-[#1a120d] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(0,0,0,0.12)]"
            >
              Show slide details
            </button>
          ) : activeSlide ? (
            <div className="rounded-[1.45rem] border border-[#2c1e15]/10 bg-white p-4 shadow-[0_18px_50px_rgba(26,18,13,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center rounded-full bg-[#f3ebe5] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#7c5b49]">
                    Bestseller Range
                  </span>
                  <h1 className="mt-3 text-[1.55rem] font-black leading-[0.96] tracking-[-0.04em] text-[#2d1a11]">
                    {activeSlide.title}
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHeroPanelDismissed(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#2c1e15]/10 bg-[#f7f2ed] text-[#2d1a11]"
                  aria-label="Hide slide details"
                >
                  <FiX size={15} />
                </button>
              </div>

              <p className="mt-3 text-sm leading-6 text-[#6a5447]">
                {activeSlide.subtitle}
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={activeSlide.link}
                  className="inline-flex items-center gap-2 rounded-full bg-[#2d1a11] px-5 py-3 text-sm font-bold text-white"
                >
                  {activeSlide.cta}
                  <FiArrowUpRight size={16} />
                </Link>
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 rounded-full border border-[#2d1a11]/12 bg-[#fffaf6] px-4 py-3 text-sm font-semibold text-[#2d1a11]"
                >
                  View catalog
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        {heroTrustItems.length ? (
          <div className="relative z-20 mx-auto mt-3 max-w-7xl px-4 sm:mt-4 md:-mt-6">
            <div className="mx-auto w-full max-w-5xl rounded-[1.4rem] border border-white/16 bg-[rgba(18,12,9,0.78)] px-2.5 py-3 text-white/88 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur-xl md:max-w-fit md:rounded-full md:px-4">
              <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:justify-center md:gap-2 md:overflow-visible">
                {heroTrustItems.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-white/10 px-2.5 py-1.5 text-[8px] font-extrabold uppercase tracking-[0.12em] sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.2em]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <style jsx global>{`
        .homeSlider .swiper-pagination {
          bottom: 12px !important;
        }
        .home-slide-bullet {
          width: 24px !important;
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
          width: 36px !important;
          background: var(--color-primary, #00d89e) !important;
          box-shadow: 0 0 12px var(--color-primary, #00d89e) !important;
        }
      `}</style>
    </section>
  );
};

export default HomeSlider;
