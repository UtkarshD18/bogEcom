"use client";

import ComboCard from "@/components/ComboCard";
import { fetchDataFromApi } from "@/utils/api";
import { trackEvent } from "@/utils/analyticsTracker";
import { useEffect, useRef, useState } from "react";

export default function ComboDealsPage() {
  const [combos, setCombos] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const viewTracker = useRef(new Set());
  const loaderRef = useRef(null);

  const buildQuery = (pageNumber = 1) => {
    const params = new URLSearchParams();
    params.set("page", String(pageNumber));
    params.set("limit", "12");
    return params.toString();
  };

  const fetchCombos = async ({ reset = false, nextPage = 1 } = {}) => {
    setLoading(true);
    try {
      const response = await fetchDataFromApi(`/api/combos?${buildQuery(nextPage)}`);
      if (response?.success) {
        const combosList = Array.isArray(response?.data?.items)
          ? response.data.items
          : response?.data?.items || [];

        setCombos((prev) => (reset ? combosList : [...prev, ...combosList]));
        setPage(response.data?.page || nextPage);
        setPages(response.data?.pages || 1);
      } else {
        if (reset) {
          setCombos([]);
        }
      }
    } catch (error) {
      if (reset) {
        setCombos([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCombos({ reset: true, nextPage: 1 });
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
        sectionName: "combo_deals",
      });
    });
  }, [combos]);

  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (loading) return;
        if (page >= pages) return;
        fetchCombos({ reset: false, nextPage: page + 1 });
      },
      { rootMargin: "200px" },
    );

    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loaderRef, loading, page, pages]);

  const hasCombos = combos.length > 0;

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-900">
              Combo <span className="text-primary">Deals</span>
            </h1>
            <p className="text-gray-500 mt-2 max-w-2xl">
              Discover curated bundles crafted to boost savings and help you explore
              more of what you love.
            </p>
          </div>

        </header>

        <section data-track-section="combo_deals_grid">
          {hasCombos ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {combos.map((combo) => (
                <ComboCard
                  key={combo._id || combo.slug}
                  combo={combo}
                  context="combo_deals"
                />
              ))}
            </div>
          ) : loading ? (
            <p className="text-sm text-gray-500">Loading combos...</p>
          ) : (
            <div className="text-sm text-gray-500">
              No combos available right now.
            </div>
          )}
        </section>

        <div ref={loaderRef} />
        {loading && hasCombos && (
          <p className="text-sm text-gray-500 text-center">Loading more combos...</p>
        )}
      </div>
    </div>
  );
}
