"use client";
import { useProducts } from "@/context/ProductContext";
import Link from "next/link";
import { useEffect } from "react";

export default function BlogPage() {
  const { blogs = [], fetchBlogs } = useProducts();

  const featuredBlog = blogs.length > 0 ? blogs[0] : null;
  const otherBlogs = blogs.slice(1);

  // Listen for blog updates from admin
  useEffect(() => {
    const handleBlogUpdate = (event) => {
      console.log("Blog updated event received:", event.detail);
      // Refresh blogs from server
      fetchBlogs();
    };

    window.addEventListener("blogUpdated", handleBlogUpdate);
    return () => window.removeEventListener("blogUpdated", handleBlogUpdate);
  }, [fetchBlogs]);

  return (
    <>
      <main className="bg-gray-50">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white py-20 overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-72 h-72 bg-[#c1591c] rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#d06a2d] rounded-full blur-3xl"></div>
          </div>
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block px-4 py-2 bg-[#c1591c]/20 border border-[#c1591c]/30 rounded-full text-[#f0a070] text-sm font-semibold mb-6 backdrop-blur-sm">
              ✨ Health & Wellness Insights
            </span>
            <h1 className="text-5xl md:text-6xl font-bold mb-5 bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              The Journal
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Expert insights on nutrition, wellness, and the science behind
              healthy living. No fluff, just evidence-backed guidance.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Updated Weekly
              </div>
              <div className="text-gray-600">•</div>
              <div className="text-sm text-gray-400">Expert Authors</div>
              <div className="text-gray-600">•</div>
              <div className="text-sm text-gray-400">Science-Backed</div>
            </div>
          </div>
        </section>

        {/* Featured Blog */}
        {featuredBlog && (
          <section className="py-14 bg-white">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-stretch bg-white rounded-2xl overflow-hidden shadow-2xl border border-gray-100">
                {/* Featured Image */}
                <div className="relative h-80 lg:h-[450px] overflow-hidden">
                  <img
                    src={featuredBlog.image}
                    alt={featuredBlog.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-[#c1591c] to-[#d06a2d] text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg">
                    ⭐ Featured
                  </div>
                </div>

                {/* Featured Content */}
                <div className="p-8 lg:p-12 flex flex-col justify-center bg-gradient-to-br from-white to-gray-50">
                  <div className="flex items-center gap-4 mb-5">
                    <span className="bg-gradient-to-r from-[#c1591c]/10 to-[#d06a2d]/10 text-[#c1591c] px-4 py-1.5 rounded-full text-xs font-bold uppercase border border-[#c1591c]/20">
                      {featuredBlog.category || "General"}
                    </span>
                    <span className="text-gray-400 text-sm font-medium">
                      {new Date(featuredBlog.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )}
                    </span>
                  </div>

                  <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-5 leading-tight hover:text-[#c1591c] transition-colors">
                    {featuredBlog.title}
                  </h2>

                  <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                    {featuredBlog.excerpt ||
                      featuredBlog.content?.substring(0, 200) + "..."}
                  </p>

                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#c1591c] to-[#d06a2d] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                        {(featuredBlog.author || "A")[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {featuredBlog.author || "Admin"}
                        </p>
                        <p className="text-sm text-gray-500">Health Expert</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-sm bg-gray-100 px-3 py-1.5 rounded-full">
                      <span>👁️</span>
                      <span className="font-medium">
                        {featuredBlog.viewCount || 0} views
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/blogs/${featuredBlog.slug}`}
                    className="inline-flex items-center gap-3 bg-gradient-to-r from-[#c1591c] to-[#d06a2d] hover:from-[#a84d18] hover:to-[#c1591c] text-white font-bold py-4 px-10 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 w-fit"
                  >
                    Read Full Article
                    <span className="text-xl">→</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Latest Articles Section */}
        {otherBlogs.length > 0 && (
          <section className="py-20 bg-gray-50">
            <div className="container mx-auto px-4">
              <div className="text-center mb-14">
                <span className="inline-block px-4 py-1.5 bg-[#c1591c]/10 text-[#c1591c] rounded-full text-sm font-semibold mb-4">
                  Latest Posts
                </span>
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  Latest Articles
                </h2>
                <p className="text-gray-500 text-lg max-w-xl mx-auto">
                  Discover our most recent health and wellness insights
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {otherBlogs.map((blog) => (
                  <Link
                    key={blog._id}
                    href={`/blogs/${blog.slug}`}
                    className="group h-full"
                  >
                    <article className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 h-full flex flex-col transform hover:-translate-y-2 border border-gray-100">
                      {/* Blog Image */}
                      <div className="relative h-52 overflow-hidden bg-gray-200">
                        <img
                          src={blog.image}
                          alt={blog.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-[#c1591c] px-3 py-1.5 rounded-full text-xs font-bold uppercase shadow-sm">
                          {blog.category || "General"}
                        </div>
                      </div>

                      {/* Blog Content */}
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#c1591c] rounded-full"></span>
                            {new Date(blog.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            👁️ {blog.viewCount || 0}
                          </span>
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#c1591c] transition-colors mb-3 line-clamp-2 leading-tight">
                          {blog.title}
                        </h3>

                        <p className="text-gray-500 text-sm mb-5 line-clamp-3 grow leading-relaxed">
                          {blog.excerpt || blog.content?.substring(0, 100)}
                        </p>

                        <div className="flex items-center justify-between pt-5 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gradient-to-br from-[#c1591c] to-[#d06a2d] rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {(blog.author || "A")[0]}
                            </div>
                            <span className="text-xs font-medium text-gray-600">
                              {blog.author || "Admin"}
                            </span>
                          </div>
                          <span className="text-[#c1591c] font-semibold group-hover:gap-3 flex items-center gap-1.5 transition-all text-sm">
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
            </div>
          </section>
        )}

        {/* Newsletter CTA */}
        <section className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white py-20 overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#c1591c] rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#d06a2d] rounded-full blur-3xl"></div>
          </div>
          <div className="container mx-auto px-4 text-center max-w-2xl relative z-10">
            <div className="inline-block mb-6">
              <span className="text-4xl">✉️</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold mb-5 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Don't Miss Our Latest Articles
            </h2>
            <p className="text-gray-400 text-lg mb-10 leading-relaxed">
              Subscribe to get weekly insights, wellness tips, and exclusive
              health recommendations delivered to your inbox.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
              <input
                type="email"
                placeholder="Enter your email address"
                className="flex-1 px-6 py-4 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-[#c1591c]/30 border-2 border-transparent focus:border-[#c1591c] transition-all shadow-lg"
              />
              <button className="bg-gradient-to-r from-[#c1591c] to-[#d06a2d] hover:from-[#a84d18] hover:to-[#c1591c] text-white font-bold px-8 py-4 rounded-xl transition-all whitespace-nowrap shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                Subscribe →
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-6 flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              We respect your privacy. Unsubscribe at any time.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
