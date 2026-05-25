"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiArrowRight } from "react-icons/fi";
import ProductSlider from "./ProductSlider";

const PopularProducts = ({ initialProducts = [], initialCombos = [] }) => {
  const sectionRef = useRef(null);
  const hasInitialContent =
    initialProducts.length > 0 || initialCombos.length > 0;
  const [isVisible, setIsVisible] = useState(hasInitialContent);

  useEffect(() => {
    if (isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "240px 0px",
      },
    );

    const element = sectionRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-12 sm:py-16 md:py-20 transition-all duration-500"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, var(--flavor-light, #F7F1EF) 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-12 h-64 w-64 -translate-x-1/2 rounded-full blur-[110px]"
          style={{
            background: "var(--flavor-glass, rgba(90,58,46,0.22))",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4">
        <div
          className="relative overflow-hidden rounded-[2rem] border border-white/70 shadow-[0_24px_80px_rgba(90,58,34,0.10)] sm:rounded-[2.5rem]"
          style={{
            background:
              "linear-gradient(135deg, var(--flavor-card-bg, #FCF8F6) 0%, rgba(255,255,255,0.95) 56%, rgba(255,255,255,0.98) 100%)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute -right-14 top-6 h-44 w-44 rounded-full blur-[90px]"
              style={{
                background: "var(--flavor-glass, rgba(90,58,46,0.22))",
              }}
            />
            <div
              className="absolute -bottom-16 left-10 h-40 w-40 rounded-full blur-[90px]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, var(--flavor-glass, rgba(90,58,46,0.18)) 100%)",
              }}
            />
          </div>

          <div className="relative flex flex-col gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="max-w-3xl space-y-3 sm:space-y-4"
              >
                <span className="inline-flex items-center gap-2.5 rounded-full border border-white/80 bg-white/70 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.28em] text-primary shadow-[0_10px_30px_rgba(90,58,34,0.08)] backdrop-blur-md">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                  </span>
                  Trending Now
                </span>

                <h2
                  className="whitespace-nowrap text-[clamp(1.45rem,3.55vw,4.35rem)] font-black leading-[0.92] tracking-[-0.05em] transition-colors duration-500"
                  style={{ color: "var(--color-primary)" }}
                >
                  Fresh & Popular Products
                </h2>

                <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
                  Curated best-sellers with clean ingredients, richer texture,
                  and standout flavor in one polished collection.
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
                  className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-primary) 0%, var(--flavor-hover) 100%)",
                  }}
                >
                  View All
                  <FiArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="relative rounded-[1.7rem] border border-white/80 bg-white/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_18px_50px_rgba(90,58,34,0.08)] backdrop-blur-sm sm:p-5"
            >
              {isVisible ? (
                <ProductSlider
                  limit={120}
                  sortBy="popular"
                  order="desc"
                  includeCombos={true}
                  productLimit={10}
                  comboLimit={4}
                  initialProducts={initialProducts}
                  initialCombos={initialCombos}
                />
              ) : (
                <div className="flex gap-4 overflow-hidden py-4">
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="h-72 min-w-56 rounded-[1.4rem] animate-pulse"
                      style={{
                        backgroundColor:
                          "var(--flavor-glass, rgba(90,58,46,0.24))",
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PopularProducts;
