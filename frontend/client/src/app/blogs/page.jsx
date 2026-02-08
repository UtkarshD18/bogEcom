"use client";

import { useProducts } from "@/context/ProductContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
)
  .trim()
  .replace(/\/+$/, "");

const DEFAULT_PAGE = {
  theme: { style: "mint", layout: "magazine" },
  sections: { hero: true, featured: true, grid: true, newsletter: true },
  hero: {
    badge: "Health & Wellness Insights",
    title: "The Journal",
    description:
      "Expert insights on nutrition, wellness, and the science behind healthy living. No fluff, just evidence-backed guidance.",
  },
  newsletter: {
    title: "Don't Miss Our Latest Articles",
    description:
      "Subscribe to get weekly insights, wellness tips, and exclusive health recommendations delivered to your inbox.",
    inputPlaceholder: "Enter your email address",
    buttonText: "Subscribe",
    note: "We respect your privacy. Unsubscribe at any time.",
  },
};

const THEME_PRESETS = {
  mint: {
    accent: "from-emerald-600 to-teal-600",
    accentStrong: "from-emerald-500 to-teal-500",
    accentText: "text-emerald-600",
    accentSoft: "bg-emerald-600/10 border-emerald-600/20 text-emerald-600",
    glowA: "bg-emerald-500",
    glowB: "bg-teal-400",
  },
  sky: {
    accent: "from-sky-600 to-cyan-600",
    accentStrong: "from-sky-500 to-cyan-500",
    accentText: "text-sky-600",
    accentSoft: "bg-sky-600/10 border-sky-600/20 text-sky-600",
    glowA: "bg-sky-500",
    glowB: "bg-cyan-400",
  },
  aurora: {
    accent: "from-lime-600 to-emerald-600",
    accentStrong: "from-lime-500 to-emerald-500",
    accentText: "text-emerald-700",
    accentSoft:
      "bg-emerald-600/10 border-emerald-600/20 text-emerald-700",
    glowA: "bg-lime-500",
    glowB: "bg-emerald-400",
  },
  lavender: {
    accent: "from-indigo-600 to-purple-600",
    accentStrong: "from-indigo-500 to-purple-500",
    accentText: "text-indigo-700",
    accentSoft: "bg-indigo-600/10 border-indigo-600/20 text-indigo-700",
    glowA: "bg-indigo-500",
    glowB: "bg-purple-400",
  },
};

const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
};

