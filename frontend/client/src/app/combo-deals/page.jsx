"use client";

import ComboCard from "@/components/ComboCard";
import { fetchDataFromApi } from "@/utils/api";
import { trackEvent } from "@/utils/analyticsTracker";
import { useEffect, useMemo, useRef, useState } from "react";

const CENTERED_COMBO_GRID_CLASS = "flex flex-wrap justify-center gap-4 sm:gap-6";
const CENTERED_COMBO_CARD_CLASS =
  "shrink-0 grow-0 basis-[calc((100%_-_1rem)/2)] sm:basis-[calc((100%_-_1.5rem)/2)] md:basis-[calc((100%_-_3rem)/3)] lg:basis-[calc((100%_-_4.5rem)/4)]";

export default function ComboDealsPage() {
  const [combos, setCombos] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
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
        setTotal(Number(response.data?.total || combosList.length));
      } else {
        if (reset) {
          setCombos([]);
          setTotal(0);
        }
      }
    } catch (error) {
      if (reset) {
        setCombos([]);
        setTotal(0);
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
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Showing {renderedCombos.length} of {total || renderedCombos.length} combos
              </p>
              <div className={CENTERED_COMBO_GRID_CLASS}>
                {renderedCombos.map((combo) => (
                  <div
                    key={combo._id || combo.slug}
                    className={CENTERED_COMBO_CARD_CLASS}
                  >
                    <ComboCard
                      combo={combo}
                      context="combo_deals"
                      action="details"
                      compactListing
                    />
                  </div>
                ))}
              </div>
              {page < pages ? (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => fetchCombos({ reset: false, nextPage: page + 1 })}
                    disabled={loading}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                  >
                    {loading ? "Loading..." : "Load more combos"}
                  </button>
                </div>
              ) : null}
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
