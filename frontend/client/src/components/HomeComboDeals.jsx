"use client";

import ComboCard from "@/components/ComboCard";
import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { fetchDataFromApi } from "@/utils/api";
import { trackEvent } from "@/utils/analyticsTracker";
import Link from "next/link";
import { useContext, useEffect, useMemo, useRef, useState } from "react";

const HomeComboDeals = () => {
  const context = useContext(MyContext);
  const flavor = context?.flavor || FLAVORS.creamy;

  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(false);
  const viewTracker = useRef(new Set());

  useEffect(() => {
    const fetchCombos = async () => {
      setLoading(true);
      try {
        const response = await fetchDataFromApi("/api/combos?limit=4");
        if (response?.success) {
          const items = Array.isArray(response?.data?.items)
            ? response.data.items
            : response?.data?.items || [];
          setCombos(items);
        } else {
          setCombos([]);
        }
      } catch (error) {
        setCombos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCombos();
  }, []);

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
      const comboId = String(combo?._id || combo?.id || combo?.slug || "").trim();
      if (!comboId || seen.has(comboId)) return false;
      seen.add(comboId);
      return true;
    });
  }, [combos]);

  return (
    <section
      className="relative py-12 sm:py-16 md:py-20 overflow-hidden transition-all duration-500"
      style={{ backgroundColor: flavor.light }}
    >
      <div className="relative max-w-7xl mx-auto px-4 z-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="max-w-lg space-y-3">
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest font-extrabold px-4 py-2 rounded-full bg-[var(--flavor-glass)] text-primary border border-primary/20">
              Combo Savings
            </span>
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight"
              style={{ color: "var(--color-primary)" }}
            >
              Combo Deals
            </h2>
            <p className="text-sm sm:text-base text-gray-500 font-medium leading-relaxed max-w-md">
              Handpicked bundles built from what customers love together.
            </p>
          </div>

          <Link
            href="/combo-deals"
            className="self-start md:self-auto inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white shadow-lg shadow-primary/30 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 active:scale-95"
            style={{
              background:
                "linear-gradient(135deg, var(--color-primary) 0%, var(--flavor-hover) 100%)",
            }}
          >
            View All Combos
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading combo deals...</p>
        ) : combos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
          <p className="text-sm text-gray-500">No combo deals right now.</p>
        )}
      </div>
    </section>
  );
};

export default HomeComboDeals;
