"use client";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { AiOutlineCheck } from "react-icons/ai";
import { motion } from "framer-motion";

export default function MembershipCTA() {
    const router = useRouter();
    const themeContext = useContext(MyContext);
    const flavor = themeContext?.flavor || FLAVORS.creamy;
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const benefits = [
        { emoji: "💰", title: "Save ₹2000+", desc: "Annually with discounts" },
        { emoji: "📦", title: "Free Shipping", desc: "On all your orders" },
        { emoji: "🎧", title: "24/7 Support", desc: "Dedicated member hotline" },
        { emoji: "🚀", title: "Early Access", desc: "To new product launches" },
    ];

    const checkItems = [
        "15% discount on all orders",
        "Free shipping on every purchase",
        "Exclusive member-only products",
        "Priority customer support",
        "Monthly wellness tips & guides",
    ];

    return (
        <section
            className="membership-content relative mt-0 mb-0 pb-16 sm:pb-20 overflow-hidden"
            style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${flavor.color} 85%, #1a1a2e), color-mix(in srgb, ${flavor.hover} 70%, #1a1a2e) 50%, color-mix(in srgb, ${flavor.color} 60%, #2d1b4e))`,
            }}
        >
            {/* Decorative blobs */}
            <div
                className="absolute top-0 right-0 w-96 h-96 rounded-full blur-[100px] pointer-events-none"
                style={{ backgroundColor: `color-mix(in srgb, ${flavor.color} 30%, transparent)` }}
            />
            <div
                className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-[100px] pointer-events-none"
                style={{ backgroundColor: `color-mix(in srgb, ${flavor.hover} 30%, transparent)` }}
            />

            <div className="container mx-auto px-4 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    {/* Left Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="text-white pt-4 sm:pt-6"
                    >
                        <h2 className="text-4xl sm:text-5xl font-black mb-6 leading-tight">
                            Join Our Buy One <br />Gram Club
                        </h2>
                        <p className="text-lg font-medium mb-8 max-w-md" style={{ color: `color-mix(in srgb, ${flavor.light} 80%, white)` }}>
                            Unlock premium benefits, exclusive savings, and prioritize your health journey with us.
                        </p>

                        <div className="space-y-4 mb-10">
                            {checkItems.map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.5, delay: i * 0.1 }}
                                    className="flex items-center gap-4"
                                >
                                    <span
                                        className="flex items-center justify-center w-6 h-6 rounded-full text-white shrink-0"
                                        style={{ backgroundColor: flavor.color, boxShadow: `0 4px 12px color-mix(in srgb, ${flavor.color} 40%, transparent)` }}
                                    >
                                        <AiOutlineCheck size={12} />
                                    </span>
                                    <span className="text-sm font-semibold text-white/90">{item}</span>
                                </motion.div>
                            ))}
                        </div>

                        <motion.button
                            onClick={() => router.push("/membership")}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="group inline-flex items-center gap-3 px-8 py-4 bg-white rounded-full font-bold shadow-xl transition-all active:scale-95"
                            style={{ color: `color-mix(in srgb, ${flavor.color} 80%, #1a1a2e)` }}
                            onHoverStart={() => { }}
                        >
                            Explore Plans
                            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </motion.button>
                    </motion.div>

                    {/* Right Grid */}
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={{
                            hidden: { opacity: 0 },
                            visible: {
                                opacity: 1,
                                transition: {
                                    staggerChildren: 0.15
                                }
                            }
                        }}
                        className="grid grid-cols-2 gap-4"
                    >
                        {benefits.map((item, i) => (
                            <motion.div
                                key={i}
                                variants={{
                                    hidden: { opacity: 0, y: 20 },
                                    visible: { opacity: 1, y: 0 }
                                }}
                                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                className="p-6 rounded-3xl bg-white/10 backdrop-blur-lg border border-white/20 hover:bg-white/20 transition-colors shadow-lg"
                            >
                                <div className="text-4xl mb-4 grayscale mix-blend-screen">{item.emoji}</div>
                                <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                                <p className="text-xs font-medium" style={{ color: `color-mix(in srgb, ${flavor.light} 60%, white)` }}>{item.desc}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
