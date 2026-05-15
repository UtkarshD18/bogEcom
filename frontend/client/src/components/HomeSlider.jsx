"use client";

import { useProducts } from "@/context/ProductContext";
import {
  getHeroImageUrl,
  getHeroMobileImageUrl,
  isCloudinaryUrl,
} from "@/utils/imageUtils";
import { AnimatePresence, motion } from "framer-motion";
import SeoImage from "@/components/SeoImage";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiArrowUpRight, FiPlus, FiX } from "react-icons/fi";
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
    subtitle: "High Protein • No Sugar",
    cta: "Explore",
    link: "/products?category=protein-peanut-butter",
  },
  {
    image: "/slide_3.jpg",
    title: "Clean Eating",
    subtitle: "No Palm Oil • No Preservatives",
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

const HERO_CARD_POSITIONS = [
  {
    id: "lower-left",
    className:
      "left-4 bottom-[4.5rem] sm:left-6 sm:bottom-24 md:left-16 md:bottom-24 lg:left-24 lg:bottom-28",
  },
  {
    id: "lifted-left",
    className:
      "left-4 bottom-[10rem] sm:left-6 sm:bottom-[10.5rem] md:left-20 md:bottom-[15rem] lg:left-28 lg:bottom-[15.5rem]",
  },
  {
    id: "upper-left",
    className:
      "left-4 top-20 sm:left-6 sm:top-24 md:left-16 md:top-28 lg:left-24 lg:top-32",
  },
  {
    id: "mid-left",
    className:
      "left-4 top-[34%] sm:left-6 sm:top-[33%] md:left-16 md:top-[31%] lg:left-24 lg:top-[30%]",
  },
  {
    id: "drift-left",
    className:
      "left-6 bottom-[7.25rem] sm:left-10 sm:bottom-[8.25rem] md:left-28 md:bottom-[11rem] lg:left-36 lg:bottom-[12rem]",
  },
];

const pickNextCardPositionIndex = (currentIndex = 0) => {
  if (HERO_CARD_POSITIONS.length < 2) return currentIndex;

  let nextIndex = currentIndex;

  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * HERO_CARD_POSITIONS.length);
  }

  return nextIndex;
};

