"use client";

import ResponsiveMediaImage from "@/components/ResponsiveMediaImage";
import { useProducts } from "@/context/ProductContext";
import { useSettings } from "@/context/SettingsContext";
import { getHeroImageUrl, getHeroMobileImageUrl } from "@/utils/imageUtils";
import { DEFAULT_HOME_SLIDES } from "@/utils/mediaDefaults";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiArrowUpRight, FiX } from "react-icons/fi";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/pagination";
import { Autoplay, EffectFade, Pagination } from "swiper/modules";

const HERO_PANEL_REOPEN_DELAY_MS = 4200;

const fallbackSlides = [
  {
    image: DEFAULT_HOME_SLIDES[0],
    title: "Pure Nutrition",
    subtitle: "100% Natural Peanut Butter",
    cta: "Shop Now",
    link: "/products",
    stayDurationMs: 5600,
  },
  {
    image: DEFAULT_HOME_SLIDES[1],
    title: "Fuel Your Fitness",
    subtitle: "High Protein | No Sugar",
    cta: "Explore",
    link: "/products?category=protein-peanut-butter",
    stayDurationMs: 5600,
  },
  {
    image: DEFAULT_HOME_SLIDES[2],
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
  slides
    .map((slide) => ({
      image: slide.image,
      mobileImage: slide.mobileImage || slide.image,
    desktopImageScale: 1,
    desktopImagePositionX: Number(slide.desktopImagePositionX) || 50,
    desktopImagePositionY: Number(slide.desktopImagePositionY) || 50,
    mobileImageScale: 1,
    mobileImagePositionX: Number(slide.mobileImagePositionX) || 50,
    mobileImagePositionY: Number(slide.mobileImagePositionY) || 50,
    title: normalizeSlideText(slide.title, ""),
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
    }))
    .filter((slide) => String(slide.image || slide.mobileImage || "").trim());

const HERO_STATS = [
  { label: "Best Seller", value: "Top Rated" },
  { label: "Clean Label", value: "No Nasties" },
  { label: "Everyday Use", value: "Snack + Fitness" },
];

const hasNarrativeContent = (slide) =>
  Boolean(
    String(slide?.title || "").trim() || String(slide?.subtitle || "").trim(),
  );

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
  const heroPanelReopenTimerRef = useRef(null);

  const displaySlides = useMemo(() => {
    if (homeSlides?.length > 0) {
      const formatted = formatSlides(homeSlides);
      if (formatted.length) return formatted;
    }

    if (initialSlides.length > 0) {
      const formatted = formatSlides(initialSlides);
      if (formatted.length) return formatted;
    }

    return formatSlides(fallbackSlides);
  }, [homeSlides, initialSlides]);

  const motionEnabled = !prefersReducedMotion;
  const hasMultipleSlides = displaySlides.length > 1;
  const activeSlide = displaySlides[activeIndex] || displaySlides[0] || null;
  const activeSlideHasNarrative = hasNarrativeContent(activeSlide);
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

  useEffect(() => {
    setIsHeroPanelDismissed(false);
  }, [activeIndex]);

  useEffect(() => {
    if (heroPanelReopenTimerRef.current) {
      window.clearTimeout(heroPanelReopenTimerRef.current);
      heroPanelReopenTimerRef.current = null;
    }

    if (!isHeroPanelDismissed || !activeSlideHasNarrative) {
      return undefined;
    }

    heroPanelReopenTimerRef.current = window.setTimeout(() => {
      setIsHeroPanelDismissed(false);
      heroPanelReopenTimerRef.current = null;
    }, HERO_PANEL_REOPEN_DELAY_MS);

    return () => {
      if (heroPanelReopenTimerRef.current) {
        window.clearTimeout(heroPanelReopenTimerRef.current);
        heroPanelReopenTimerRef.current = null;
      }
    };
  }, [activeSlideHasNarrative, isHeroPanelDismissed]);

  const handlePreviousSlide = () => {
    swiperRef.current?.slidePrev();
  };

  const handleNextSlide = () => {
    swiperRef.current?.slideNext();
  };

  return (
    <section className="relative z-10 px-3 sm:px-4 xl:px-6">
      <div className="w-full">
        <div className="overflow-hidden rounded-[1.35rem] bg-[#f3ece4] shadow-[0_24px_70px_rgba(26,18,13,0.14)] sm:rounded-[2rem] md:mx-auto md:max-w-[900px] md:rounded-[2.25rem] md:shadow-[0_32px_90px_rgba(26,18,13,0.16)] lg:max-w-[980px] lg:rounded-[2.6rem] xl:max-w-[1020px]">
          <div className="relative h-[clamp(190px,56vw,255px)] w-full md:aspect-auto md:h-[clamp(360px,39vw,470px)] lg:h-[clamp(390px,37vw,520px)] xl:h-[clamp(410px,35vw,540px)]">
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
                  <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_center,#fffaf3_0%,#efe4d9_58%,#e2d2c2_100%)]">
                    <div className="absolute inset-0 z-0">
                      {(() => {
                        const desktopSrc = getHeroImageUrl(slide.image);
                        const mobileSrc = getHeroMobileImageUrl(
                          slide.mobileImage || slide.image,
                        );

                        return (
                          <ResponsiveMediaImage
                            desktopSrc={desktopSrc}
                            mobileSrc={mobileSrc}
                            alt={slide.title}
                            className="absolute inset-0"
                            imgClassName="home-slider-media"
                            desktopProfile="heroDesktop"
                            mobileProfile="heroMobile"
                            desktopPosition={`${slide.desktopImagePositionX}% ${slide.desktopImagePositionY}%`}
                            mobilePosition={`${slide.mobileImagePositionX}% ${slide.mobileImagePositionY}%`}
                            desktopScale={slide.desktopImageScale}
                            mobileScale={slide.mobileImageScale}
                            objectFit="contain"
                            backgroundColor={slide.backgroundColor || "#f5f5f5"}
                            loading={index === 0 ? "eager" : "lazy"}
                            fetchPriority={index === 0 ? "high" : "auto"}
                          />
                        );
                      })()}
                    </div>

                    <div className="absolute inset-0 z-10 bg-[linear-gradient(90deg,rgba(12,9,7,0.20)_0%,rgba(12,9,7,0.10)_38%,rgba(12,9,7,0.04)_100%),linear-gradient(to_top,rgba(24,16,11,0.08)_0%,rgba(24,16,11,0.03)_30%,transparent_58%)] md:bg-[linear-gradient(90deg,rgba(12,9,7,0.54)_0%,rgba(12,9,7,0.32)_24%,rgba(12,9,7,0.08)_58%,rgba(12,9,7,0.12)_100%),linear-gradient(to_top,rgba(24,16,11,0.22)_0%,rgba(24,16,11,0.04)_28%,transparent_58%)]" />
                    <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#1d140f]/14 to-transparent" />

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
                  className="absolute left-4 top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-black/38 text-white shadow-[0_14px_30px_rgba(0,0,0,0.24)] backdrop-blur-md transition hover:bg-black/48 md:hidden"
                  aria-label="Previous home slide"
                >
                  <FiArrowLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleNextSlide}
                  className="absolute right-4 top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-black/38 text-white shadow-[0_14px_30px_rgba(0,0,0,0.24)] backdrop-blur-md transition hover:bg-black/48 md:hidden"
                  aria-label="Next home slide"
                >
                  <FiArrowRight size={16} />
                </button>
              </>
            ) : null}

            {activeSlide && activeSlideHasNarrative && !isHeroPanelDismissed ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 hidden px-4 md:block lg:px-5">
                <div className="pointer-events-auto max-w-[360px] overflow-hidden rounded-[1.65rem] border border-white/24 bg-[linear-gradient(160deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.10)_45%,rgba(32,23,17,0.22)_100%)] px-4 py-4 text-white shadow-[0_20px_54px_rgba(15,10,7,0.22)] backdrop-blur-[22px] backdrop-saturate-[1.6] xl:max-w-[380px]">
                  <button
                    type="button"
                    onClick={() => setIsHeroPanelDismissed(true)}
                    className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/16 bg-white/12 text-white/84 transition hover:bg-white/20"
                    aria-label="Hide slide details"
                  >
                    <FiX size={14} />
                  </button>

                  <span className="inline-flex items-center rounded-full border border-white/24 bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                    Bestseller Range
                  </span>

                  {activeSlide.title ? (
                    <h1 className="mt-3 max-w-[12ch] text-[1.45rem] font-black leading-[0.95] tracking-[-0.04em] text-white xl:text-[1.55rem]">
                      {activeSlide.title}
                    </h1>
                  ) : null}

                  {activeSlide.subtitle ? (
                    <p className="mt-2 max-w-[21rem] text-[13px] font-medium leading-5 text-white/74 xl:text-sm xl:leading-6">
                      {activeSlide.subtitle}
                    </p>
                  ) : null}

                  <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                    <Link
                      href={activeSlide.link}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2.5 text-[13px] font-bold text-[#352116] shadow-[0_14px_36px_-24px_rgba(255,255,255,0.5)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#fff6ea]"
                    >
                      {activeSlide.cta}
                      <FiArrowUpRight size={16} />
                    </Link>

                    <Link
                      href="/products"
                      className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-3.5 py-2.5 text-[13px] font-semibold text-white/92 transition duration-300 hover:bg-white/14"
                    >
                      View catalog
                    </Link>
                  </div>

                  <div className="mt-3.5 grid grid-cols-3 gap-2">
                    {HERO_STATS.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-[0.9rem] border border-white/14 bg-white/8 px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                      >
                        <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/56">
                          {item.label}
                        </p>
                        <p className="mt-1 text-[12px] font-semibold leading-tight text-white/88 xl:text-[13px]">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {heroTrustItems.length ? (
        <div className="mt-2 flex justify-center px-0 md:mt-2 md:px-4">
          <div className="mx-auto w-full max-w-5xl rounded-[1.1rem] border border-white/16 bg-[rgba(18,12,9,0.78)] px-2 py-2 text-white/88 shadow-[0_14px_42px_rgba(0,0,0,0.18)] backdrop-blur-xl md:max-w-fit md:rounded-full md:px-3.5 md:py-2.5 md:shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
            <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:justify-center md:overflow-visible">
              {heroTrustItems.map((item) => (
                <span
                  key={item}
                  className="shrink-0 rounded-full bg-white/10 px-2 py-1.5 text-[7px] font-extrabold uppercase tracking-[0.1em] sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.2em] md:px-3.5 md:py-1.5"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-2 md:mx-auto md:mt-5 md:max-w-[1000px] lg:max-w-[1080px]">
        {activeSlideHasNarrative && isHeroPanelDismissed ? (
          <button
            type="button"
            onClick={() => setIsHeroPanelDismissed(false)}
            className="inline-flex items-center rounded-full border border-[#2c1e15]/10 bg-white/90 px-4 py-2 text-sm font-semibold text-[#2d1a11] shadow-[0_10px_26px_rgba(26,18,13,0.12)] backdrop-blur-sm md:hidden"
          >
            Show slide details
          </button>
        ) : activeSlide && activeSlideHasNarrative ? (
          <>
            <div className="rounded-[1.15rem] border border-[#2c1e15]/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.78)_0%,rgba(255,249,242,0.64)_100%)] p-3.5 text-[#2d1a11] shadow-[0_14px_38px_rgba(26,18,13,0.12),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-2xl backdrop-saturate-150 md:hidden">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center rounded-full border border-white/60 bg-white/46 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#7c5b49] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md">
                    Bestseller Range
                  </span>
                  {activeSlide.title ? (
                    <h1 className="mt-2.5 text-[1.24rem] font-black leading-[0.98] tracking-[-0.04em] text-[#2d1a11]">
                      {activeSlide.title}
                    </h1>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setIsHeroPanelDismissed(true)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#2c1e15]/10 bg-[#f7f2ed] text-[#2d1a11]"
                  aria-label="Hide slide details"
                >
                  <FiX size={15} />
                </button>
              </div>

              {activeSlide.subtitle ? (
                <p className="mt-2.5 text-[13px] leading-5 text-[#6a5447]">
                  {activeSlide.subtitle}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2.5">
                <Link
                  href={activeSlide.link}
                  className="inline-flex items-center gap-2 rounded-full bg-[#2d1a11] px-3.5 py-2 text-[13px] font-bold text-white sm:px-5 sm:py-3 sm:text-sm"
                >
                  {activeSlide.cta}
                  <FiArrowUpRight size={16} />
                </Link>
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 rounded-full border border-[#2d1a11]/12 bg-white/54 px-3.5 py-2 text-[13px] font-semibold text-[#2d1a11] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-md sm:py-3 sm:text-sm"
                >
                  View catalog
                </Link>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <style jsx global>{`
        .homeSlider,
        .homeSlider .swiper-wrapper,
        .homeSlider .swiper-slide {
          height: 100%;
        }

        .homeSlider .swiper-slide > div {
          height: 100%;
        }

        .homeSlider .responsive-media__img {
          height: 100% !important;
          width: 100% !important;
          object-fit: cover !important;
          object-position: center center !important;
          transform: none !important;
        }

        .homeSlider .home-slider-media {
          transition: none !important;
        }

        @media (min-width: 768px) {
          .homeSlider .responsive-media__img {
            object-fit: contain !important;
          }
        }

         .homeSlider .swiper-pagination {
          bottom: 12px !important;
        }
        .homeSlider button:focus-visible {
          outline: 2px solid var(--color-accent, #FF8C42) !important;
          outline-offset: 2px !important;
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
        .home-slide-bullet:focus-visible {
          outline: 2px solid var(--color-accent, #FF8C42) !important;
          outline-offset: 2px !important;
        }
        .home-slide-bullet-active {
          width: 36px !important;
          background: var(--color-primary, #00d89e) !important;
          box-shadow: 0 0 12px var(--color-primary, #00d89e) !important;
        }

        @media (max-width: 767px) {
          .homeSlider .swiper-pagination {
            bottom: 8px !important;
          }
          .home-slide-bullet {
            width: 16px !important;
            height: 3px !important;
            margin: 0 3px !important;
          }
          .home-slide-bullet-active {
            width: 26px !important;
          }
        }
      `}</style>
    </section>
  );
};

export default HomeSlider;
