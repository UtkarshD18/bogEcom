"use client";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { fetchDataFromApi } from "@/utils/api";
import { getBannerImageUrl, isCloudinaryUrl } from "@/utils/imageUtils";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useContext, useEffect, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiVolume2, FiVolumeX } from "react-icons/fi";
import useSeoAlt from "@/hooks/useSeoAlt";

const BannerMedia = ({ banner, onMuteToggle, isMuted }) => {
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

  // Sync muted state with video element
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
  const mobileSrc = banner.image ? getBannerImageUrl(banner.mobileImage || banner.image) : null;
  const desktopAlt = useSeoAlt(desktopSrc || banner.title, banner.title);
  const mobileAlt = useSeoAlt(mobileSrc || banner.title, banner.title);

  if (banner.mediaType === "video" && banner.videoUrl && !videoError) {
    return (
      <div
        ref={containerRef}
        className="relative h-56 sm:h-64 md:h-72 w-full overflow-hidden rounded-3xl"
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
      <div className="relative h-56 sm:h-64 md:h-72 w-full overflow-hidden rounded-3xl">
        <div className="absolute inset-0 hidden md:block">
                  <Image
                    src={desktopSrc}
                    alt={desktopAlt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            unoptimized={isCloudinaryUrl(desktopSrc)}
            className="object-cover transition-transform duration-700 hover:scale-105"
          />
        </div>
        <div className="absolute inset-0 md:hidden">
                  <Image
                    src={mobileSrc}
                    alt={mobileAlt}
            fill
            sizes="100vw"
            unoptimized={isCloudinaryUrl(mobileSrc)}
            className="object-cover transition-transform duration-700 hover:scale-105"
          />
        </div>
      </div>
    );
  }

  return <div className="h-56 w-full rounded-3xl bg-gray-100" />;
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
      const gap = 16;
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
    <section className="py-8 sm:py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="relative">
          {banners.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => scrollToBanner(activeBannerIndex - 1)}
                className="slider-nav absolute left-2 top-1/2 -translate-y-1/2 transition hover:bg-white"
                aria-label="Previous banner"
              >
                <FiChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={() => scrollToBanner(activeBannerIndex + 1)}
                className="slider-nav absolute right-2 top-1/2 -translate-y-1/2 transition hover:bg-white"
                aria-label="Next banner"
              >
                <FiChevronRight size={22} />
              </button>
            </>
          ) : null}

          <div
            ref={scrollerRef}
            onScroll={handleBannerScroll}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
          {banners.map((banner, index) => {
            const bannerLink =
              banner.title?.includes("Subscribe") ||
              banner.title?.includes("Save")
                ? "/membership"
                : banner.link || "/products";

            const bannerId = String(banner?._id || "").trim();
            const bannerName = String(banner?.title || `banner-${index + 1}`)
              .trim()
              .replace(/\s+/g, " ")
              .slice(0, 140);
            const bannerPosition = String(
              banner?.position || `home_slot_${index + 1}`,
            )
              .trim()
              .slice(0, 80);
            const bannerCampaign = String(banner?.campaign || "home_banners")
              .trim()
              .slice(0, 120);

            const isVideo = banner.mediaType === "video" && banner.videoUrl;

            return (
              <motion.div
                key={banner._id || `banner-${index}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="min-w-full snap-center md:min-w-[calc(50%_-_8px)]"
              >
                <div className="relative">
                  <Link
                    href={bannerLink}
                    className="group relative block rounded-3xl transition-all"
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
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.24 }}
                      className="banner-image-container relative overflow-hidden rounded-3xl shadow-none"
                    >
                      <BannerMedia
                        banner={banner}
                        isMuted={activeAudioBannerId !== banner._id}
                      />

                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent pointer-events-none rounded-3xl" />

                      {/* Content */}
                      <div className="absolute bottom-0 left-0 p-6 sm:p-8 w-full z-10">
                        <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight drop-shadow-sm">
                          {banner.title}
                        </h3>
                        {banner.subtitle && (
                          <p className="text-gray-200 text-sm sm:text-base mb-4 font-medium max-w-xs drop-shadow-sm">
                            {banner.subtitle}
                          </p>
                        )}
                        <span className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-gray-900 font-bold rounded-full text-sm hover:bg-primary hover:text-white transition-colors shadow-lg">
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
                              d="M17 8l4 4m0 0l-4 4m4-4H3"
                            />
                          </svg>
                        </span>
                      </div>
                    </motion.div>
                  </Link>

                  {/* Mute/Unmute Button - OUTSIDE Link to prevent navigation */}
                  {isVideo && (
                    <div className="banner-controls">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveAudioBannerId((prev) =>
                            prev === banner._id ? null : banner._id,
                          );
                        }}
                        className="banner-audio rounded-full bg-black/50 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/70"
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
                  )}
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
                      ? "w-7 bg-primary"
                      : "w-2.5 bg-gray-300 hover:bg-gray-400"
                  }`}
                  aria-label={`Show banner ${index + 1}`}
                  aria-current={activeBannerIndex === index ? "true" : undefined}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default Banners;