const HomeSlider = ({ initialSlides = [] }) => {
  const { homeSlides = [], fetchHomeSlides } = useProducts();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [cardPositionIndices, setCardPositionIndices] = useState({});
  const [cardRespawnKeys, setCardRespawnKeys] = useState({});
  const [supportsHover, setSupportsHover] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
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

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const viewportQuery = window.matchMedia("(max-width: 767px)");
    const updatePreferences = () => {
      setSupportsHover(hoverQuery.matches);
      setPrefersReducedMotion(motionQuery.matches);
      setIsMobileViewport(viewportQuery.matches);
    };

    updatePreferences();

    const cleanupFns = [hoverQuery, motionQuery, viewportQuery].map(
      (mediaQuery) => {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", updatePreferences);
        return () =>
          mediaQuery.removeEventListener("change", updatePreferences);
      }

      mediaQuery.addListener(updatePreferences);
      return () => mediaQuery.removeListener(updatePreferences);
      },
    );

    return () => {
      cleanupFns.forEach((cleanup) => cleanup());
    };
  }, []);

  useEffect(() => {
    setHoveredIndex(null);
    setExpandedIndex(null);
  }, [activeIndex]);

  useEffect(() => {
    if (!homeSlides?.length && !initialSlides?.length) {
      fetchHomeSlides();
    }
  }, [fetchHomeSlides, homeSlides?.length, initialSlides?.length]);

  const openSlideCard = (index) => {
    setExpandedIndex(index);
  };

  const dismissSlideCard = (index) => {
    setHoveredIndex((current) => (current === index ? null : current));
    setExpandedIndex((current) => (current === index ? null : current));
    setCardPositionIndices((current) => ({
      ...current,
      [index]: pickNextCardPositionIndex(current[index] ?? 0),
    }));
    setCardRespawnKeys((current) => ({
      ...current,
      [index]: (current[index] ?? 0) + 1,
    }));
  };

  return (
    <section className="relative w-full h-[60vh] md:h-[85vh] min-h-100 md:min-h-150 overflow-hidden bg-black p-0">
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
        className="h-full w-full homeSlider"
        onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
      >
        {displaySlides.map((slide, index) => (
          <SwiperSlide
            key={`${slide.title || "slide"}-${index}`}
            className="relative w-full h-full"
          >
            {/* Background image */}
            <div className="relative w-full h-full overflow-hidden">
              <motion.div
                className="absolute inset-0 transform-gpu"
                initial={false}
                animate={{ scale: 1 }}
                transition={
                  motionEnabled
                    ? { duration: 5.6, ease: "easeOut" }
                    : { duration: 0.18 }
                }
                style={{ willChange: "auto" }}
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
                            className="object-fill"
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
                            className="object-fill"
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
                    "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 40%, transparent 70%)",
                }}
              />
            </div>

            {/* Content per slide */}
            <div className="pointer-events-none absolute inset-0">
              <AnimatePresence mode="wait">
                {activeIndex === index && (
                  (() => {
                    const isExpanded =
                      hoveredIndex === index || expandedIndex === index;
                    const interactionHint = supportsHover
                      ? "Hover to expand"
                      : "Tap to expand";
                    const cardPosition =
                      HERO_CARD_POSITIONS[cardPositionIndices[index] ?? 0] ||
                      HERO_CARD_POSITIONS[0];
                    const respawnKey = cardRespawnKeys[index] ?? 0;

                    return (
                      <motion.div
                        key={`slide-content-${index}-${cardPosition.id}-${respawnKey}`}
                        initial={
                          motionEnabled
                            ? {
                                opacity: 0,
                                scale: 0.94,
                                x: -10,
                                y: 14,
                              }
                            : { opacity: 0 }
                        }
                        animate={
                          motionEnabled
                            ? {
                                opacity: 1,
                                scale: 1,
                                x: 0,
                                y: 0,
                              }
                            : { opacity: 1 }
                        }
                        exit={
                          motionEnabled
                            ? {
                                opacity: 0,
                                scale: 0.98,
                                x: 12,
                                y: -8,
                              }
                            : { opacity: 0 }
                        }
                        transition={
                          motionEnabled
                            ? {
                                duration: 0.34,
                                ease: [0.22, 1, 0.36, 1],
                              }
                            : { duration: 0.18 }
                        }
                        className={`pointer-events-auto absolute transform-gpu ${cardPosition.className}`}
                        style={{
                          willChange: motionEnabled
                            ? "transform, opacity"
                            : "auto",
                        }}
                      >
                        <motion.div
                          onHoverStart={() => {
                            if (supportsHover) {
                              setHoveredIndex(index);
                            }
                          }}
                          onHoverEnd={() => {
                            if (supportsHover) {
                              setHoveredIndex((current) =>
                                current === index ? null : current,
                              );
                            }
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 220,
                            damping: 26,
                          }}
                          className={`home-glass-card relative overflow-hidden border border-white/22 text-white shadow-[0_35px_95px_-52px_rgba(15,23,42,0.9)] backdrop-blur-md sm:backdrop-blur-xl transform-gpu ${
                            isExpanded
                              ? "w-[min(86vw,28rem)] rounded-[30px] px-5 py-5 sm:w-[22rem] sm:px-6 sm:py-6 md:w-[27rem]"
                              : "w-[13.25rem] rounded-[24px] px-4 py-4 sm:w-[14.5rem] sm:px-5"
                          }`}
                          style={{
                            background: isExpanded
                              ? "linear-gradient(140deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.1) 42%, rgba(255,255,255,0.08) 100%)"
                              : "linear-gradient(140deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)",
                            boxShadow: isExpanded
                              ? "0 30px 70px -42px rgba(15,23,42,0.88), inset 0 1px 0 rgba(255,255,255,0.34)"
                              : "0 24px 50px -40px rgba(15,23,42,0.72), inset 0 1px 0 rgba(255,255,255,0.28)",
                            willChange: motionEnabled
                              ? "transform, opacity"
                              : "auto",
                          }}
                        >
                          <div className="pointer-events-none absolute inset-0">
                            <div className="absolute left-[-16%] top-[-22%] h-28 w-32 rounded-full bg-white/28 blur-2xl" />
                            <div className="absolute bottom-[-28%] right-[-10%] h-32 w-36 rounded-full bg-[rgba(255,255,255,0.16)] blur-3xl" />
                            <div className="absolute inset-x-6 top-0 h-px bg-white/35" />
                            <div className="absolute inset-y-5 left-0 w-px bg-white/18" />
                          </div>

                          {!isExpanded ? (
                            <button
                              type="button"
                              onClick={() => openSlideCard(index)}
                              aria-label={`Expand ${slide.title} banner`}
                              aria-expanded="false"
                              className="absolute inset-0 z-10"
                            />
                          ) : null}

                          <div className="relative z-20">
                            <div className="flex items-start justify-between gap-3">
                              <motion.span
                                initial={{ opacity: 0, x: -18 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.45, delay: 0.15 }}
                                className="inline-flex items-center rounded-full border border-white/16 bg-[rgba(121,80,41,0.22)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-white/90"
                              >
                                Top Pick
                              </motion.span>

                              <button
                                type="button"
                                onClick={() =>
                                  isExpanded
                                    ? dismissSlideCard(index)
                                    : openSlideCard(index)
                                }
                                aria-label={
                                  isExpanded
                                    ? `Move ${slide.title} banner`
                                    : `Expand ${slide.title} banner`
                                }
                                aria-expanded={isExpanded ? "true" : "false"}
                                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/24 bg-white/10 text-white/90 transition duration-300 ${
                                  isExpanded
                                    ? "hover:bg-white/18"
                                    : "hover:scale-105 hover:bg-white/14"
                                }`}
                              >
                                {isExpanded ? <FiX size={16} /> : <FiPlus size={16} />}
                              </button>
                            </div>

                            <motion.h2
                              initial={{ opacity: 0, y: 18 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.5, delay: 0.22 }}
                              className={`mt-3 font-black leading-[1.02] text-white drop-shadow-[0_10px_28px_rgba(0,0,0,0.25)] ${
                                isExpanded
                                  ? "text-[2rem] sm:text-[2.35rem]"
                                  : "line-clamp-2 text-[1.45rem] sm:text-[1.65rem]"
                              }`}
                            >
                              {slide.title}
                            </motion.h2>

                            <AnimatePresence initial={false} mode="popLayout">
                              {isExpanded ? (
                                <motion.div
                                  key={`expanded-copy-${index}`}
                                  initial={{ opacity: 0, y: 12 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 8 }}
                                  transition={{ duration: 0.28, ease: "easeOut" }}
                                  className="mt-4"
                                >
                                  <p className="max-w-[26rem] text-sm leading-6 text-white/82 sm:text-base">
                                    {slide.subtitle}
                                  </p>

                                  <div className="mt-5 flex flex-wrap items-center gap-3">
                                    <Link
                                      href={slide.link}
                                      className="inline-flex items-center gap-2 rounded-full border border-white/26 bg-white/12 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_-30px_rgba(255,255,255,0.35)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-white/18"
                                    >
                                      {slide.cta}
                                      <FiArrowUpRight size={16} />
                                    </Link>
                                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/58">
                                      Swipe for more
                                    </span>
                                  </div>
                                </motion.div>
                              ) : (
                                <motion.p
                                  key={`collapsed-hint-${index}`}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 6 }}
                                  transition={{ duration: 0.24, ease: "easeOut" }}
                                  className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/62"
                                >
                                  {interactionHint}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      </motion.div>
                    );
                  })()
                )}
              </AnimatePresence>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom pagination & slide styling */}
      <style jsx global>{`
        .homeSlider .swiper-pagination {
          bottom: 24px !important;
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
