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
    className="h-[280px] rounded-3xl border border-white/50 bg-white/60 backdrop-blur-md animate-pulse"
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
      className={`relative mb-14 rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)] transition-all duration-700 sm:p-8 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
    >
      <div className="absolute -top-12 -right-10 h-40 w-40 rounded-full bg-[image:var(--glass-accent)] opacity-25 blur-3xl" />
      <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-[image:var(--glass-accent)] opacity-20 blur-3xl" />

      <div className="relative z-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--glass-text)] shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)]">
              <FaCrown className="text-amber-500" />
              Members-Only Exclusive Products
            </span>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Members-Only Exclusive Products
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--glass-text)]">
                Limited Member Drop
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--glass-text)]">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="text-sm text-slate-600">
            {isActiveMember
              ? "You are unlocked. Tap any card to open the full exclusive catalog."
              : "Unlock hidden VIP prices, member-first drops, and instant access to private products."}
          </p>

          <button
            type="button"
            onClick={handleUnlockCta}
            className="group relative inline-flex items-center gap-2 rounded-2xl bg-[image:var(--glass-accent)] px-6 py-3 text-sm font-extrabold text-white shadow-[var(--glass-shadow)] ring-2 ring-[var(--glass-border)] transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-[var(--glass-shadow)]"
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
