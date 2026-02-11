"use client";
import FlavorSwitcherBar from "./FlavorSwitcherBar";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { fetchDataFromApi } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useContext, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/navigation";

const CatSlider = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const context = useContext(MyContext);
    const flavor = context?.flavor || FLAVORS.creamy;

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await fetchDataFromApi("/api/categories");
                if (response.success && response.data) {
                    const parentCategories = response.data.filter((cat) => !cat.parent);
                    setCategories(parentCategories);
                }
            } catch (error) {
                console.error("Failed to fetch categories:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCategories();
    }, []);

    if (loading) {
        return (
            <div className="py-12 bg-gray-50/50">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex gap-4 overflow-hidden">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="w-40 h-40 bg-gray-200 rounded-3xl animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (categories.length === 0) return null;

    return (
        <div>
            <FlavorSwitcherBar />
            <section className="py-10 sm:py-14 bg-gradient-to-b from-white to-gray-50/50">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="max-w-7xl mx-auto px-4"
                >
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                            Shop by Category
                        </h2>
                        <Link
                            href="/products"
                            className="font-bold text-sm px-6 py-2.5 rounded-full bg-primary text-white shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95"
                        >
                            View All
                        </Link>
                    </div>

                    <Swiper
                        spaceBetween={16}
                        slidesPerView={2}
                        navigation
                        modules={[Navigation]}
                        breakpoints={{
                            480: { slidesPerView: 3, spaceBetween: 16 },
                            640: { slidesPerView: 4, spaceBetween: 20 },
                            768: { slidesPerView: 5, spaceBetween: 24 },
                            1024: { slidesPerView: 6, spaceBetween: 24 },
                        }}
                        className="pb-4 !px-1"
                    >
                        {categories.map((category, index) => (
                            <SwiperSlide key={category._id}>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.4, delay: index * 0.05 }}
                                    viewport={{ once: true }}
                                >
                                    <Link
                                        href={`/products?category=${category._id}`}
                                        className="group block rounded-[2.5rem] p-6 text-center transition-all duration-500 hover:-translate-y-2 bg-white border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30 h-full flex flex-col items-center justify-center min-h-[220px] w-full"
                                    >
                                        <div className="aspect-square w-28 h-28 mb-6 rounded-[2rem] overflow-hidden bg-gray-50 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-700 ring-8 ring-transparent group-hover:ring-primary/20">
                                            {category.image ? (
                                                <img
                                                    src={getImageUrl(category.image)}
                                                    alt={category.name}
                                                    className="w-full h-full object-cover p-2"
                                                />
                                            ) : (
                                                <span className="text-5xl">🥜</span>
                                            )}
                                        </div>

                                        <h3 className="text-[13px] font-black text-gray-800 group-hover:text-primary transition-colors uppercase tracking-[0.1em]">
                                            {category.name}
                                        </h3>
                                    </Link>
                                </motion.div>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </motion.div>
            </section>
        </div>
    );
};

export default CatSlider;
