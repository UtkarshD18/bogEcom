"use client";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { fetchDataFromApi } from "@/utils/api";
import { getBannerImageUrl } from "@/utils/imageUtils";
import { motion } from "framer-motion";
import Link from "next/link";
import { useContext, useEffect, useRef, useState } from "react";
import { FiVolume2, FiVolumeX } from "react-icons/fi";

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
        <img
          src={getBannerImageUrl(banner.image)}
          alt={banner.title}
          className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
        />
      </div>
    );
  }

  return <div className="h-56 w-full rounded-3xl bg-gray-100" />;
};

const Banners = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mutedStates, setMutedStates] = useState({}); // { [bannerId]: boolean }
  const context = useContext(MyContext);
  const flavor = context?.flavor || FLAVORS.creamy;

  useEffect(() => {
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
  }, []);

  if (loading) return null;
  if (banners.length === 0) return null;

  return (
    <section className="py-8 sm:py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banners.map((banner, index) => {
            const bannerLink =
              banner.title?.includes("Subscribe") ||
                banner.title?.includes("Save")
                ? "/membership"
                : banner.link || "/products";

            const isVideo = banner.mediaType === "video" && banner.videoUrl;

            return (
              <motion.div
                key={banner._id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="relative">
                  <Link
                    href={bannerLink}
                    className="group relative block rounded-3xl transition-all"
                  >
                    <motion.div
                      whileHover={{ y: -5, scale: 1.02 }}
                      transition={{ duration: 0.3 }}
                      className="relative overflow-hidden rounded-3xl shadow-sm hover:shadow-xl"
                    >
                      <BannerMedia
                        banner={banner}
                        isMuted={mutedStates[banner._id] !== false}
                      />

                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none rounded-3xl" />

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
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMutedStates((prev) => ({
                          ...prev,
                          [banner._id]:
                            prev[banner._id] !== false ? false : true,
                        }));
                      }}
                      className="absolute bottom-20 right-4 z-20 rounded-full bg-black/50 p-2 text-white backdrop-blur-md hover:bg-black/70 transition-colors"
                      aria-label={
                        mutedStates[banner._id] !== false
                          ? "Unmute video"
                          : "Mute video"
                      }
                    >
                      {mutedStates[banner._id] !== false ? (
                        <FiVolumeX size={16} />
                      ) : (
                        <FiVolume2 size={16} />
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Banners;
