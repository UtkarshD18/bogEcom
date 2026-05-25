"use client";

import { fetchDataFromApi, postData } from "@/utils/api";
import { extractImageCandidatesFromBlogHtml } from "@/utils/blogHtml";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

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
  article: {
    bannerStartColor: "#f97316",
    bannerEndColor: "#ec4899",
    fontFamily: "modern-sans",
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
    accentSoft: "bg-emerald-600/10 border-emerald-600/20 text-emerald-700",
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
  sunset: {
    accent: "from-orange-500 to-rose-500",
    accentStrong: "from-orange-600 to-rose-600",
    accentText: "text-rose-600",
    accentSoft: "bg-rose-600/10 border-rose-600/20 text-rose-600",
    glowA: "bg-orange-400",
    glowB: "bg-rose-400",
  },
  midnight: {
    accent: "from-slate-700 to-slate-900",
    accentStrong: "from-slate-800 to-slate-950",
    accentText: "text-slate-700",
    accentSoft: "bg-slate-600/10 border-slate-600/20 text-slate-700",
    glowA: "bg-slate-500",
    glowB: "bg-gray-400",
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

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const BLOG_MEDIA_VARIANTS = {
  minimal: {
    shell:
      "relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-slate-100 via-white to-slate-100 p-3",
    frame:
      "relative h-full w-full overflow-hidden rounded-[1.2rem] border border-white/70 shadow-[0_18px_50px_rgba(15,23,42,0.12)]",
    media:
      "h-full w-full object-contain transition-transform duration-500",
  },
  featured: {
    shell:
      "relative min-h-[260px] sm:min-h-[360px] lg:min-h-full overflow-hidden bg-gradient-to-br from-slate-100 via-white to-indigo-50 p-4 sm:p-6",
    frame:
      "relative h-full w-full overflow-hidden rounded-[1.75rem] border border-white/70 shadow-[0_22px_60px_rgba(15,23,42,0.14)]",
    media:
      "h-full w-full object-contain transition-transform duration-500",
  },
  grid: {
    shell:
      "relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-100 p-3",
    frame:
      "relative h-full w-full overflow-hidden rounded-[1.2rem] border border-white/70 shadow-[0_18px_50px_rgba(15,23,42,0.12)]",
    media:
      "h-full w-full object-contain transition-transform duration-500",
  },
};

export default function BlogPage() {
  const [blogs, setBlogs] = useState([]);
  const [pageConfig, setPageConfig] = useState(DEFAULT_PAGE);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState(null);
  const [newsletterMessage, setNewsletterMessage] = useState("");

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

  const resolveBlogHref = (blog) => `/blogs/${blog.slug || blog._id}`;
  const getBlogPreviewImage = (blog) => {
    if (blog?.image) return blog.image;
    return extractImageCandidatesFromBlogHtml(blog?.contentHtml || "")?.[0] || "";
  };
  const hasBlogMedia = (blog) => Boolean(blog?.videoUrl || getBlogPreviewImage(blog));
  const renderBlogMedia = (blog, className = "") => {
    const previewImage = getBlogPreviewImage(blog);
    if (blog.videoUrl) {
      return (
        <video
          src={blog.videoUrl}
          controls
          playsInline
          poster={previewImage || undefined}
          preload="metadata"
          className={className}
        />
      );
    }

    if (previewImage) {
      return (
        <Image
          src={previewImage}
          alt={blog.title}
          width={960}
          height={540}
          sizes="(max-width: 1024px) 100vw, 50vw"
          className={className}
        />
      );
    }

    return null;
  };
  const renderBlogMediaSurface = (blog, variant = "grid") => {
    if (!hasBlogMedia(blog)) return null;

    const styles =
      BLOG_MEDIA_VARIANTS[variant] || BLOG_MEDIA_VARIANTS.grid;
    const mediaTone = blog?.videoUrl ? "bg-black" : "bg-white";

    return (
      <div className={styles.shell}>
        <div className={`${styles.frame} ${mediaTone}`}>
          {renderBlogMedia(blog, `${styles.media} ${mediaTone}`)}
        </div>
      </div>
    );
  };

  const resolveBlogApiBaseUrl = () => {
    const configuredBase = String(
      process.env.NEXT_PUBLIC_APP_API_URL || process.env.NEXT_PUBLIC_API_URL || "",
    )
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/\/+$/, "");

    if (configuredBase) {
      return configuredBase;
    }

    if (typeof window !== "undefined") {
      return String(window.location.origin || "").replace(/\/+$/, "");
    }

    return "http://127.0.0.1:8000";
  };

  // Email validation helper - matches server-side validation
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Sanitize email - remove invisible/zero-width characters
  const sanitizeEmail = (email) => {
    return email
      .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "") // Remove zero-width & non-breaking spaces
      .replace(/[^\x20-\x7E]/g, "") // Keep only printable ASCII
      .trim()
      .toLowerCase();
  };

  const handleNewsletterEmailChange = (event) => {
    setNewsletterEmail(event.target.value);
    // Reset error state when user starts typing again
    if (newsletterStatus === "error") {
      setNewsletterStatus(null);
      setNewsletterMessage("");
    }
  };

  const handleNewsletterSubmit = async (event) => {
    event.preventDefault();
    const emailValue = sanitizeEmail(newsletterEmail);
    if (!emailValue) {
      setNewsletterStatus("error");
      setNewsletterMessage("Please enter your email address.");
      toast.error("Please enter your email address.");
      return;
    }
    if (!isValidEmail(emailValue)) {
      setNewsletterStatus("error");
      setNewsletterMessage("Please enter a valid email address.");
      toast.error("Please enter a valid email address.");
      return;
    }
    setNewsletterStatus("loading");
    setNewsletterMessage("");
    try {
      const response = await postData("/api/newsletter/subscribe", {
        email: emailValue,
        source: "blogs",
      });
      if (response?.success) {
        setNewsletterStatus("success");
        setNewsletterMessage(response.message || "Thank you for subscribing!");
        setNewsletterEmail("");
        toast.success(response.message || "Thank you for subscribing!");
      } else {
        setNewsletterStatus("error");
        setNewsletterMessage(
          response?.message || "Failed to subscribe. Please try again.",
        );
        toast.error(
          response?.message || "Failed to subscribe. Please try again.",
        );
      }
    } catch (error) {
      console.error("Blog newsletter subscription error:", error);
      setNewsletterStatus("error");
      setNewsletterMessage("Failed to subscribe. Please try again.");
      toast.error("Failed to subscribe. Please try again.");
    }
  };

  useEffect(() => {
    const fetchPage = async () => {
      const response = await fetchDataFromApi("/api/blogs/page/public", {
        skipCache: true,
      });

      if (response?.error || !response?.data) {
        return;
      }

      setPageConfig({
        ...DEFAULT_PAGE,
        ...response.data,
        theme: { ...DEFAULT_PAGE.theme, ...(response.data.theme || {}) },
        sections: {
          ...DEFAULT_PAGE.sections,
          ...(response.data.sections || {}),
        },
        hero: { ...DEFAULT_PAGE.hero, ...(response.data.hero || {}) },
        newsletter: {
          ...DEFAULT_PAGE.newsletter,
          ...(response.data.newsletter || {}),
        },
        article: {
          ...DEFAULT_PAGE.article,
          ...(response.data.article || {}),
        },
      });
    };

    fetchPage().catch((error) => {
      console.error("BlogPage config fetch error:", error);
    });
  }, []);

  useEffect(() => {
    const loadBlogs = async () => {
      try {
        const response = await fetch(
          `${resolveBlogApiBaseUrl()}/api/blogs`,
          {
            credentials: "include",
          },
        );
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (data?.success && Array.isArray(data?.data)) {
          setBlogs(data.data);
        }
      } catch (error) {
        console.error("Blog list fetch error:", error);
      }
    };

    loadBlogs();

    const handleBlogUpdate = () => {
      loadBlogs();
    };

    window.addEventListener("blogUpdated", handleBlogUpdate);
    return () => window.removeEventListener("blogUpdated", handleBlogUpdate);
  }, []);

  if (layout === "minimal") {
    return (
      <main className="bg-white min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          {showHero && (
            <motion.section
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="max-w-3xl"
            >
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
              <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
                {pageConfig?.hero?.title || DEFAULT_PAGE.hero.title}
              </h1>
              {pageConfig?.hero?.description && (
                <p className="mt-4 text-gray-600 text-lg leading-relaxed">
                  {pageConfig.hero.description}
                </p>
              )}
            </motion.section>
          )}

          {showGrid && (
            <section className="mt-16">
              {blogs.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center text-gray-600">
                  No blogs yet.
                </div>
              ) : (
                <motion.div
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  variants={staggerContainer}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                  {blogs.map((blog) => (
                    <Link
                      key={blog._id}
                      href={resolveBlogHref(blog)}
                    >
                      <motion.article
                        variants={fadeInUp}
                        whileHover={{ y: -5 }}
                        className="group h-full flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-lg transition-all duration-300"
                      >
                        {hasBlogMedia(blog) && (
                          renderBlogMediaSurface(blog, "minimal")
                        )}
                        <div className="p-6 flex-1 flex flex-col">
                          <div className="text-xs text-gray-400 font-medium mb-2">
                            {formatDate(blog.createdAt)}
                          </div>
                          <h2 className="text-xl font-bold text-gray-900 line-clamp-2 group-hover:text-gray-700 transition-colors">
                            {blog.title}
                          </h2>
                          <p className="mt-3 text-sm text-gray-600 line-clamp-3 mb-4 flex-1">
                            {blog.excerpt ||
                              blog.description ||
                              blog.content?.substring(0, 120)}
                          </p>
                          <div
                            className={`text-sm font-semibold flex items-center gap-1 ${theme.accentText}`}
                          >
                            Read more{" "}
                            <span className="group-hover:translate-x-1 transition-transform">
                              →
                            </span>
                          </div>
                        </div>
                      </motion.article>
                    </Link>
                  ))}
                </motion.div>
              )}
            </section>
          )}

          {showNewsletter && (
            <motion.section
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="mt-20 rounded-3xl border border-gray-100 bg-gray-50 p-8 sm:p-12 relative overflow-hidden"
            >
              <div className="relative z-10">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                  {pageConfig?.newsletter?.title ||
                    DEFAULT_PAGE.newsletter.title}
                </h2>
                {pageConfig?.newsletter?.description && (
                  <p className="mt-3 text-gray-600 leading-relaxed max-w-2xl">
                    {pageConfig.newsletter.description}
                  </p>
                )}
                <form
                  onSubmit={handleNewsletterSubmit}
                  className="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl"
                >
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={handleNewsletterEmailChange}
                    placeholder={
                      pageConfig?.newsletter?.inputPlaceholder ||
                      DEFAULT_PAGE.newsletter.inputPlaceholder
                    }
                    required
                    disabled={
                      newsletterStatus === "loading" ||
                      newsletterStatus === "success"
                    }
                    className="flex-1 px-5 py-3.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-black/5 transition-shadow"
                  />
                  <button
                    type="submit"
                    disabled={
                      newsletterStatus === "loading" ||
                      newsletterStatus === "success"
                    }
                    className={`px-8 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r ${theme.accent} shadow-md transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed ${newsletterStatus === "loading" || newsletterStatus === "success" ? "" : "hover:shadow-lg hover:-translate-y-0.5"}`}
                  >
                    {newsletterStatus === "loading"
                      ? "Subscribing..."
                      : newsletterStatus === "success"
                        ? "Subscribed"
                        : pageConfig?.newsletter?.buttonText ||
                          DEFAULT_PAGE.newsletter.buttonText}
                  </button>
                </form>
                {pageConfig?.newsletter?.note && (
                  <p className="mt-4 text-xs text-gray-500">
                    {pageConfig.newsletter.note}
                  </p>
                )}
                {newsletterStatus === "success" && (
                  <p className="mt-2 text-xs font-semibold text-emerald-600">
                    {newsletterMessage || "Thank you for subscribing!"}
                  </p>
                )}
                {newsletterStatus === "error" && (
                  <p className="mt-2 text-xs font-semibold text-rose-600">
                    {newsletterMessage ||
                      "Failed to subscribe. Please try again."}
                  </p>
                )}
              </div>
            </motion.section>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      {showHero && (
        <section className="relative bg-[#0f1016] text-white py-24 sm:py-32 overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] opacity-90" />
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className={`absolute top-0 left-1/4 w-[600px] h-[600px] ${theme.glowA} rounded-full blur-[120px] mix-blend-screen opacity-30`}
            />
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
              className={`absolute bottom-0 right-1/4 w-[500px] h-[500px] ${theme.glowB} rounded-full blur-[100px] mix-blend-screen opacity-30`}
            />
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="container mx-auto px-4 text-center relative z-10"
          >
            {pageConfig?.hero?.badge && (
              <motion.span
                whileHover={{ scale: 1.05 }}
                className="inline-block px-5 py-2 bg-white/10 border border-white/10 rounded-full text-sm font-semibold mb-8 backdrop-blur-md shadow-lg"
              >
                {pageConfig.hero.badge}
              </motion.span>
            )}
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent tracking-tight">
              {pageConfig?.hero?.title || DEFAULT_PAGE.hero.title}
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              {pageConfig?.hero?.description || DEFAULT_PAGE.hero.description}
            </p>
          </motion.div>
        </section>
      )}

      {/* Featured Blog */}
      {showFeatured && featuredBlog && (
        <section className="py-16 sm:py-20 relative z-20 -mt-10 sm:-mt-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7 }}
              className={`grid grid-cols-1 ${hasBlogMedia(featuredBlog) ? "lg:grid-cols-2" : ""} gap-0 items-stretch bg-white rounded-3xl overflow-hidden shadow-2xl shadow-black/5`}
            >
              {hasBlogMedia(featuredBlog) && (
                <div className="relative group">
                  {renderBlogMediaSurface(featuredBlog, "featured")}
                  <div
                    className={`absolute top-6 left-6 bg-gradient-to-r ${theme.accentStrong} text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg`}
                  >
                    Featured
                  </div>
                </div>
              )}

              <div className="p-8 lg:p-14 flex flex-col justify-center bg-white">
                <div className="flex items-center gap-4 mb-6">
                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${theme.accentSoft}`}
                  >
                    {featuredBlog.category || "General"}
                  </span>
                  <span className="text-gray-400 text-sm font-medium">
                    {formatDate(featuredBlog.createdAt)}
                  </span>
                </div>

                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6 leading-tight">
                  <Link
                    href={resolveBlogHref(featuredBlog)}
                    className="hover:text-gray-600 transition-colors"
                  >
                    {featuredBlog.title}
                  </Link>
                </h2>

                <p className="text-gray-600 text-lg mb-8 leading-relaxed line-clamp-3">
                  {featuredBlog.excerpt ||
                    featuredBlog.description ||
                    featuredBlog.content?.substring(0, 220)}
                </p>

                <Link
                  href={resolveBlogHref(featuredBlog)}
                  className={`inline-flex items-center gap-2 font-bold text-lg ${theme.accentText} group`}
                >
                  Read Full Article{" "}
                  <span className="group-hover:translate-x-1.5 transition-transform">
                    →
                  </span>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Blog Grid */}
      {showGrid && (
        <section className="py-16 sm:py-24">
          <div className="container mx-auto px-4">
            {otherBlogs.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
                <p className="text-gray-500 text-lg">
                  No additional stories to explore yet.
                </p>
              </div>
            ) : (
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={staggerContainer}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {otherBlogs.map((blog) => (
                  <Link
                    key={blog._id}
                    href={resolveBlogHref(blog)}
                    className="block h-full"
                  >
                    <motion.article
                      variants={fadeInUp}
                      whileHover={{ y: -8 }}
                      className="h-full flex flex-col bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group border border-gray-100"
                    >
                      {hasBlogMedia(blog) && (
                        <div className="relative">
                          {renderBlogMediaSurface(blog, "grid")}
                          <div className="absolute top-4 left-4">
                            <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-bold text-gray-900 shadow-sm">
                              {blog.category || "General"}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="p-7 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${theme.glowA}`}
                            />
                            {formatDate(blog.createdAt)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {blog.viewCount || 0} views
                          </span>
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-gray-700 transition-colors mb-3 line-clamp-2 leading-snug">
                          {blog.title}
                        </h3>

                        <p className="text-gray-500 text-sm mb-6 line-clamp-3 leading-relaxed flex-1">
                          {blog.excerpt ||
                            blog.description ||
                            blog.content?.substring(0, 120)}
                        </p>

                        <div className="pt-5 border-t border-gray-100 flex items-center justify-between mt-auto">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-full bg-gradient-to-br ${theme.accentStrong} flex items-center justify-center text-white text-xs font-bold shadow-sm`}
                            >
                              {(blog.author || "A")[0]}
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {blog.author || "Admin"}
                            </span>
                          </div>
                          <span
                            className={`${theme.accentText} font-semibold text-sm group-hover:translate-x-1 transition-transform`}
                          >
                            Read →
                          </span>
                        </div>
                      </div>
                    </motion.article>
                  </Link>
                ))}
              </motion.div>
            )}
          </div>
        </section>
      )}

      {/* Newsletter CTA */}
      {showNewsletter && (
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-[#0f1016]">
            <div
              className={`absolute top-0 right-0 w-[600px] h-[600px] ${theme.glowA} rounded-full blur-[120px] opacity-20`}
            />
            <div
              className={`absolute bottom-0 left-0 w-[600px] h-[600px] ${theme.glowB} rounded-full blur-[120px] opacity-20`}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="container mx-auto px-4 text-center max-w-3xl relative z-10"
          >
            <span className="inline-block mb-6 text-gray-400 font-medium tracking-widest text-sm uppercase">
              Stay Updated
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white tracking-tight">
              {pageConfig?.newsletter?.title || DEFAULT_PAGE.newsletter.title}
            </h2>
            <p className="text-gray-400 text-lg mb-10 leading-relaxed">
              {pageConfig?.newsletter?.description ||
                DEFAULT_PAGE.newsletter.description}
            </p>

            <form
              onSubmit={handleNewsletterSubmit}
              className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto"
            >
              <input
                type="email"
                value={newsletterEmail}
                onChange={handleNewsletterEmailChange}
                placeholder={
                  pageConfig?.newsletter?.inputPlaceholder ||
                  DEFAULT_PAGE.newsletter.inputPlaceholder
                }
                required
                disabled={
                  newsletterStatus === "loading" ||
                  newsletterStatus === "success"
                }
                className="flex-1 px-6 py-4 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-4 focus:ring-white/10 transition-all shadow-xl"
              />
              <button
                type="submit"
                disabled={
                  newsletterStatus === "loading" ||
                  newsletterStatus === "success"
                }
                className={`flex-none bg-gradient-to-r ${theme.accentStrong} text-white font-bold px-8 py-4 rounded-xl transition-all shadow-lg whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed ${newsletterStatus === "loading" || newsletterStatus === "success" ? "" : "hover:shadow-xl hover:-translate-y-0.5"}`}
              >
                {newsletterStatus === "loading"
                  ? "Subscribing..."
                  : newsletterStatus === "success"
                    ? "Subscribed"
                    : pageConfig?.newsletter?.buttonText ||
                      DEFAULT_PAGE.newsletter.buttonText}{" "}
                {newsletterStatus === "loading" ||
                newsletterStatus === "success"
                  ? ""
                  : "→"}              </button>
            </form>
            {newsletterMessage && (
              <p
                className={`text-sm mt-4 ${
                  newsletterStatus === "success"
                    ? "text-emerald-400"
                    : "text-rose-300"
                }`}
              >
                {newsletterMessage}
              </p>
            )}

            {pageConfig?.newsletter?.note && (
              <p className="text-xs text-gray-500 mt-6">
                {pageConfig.newsletter.note}
              </p>
            )}
            {newsletterStatus === "success" && (
              <p className="text-xs font-semibold text-emerald-400 mt-3">
                {newsletterMessage || "Thank you for subscribing!"}
              </p>
            )}
            {newsletterStatus === "error" && (
              <p className="text-xs font-semibold text-rose-400 mt-3">
                {newsletterMessage || "Failed to subscribe. Please try again."}
              </p>
            )}
          </motion.div>
        </section>
      )}
    </main>
  );
}

