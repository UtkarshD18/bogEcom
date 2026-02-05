"use client";
import { useProducts } from "@/context/ProductContext";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FaPause, FaPlay, FaVolumeMute, FaVolumeUp } from "react-icons/fa";

export default function BlogDetailPage() {
  const params = useParams();
  const slug = params.slug;
  const { blogs, fetchBlogs } = useProducts();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (blogs && blogs.length > 0) {
      const foundBlog = blogs.find((b) => b.slug === slug);
      if (foundBlog) {
        setBlog(foundBlog);
        setError(null);
      } else {
        setError("Blog not found");
      }
      setLoading(false);
    }
  }, [blogs, slug]);

  // Listen for blog updates from admin
  useEffect(() => {
    const handleBlogUpdate = (event) => {
      console.log("Blog updated event received in detail page:", event.detail);
      // Refresh blogs from server
      fetchBlogs();
    };

    window.addEventListener("blogUpdated", handleBlogUpdate);
    return () => window.removeEventListener("blogUpdated", handleBlogUpdate);
  }, [fetchBlogs]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              Blog Not Found
            </h1>
            <p className="text-gray-600 mb-6">
              Sorry, we couldn't find the blog you're looking for.
            </p>
            <Link
              href="/blogs"
              className="inline-block bg-emerald-500 text-white px-6 py-3 rounded-lg hover:bg-emerald-600 transition"
            >
              Back to Blogs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const relatedBlogs = blogs.filter(
    (b) => b.category === blog.category && b._id !== blog._id,
  );

  // Video player component with controls
  const VideoPlayer = ({ src, poster }) => {
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);

    const togglePlay = () => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    const toggleMute = () => {
      if (videoRef.current) {
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
      }
    };

    return (
      <div className="relative group rounded-2xl overflow-hidden shadow-xl">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          muted={isMuted}
          loop
          playsInline
          className="w-full h-96 md:h-[500px] object-cover"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        {/* Video Controls Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Play/Pause Button - Center */}
        <button
          onClick={togglePlay}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-5 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110"
        >
          {isPlaying ? (
            <FaPause size={28} />
          ) : (
            <FaPlay size={28} className="ml-1" />
          )}
        </button>

        {/* Mute Button - Bottom Right */}
        <button
          onClick={toggleMute}
          className="absolute bottom-4 right-4 bg-emerald-600/90 hover:bg-emerald-700 text-white p-3 rounded-full transition-all duration-300 shadow-lg hover:scale-105"
        >
          {isMuted ? <FaVolumeMute size={18} /> : <FaVolumeUp size={18} />}
        </button>

        {/* Playing Indicator */}
        {isPlaying && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-emerald-600/90 text-white px-3 py-1.5 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            Playing
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Button */}
      <div className="container mx-auto px-4 py-4">
        <Link
          href="/blogs"
          className="inline-flex items-center text-emerald-600 hover:text-emerald-700 transition font-medium gap-2"
        >
          <span>←</span> Back to Blogs
        </Link>
      </div>

      {/* Blog Header - Green Theme */}
      <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-white py-16 overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-teal-300 rounded-full blur-3xl"></div>
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-semibold border border-white/30">
              {blog.category || "General"}
            </span>
            {blog.mediaType === "video" && (
              <span className="bg-red-500/90 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5">
                <FaPlay size={10} /> Video
              </span>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-tight max-w-4xl">
            {blog.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/90">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center font-bold">
                {(blog.author || "A")[0]}
              </div>
              <span className="font-medium">{blog.author || "Admin"}</span>
            </div>
            <span className="w-1.5 h-1.5 bg-white/50 rounded-full"></span>
            <span>
              {new Date(blog.createdAt).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            {blog.viewCount > 0 && (
              <>
                <span className="w-1.5 h-1.5 bg-white/50 rounded-full"></span>
                <span className="flex items-center gap-1">
                  👁️ {blog.viewCount} views
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Blog Content */}
          <div className="lg:col-span-2">
            {/* Featured Media - Video or Image */}
            {blog.mediaType === "video" && blog.videoUrl ? (
              <div className="mb-10">
                <VideoPlayer src={blog.videoUrl} poster={blog.image} />
              </div>
            ) : blog.image ? (
              <div className="mb-10 rounded-2xl overflow-hidden shadow-xl">
                <img
                  src={blog.image}
                  alt={blog.title}
                  className="w-full h-96 md:h-[500px] object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            ) : null}

            {/* Excerpt */}
            {blog.excerpt && (
              <p className="text-xl text-gray-600 italic mb-8 pb-8 border-b border-gray-200 leading-relaxed">
                {blog.excerpt}
              </p>
            )}

            {/* Content */}
            <div className="prose prose-lg max-w-none">
              <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-lg">
                {blog.content}
              </div>
            </div>

            {/* Tags */}
            {blog.tags && blog.tags.length > 0 && (
              <div className="mt-12 pt-8 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4 tracking-wider">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {blog.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium hover:bg-emerald-100 transition cursor-pointer"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Share Section */}
            <div className="mt-10 pt-8 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4 tracking-wider">
                Share this article
              </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator
                        .share({
                          title: blog.title,
                          text: blog.excerpt || blog.content?.substring(0, 100),
                          url: window.location.href,
                        })
                        .catch(() => {});
                    } else {
                      // Fallback: open share dialog for WhatsApp
                      window.open(
                        `https://wa.me/?text=${encodeURIComponent(blog.title + " - " + window.location.href)}`,
                        "_blank",
                      );
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg transition flex items-center gap-2 text-sm font-medium"
                >
                  <span>📤</span> Share
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard
                      .writeText(window.location.href)
                      .then(() => {
                        alert("Link copied to clipboard!");
                      })
                      .catch(() => {
                        // Fallback for older browsers
                        const textArea = document.createElement("textarea");
                        textArea.value = window.location.href;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand("copy");
                        document.body.removeChild(textArea);
                        alert("Link copied to clipboard!");
                      });
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg transition flex items-center gap-2 text-sm font-medium"
                >
                  <span>📋</span> Copy Link
                </button>
                {/* Social Share Buttons */}
                <button
                  onClick={() =>
                    window.open(
                      `https://wa.me/?text=${encodeURIComponent(blog.title + " - " + window.location.href)}`,
                      "_blank",
                    )
                  }
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg transition flex items-center gap-2 text-sm font-medium"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  WhatsApp
                </button>
                <button
                  onClick={() =>
                    window.open(
                      `https://twitter.com/intent/tweet?text=${encodeURIComponent(blog.title)}&url=${encodeURIComponent(window.location.href)}`,
                      "_blank",
                    )
                  }
                  className="bg-black hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg transition flex items-center gap-2 text-sm font-medium"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  X
                </button>
                <button
                  onClick={() =>
                    window.open(
                      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`,
                      "_blank",
                    )
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition flex items-center gap-2 text-sm font-medium"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Facebook
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Related Blogs */}
            {relatedBlogs.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-4 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                  Related Blogs
                </h3>
                <div className="space-y-5">
                  {relatedBlogs.slice(0, 3).map((relatedBlog) => (
                    <Link
                      key={relatedBlog._id}
                      href={`/blogs/${relatedBlog.slug}`}
                      className="block group"
                    >
                      {relatedBlog.image && (
                        <div className="mb-3 rounded-xl overflow-hidden h-36 relative">
                          <img
                            src={relatedBlog.image}
                            alt={relatedBlog.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          {relatedBlog.mediaType === "video" && (
                            <div className="absolute top-2 right-2 bg-red-500/90 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                              <FaPlay size={8} /> Video
                            </div>
                          )}
                        </div>
                      )}
                      <h4 className="font-semibold text-gray-800 group-hover:text-emerald-600 transition line-clamp-2 leading-snug">
                        {relatedBlog.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                        {new Date(relatedBlog.createdAt).toLocaleDateString(
                          "en-IN",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Newsletter Signup */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl shadow-lg p-6 mt-6 text-white">
              <h3 className="text-lg font-bold mb-3">Stay Updated</h3>
              <p className="text-emerald-100 text-sm mb-4">
                Get the latest articles delivered to your inbox.
              </p>
              <input
                type="email"
                placeholder="Your email"
                className="w-full px-4 py-3 rounded-lg text-gray-900 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <button className="w-full bg-white text-emerald-700 font-semibold py-3 rounded-lg hover:bg-emerald-50 transition">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
