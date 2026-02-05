"use client";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { fetchDataFromApi } from "@/utils/api";
import { getBannerImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useContext, useEffect, useRef, useState } from "react";
import { FiVolume2, FiVolumeX } from "react-icons/fi";

/**
 * BannerMedia Component
 * Renders either an image or video based on the banner's mediaType
 * Includes lazy loading, mute toggle, and graceful fallback for videos
 */
const BannerMedia = ({ banner }) => {
  const videoRef = useRef(null);
  const [videoError, setVideoError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay

  // Lazy load video using Intersection Observer
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

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => observer.disconnect();
  }, [banner.mediaType, banner.videoUrl]);

  // Handle video error - fallback to image
  const handleVideoError = () => {
    console.warn(
      "Video failed to load, falling back to image:",
      banner.videoUrl,
    );
    setVideoError(true);
  };

  // Toggle mute/unmute
  const toggleMute = (e) => {
    e.preventDefault(); // Prevent link navigation
    e.stopPropagation();
    setIsMuted(!isMuted);
    if (videoRef.current?.querySelector("video")) {
      videoRef.current.querySelector("video").muted = !isMuted;
    }
  };

  // Render video banner
  if (banner.mediaType === "video" && banner.videoUrl && !videoError) {
    return (
      <div ref={videoRef} className="relative h-48 md:h-56">
        {isInView ? (
          <>
            <video
              src={banner.videoUrl}
              poster={
                banner.image ? getBannerImageUrl(banner.image) : undefined
              }
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              autoPlay
              loop
              muted={isMuted}
              playsInline
              preload="metadata"
              onError={handleVideoError}
            />
            {/* Mute/Unmute Button */}
            <button
              onClick={toggleMute}
              className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-all z-10 backdrop-blur-sm"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
            </button>
          </>
        ) : // Show poster image while video is lazy loading
        banner.image ? (
          <img
            src={getBannerImageUrl(banner.image)}
            alt={banner.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <span className="text-white/50">Loading video...</span>
          </div>
        )}
      </div>
    );
  }

  // Render image banner (default) - only if image exists
  if (banner.image) {
    return (
      <div className="relative h-48 md:h-56">
        <img
          src={getBannerImageUrl(banner.image)}
          alt={banner.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
    );
  }

  // Fallback if no media
  return (
    <div className="relative h-48 md:h-56 bg-gradient-to-r from-gray-700 to-gray-900" />
  );
};

const Banners = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const context = useContext(MyContext);
  const flavor = context?.flavor || FLAVORS.creamy;

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const response = await fetchDataFromApi("/api/banners");
        if (response.success && response.data) {
          setBanners(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch banners:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  if (loading) {
    return (
      <section
        className="banners py-6 transition-all duration-500"
        style={{ background: flavor.gradient }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-xl"
                style={{ backgroundColor: flavor.glass }}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (banners.length === 0) {
    return null;
  }

  return (
    <section
      className="banners py-8 transition-all duration-500"
      style={{ background: flavor.gradient }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banners.map((banner) => {
            // Route Subscribe & Save banner to membership page
            const bannerLink =
              banner.title?.includes("Subscribe") ||
              banner.title?.includes("Save")
                ? "/membership"
                : banner.link || "/products";

            return (
              <Link
                key={banner._id}
                href={bannerLink}
                className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Banner Media (Image or Video) */}
                <BannerMedia banner={banner} />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />

                {/* Content */}
                <div className="absolute inset-0 p-6 flex flex-col justify-center">
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                    {banner.title}
                  </h3>
                  {banner.subtitle && (
                    <p className="text-white/90 text-sm md:text-base mb-4 max-w-xs">
                      {banner.subtitle}
                    </p>
                  )}
                  <span className="inline-flex items-center gap-2 text-white font-semibold text-sm group-hover:gap-3 transition-all">
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
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Banners;
