"use client";

import ExclusivePreviewCard from "@/components/ExclusivePreviewCard";
import useMembership from "@/hooks/useMembership";
import { fetchDataFromApi } from "@/utils/api";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCrown } from "react-icons/fa";

const TEASER_PRODUCTS = [
  {
    _id: "teaser-1",
    name: "Elite Protein Shaker",
    brand: "Members Series",
    image: "/product_1.png",
  },
  {
    _id: "teaser-2",
    name: "Recovery Blend Box",
    brand: "Members Series",
    image: "/product_2.png",
  },
  {
    _id: "teaser-3",
    name: "Performance Stack Kit",
    brand: "Members Series",
    image: "/product_3.png",
  },
  {
    _id: "teaser-4",
    name: "Night Wellness Pack",
    brand: "Members Series",
    image: "/product_4.png",
  },
];

const CardSkeleton = ({ delayMs = 0 }) => (
  <div
    className="h-[280px] rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)] animate-pulse"
    style={{ animationDelay: `${delayMs}ms` }}
  />
);

const MembershipExclusivePreview = ({ onUnlockExclusive }) => {
  const router = useRouter();
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [exclusiveProducts, setExclusiveProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const { isActiveMember, loading: membershipLoading } = useMembership({
    autoFetch: true,
  });

  useEffect(() => {
    const target = sectionRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const loadExclusiveProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      const response = await fetchDataFromApi("/api/products/exclusive?limit=4");
      if (response?.success && Array.isArray(response?.data)) {
        setExclusiveProducts(response.data);
      } else {
        setExclusiveProducts([]);
      }
    } catch (error) {
      setExclusiveProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Security: only active members request the real exclusive products API.
    if (!isActiveMember) {
      setExclusiveProducts([]);
      return;
    }
    loadExclusiveProducts();
  }, [isActiveMember, loadExclusiveProducts]);

  const displayProducts = useMemo(() => {
    if (!isActiveMember) return TEASER_PRODUCTS;
    return exclusiveProducts.length > 0 ? exclusiveProducts.slice(0, 4) : [];
  }, [exclusiveProducts, isActiveMember]);

  const showMemberEmptyState =
    !membershipLoading &&
    !productsLoading &&
    isActiveMember &&
    displayProducts.length === 0;

  const handleUnlockCta = () => {
    if (isActiveMember) {
      router.push("/exclusive-products");
      return;
    }

    if (typeof onUnlockExclusive === "function") {
      onUnlockExclusive();
      return;
    }

    const pricingSection = document.getElementById("membership-pricing");
    pricingSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCardClick = () => {
    if (!isActiveMember) return;
    router.push("/exclusive-products");
  };

  return (
    <section
      ref={sectionRef}
      className={`relative mb-14 overflow-hidden rounded-[28px] border border-white/40 bg-white/35 p-6 shadow-[0_40px_120px_rgba(124,58,237,0.18)] backdrop-blur-2xl transition-all duration-700 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.18),transparent_60%)] before:pointer-events-none sm:p-8 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
    >
      <div className="absolute -top-12 -right-10 h-40 w-40 rounded-full bg-[#e8deff] opacity-25 blur-3xl" />
      <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-[#e8deff] opacity-20 blur-3xl" />

      <div className="relative z-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6d5dfc] via-[#8b5cf6] to-[#ec4899] px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-white shadow-[0_4px_12px_rgba(168,85,247,0.35)]">
              <FaCrown className="text-amber-500" />
              Members-Only Exclusive Products
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#5b4fd6] drop-shadow-[0_2px_6px_rgba(124,58,237,0.15)] sm:text-3xl">
              Members-Only Exclusive Products
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-[#e3dbff] bg-[#f9f7ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5b4fd6]">
                Limited Member Drop
              </span>
              <span className="inline-flex items-center rounded-full border border-[#e3dbff] bg-[#f9f7ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5b4fd6]">
                Prices Reveal After Upgrade
              </span>
            </div>
          </div>
        </div>

        {membershipLoading || (isActiveMember && productsLoading) ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <CardSkeleton key={item} delayMs={item * 90} />
            ))}
          </div>
        ) : showMemberEmptyState ? (
          <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 text-center backdrop-blur-[var(--glass-blur)]">
            <p className="text-base font-bold text-[var(--glass-text)]">
              No exclusive launches are live yet.
            </p>
            <p className="mt-2 text-sm text-[var(--glass-text)]/80">
              Your membership is active. New drops will appear here first.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {displayProducts.map((product, index) => (
              <ExclusivePreviewCard
                key={product?._id || `preview-${index}`}
                product={product}
                isLocked={!isActiveMember}
                onClick={handleCardClick}
                animationDelayMs={index * 90}
              />
            ))}
          </div>
        )}

        <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--glass-text)]/80">
            {isActiveMember
              ? "You are unlocked. Tap any card to open the full exclusive catalog."
              : "Unlock hidden VIP prices, member-first drops, and instant access to private products."}
          </p>

          <button
            type="button"
            onClick={handleUnlockCta}
            className="group relative inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#6d5dfc] via-[#8b5cf6] to-[#ec4899] px-6 py-3 text-sm font-extrabold text-white shadow-[0_10px_30px_rgba(124,58,237,0.35)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_14px_40px_rgba(124,58,237,0.45)] hover:ring-2 hover:ring-purple-300/50 active:scale-[0.98]"
          >
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/0 via-white/30 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <span className="relative z-10">
              {isActiveMember
                ? "Browse Exclusive Products"
                : "Start Membership Unlock VIP Deals"}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default MembershipExclusivePreview;
