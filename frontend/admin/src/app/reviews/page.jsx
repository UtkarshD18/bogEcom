"use client";

import { useAdmin } from "@/context/AdminContext";
import { hasAdminPermission } from "@/utils/adminPermissions";
import { deleteData, getData, patchData } from "@/utils/api";
import { Alert, CircularProgress, Pagination } from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  FiEye,
  FiEyeOff,
  FiMessageSquare,
  FiRefreshCw,
  FiSearch,
  FiStar,
  FiTrash2,
  FiX,
} from "react-icons/fi";

const REVIEW_VISIBILITY_OPTIONS = [
  { value: "", label: "All visibility" },
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
];

const REVIEW_SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "order", label: "Verified orders" },
  { value: "public", label: "Public form" },
];

const REQUEST_TIMEOUT_MS = 12000;
const PAGE_SIZE = 18;

const withRequestTimeout = async (
  promise,
  timeoutMs = REQUEST_TIMEOUT_MS,
  timeoutMessage = "Request timed out.",
) => {
  let timeoutId = null;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const prettify = (value = "") =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const visibilityTone = (value = "visible") => {
  if (value === "hidden") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const sourceTone = (value = "public") => {
  if (value === "order") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
};

const ReviewStatCard = ({ label, value, hint }) => (
  <div className="rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-sm shadow-orange-100">
    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
      {label}
    </p>
    <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
    <p className="mt-2 text-sm text-slate-500">{hint}</p>
  </div>
);

const ReviewStars = ({ rating = 0 }) => (
  <div className="flex items-center gap-1 text-amber-500">
    {Array.from({ length: 5 }).map((_, index) => (
      <FiStar
        key={index}
        className={index < Math.round(Number(rating || 0)) ? "fill-current" : ""}
      />
    ))}
  </div>
);

export default function ReviewsPage() {
  const { token, admin, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const canManageReviews = useMemo(
    () => hasAdminPermission(admin, "manage_crm"),
    [admin],
  );

  const [reviews, setReviews] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    visibility: "",
    source: "",
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewsLoadError, setReviewsLoadError] = useState("");
  const [activeReviewId, setActiveReviewId] = useState("");

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  const loadReviews = useCallback(async () => {
    if (!token || !canManageReviews) return;

    setLoadingReviews(true);
    setReviewsLoadError("");

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.visibility) params.set("visibility", filters.visibility);
      if (filters.source) params.set("source", filters.source);

      const response = await withRequestTimeout(
        getData(`/api/admin/reviews?${params.toString()}`, token),
        REQUEST_TIMEOUT_MS,
        "Loading reviews is taking longer than expected.",
      );

      if (!response?.success) {
        throw new Error(response?.message || "Failed to load reviews.");
      }

      setReviews(Array.isArray(response.data) ? response.data : []);
      setTotalReviews(Number(response.pagination?.total || 0));
      setTotalPages(Math.max(Number(response.pagination?.totalPages || 1), 1));
    } catch (error) {
      setReviews([]);
      setTotalReviews(0);
      setTotalPages(1);
      const nextMessage = error?.message || "Failed to load reviews.";
      setReviewsLoadError(nextMessage);
      toast.error(nextMessage);
    } finally {
      setLoadingReviews(false);
    }
  }, [canManageReviews, filters, page, token]);

  useEffect(() => {
    if (!isAuthenticated || !token || !canManageReviews) return;
    loadReviews();
  }, [canManageReviews, isAuthenticated, loadReviews, token]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setPage(1);
    setFilters((current) => ({
      ...current,
      q: searchInput.trim(),
    }));
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setPage(1);
    setFilters({
      q: "",
      visibility: "",
      source: "",
    });
  };

  const handleVisibilityChange = async (reviewId, nextVisibility) => {
    if (!reviewId || !token) return;

    setActiveReviewId(reviewId);

    try {
      const response = await patchData(
        `/api/admin/reviews/${reviewId}`,
        { visibility: nextVisibility },
        token,
      );

      if (!response?.success) {
        throw new Error(response?.message || "Failed to update review.");
      }

      setReviews((current) =>
        current.map((review) =>
          review._id === reviewId
            ? {
                ...review,
                ...(response.data || {}),
                visibility: response.data?.visibility || nextVisibility,
              }
            : review,
        ),
      );
      toast.success(`Review marked ${prettify(nextVisibility)}.`);
    } catch (error) {
      toast.error(error?.message || "Failed to update review.");
    } finally {
      setActiveReviewId("");
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!reviewId || !token) return;

    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm("Delete this review permanently?");
    if (!confirmed) return;

    setActiveReviewId(reviewId);

    try {
      const response = await deleteData(`/api/admin/reviews/${reviewId}`, token);

      if (!response?.success) {
        throw new Error(response?.message || "Failed to delete review.");
      }

      toast.success("Review deleted.");
      if (reviews.length === 1 && page > 1) {
        setPage((current) => Math.max(current - 1, 1));
      } else {
        await loadReviews();
      }
    } catch (error) {
      toast.error(error?.message || "Failed to delete review.");
    } finally {
      setActiveReviewId("");
    }
  };

  const reviewStats = useMemo(() => {
    const visibleCount = reviews.filter(
      (review) => (review.visibility || "visible") === "visible",
    ).length;
    const verifiedCount = reviews.filter((review) =>
      Boolean(review.isVerifiedPurchase),
    ).length;
    const avgRating = reviews.length
      ? (
          reviews.reduce(
            (sum, review) => sum + Number(review.rating || 0),
            0,
          ) / reviews.length
        ).toFixed(1)
      : "0.0";

    return {
      visibleCount,
      verifiedCount,
      avgRating,
    };
  }, [reviews]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <CircularProgress />
      </div>
    );
  }

  if (!canManageReviews) {
    return (
      <section className="p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <Alert severity="error">
            You do not have permission to manage customer reviews.
          </Alert>
        </div>
      </section>
    );
  }

  return (
    <section className="p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[32px] border border-orange-100 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_30%),linear-gradient(135deg,#fffaf3_0%,#ffffff_55%,#fff3e6_100%)] p-6 shadow-[0_24px_80px_rgba(120,53,15,0.08)] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-orange-500">
                Review Moderation
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Review, hide, and remove customer feedback from one page
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
                This page is built for quick moderation. Search reviews, spot
                verified purchases, hide weak entries from the storefront, or
                delete them permanently without bouncing through CRM settings.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadReviews()}
              disabled={loadingReviews}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw className={loadingReviews ? "animate-spin" : ""} />
              {loadingReviews ? "Refreshing..." : "Refresh reviews"}
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReviewStatCard
              label="Results"
              value={totalReviews}
              hint="Reviews matching your current filters"
            />
            <ReviewStatCard
              label="Visible now"
              value={reviewStats.visibleCount}
              hint="Visible reviews in the current page"
            />
            <ReviewStatCard
              label="Verified"
              value={reviewStats.verifiedCount}
              hint="Verified-purchase entries in the current page"
            />
            <ReviewStatCard
              label="Avg rating"
              value={reviewStats.avgRating}
              hint="Average rating across the loaded page"
            />
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <form
            onSubmit={handleSearchSubmit}
            className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_220px_220px_auto_auto]"
          >
            <label className="relative block">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search reviewer, city, email, or comment..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-50"
              />
            </label>

            <select
              value={filters.visibility}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  visibility: event.target.value,
                }));
              }}
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-50"
            >
              {REVIEW_VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value || "all-visibility"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filters.source}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  source: event.target.value,
                }));
              }}
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-50"
            >
              {REVIEW_SOURCE_OPTIONS.map((option) => (
                <option key={option.value || "all-source"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Search
            </button>

            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <FiX />
              Clear
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              Quick actions: show, hide, delete
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              Page size: {PAGE_SIZE}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              Current query: {filters.q || "none"}
            </span>
          </div>
        </div>

        {loadingReviews ? (
          <div className="flex justify-center rounded-[28px] border border-slate-200 bg-white py-20 shadow-sm">
            <CircularProgress />
          </div>
        ) : reviewsLoadError ? (
          <div className="rounded-[28px] border border-red-100 bg-white p-5 shadow-sm">
            <Alert severity="error">{reviewsLoadError}</Alert>
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-14 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-800">
              No reviews matched the current filters
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Try clearing filters or broadening the search query.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {reviews.map((review) => {
              const isBusy = activeReviewId === review._id;
              const currentVisibility = review.visibility || "visible";
              const nextVisibility =
                currentVisibility === "visible" ? "hidden" : "visible";
              const itemName =
                review.combo?.name ||
                review.product?.name ||
                review.comboId ||
                review.productId ||
                "Unknown item";

              return (
                <article
                  key={review._id}
                  className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-50 text-lg font-bold text-amber-700">
                        {String(review.userName || "C").trim().slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-slate-900">
                            {review.userName || "Customer"}
                          </h2>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${visibilityTone(
                              currentVisibility,
                            )}`}
                          >
                            {prettify(currentVisibility)}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${sourceTone(
                              review.source || "public",
                            )}`}
                          >
                            {prettify(review.source || "public")}
                          </span>
                          {review.isVerifiedPurchase ? (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                              Verified purchase
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500">
                          <span>{review.userEmail || "No email shared"}</span>
                          <span>{review.city || "No city"}</span>
                          <span>{formatDateTime(review.createdAt)}</span>
                        </div>

                        <div className="mt-3 flex items-center gap-3">
                          <ReviewStars rating={review.rating} />
                          <span className="text-sm font-semibold text-slate-700">
                            {Number(review.rating || 0).toFixed(1)} / 5
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleVisibilityChange(review._id, nextVisibility)
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {currentVisibility === "visible" ? <FiEyeOff /> : <FiEye />}
                        {currentVisibility === "visible" ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDeleteReview(review._id)}
                        className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiTrash2 />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Item
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {itemName}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Order Ref
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {review.order?._id || review.orderId || "Public / none"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Review Id
                      </p>
                      <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                        {review._id}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[24px] border border-orange-100 bg-gradient-to-r from-orange-50/90 via-white to-amber-50/80 px-5 py-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
                      <FiMessageSquare />
                      Review Comment
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {review.comment || "No written comment."}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex justify-center rounded-[28px] border border-slate-200 bg-white px-4 py-5 shadow-sm">
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_event, nextPage) => setPage(nextPage)}
              showFirstButton
              showLastButton
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
