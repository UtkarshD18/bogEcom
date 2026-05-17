"use client";

import useSeoAlt from "@/hooks/useSeoAlt";
import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { fetchDataFromApi } from "@/utils/api";
import { getBannerImageUrl, isCloudinaryUrl } from "@/utils/imageUtils";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useContext, useEffect, useRef, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiVolume2,
  FiVolumeX,
} from "react-icons/fi";

const BannerMedia = ({ banner, isMuted }) => {
  const containerRef = useRef(null);
  const videoElementRef = useRef(null);
  const [videoError, setVideoError] = useState(false);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (banner.mediaType !== "video" || !banner.videoUrl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [banner.mediaType, banner.videoUrl]);

  useEffect(() => {
    if (videoElementRef.current) {
      videoElementRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleVideoError = () => {
    console.warn("Video failed to load:", banner.videoUrl);
    setVideoError(true);
  };

  const desktopSrc = banner.image ? getBannerImageUrl(banner.image) : null;
  const mobileSrc = banner.image
    ? getBannerImageUrl(banner.mobileImage || banner.image)
    : null;
  const desktopAlt = useSeoAlt(desktopSrc || banner.title, banner.title);
  const mobileAlt = useSeoAlt(mobileSrc || banner.title, banner.title);

  if (banner.mediaType === "video" && banner.videoUrl && !videoError) {
    return (
      <div
        ref={containerRef}
        className="relative h-56 w-full overflow-hidden rounded-[1.7rem] sm:h-64 md:h-72"
      >
        {isInView ? (
          <video
            ref={videoElementRef}
            src={banner.videoUrl}
            poster={banner.image ? getBannerImageUrl(banner.image) : undefined}
            className="h-full w-full object-cover"
            autoPlay
            loop
            muted={isMuted}
            playsInline
            preload="metadata"
            onError={handleVideoError}
          />
        ) : (
          <div className="h-full w-full bg-gray-900" />
        )}
      </div>
    );
  }

  if (banner.image) {
    return (
      <div className="relative h-56 w-full overflow-hidden rounded-[1.7rem] sm:h-64 md:h-72">
        <div className="absolute inset-0 hidden md:block">
          <Image
            src={desktopSrc}
            alt={desktopAlt}
            fill
            sizes="100vw"
            unoptimized={isCloudinaryUrl(desktopSrc)}
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </div>
        <div className="absolute inset-0 md:hidden">
          <Image
            src={mobileSrc}
            alt={mobileAlt}
            fill
            sizes="100vw"
            unoptimized={isCloudinaryUrl(mobileSrc)}
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </div>
      </div>
    );
  }

  return <div className="h-56 w-full rounded-[1.7rem] bg-gray-100" />;
};

const Banners = ({ initialBanners = [] }) => {
  const [banners, setBanners] = useState(initialBanners);
  const [loading, setLoading] = useState(initialBanners.length === 0);
  const [activeAudioBannerId, setActiveAudioBannerId] = useState(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const scrollerRef = useRef(null);
  const scrollFrameRef = useRef(0);
  const activeBannerIndexRef = useRef(0);
  const context = useContext(MyContext);
  const flavor = context?.flavor || FLAVORS.creamy;

  useEffect(() => {
    if (initialBanners.length > 0) {
      setBanners(initialBanners);
      setLoading(false);
      return;
    }

    const fetchBanners = async () => {
      try {
        const response = await fetchDataFromApi("/api/banners");
        if (response.success && response.data) setBanners(response.data);
      } catch (error) {
        console.error("Failed to fetch banners:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [initialBanners]);

  useEffect(() => {
    activeBannerIndexRef.current = activeBannerIndex;
  }, [activeBannerIndex]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  if (loading) return null;
  if (banners.length === 0) return null;

  const scrollToBanner = (nextIndex) => {
    const scroller = scrollerRef.current;
    if (!scroller || banners.length === 0) return;

    const normalizedIndex = (nextIndex + banners.length) % banners.length;
    const target = scroller.children[normalizedIndex];
    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
    activeBannerIndexRef.current = normalizedIndex;
    setActiveBannerIndex(normalizedIndex);
  };

  const handleBannerScroll = () => {
    if (scrollFrameRef.current) return;

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = 0;

      const scroller = scrollerRef.current;
      if (!scroller) return;

      const slideWidth =
        scroller.firstElementChild?.clientWidth || scroller.clientWidth;
      const gap = 20;
      const nextIndex = Math.round(
        scroller.scrollLeft / Math.max(slideWidth + gap, 1),
      );
      const resolvedIndex = Math.min(
        Math.max(nextIndex, 0),
        banners.length - 1,
      );

      if (activeBannerIndexRef.current !== resolvedIndex) {
        activeBannerIndexRef.current = resolvedIndex;
        setActiveBannerIndex(resolvedIndex);
      }
    });
  };

  return (
    <section className="relative z-20 -mt-7 bg-transparent pb-8 sm:-mt-10 sm:pb-12 md:-mt-14 md:pb-14">
      <div className="mx-auto max-w-7xl px-4">
        <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/88 p-4 shadow-[0_30px_80px_rgba(90,58,34,0.10)] backdrop-blur-xl sm:rounded-[2.4rem] sm:p-5 lg:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl space-y-2">
              <span
                className="inline-flex items-center rounded-full border px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.24em]"
                style={{
                  backgroundColor: flavor.glass,
                  borderColor: "rgba(255,255,255,0.75)",
                  color: "var(--color-primary)",
                }}
              >
                Featured Offers
              </span>
              <h2
                className="text-[1.9rem] font-black tracking-[-0.04em] sm:text-[2.2rem]"
                style={{ color: "var(--color-primary)" }}
              >
                Fresh Picks For You
              </h2>
              <p className="text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
                Swipe through high-conviction campaigns, bundles, and brand
                stories styled like a cleaner ecommerce showcase.
              </p>
            </div>

            {banners.length > 1 ? (
              <div className="hidden items-center gap-3 sm:flex">
                <button
                  type="button"
                  onClick={() => scrollToBanner(activeBannerIndex - 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white text-slate-700 shadow-[0_10px_24px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5"
                  aria-label="Previous banner"
                >
                  <FiChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToBanner(activeBannerIndex + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white text-slate-700 shadow-[0_10px_24px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5"
                  aria-label="Next banner"
                >
                  <FiChevronRight size={20} />
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <div
              ref={scrollerRef}
              onScroll={handleBannerScroll}
              className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {banners.map((banner, index) => {
                const bannerLink =
                  banner.title?.includes("Subscribe") ||
                  banner.title?.includes("Save")
                    ? "/membership"
                    : banner.link || "/products";

                const bannerId = String(banner?._id || "").trim();
                const bannerName = String(
                  banner?.title || `banner-${index + 1}`,
                )
                  .trim()
                  .replace(/\s+/g, " ")
                  .slice(0, 140);
                const bannerPosition = String(
                  banner?.position || `home_slot_${index + 1}`,
                )
                  .trim()
                  .slice(0, 80);
                const bannerCampaign = String(
                  banner?.campaign || "home_banners",
                )
                  .trim()
                  .slice(0, 120);

                const isVideo = banner.mediaType === "video" && banner.videoUrl;

                return (
                  <motion.div
                    key={banner._id || `banner-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                    className="min-w-full snap-center md:min-w-[calc(50%_-_10px)]"
                  >
                    <div className="relative">
                      <Link
                        href={bannerLink}
                        className="group relative block rounded-[1.8rem]"
                        data-track="banner_click"
                        data-track-click="banner_click"
                        data-track-target-type="banner"
                        data-track-target-id={bannerId || bannerName}
                        data-banner-id={bannerId}
                        data-banner-name={bannerName}
                        data-banner-position={bannerPosition}
                        data-banner-campaign={bannerCampaign}
                      >
                        <motion.div
                          whileHover={{ y: -4 }}
                          transition={{ duration: 0.24 }}
                          className="relative overflow-hidden rounded-[1.8rem] border border-black/5 bg-white shadow-[0_18px_44px_rgba(90,58,34,0.10)]"
                        >
                          <BannerMedia
                            banner={banner}
                            isMuted={activeAudioBannerId !== banner._id}
                          />

                          <div className="pointer-events-none absolute inset-0 rounded-[1.8rem] bg-gradient-to-t from-black/78 via-black/24 to-transparent" />

                          <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-4 sm:p-5">
                            <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/88 backdrop-blur-md">
                              Featured
                            </span>
                          </div>

                          <div className="absolute bottom-0 left-0 z-10 w-full p-5 sm:p-7">
                            <h3 className="mb-2 text-2xl font-black leading-tight text-white drop-shadow-sm sm:text-3xl">
                              {banner.title}
                            </h3>
                            {banner.subtitle ? (
                              <p className="mb-4 max-w-xs text-sm font-medium text-gray-200 drop-shadow-sm sm:text-base">
                                {banner.subtitle}
                              </p>
                            ) : null}
                            <span className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-gray-900 shadow-lg transition-colors group-hover:bg-[#fff2df]">
                              {banner.buttonText ||
                                banner.linkText ||
                                "Shop Now"}
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                                />
                              </svg>
                            </span>
                          </div>
                        </motion.div>
                      </Link>

                      {isVideo ? (
                        <div className="absolute right-4 top-4 z-20">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setActiveAudioBannerId((prev) =>
                                prev === banner._id ? null : banner._id,
                              );
                            }}
                            className="rounded-full bg-black/50 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/70"
                            aria-label={
                              activeAudioBannerId !== banner._id
                                ? "Unmute video"
                                : "Mute video"
                            }
                          >
                            {activeAudioBannerId !== banner._id ? (
                              <FiVolumeX size={16} />
                            ) : (
                              <FiVolume2 size={16} />
                            )}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {banners.length > 1 ? (
              <div className="mt-3 flex items-center justify-center gap-2">
                {banners.map((banner, index) => (
                  <button
                    key={`${banner?._id || "banner"}-dot-${index}`}
                    type="button"
                    onClick={() => scrollToBanner(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      activeBannerIndex === index
                        ? "w-8 bg-primary"
                        : "w-2.5 bg-gray-300 hover:bg-gray-400"
                    }`}
                    aria-label={`Show banner ${index + 1}`}
                    aria-current={
                      activeBannerIndex === index ? "true" : undefined
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Banners;
