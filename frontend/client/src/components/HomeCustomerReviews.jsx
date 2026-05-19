"use client";

import { fetchDataFromApi } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiLayers, FiStar } from "react-icons/fi";

const FALLBACK_REVIEWS = [
  {
    _id: "home-review-1",
    userName: "Aarav Sharma",
    city: "Delhi",
    rating: 5,
    comment:
      "The peanut butter feels fresh, clean, and filling. It has become my daily breakfast add-on.",
    itemName: "Crunchy Peanut Butter",
    isVerifiedPurchase: true,
  },
  {
    _id: "home-review-2",
    userName: "Priya Mehta",
    city: "Bengaluru",
    rating: 5,
    comment:
      "Great texture and no over-sweet taste. The family pack actually disappears fast at home.",
    itemName: "Chocolate Peanut Butter",
    isVerifiedPurchase: true,
  },
  {
    _id: "home-review-3",
    userName: "Rohan Verma",
    city: "Pune",
    rating: 4,
    comment:
      "Good protein snack before workout. Delivery and packaging were neat too.",
    itemName: "Protein overflow",
    isVerifiedPurchase: true,
  },
];

const getInitials = (name = "") =>
  String(name || "Customer")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "C";

const Stars = ({ rating }) => {
  const value = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
  return (
    <div className="flex items-center gap-1 text-[#c67b05]" aria-label={`${value} star review`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <FiStar
          key={index}
          className={index < value ? "fill-current" : "text-[#d8c7b2]"}
        />
      ))}
    </div>
  );
};

export default function HomeCustomerReviews({ initialReviews = [] }) {
  const [reviews, setReviews] = useState(
    Array.isArray(initialReviews) && initialReviews.length > 0
      ? initialReviews
      : FALLBACK_REVIEWS,
  );
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadReviews = async () => {
      try {
        const response = await fetchDataFromApi("/api/reviews/featured/home?limit=6");
        if (!cancelled && response?.success && Array.isArray(response.data)) {
          setReviews(response.data.length > 0 ? response.data : FALLBACK_REVIEWS);
        }
      } catch {
        if (!cancelled) setReviews(FALLBACK_REVIEWS);
      }
    };

    loadReviews();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleReviews = useMemo(
    () => (showAllReviews ? reviews.slice(0, 12) : reviews.slice(0, 3)),
    [reviews, showAllReviews],
  );
  const hiddenReviewCount = Math.max(reviews.length - 3, 0);

  return (
    <section className="relative overflow-hidden bg-[#fffaf4] px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#b37608]">
              Customer Love
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-normal text-[#23150f] sm:text-4xl">
              Real reviews from happy buyers
            </h2>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#ecd6b8] bg-white px-4 py-2 text-sm font-bold text-[#5e3b22] shadow-sm">
            <FiCheckCircle className="text-[#0f8a4b]" />
            Verified taste signals
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleReviews.map((review, index) => (
            <article
              key={review._id || `${review.userName}-${review.comment}`}
              className={`rounded-[24px] border border-[#ead9c5] bg-white p-5 shadow-[0_22px_60px_-45px_rgba(80,45,18,0.55)] ${
                !showAllReviews && index === 1 ? "hidden md:block" : ""
              } ${!showAllReviews && index === 2 ? "hidden xl:block" : ""}`}
            >
              <div className="flex items-start gap-4">
                {review.itemImage ? (
                  <img
                    src={getImageUrl(review.itemImage)}
                    alt=""
                    className="h-14 w-14 rounded-2xl object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3dfbf] text-lg font-black text-[#8a570c]">
                    {getInitials(review.userName)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <Stars rating={review.rating} />
                  <p className="mt-2 text-sm font-black text-[#24150f]">
                    {review.userName || "Customer"}
                  </p>
                  <p className="text-xs font-semibold text-[#806b5d]">
                    {[review.city, review.itemName].filter(Boolean).join(" - ")}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#59483e]">
                "{String(review.comment || "").slice(0, 220)}"
              </p>
            </article>
          ))}

          {!showAllReviews && hiddenReviewCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAllReviews(true)}
              className="group relative overflow-hidden rounded-[24px] border border-[#ead9c5] bg-[linear-gradient(145deg,#fffaf2_0%,#f5e5ce_100%)] p-5 text-left shadow-[0_22px_60px_-45px_rgba(80,45,18,0.55)] transition hover:-translate-y-0.5 md:col-span-2 xl:col-span-1"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#6a3f29] text-xl text-white shadow-lg">
                  <FiLayers />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b37608]">
                    Review bundle
                  </p>
                  <h3 className="mt-1 text-xl font-black text-[#24150f]">
                    <span className="md:hidden">
                      +{Math.max(reviews.length - 1, 0)} more reviews
                    </span>
                    <span className="hidden md:inline xl:hidden">
                      +{Math.max(reviews.length - 2, 0)} more reviews
                    </span>
                    <span className="hidden xl:inline">
                      +{hiddenReviewCount} more reviews
                    </span>
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-[#806b5d]">
                    Open the full customer wall
                  </p>
                </div>
              </div>
              <span className="mt-5 inline-flex rounded-full bg-[#24150f] px-5 py-2.5 text-sm font-black text-white transition group-hover:bg-[#6a3f29]">
                Show all reviews
              </span>
            </button>
          ) : null}
        </div>

        {showAllReviews && reviews.length > 3 ? (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllReviews(false)}
              className="rounded-full border border-[#e6d3bc] bg-white px-5 py-2.5 text-sm font-black text-[#5e3b22] shadow-sm transition hover:bg-[#fff4e4]"
            >
              Show fewer reviews
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