export default function BlogPage() {
  const { blogs = [], fetchBlogs } = useProducts();
  const [pageConfig, setPageConfig] = useState(DEFAULT_PAGE);

  const themeStyle = pageConfig?.theme?.style || DEFAULT_PAGE.theme.style;
  const layout = pageConfig?.theme?.layout || DEFAULT_PAGE.theme.layout;
  const theme = useMemo(
    () => THEME_PRESETS[themeStyle] || THEME_PRESETS.mint,
    [themeStyle],
  );

  const sections = pageConfig?.sections || DEFAULT_PAGE.sections;
  const showHero = sections.hero !== false;
  const showFeatured = sections.featured !== false;
  const showGrid = sections.grid !== false;
  const showNewsletter = sections.newsletter !== false;

  const featuredBlog = blogs.length > 0 ? blogs[0] : null;
  const otherBlogs = blogs.slice(1);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/blogs/page/public`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data?.success && data?.data) {
          setPageConfig({
            ...DEFAULT_PAGE,
            ...data.data,
            theme: { ...DEFAULT_PAGE.theme, ...(data.data.theme || {}) },
            sections: { ...DEFAULT_PAGE.sections, ...(data.data.sections || {}) },
            hero: { ...DEFAULT_PAGE.hero, ...(data.data.hero || {}) },
            newsletter: {
              ...DEFAULT_PAGE.newsletter,
              ...(data.data.newsletter || {}),
            },
          });
        }
      } catch (error) {
        console.error("BlogPage config fetch error:", error);
      }
    };

    fetchPage();
  }, []);

  // Listen for blog updates from admin
  useEffect(() => {
    const handleBlogUpdate = (event) => {
      console.log("Blog updated event received:", event.detail);
      fetchBlogs();
    };

    window.addEventListener("blogUpdated", handleBlogUpdate);
    return () => window.removeEventListener("blogUpdated", handleBlogUpdate);
  }, [fetchBlogs]);

  if (layout === "minimal") {
    return (
      <main className="bg-white min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          {showHero && (
            <section className="max-w-3xl">
              {pageConfig?.hero?.badge && (
                <span
                  className={[
                    "inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border",
                    theme.accentSoft,
                  ].join(" ")}
                >
                  {pageConfig.hero.badge}
                </span>
              )}
              <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold text-gray-900">
                {pageConfig?.hero?.title || DEFAULT_PAGE.hero.title}
              </h1>
              {pageConfig?.hero?.description && (
                <p className="mt-4 text-gray-600 text-lg leading-relaxed">
                  {pageConfig.hero.description}
                </p>
              )}
            </section>
          )}

          {showGrid && (
            <section className="mt-10">
              {blogs.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center text-gray-600">
                  No blogs yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {blogs.map((blog) => (
                    <Link key={blog._id} href={`/blogs/${blog.slug || blog._id}`}>
                      <article className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
                        <div className="relative h-44 overflow-hidden bg-gray-50">
                          <img
                            src={blog.image}
                            alt={blog.title}
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                          />
                        </div>
                        <div className="p-5">
                          <div className="text-xs text-gray-400">
                            {formatDate(blog.createdAt)}
                          </div>
                          <h2 className="mt-2 font-bold text-gray-900 line-clamp-2 group-hover:text-gray-700 transition-colors">
                            {blog.title}
                          </h2>
                          <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                            {blog.excerpt || blog.description || blog.content?.substring(0, 120)}
                          </p>
                          <div className={`mt-4 text-sm font-semibold ${theme.accentText}`}>
                            Read more →
                          </div>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {showNewsletter && (
            <section className="mt-14 rounded-3xl border border-gray-100 bg-gray-50 p-8 sm:p-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                {pageConfig?.newsletter?.title || DEFAULT_PAGE.newsletter.title}
              </h2>
              {pageConfig?.newsletter?.description && (
                <p className="mt-3 text-gray-600 leading-relaxed max-w-2xl">
                  {pageConfig.newsletter.description}
                </p>
              )}
              <div className="mt-6 flex flex-col sm:flex-row gap-3 max-w-xl">
                <input
                  type="email"
                  placeholder={
                    pageConfig?.newsletter?.inputPlaceholder ||
                    DEFAULT_PAGE.newsletter.inputPlaceholder
                  }
                  className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-4 focus:ring-black/5"
                />
                <button
                  className={`px-6 py-3 rounded-2xl font-bold text-white bg-gradient-to-r ${theme.accent} shadow-sm hover:shadow transition`}
                >
                  {pageConfig?.newsletter?.buttonText ||
                    DEFAULT_PAGE.newsletter.buttonText}
                </button>
              </div>
              {pageConfig?.newsletter?.note && (
                <p className="mt-4 text-xs text-gray-500">
                  {pageConfig.newsletter.note}
                </p>
              )}
            </section>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gray-50">
      {/* Hero Section */}
      {showHero && (
        <section className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white py-20 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div
              className={`absolute top-10 left-10 w-72 h-72 ${theme.glowA} rounded-full blur-3xl`}
            />
            <div
              className={`absolute bottom-10 right-10 w-96 h-96 ${theme.glowB} rounded-full blur-3xl`}
            />
          </div>
          <div className="container mx-auto px-4 text-center relative z-10">
            {pageConfig?.hero?.badge && (
              <span
                className={`inline-block px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-semibold mb-6 backdrop-blur-sm`}
              >
                {pageConfig.hero.badge}
              </span>
            )}
            <h1 className="text-5xl md:text-6xl font-bold mb-5 bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              {pageConfig?.hero?.title || DEFAULT_PAGE.hero.title}
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              {pageConfig?.hero?.description || DEFAULT_PAGE.hero.description}
            </p>
          </div>
        </section>
      )}

      {/* Featured Blog */}
      {showFeatured && featuredBlog && (
        <section className="py-14 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-stretch bg-white rounded-2xl overflow-hidden shadow-2xl border border-gray-100">
              <div className="relative h-80 lg:h-[450px] overflow-hidden">
                <img
                  src={featuredBlog.image}
                  alt={featuredBlog.title}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <div
                  className={`absolute top-4 left-4 bg-gradient-to-r ${theme.accentStrong} text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg`}
                >
                  Featured
                </div>
              </div>

              <div className="p-8 lg:p-12 flex flex-col justify-center bg-gradient-to-br from-white to-gray-50">
                <div className="flex items-center gap-4 mb-5">
                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase border ${theme.accentSoft}`}
                  >
                    {featuredBlog.category || "General"}
                  </span>
                  <span className="text-gray-400 text-sm font-medium">
                    {formatDate(featuredBlog.createdAt)}
                  </span>
                </div>

                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-5 leading-tight hover:text-gray-800 transition-colors">
                  {featuredBlog.title}
                </h2>

                <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                  {featuredBlog.excerpt ||
                    featuredBlog.description ||
                    featuredBlog.content?.substring(0, 220)}
                </p>

                <Link
                  href={`/blogs/${featuredBlog.slug || featuredBlog._id}`}
                  className={`inline-flex items-center gap-2 font-bold ${theme.accentText}`}
                >
                  Read Full Article <span className="text-xl">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Blog Grid */}
      {showGrid && (
        <section className="py-14">
          <div className="container mx-auto px-4">
            {otherBlogs.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                No more blogs yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {otherBlogs.map((blog) => (
                  <Link
                    key={blog._id}
                    href={`/blogs/${blog.slug || blog._id}`}
                    className="group"
                  >
                    <article className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:-translate-y-2">
                      <div className="relative h-56 overflow-hidden">
                        <img
                          src={blog.image}
                          alt={blog.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div
                          className={`absolute top-4 left-4 px-3 py-1 rounded-full text-white text-xs font-bold uppercase shadow-sm bg-gradient-to-r ${theme.accentStrong}`}
                        >
                          {blog.category || "General"}
                        </div>
                      </div>

                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${theme.glowA}`}
                            />
                            {new Date(blog.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            {blog.viewCount || 0} views
                          </span>
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-gray-800 transition-colors mb-3 line-clamp-2 leading-tight">
                          {blog.title}
                        </h3>

                        <p className="text-gray-500 text-sm mb-5 line-clamp-3 grow leading-relaxed">
                          {blog.excerpt ||
                            blog.description ||
                            blog.content?.substring(0, 120)}
                        </p>

                        <div className="flex items-center justify-between pt-5 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 bg-gradient-to-br ${theme.accentStrong} rounded-full flex items-center justify-center text-white text-xs font-bold`}
                            >
                              {(blog.author || "A")[0]}
                            </div>
                            <span className="text-xs font-medium text-gray-600">
                              {blog.author || "Admin"}
                            </span>
                          </div>
                          <span
                            className={`${theme.accentText} font-semibold group-hover:gap-3 flex items-center gap-1.5 transition-all text-sm`}
                          >
                            Read More
                            <span className="group-hover:translate-x-1 transition-transform">
                              →
                            </span>
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Newsletter CTA */}
      {showNewsletter && (
        <section className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white py-20 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div
              className={`absolute top-0 right-0 w-96 h-96 ${theme.glowA} rounded-full blur-3xl`}
            />
            <div
              className={`absolute bottom-0 left-0 w-72 h-72 ${theme.glowB} rounded-full blur-3xl`}
            />
          </div>
          <div className="container mx-auto px-4 text-center max-w-2xl relative z-10">
            <div className="inline-block mb-6">
              <span className="text-4xl">Mail</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold mb-5 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              {pageConfig?.newsletter?.title || DEFAULT_PAGE.newsletter.title}
            </h2>
            <p className="text-gray-400 text-lg mb-10 leading-relaxed">
              {pageConfig?.newsletter?.description ||
                DEFAULT_PAGE.newsletter.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
              <input
                type="email"
                placeholder={
                  pageConfig?.newsletter?.inputPlaceholder ||
                  DEFAULT_PAGE.newsletter.inputPlaceholder
                }
                className="flex-1 px-6 py-4 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-white/10 border-2 border-transparent transition-all shadow-lg"
              />
              <button
                className={`bg-gradient-to-r ${theme.accentStrong} text-white font-bold px-8 py-4 rounded-xl transition-all whitespace-nowrap shadow-lg hover:shadow-xl hover:-translate-y-0.5`}
              >
                {pageConfig?.newsletter?.buttonText ||
                  DEFAULT_PAGE.newsletter.buttonText}{" "}
                →
              </button>
            </div>
            {pageConfig?.newsletter?.note && (
              <p className="text-xs text-gray-500 mt-6">
                {pageConfig.newsletter.note}
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

