"use client";

import { API_BASE_URL, uploadFile, uploadVideoFile } from "@/utils/api";
import { useAdmin } from "@/context/AdminContext";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MdSave } from "react-icons/md";

const API_URL = API_BASE_URL;

const EditBlog = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const { id } = useParams();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [referenceLink, setReferenceLink] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchBlogDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${API_URL}/api/blogs/admin/${id}`,
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
        setVideoUrl(data.blog.videoUrl || "");
        setReferenceLink(data.blog.referenceLink || "");
        setIsPublished(data.blog.isPublished !== false);
      } else {
        setError("Failed to fetch blog details");
      }
    } catch (err) {
      console.error("Error fetching blog:", err);
      setError("Error loading blog details");
    } finally {
      setIsLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && id) {
      fetchBlogDetails();
    }
  }, [isAuthenticated, id, fetchBlogDetails]);

  const handleImageSelection = (file) => {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleVideoSelection = (file) => {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setError("Video must be under 100MB");
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      let imageUrlFinal = image || "";
      let videoUrlFinal = videoUrl || "";

      if (imageFile) {
        const uploadResp = await uploadFile(imageFile, token, {
          folder: "blogs",
          preserveQuality: true,
        });
        if (uploadResp?.success && uploadResp.data?.url) {
          imageUrlFinal = uploadResp.data.url;
        }
      }

      if (videoFile) {
        const uploadResp = await uploadVideoFile(videoFile, token, {
          folder: "blogs",
        });
        if (uploadResp?.success && uploadResp.data?.url) {
          videoUrlFinal = uploadResp.data.url;
        }
      }

      const response = await fetch(`${API_URL}/api/blogs/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title?.trim() || undefined,
          content: content?.trim() || undefined,
          excerpt: excerpt?.trim() || undefined,
          category: category || undefined,
          image: imageUrlFinal || undefined,
          videoUrl: videoUrlFinal || undefined,
          referenceLink: referenceLink?.trim() || undefined,
          isPublished,
        }),
      });

      const data = await response.json();

      if (data.success) {
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

          {/* Reference Link */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Reference / External Link</label>
            <input
              type="text"
              value={referenceLink}
              onChange={(e) => setReferenceLink(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-400 outline-none"
            />
          </div>

          {/* Image & Video Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Cover Image (optional)</label>
              <input
                type="file"
                accept="image/*,.gif"
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  setImageFile(f);
                  setImagePreview(URL.createObjectURL(f));
                }}
                className="w-full"
              />
              {imagePreview ? (
                <img src={imagePreview} alt="preview" className="mt-2 w-full h-28 object-cover rounded-lg" />
              ) : image ? (
                <img src={image} alt="current" className="mt-2 w-full h-28 object-cover rounded-lg" />
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Video URL / Upload (optional)</label>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
                className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-400 outline-none"
              />
              <input
                type="file"
                accept="video/mp4,video/webm"
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  if (f.size > 100 * 1024 * 1024) {
                    setError("Video must be under 100MB");
                    return;
                  }
                  setVideoFile(f);
                  setVideoPreview(URL.createObjectURL(f));
                }}
                className="w-full mt-2"
              />
              {videoPreview ? (
                <video src={videoPreview} controls className="mt-2 w-full h-28 object-cover rounded-lg" />
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="block text-sm font-medium text-gray-600">
              Publish Status
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-gray-700">
                {isPublished ? "Published" : "Draft"}
              </span>
            </label>
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
