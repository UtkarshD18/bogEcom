"use client";

import { useProducts } from "@/context/ProductContext";
import { fetchDataFromApi } from "@/utils/api";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FiArrowLeft,
  FiBookOpen,
  FiCalendar,
  FiClock,
  FiEye,
  FiLink2,
} from "react-icons/fi";

const DEFAULT_PAGE = {
  article: {
    bannerStartColor: "#f97316",
    bannerEndColor: "#ec4899",
    fontFamily: "modern-sans",
  },
};

const ARTICLE_FONT_FAMILIES = {
  "modern-sans": '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  "editorial-serif": 'Georgia, Cambria, "Times New Roman", serif',
  "clean-serif": '"Palatino Linotype", "Book Antiqua", Georgia, serif',
  "compact-sans": '"Trebuchet MS", "Segoe UI", Arial, sans-serif',
};

const BLOG_CONTENT_FONT_FAMILIES = {
  "modern-sans": '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  "editorial-serif": 'Georgia, Cambria, "Times New Roman", serif',
  "clean-serif": '"Palatino Linotype", "Book Antiqua", Georgia, serif',
  "compact-sans": '"Trebuchet MS", "Segoe UI", Arial, sans-serif',
};

const BLOG_CONTENT_FONT_FAMILY_LABELS = {
  "modern-sans": "Modern Sans",
  "editorial-serif": "Editorial Serif",
  "clean-serif": "Clean Serif",
  "compact-sans": "Compact Sans",
};

const BLOG_CONTENT_FONT_SIZES = {
  sm: {
    fontSize: "0.98rem",
    lineHeight: "1.85",
  },
  base: {
    fontSize: "1.08rem",
    lineHeight: "1.95",
  },
  lg: {
    fontSize: "1.2rem",
    lineHeight: "2",
  },
  xl: {
    fontSize: "1.32rem",
    lineHeight: "2.05",
  },
};

const BLOG_CONTENT_FONT_SIZE_LABELS = {
  sm: "Small",
  base: "Medium",
  lg: "Large",
  xl: "XL",
};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const normalizeHexColor = (value, fallback) => {
  const candidate = String(value || "").trim();
  return HEX_COLOR_PATTERN.test(candidate) ? candidate : fallback;
};

const resolveBlogApiBaseUrl = () => {
  const configuredBase = String(
    process.env.NEXT_PUBLIC_APP_API_URL || process.env.NEXT_PUBLIC_API_URL || "",
  )
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "");

  if (configuredBase) {
    return configuredBase;
  }

  if (typeof window !== "undefined") {
    return String(window.location.origin || "").replace(/\/+$/, "");
  }

  return "http://127.0.0.1:8000";
};

const estimateReadTime = (content) => {
  const wordCount = String(content || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.round(wordCount / 180));
};

