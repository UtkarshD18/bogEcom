"use client";
import { useProducts } from "@/context/ProductContext";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
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
              className="inline-block bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition"
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Button */}
      <div className="container mx-auto px-4 py-4">
        <Link
          href="/blogs"
          className="inline-flex items-center text-orange-500 hover:text-orange-600 transition"
        >
          ← Back to Blogs
        </Link>
      </div>

      {/* Blog Header */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
              {blog.category || "General"}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{blog.title}</h1>
          <div className="flex items-center gap-4 text-sm opacity-90">
            <span>{blog.author || "Admin"}</span>
            <span>•</span>
            <span>
              {new Date(blog.createdAt).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            {blog.viewCount && (
              <>
                <span>•</span>
                <span>👁️ {blog.viewCount} views</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Blog Content */}
          <div className="lg:col-span-2">
            {/* Featured Image */}
            {blog.image && (
              <div className="mb-8 rounded-lg overflow-hidden">
                <img
                  src={blog.image}
                  alt={blog.title}
                  className="w-full h-96 object-cover"
                />
              </div>
            )}

            {/* Excerpt */}
            {blog.excerpt && (
              <p className="text-lg text-gray-600 italic mb-8 pb-8 border-b">
                {blog.excerpt}
              </p>
            )}

            {/* Content */}
            <div className="prose prose-lg max-w-none">
              <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                {blog.content}
              </div>
            </div>

            {/* Tags */}
            {blog.tags && blog.tags.length > 0 && (
              <div className="mt-12 pt-8 border-t">
                <h3 className="text-sm font-semibold text-gray-600 uppercase mb-4">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {blog.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full text-sm"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Related Blogs */}
            {relatedBlogs.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Related Blogs
                </h3>
                <div className="space-y-4">
                  {relatedBlogs.slice(0, 3).map((relatedBlog) => (
                    <Link
                      key={relatedBlog._id}
                      href={`/blogs/${relatedBlog.slug}`}
                      className="block group"
                    >
                      {relatedBlog.image && (
                        <div className="mb-2 rounded overflow-hidden h-32">
                          <img
                            src={relatedBlog.image}
                            alt={relatedBlog.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                        </div>
                      )}
                      <h4 className="font-semibold text-gray-800 group-hover:text-orange-500 transition line-clamp-2">
                        {relatedBlog.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
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
          </div>
        </div>
      </div>
    </div>
  );
}
