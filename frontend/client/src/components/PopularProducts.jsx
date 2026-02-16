"use client";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { motion } from "framer-motion";
import Link from "next/link";
import { useContext } from "react";
import { FiArrowRight } from "react-icons/fi";
import ProductSlider from "./ProductSlider";

const PopularProducts = () => {
    const context = useContext(MyContext);
    const flavor = context?.flavor || FLAVORS.creamy;

    return (
        <section
            className="relative py-12 sm:py-16 md:py-20 overflow-hidden transition-all duration-500"
            style={{ backgroundColor: flavor.light }}
        >
            {/* Decorative blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-20 -right-28 h-72 w-72 rounded-full bg-primary/20 blur-[100px]" />
                <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-purple-500/10 blur-[100px]" />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 sm:gap-8 mb-8 sm:mb-12">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="max-w-lg space-y-3 sm:space-y-4"
                    >
                        {/* Trending badge */}
                        <span className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-widest font-extrabold px-4 py-2 rounded-full bg-[var(--flavor-glass)] text-primary border border-primary/20">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                            </span>
                            Trending Now
                        </span>

                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight transition-colors duration-500" style={{ color: 'var(--color-primary)' }}>
                            Popular Products
                        </h2>

                        <p className="text-sm sm:text-base text-gray-500 font-medium leading-relaxed max-w-md">
                            Curated best-sellers with clean ingredients and bold flavor.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <Link
                            href="/products"
                            className="self-start md:self-auto inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-sm text-white shadow-lg shadow-primary/30 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 active:scale-95"
                            style={{
                                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--flavor-hover) 100%)",
                            }}
                        >
                            View All
                            <FiArrowRight className="w-4 h-4" />
                        </Link>
                    </motion.div>
                </div>

                {/* Product Slider Container */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="relative rounded-3xl p-4 sm:p-6 bg-white shadow-xl shadow-gray-200/50 border border-gray-100"
                >
                    <ProductSlider isFeatured={true} limit={10} />
                </motion.div>
            </div>
        </section >
    );
};

export default PopularProducts;
