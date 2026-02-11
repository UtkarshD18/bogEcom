"use client";

import { useProducts } from "@/context/ProductContext";
import { getImageUrl } from "@/utils/imageUtils";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/effect-creative";
import "swiper/css/pagination";

import { Autoplay, EffectCreative, Pagination } from "swiper/modules";

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
        <section className="relative w-full h-[60vh] md:h-[85vh] min-h-[400px] md:min-h-[600px] overflow-hidden bg-black p-0 mt-[100px] md:mt-[120px]">
            <Swiper
                speed={1200}
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
                }}
                modules={[Autoplay, Pagination, EffectCreative]}
                className="h-full w-full"
            >
                {displaySlides.map((slide, index) => (
                    <SwiperSlide key={index} className="relative w-full h-full">
                        {/* Background Image */}
                        <div className="relative w-full h-full">
                            <img
                                src={getImageUrl(slide.image)}
                                alt={slide.title}
                                className="absolute inset-0 w-full h-full object-cover"
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
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                                className="max-w-xl w-full p-8 rounded-3xl backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl"
                            >
                                <motion.span
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5, delay: 0.4 }}
                                    className="inline-block px-3 py-1 mb-4 text-xs font-bold tracking-widest text-primary uppercase bg-[var(--flavor-glass)] rounded-full border border-primary/20"
                                >
                                    Top Pick
                                </motion.span>
                                <motion.h2
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.5 }}
                                    className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight drop-shadow-md"
                                >
                                    {slide.title}
                                </motion.h2>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.6, delay: 0.7 }}
                                    className="text-lg text-gray-200 mb-8 font-medium"
                                >
                                    {slide.subtitle}
                                </motion.p>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.9 }}
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
                        </div>
                    </SwiperSlide>
                ))}
            </Swiper>
        </section>
    );
};

export default HomeSlider;
