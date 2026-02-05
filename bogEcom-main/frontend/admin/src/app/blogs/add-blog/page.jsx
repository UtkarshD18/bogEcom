"use client";
import { useAdmin } from "@/context/AdminContext";
import { postData, uploadFile, uploadVideoFile } from "@/utils/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { IoMdClose } from "react-icons/io";
import { MdCloudUpload, MdLink, MdSave, MdVideoLibrary } from "react-icons/md";

const AddBlog = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [referenceLink, setReferenceLink] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [mediaType, setMediaType] = useState("image");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  // Auto compress image
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.7,
        );
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate authentication
    if (!token || typeof token !== "string") {
      toast.error("Authentication required. Please login again.");
      router.push("/login");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a blog title");
      return;
    }
    if (!content.trim()) {
      toast.error("Please enter blog content");
      return;
    }

    // Validate media based on type
    if (mediaType === "image" && !imageFile && !imageUrl) {
      toast.error("Please upload or provide an image URL");
      return;
    }
    if (mediaType === "video" && !videoFile && !videoUrl) {
      toast.error("Please upload or provide a video URL");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl_final = imageUrl;
      let videoUrl_final = videoUrl;

      // Upload image to Cloudinary if file is selected
      if (imageFile) {
        const uploadResponse = await uploadFile(imageFile, token);

        if (uploadResponse.error === true || !uploadResponse.success) {
          toast.error(uploadResponse.message || "Failed to upload image");
          setIsSubmitting(false);
          return;
        }

        if (uploadResponse.data && uploadResponse.data.url) {
          imageUrl_final = uploadResponse.data.url;
        } else {
          toast.error("Upload successful but image URL not found");
          setIsSubmitting(false);
          return;
        }
      }

      // Upload video to Cloudinary if file is selected
      if (videoFile) {
        toast.loading("Uploading video... This may take a moment", {
          id: "video-upload",
        });
        const uploadResponse = await uploadVideoFile(videoFile, token);
        toast.dismiss("video-upload");

        if (uploadResponse.error === true || !uploadResponse.success) {
          toast.error(uploadResponse.message || "Failed to upload video");
          setIsSubmitting(false);
          return;
        }

        if (uploadResponse.data && uploadResponse.data.url) {
          videoUrl_final = uploadResponse.data.url;
        } else {
          toast.error("Upload successful but video URL not found");
          setIsSubmitting(false);
          return;
        }
      }

      // Create blog data
      const blogData = {
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim() || content.substring(0, 150),
        image: imageUrl_final || null,
        mediaType: mediaType,
        videoUrl: mediaType === "video" ? videoUrl_final : null,
        isPublished,
      };

      // Send to API
      const response = await postData("/api/blogs", blogData, token);

      if (response.success) {
        toast.success("Blog published successfully!");
        router.push("/blogs");
      } else {
        toast.error(response.message || "Failed to publish blog");
      }
    } catch (error) {
      console.error("Error creating blog:", error);
      toast.error("Failed to publish blog");
    }

    setIsSubmitting(false);
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 w-full">
      <h1 className="text-4xl font-bold text-gray-900">Add New Blog</h1>
      <div className="h-1 w-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full mt-2 mb-8"></div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl p-8 w-full space-y-10"
      >
        {/* TITLE */}
        <div>
          <label className="font-semibold text-gray-700">Blog Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter blog title"
            className="w-full border rounded-xl px-4 py-3 mt-2 outline-none focus:border-blue-500"
          />
        </div>

        {/* REFERENCE LINK */}
        <div>
          <label className="font-semibold text-gray-700">
            Reference / External Article Link
          </label>
          <div className="flex items-center gap-2 mt-2">
            <MdLink className="text-gray-500" />
            <input
              type="text"
              placeholder="https://example.com/article"
              value={referenceLink}
              onChange={(e) => setReferenceLink(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          {referenceLink && (
            <a
              href={referenceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 text-sm mt-2 inline-block hover:underline"
            >
              Preview reference link →
            </a>
          )}
        </div>

        {/* MEDIA TYPE SELECTOR */}
        <div className="bg-gray-50 rounded-xl p-6">
          <label className="font-semibold text-gray-700 block mb-4">
            Media Type
          </label>
          <div className="flex gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="mediaType"
                value="image"
                checked={mediaType === "image"}
                onChange={(e) => setMediaType(e.target.value)}
                className="w-5 h-5 text-emerald-600"
              />
              <span className="text-gray-700 font-medium">Image / GIF</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="mediaType"
                value="video"
                checked={mediaType === "video"}
                onChange={(e) => setMediaType(e.target.value)}
                className="w-5 h-5 text-emerald-600"
              />
              <span className="text-gray-700 font-medium">Video</span>
            </label>
          </div>
        </div>

        {/* IMAGE SECTION - Only show if mediaType is image */}
        {mediaType === "image" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* IMAGE UPLOAD */}
            <div>
              <label className="font-semibold text-gray-700">
                Upload Image / GIF / Banner
              </label>
              <div className="border-2 border-dashed rounded-xl p-6 text-center mt-2 hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  accept="image/*,.gif"
                  className="hidden"
                  id="imageUpload"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const compressed = await compressImage(file);
                    setImageFile(compressed);
                    setImagePreview(URL.createObjectURL(compressed));
                  }}
                />
                <label htmlFor="imageUpload" className="cursor-pointer">
                  <MdCloudUpload
                    size={40}
                    className="mx-auto text-emerald-500"
                  />
                  <p>Click to upload image or gif</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Supports JPG, PNG, WEBP, GIF (auto compressed)
                  </p>
                </label>
              </div>

              {imagePreview && (
                <div className="relative mt-3">
                  <img
                    src={imagePreview}
                    alt="preview"
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                    }}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                  >
                    <IoMdClose size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* IMAGE URL */}
            <div>
              <label className="font-semibold text-gray-700">
                Or Image URL
              </label>
              <input
                type="text"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full border rounded-xl px-4 py-3 mt-2 outline-none focus:border-emerald-500"
              />

              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="preview"
                  className="mt-3 w-full h-48 object-cover rounded-xl"
                />
              )}
            </div>
          </div>
        )}

        {/* VIDEO SECTION - Only show if mediaType is video */}
        {mediaType === "video" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* THUMBNAIL IMAGE */}
            <div>
              <label className="font-semibold text-gray-700">
                Video Thumbnail (Optional)
              </label>
              <div className="border-2 border-dashed rounded-xl p-6 text-center mt-2 hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="thumbnailUpload"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const compressed = await compressImage(file);
                    setImageFile(compressed);
                    setImagePreview(URL.createObjectURL(compressed));
                  }}
                />
                <label htmlFor="thumbnailUpload" className="cursor-pointer">
                  <MdCloudUpload
                    size={40}
                    className="mx-auto text-emerald-500"
                  />
                  <p>Click to upload thumbnail</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Used as poster image before video plays
                  </p>
                </label>
              </div>
              {imagePreview && (
                <div className="relative mt-3">
                  <img
                    src={imagePreview}
                    alt="thumbnail"
                    className="w-full h-32 object-cover rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                    }}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                  >
                    <IoMdClose size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* VIDEO UPLOAD */}
            <div>
              <label className="font-semibold text-gray-700">
                Upload Video
              </label>
              <div className="border-2 border-dashed rounded-xl p-6 text-center mt-2 hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg"
                  className="hidden"
                  id="videoUpload"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (file.size > 100 * 1024 * 1024) {
                      toast.error("Video must be under 100MB");
                      return;
                    }
                    setVideoFile(file);
                    setVideoPreview(URL.createObjectURL(file));
                  }}
                />
                <label htmlFor="videoUpload" className="cursor-pointer">
                  <MdVideoLibrary size={40} className="mx-auto text-blue-500" />
                  <p>Click to upload video</p>
                  <p className="text-xs text-gray-400 mt-1">
                    MP4, WebM (max 100MB)
                  </p>
                </label>
              </div>

              {videoPreview && (
                <div className="relative mt-3">
                  <video
                    src={videoPreview}
                    controls
                    className="w-full h-48 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setVideoPreview(null);
                      setVideoFile(null);
                    }}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                  >
                    <IoMdClose size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIDEO URL - Only show if mediaType is video and no file uploaded */}
        {mediaType === "video" && !videoFile && (
          <div>
            <label className="font-semibold text-gray-700">Or Video URL</label>
            <input
              type="text"
              placeholder="https://example.com/video.mp4"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 mt-2 outline-none focus:border-emerald-500"
            />
            {videoUrl && (
              <video
                src={videoUrl}
                controls
                className="mt-3 w-full h-48 rounded-xl"
              />
            )}
          </div>
        )}

        {/* CONTENT */}
        <div>
          <label className="font-semibold text-gray-700">
            Blog Excerpt (Optional)
          </label>
          <textarea
            rows="3"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Brief summary of the blog (max 150 chars)..."
            className="w-full border rounded-xl px-4 py-3 mt-2 outline-none focus:border-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            {excerpt.length}/150 characters
          </p>
        </div>

        {/* BLOG CONTENT */}
        <div>
          <label className="font-semibold text-gray-700">Blog Content</label>
          <textarea
            rows="8"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write full blog content here..."
            className="w-full border rounded-xl px-4 py-3 mt-2 outline-none focus:border-blue-500"
          />
        </div>

        {/* PUBLISH STATUS */}
        <div className="flex items-center gap-4">
          <label className="font-semibold text-gray-700">Publish Status</label>
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

        {/* BUTTON */}
        <div className="flex justify-end gap-4">
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
            className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-10 py-3 rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 transition-all"
          >
            <MdSave size={22} />
            {isSubmitting ? "Publishing..." : "Publish Blog"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddBlog;