export default function BlogDetailPage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const { blogs, fetchBlogs } = useProducts();
  const [blog, setBlog] = useState(null);
  const [pageConfig, setPageConfig] = useState(DEFAULT_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) {
      setError("Blog not found");
      setLoading(false);
      return;
    }

    let isCancelled = false;

    const loadBlog = async () => {
      setLoading(true);
      setError(null);

      const foundBlog = Array.isArray(blogs)
        ? blogs.find((item) => item.slug === slug || String(item._id) === String(slug))
        : null;

      if (foundBlog) {
        setBlog(foundBlog);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${resolveBlogApiBaseUrl()}/api/blogs/${encodeURIComponent(slug)}`,
          {
            credentials: "include",
          },
        );

        if (isCancelled) return;

        if (!response.ok) {
          setError("Blog not found");
          setLoading(false);
          return;
        }

        const data = await response.json();
        if (data?.error || !data?.data) {
          setError("Blog not found");
          setLoading(false);
          return;
        }

        setBlog(data.data);
        setError(null);
      } catch (fetchError) {
        if (isCancelled) return;
        console.error("Error fetching blog by slug:", fetchError);
        setError("Blog not found");
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadBlog();

    return () => {
      isCancelled = true;
    };
  }, [blogs, slug]);

  useEffect(() => {
    fetchBlogs();
  }, [fetchBlogs]);

  useEffect(() => {
    const loadPageConfig = async () => {
      try {
        const response = await fetchDataFromApi("/api/blogs/page/public", {
          skipCache: true,
        });

        if (response?.error || !response?.data) {
          return;
        }

        setPageConfig({
          ...DEFAULT_PAGE,
          ...response.data,
          article: {
            ...DEFAULT_PAGE.article,
            ...(response.data.article || {}),
          },
        });
      } catch (configError) {
        console.error("Blog detail page config fetch error:", configError);
      }
    };

    loadPageConfig();
  }, []);

  useEffect(() => {
    const handleBlogUpdate = () => {
      fetchBlogs();
    };

    window.addEventListener("blogUpdated", handleBlogUpdate);
    return () => window.removeEventListener("blogUpdated", handleBlogUpdate);
  }, [fetchBlogs]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="rounded-[28px] border border-orange-100 bg-white p-10 text-center shadow-sm">
            <h1 className="mb-4 text-4xl font-bold text-gray-800">Blog Not Found</h1>
            <p className="mb-6 text-gray-600">
              Sorry, we couldn&apos;t find the blog you&apos;re looking for.
            </p>
            <Link
              href="/blogs"
              className="inline-flex items-center gap-3 rounded-full bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"
            >
              <FiArrowLeft />
              <span>Back to Blogs</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const relatedBlogs = (Array.isArray(blogs) ? blogs : []).filter(
    (item) => item.category === blog.category && item._id !== blog._id,
  );
  const shouldRenderVideo = (item) => Boolean(item?.videoUrl);
  const shouldRenderImage = (item) => Boolean(item?.image);
  const articleSettings = pageConfig?.article || DEFAULT_PAGE.article;
  const articleBannerStartColor = normalizeHexColor(
    articleSettings.bannerStartColor,
    DEFAULT_PAGE.article.bannerStartColor,
  );
  const articleBannerEndColor = normalizeHexColor(
    articleSettings.bannerEndColor,
    DEFAULT_PAGE.article.bannerEndColor,
  );
  const articleFontFamily =
    ARTICLE_FONT_FAMILIES[articleSettings.fontFamily] ||
    ARTICLE_FONT_FAMILIES[DEFAULT_PAGE.article.fontFamily];
  const blogContentFontFamily =
    BLOG_CONTENT_FONT_FAMILIES[blog.contentFontFamily] ||
    BLOG_CONTENT_FONT_FAMILIES["modern-sans"];
  const blogContentTypography =
    BLOG_CONTENT_FONT_SIZES[blog.contentFontSize] || BLOG_CONTENT_FONT_SIZES.base;
  const blogContentFontFamilyLabel =
    BLOG_CONTENT_FONT_FAMILY_LABELS[blog.contentFontFamily] || "Modern Sans";
  const blogContentFontSizeLabel =
    BLOG_CONTENT_FONT_SIZE_LABELS[blog.contentFontSize] || "Medium";
  const estimatedReadTimeMinutes = estimateReadTime(blog.content);
  const publishedDate = new Date(blog.createdAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: articleFontFamily }}>
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-4">
        <Link
          href="/blogs"
          className="group inline-flex items-center gap-3 rounded-full border border-orange-200 bg-white px-5 py-3 text-sm font-semibold text-orange-700 shadow-sm shadow-orange-100 transition duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-sm transition group-hover:scale-105">
            <FiArrowLeft className="text-base" />
          </span>
          <span className="leading-none">Back to Blogs</span>
        </Link>
      </div>

      <div
        className="py-14 text-white md:py-16"
        style={{
          backgroundImage: `linear-gradient(90deg, ${articleBannerStartColor}, ${articleBannerEndColor})`,
        }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="max-w-4xl">
            <div className="mb-5 flex flex-wrap items-center gap-3 text-sm font-medium text-white/90">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur">
                {blog.category || "General"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur">
                <FiClock className="text-sm" />
                {estimatedReadTimeMinutes} min read
              </span>
            </div>

            <h1 className="text-4xl font-bold leading-tight md:text-5xl md:leading-tight">
              {blog.title}
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/90">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur">
                <FiBookOpen className="text-sm" />
                {blog.author || "Admin"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur">
                <FiCalendar className="text-sm" />
                {publishedDate}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur">
                <FiEye className="text-sm" />
                {blog.viewCount || 0} views
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <article className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
              {shouldRenderVideo(blog) ? (
                <div className="border-b border-slate-100 bg-black/95 p-3 md:p-4">
                  <div className="overflow-hidden rounded-[24px] bg-black">
                    <video
                      src={blog.videoUrl}
                      controls
                      playsInline
                      poster={blog.image || undefined}
                      preload="metadata"
                      className="max-h-[70vh] w-full bg-black object-contain"
                    />
                  </div>
                </div>
              ) : shouldRenderImage(blog) ? (
                <div className="border-b border-slate-100 bg-white p-3 md:p-4">
                  <div className="overflow-hidden rounded-[24px] bg-white">
                    <Image
                      src={blog.image}
                      alt={blog.title}
                      width={1600}
                      height={900}
                      sizes="(max-width: 1024px) 100vw, 66vw"
                      className="max-h-[70vh] w-full object-contain"
                    />
                  </div>
                </div>
              ) : null}

              <div className="px-6 py-8 md:px-10 md:py-10">
                {blog.excerpt && (
                  <div className="mb-8 rounded-[24px] border border-orange-100 bg-gradient-to-r from-orange-50 via-white to-amber-50 px-5 py-5">
                    <p
                      className="text-slate-700 italic"
                      style={{
                        fontFamily: blogContentFontFamily,
                        fontSize: "1.14rem",
                        lineHeight: "1.9",
                      }}
                    >
                      {blog.excerpt}
                    </p>
                  </div>
                )}

                {blog.referenceLink && (
                  <div className="mb-8 rounded-[22px] border border-orange-200 bg-orange-50/80 px-5 py-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                      Reference Link
                    </p>
                    <a
                      href={blog.referenceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-3 break-all text-sm font-medium text-orange-700 transition hover:text-orange-800"
                    >
                      <FiLink2 className="mt-0.5 shrink-0" />
                      <span>{blog.referenceLink}</span>
                    </a>
                  </div>
                )}

                <div className="mb-8 flex flex-wrap gap-3 border-b border-slate-100 pb-6 text-sm text-slate-500">
                  <span className="rounded-full bg-slate-100 px-4 py-2">
                    Reader style: {blogContentFontFamilyLabel}
                  </span>
                  <span className="rounded-full bg-slate-100 px-4 py-2">
                    Size: {blogContentFontSizeLabel}
                  </span>
                </div>

                <div className="max-w-none">
                  <div
                    className="whitespace-pre-wrap text-slate-800"
                    style={{
                      fontFamily: blogContentFontFamily,
                      ...blogContentTypography,
                    }}
                  >
                    {blog.content}
                  </div>
                </div>
              </div>

              {blog.tags && blog.tags.length > 0 && (
                <div className="border-t border-slate-100 px-6 py-6 md:px-10">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {blog.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </article>
          </div>

          <div className="lg:col-span-1">
            {relatedBlogs.length > 0 ? (
              <div className="sticky top-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-orange-600">
                  Keep Reading
                </p>
                <h3 className="mb-5 text-2xl font-bold text-slate-900">Related Blogs</h3>
                <div className="space-y-5">
                  {relatedBlogs.slice(0, 3).map((relatedBlog) => (
                    <Link
                      key={relatedBlog._id}
                      href={`/blogs/${relatedBlog.slug || relatedBlog._id}`}
                      className="group block rounded-[22px] border border-slate-200 bg-slate-50/70 p-3 transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-white hover:shadow-sm"
                    >
                      {shouldRenderVideo(relatedBlog) ? (
                        <div className="mb-3 overflow-hidden rounded-2xl bg-black">
                          <video
                            src={relatedBlog.videoUrl}
                            poster={relatedBlog.image || undefined}
                            preload="metadata"
                            className="h-36 w-full object-contain"
                          />
                        </div>
                      ) : shouldRenderImage(relatedBlog) ? (
                        <div className="mb-3 overflow-hidden rounded-2xl bg-white">
                          <Image
                            src={relatedBlog.image}
                            alt={relatedBlog.title}
                            width={720}
                            height={288}
                            sizes="(max-width: 1024px) 100vw, 24vw"
                            className="h-36 w-full bg-white object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        </div>
                      ) : null}

                      <h4 className="line-clamp-2 text-base font-semibold text-slate-900 transition group-hover:text-orange-600">
                        {relatedBlog.title}
                      </h4>
                      <p className="mt-2 text-xs text-slate-500">
                        {new Date(relatedBlog.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-600">
                  Article Notes
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  This story stands on its own
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  There are no closely related posts in this category yet, so this page keeps the focus on the full article experience.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
