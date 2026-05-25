"use client";

import ComboCard from "@/components/ComboCard";
import { trackEvent } from "@/utils/analyticsTracker";
import {
  fetchDataFromApi,
  PUBLIC_SECTION_REQUEST_TIMEOUT_MS,
} from "@/utils/api";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const HomeComboDeals = ({ initialCombos = [] }) => {
  const [combos, setCombos] = useState(initialCombos);
  const [loading, setLoading] = useState(initialCombos.length === 0);
  const viewTracker = useRef(new Set());

  useEffect(() => {
    if (initialCombos.length > 0) {
      setCombos(initialCombos);
      setLoading(false);
      return undefined;
    }

    const fetchCombos = async () => {
      setLoading(true);
      try {
        const response = await fetchDataFromApi(
          "/api/combos?sort=priority&limit=10",
          {
            timeoutMs: PUBLIC_SECTION_REQUEST_TIMEOUT_MS,
          },
        );
        if (response?.success) {
          const items = Array.isArray(response?.data?.items)
            ? response.data.items
            : response?.data?.items || [];
          setCombos(items.slice(0, 4));
        } else {
          setCombos([]);
        }
      } catch {
        setCombos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCombos();
  }, [initialCombos]);

  useEffect(() => {
    combos.forEach((combo) => {
      const comboId = String(combo?._id || combo?.id || "");
      if (!comboId || viewTracker.current.has(comboId)) return;
      viewTracker.current.add(comboId);
      trackEvent("combo_view", {
        comboId,
        comboName: combo?.name || "",
        comboSlug: combo?.slug || "",
        comboType: combo?.comboType || "",
        sectionName: "home_combo_deals",
      });
    });
  }, [combos]);

  const renderedCombos = useMemo(() => {
    const seen = new Set();
    return combos.filter((combo) => {
      const comboId = String(
        combo?._id || combo?.id || combo?.slug || "",
      ).trim();
      if (!comboId || seen.has(comboId)) return false;
      seen.add(comboId);
      return true;
    });
  }, [combos]);

  return (
    <section
      className="relative overflow-hidden border-t border-[#eedec9] py-14 sm:py-16 md:py-20 transition-all duration-500"
      style={{
        background:
          "linear-gradient(180deg, #f7f0e5 0%, #fbf7f1 52%, #ffffff 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-20 w-full"
          style={{
            background:
              "linear-gradient(180deg, rgba(236,219,193,0.42) 0%, transparent 100%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d6b98a] to-transparent" />
        <div className="absolute -left-20 top-16 h-52 w-52 rounded-full bg-[#f5e5ca] blur-[100px]" />
        <div className="absolute -right-14 bottom-10 h-56 w-56 rounded-full bg-[rgba(90,58,34,0.10)] blur-[110px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#e8c991] bg-[#f5e5c6] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#c78608] shadow-[0_8px_24px_rgba(199,134,8,0.10)]">
              Combo Savings
            </span>
            <h2
              className="text-[clamp(2.05rem,4vw,4.2rem)] font-black tracking-[-0.05em]"
              style={{ color: "var(--color-primary)" }}
            >
              Combo Deals
            </h2>
            <p className="max-w-xl text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
              Handpicked bundles built from what customers love together, laid
              out in a warmer section so each deal block stands apart clearly.
            </p>
          </div>

          <Link
            href="/combo-deals"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95 sm:px-6 sm:py-3"
            style={{
              background:
                "linear-gradient(135deg, var(--color-primary) 0%, var(--flavor-hover) 100%)",
            }}
          >
            View All Combos
          </Link>
        </div>

        <div className="rounded-[2rem] border border-white/80 bg-white/72 p-3 shadow-[0_22px_60px_rgba(90,58,34,0.08)] backdrop-blur-sm sm:p-4 lg:p-5">
          {loading ? (
            <p className="px-2 py-4 text-sm text-slate-500">
              Loading combo deals...
            </p>
          ) : combos.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:gap-6">
              {renderedCombos.map((combo) => (
                <ComboCard
                  key={combo._id || combo.slug}
                  combo={combo}
                  context="home_combo_deals"
                  variant="compact"
                  action="details"
                />
              ))}
            </div>
          ) : (
            <p className="px-2 py-4 text-sm text-slate-500">
              No combo deals right now.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default HomeComboDeals;
