"use client";

import { useProducts } from "@/context/ProductContext";
import { getImageUrl } from "@/utils/imageUtils";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

const HomeSlider = () => {
    const { homeSlides = [], loading } = useProducts();
    const [displaySlides, setDisplaySlides] = useState(fallbackSlides);
    const [activeIndex, setActiveIndex] = useState(0);
    const swiperRef = useRef(null);

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
        <section className="relative w-full h-[60vh] md:h-[85vh] min-h-[400px] md:min-h-[600px] overflow-hidden bg-black p-0 mt-[100px] md:mt-[120px]">
            <Swiper
                speed={1000}
                spaceBetween={0}
                slidesPerView={1}
                loop={true}
                effect="fade"
                fadeEffect={{ crossFade: true }}
                autoplay={{
                    delay: 5000,
                    disableOnInteraction: false,
                }}
                pagination={{
                    clickable: true,
                    bulletClass: "swiper-pagination-bullet home-slide-bullet",
                    bulletActiveClass: "swiper-pagination-bullet-active home-slide-bullet-active",
                }}
                modules={[Autoplay, Pagination, EffectFade]}
                className="h-full w-full homeSlider"
                onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
                onSwiper={(swiper) => (swiperRef.current = swiper)}
            >
                {displaySlides.map((slide, index) => (
                    <SwiperSlide key={index} className="relative w-full h-full">
                        {/* Background Image with Ken Burns zoom */}
                        <div className="relative w-full h-full overflow-hidden">
                            <motion.img
                                src={getImageUrl(slide.image)}
                                alt={slide.title}
                                className="absolute inset-0 w-full h-full object-cover"
                                initial={{ scale: 1 }}
                                animate={activeIndex === index ? { scale: 1.08 } : { scale: 1 }}
                                transition={{ duration: 6, ease: "easeOut" }}
                            />
                            <div
                                className="absolute inset-0"
                                style={{
                                    background:
                                        "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 40%, transparent 70%)",
                                }}
                            />
                        </div>

                        {/* Content per slide */}
                        <div className="absolute inset-0 flex items-center justify-center md:justify-start px-6 md:px-20 lg:px-32">
                            <AnimatePresence mode="wait">
                                {activeIndex === index && (
                                    <motion.div
                                        key={`slide-content-${index}`}
                                        initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
                                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                        exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                                        className="max-w-xl w-full p-8 rounded-3xl backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl"
                                    >
                                        <motion.span
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.5, delay: 0.2 }}
                                            className="inline-block px-3 py-1 mb-4 text-xs font-bold tracking-widest text-primary uppercase bg-[var(--flavor-glass)] rounded-full border border-primary/20"
                                        >
                                            Top Pick
                                        </motion.span>
                                        <motion.h2
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.6, delay: 0.3 }}
                                            className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight drop-shadow-md"
                                        >
                                            {slide.title}
                                        </motion.h2>
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.6, delay: 0.5 }}
                                            className="text-lg text-gray-200 mb-8 font-medium"
                                        >
                                            {slide.subtitle}
                                        </motion.p>
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.6, delay: 0.6 }}
                                        >
                                            <Link
                                                href={slide.link}
                                                className="inline-flex items-center gap-2 px-8 py-4 bg-linear-to-r from-primary to-[var(--flavor-hover)] text-white rounded-full font-bold shadow-lg shadow-primary/40 hover:scale-105 transition-transform"
                                            >
                                                {slide.cta}
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                                </svg>
                                            </Link>
                                        </motion.div>
                                    </motion.div>
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
                    background: rgba(255,255,255,0.35) !important;
                    opacity: 1 !important;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
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
