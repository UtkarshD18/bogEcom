"use client";

import ExclusivePreviewCard from "@/components/ExclusivePreviewCard";
import useMembership from "@/hooks/useMembership";
import { resolveMembershipTheme } from "@/utils/membershipTheme";
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

const CardSkeleton = ({ delayMs = 0, theme }) => (
  <div
    className={`h-[280px] rounded-3xl border ${theme.border} bg-white/60 backdrop-blur-md animate-pulse`}
    style={{ animationDelay: `${delayMs}ms` }}
  />
);

const MembershipExclusivePreview = ({ onUnlockExclusive, theme }) => {
  const router = useRouter();
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [exclusiveProducts, setExclusiveProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const { isActiveMember, loading: membershipLoading } = useMembership({
    autoFetch: true,
  });

  const resolvedTheme = useMemo(
    () => theme || resolveMembershipTheme("mint"),
    [theme],
  );

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
    } catch {
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
      className={`relative mb-14 rounded-3xl border ${resolvedTheme.border} ${resolvedTheme.glass} p-6 sm:p-8 backdrop-blur-xl shadow-[0_28px_90px_-50px_rgba(15,23,42,0.55)] transition-all duration-700 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
    >
      <div
        className={`absolute -top-12 -right-10 h-40 w-40 rounded-full blur-3xl ${resolvedTheme.glowA}`}
      />
      <div
        className={`absolute -bottom-16 -left-10 h-44 w-44 rounded-full blur-3xl ${resolvedTheme.glowB}`}
      />

      <div className="relative z-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <span
              className={`inline-flex items-center gap-2 rounded-full border ${resolvedTheme.border} ${resolvedTheme.glass} px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${resolvedTheme.text}`}
            >
              <FaCrown className="text-amber-500" />
              Members-Only Exclusive Products
            </span>
            <h2
              className={`mt-3 bg-gradient-to-r ${resolvedTheme.accent} bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl`}
            >
              Members-Only Exclusive Products
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border ${resolvedTheme.softBorder} ${resolvedTheme.softBg} px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${resolvedTheme.softText}`}
              >
                Limited Member Drop
              </span>
              <span
                className={`inline-flex items-center rounded-full border border-white/50 bg-gradient-to-r ${resolvedTheme.badgeRich} px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white`}
              >
                Prices Reveal After Upgrade
              </span>
            </div>
          </div>
        </div>

        {membershipLoading || (isActiveMember && productsLoading) ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <CardSkeleton key={item} delayMs={item * 90} theme={resolvedTheme} />
            ))}
          </div>
        ) : showMemberEmptyState ? (
          <div
            className={`rounded-2xl border border-dashed ${resolvedTheme.border} bg-white/60 p-8 text-center`}
          >
            <p className={`text-base font-bold ${resolvedTheme.text}`}>
              No exclusive launches are live yet.
            </p>
            <p className={`mt-2 text-sm ${resolvedTheme.text} opacity-90`}>
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
                theme={resolvedTheme}
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
            className={`group relative inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r ${resolvedTheme.accent} px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-black/20 ring-2 ring-white/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}
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

