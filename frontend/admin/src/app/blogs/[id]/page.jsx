"use client";
import { useAdmin } from "@/context/AdminContext";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MdSave } from "react-icons/md";

const EditBlog = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const { id } = useParams();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && id) {
      fetchBlogDetails();
    }
  }, [isAuthenticated, id]);

  const fetchBlogDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `http://localhost:8000/api/blogs/admin/${id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();
      if (data.success) {
        setTitle(data.blog.title || "");
        setContent(data.blog.content || "");
        setExcerpt(data.blog.excerpt || "");
        setCategory(data.blog.category || "");
        setImage(data.blog.image || "");
      } else {
        setError("Failed to fetch blog details");
      }
    } catch (err) {
      console.error("Error fetching blog:", err);
      setError("Error loading blog details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Please enter a blog title");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`http://localhost:8000/api/blogs/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          content,
          excerpt,
          category,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Notify client side to refresh blogs
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("blogUpdated", { detail: data.blog }),
          );
        }
        alert("Blog updated successfully!");
        router.push("/blogs");
      } else {
        setError(data.message || "Failed to update blog");
      }
    } catch (err) {
      console.error("Error updating blog:", err);
      setError("Error updating blog. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
          Edit Blog
        </h1>
        <div className="h-1 w-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mt-2"></div>
        <p className="text-gray-500 mt-3 text-lg">Editing blog ID: {id}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        /* Form */
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-8 space-y-6"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Blog Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-400 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Excerpt
            </label>
            <input
              type="text"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-400 outline-none"
              placeholder="Brief summary of the blog"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-400 outline-none"
              placeholder="e.g., Health, Nutrition, Tips"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Content
            </label>
            <textarea
              rows="8"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-400 outline-none"
              required
            />
          </div>

          {image && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Current Image
              </label>
              <img
                src={image}
                alt="Blog cover"
                className="max-w-xs rounded-lg"
              />
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.push("/blogs")}
              className="px-8 py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
            >
              <MdSave size={20} />
              {isSubmitting ? "Updating..." : "Update Blog"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default EditBlog;
