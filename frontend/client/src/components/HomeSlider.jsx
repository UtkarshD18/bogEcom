"use client";

import { useProducts } from "@/context/ProductContext";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";

// Import Swiper styles
import "swiper/css";
import "swiper/css/effect-creative";
import "swiper/css/pagination";

import { Autoplay, EffectCreative, Pagination } from "swiper/modules";

// Fallback slides using local images from public folder
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

const HomeSlider = () => {
  const { homeSlides = [], loading } = useProducts();
  const [displaySlides, setDisplaySlides] = useState(fallbackSlides);

  useEffect(() => {
    if (homeSlides && homeSlides.length > 0) {
      const formattedSlides = homeSlides.map((slide) => ({
        image: slide.image,
        title: slide.title,
        subtitle: slide.subtitle || slide.description,
        cta: slide.buttonText || "Shop Now",
        link: slide.buttonLink || "/products",
      }));
      setDisplaySlides(formattedSlides);
    }
  }, [homeSlides]);

  return (
    <section
      className="relative w-full h-[85vh] min-h-[600px] overflow-hidden bg-black p-0"
      style={{ marginTop: "120px" }}
    >
      <Swiper
        speed={1000}
        spaceBetween={0}
        slidesPerView={1}
        loop={true}
        effect={"creative"}
        creativeEffect={{
          prev: {
            shadow: true,
            translate: ["-20%", 0, -1],
          },
          next: {
            translate: ["100%", 0, 0],
          },
        }}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
          renderBullet: function (index, className) {
            return (
              '<span class="' +
              className +
              ' !w-2.5 !h-2.5 !bg-white/40 !backdrop-blur-sm transition-all duration-300 hover:!bg-white"></span>'
            );
          },
        }}
        modules={[Autoplay, Pagination, EffectCreative]}
        className="h-full w-full [&_.swiper-pagination-bullet-active]:!w-8 [&_.swiper-pagination-bullet-active]:!rounded-full [&_.swiper-pagination-bullet-active]:!bg-white [&_.swiper-pagination-bullet-active]:!opacity-100"
      >
        {displaySlides.map((slide, index) => (
          <SwiperSlide key={index} className="relative w-full h-full">
            {/* BACKGROUND IMAGE */}
            <div className="relative w-full h-full">
              <img
                src={getImageUrl(slide.image)}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            </div>

            {/* CONTENT CARD */}
            <div className="absolute inset-0 flex items-center justify-center md:justify-start px-6 md:px-20 lg:px-32">
              <div className="max-w-xl w-full">
                {/* Glass Container */}
                <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-8 md:p-12 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] backdrop-blur-xl transition-all duration-500 hover:bg-white/15 group">
                  {/* Shimmer Effect on Card */}
                  <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rotate-45" />

                  <div className="relative z-10 space-y-6">
                    <span className="inline-block px-3 py-1 text-xs font-semibold tracking-widest uppercase text-white/90 bg-black/20 rounded-full border border-white/10 backdrop-blur-md">
                      Buy One Gram
                    </span>

                    <div className="space-y-2">
                      <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight drop-shadow-sm">
                        {slide.title}
                      </h2>
                      <p className="text-lg md:text-xl text-white/80 font-medium leading-relaxed">
                        {slide.subtitle}
                      </p>
                    </div>

                    <Link
                      href={slide.link}
                      className="group/btn relative mt-4 inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-8 py-3.5 text-black transition-all hover:bg-white/90 hover:scale-105 active:scale-95"
                    >
                      <span className="relative font-bold text-sm tracking-wide">
                        {slide.cta}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                        className="w-4 h-4 transition-transform group-hover/btn:translate-x-1"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
};

export default HomeSlider;
