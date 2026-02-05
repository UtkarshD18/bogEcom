"use client";
import UploadBox from "@/components/UploadBox";
import { useAdmin } from "@/context/AdminContext";
import { getData, putData, uploadFile, uploadVideoFile } from "@/utils/api";
import { Button, FormControlLabel, Radio, RadioGroup } from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { FiImage, FiLink, FiVideo } from "react-icons/fi";
import { IoMdClose } from "react-icons/io";

const EditBanner = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const params = useParams();
  const bannerId = params.id;

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [link, setLink] = useState("");
  const [position, setPosition] = useState("home-top");
  const [isActive, setIsActive] = useState(true);
  const [image, setImage] = useState(null); // { file?, preview, isExisting? }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ===== NEW VIDEO SUPPORT STATE =====
  const [mediaType, setMediaType] = useState("image"); // "image" or "video"
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [videoInputMethod, setVideoInputMethod] = useState("url"); // "url" or "upload"
  const [existingVideoUrl, setExistingVideoUrl] = useState(""); // Track existing video

  const fetchBanner = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getData(`/api/banners/${bannerId}`, token);
      if (response.success && response.data) {
        const banner = response.data;
        setTitle(banner.title || "");
        setSubtitle(banner.subtitle || "");
        setLink(banner.link || "");
        setPosition(banner.position || "top");
        setIsActive(banner.isActive !== false);
        if (banner.image) {
          setImage({ preview: banner.image, isExisting: true });
        }
        // ===== LOAD VIDEO DATA =====
        if (banner.mediaType) {
          setMediaType(banner.mediaType);
        }
        if (banner.videoUrl) {
          setVideoUrl(banner.videoUrl);
          setExistingVideoUrl(banner.videoUrl);
          setVideoInputMethod("url");
        }
      } else {
        toast.error("Banner not found");
        router.push("/banners");
      }
    } catch (error) {
      console.error("Failed to fetch banner:", error);
      toast.error("Failed to load banner");
      router.push("/banners");
    }
    setIsLoading(false);
  }, [bannerId, token, router]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token && bannerId) {
      fetchBanner();
    }
  }, [isAuthenticated, token, bannerId, fetchBanner]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage({ file, preview: reader.result, isExisting: false });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(null);
  };

  // ===== VIDEO HANDLERS =====
  const handleVideoFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ["video/mp4", "video/webm"];
      if (!validTypes.includes(file.type)) {
        toast.error("Only MP4 and WebM video formats are supported");
        return;
      }
      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error("Video size should be less than 50MB");
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setVideoUrl(""); // Clear URL if uploading file
    }
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreview("");
    setVideoUrl("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // For image banners, image is required
    if (mediaType === "image" && !image) {
      toast.error("Please upload a banner image");
      return;
    }

    // Video validation
    if (mediaType === "video") {
      if (!videoUrl && !videoFile && !existingVideoUrl) {
        toast.error("Please provide a video URL or upload a video file");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let imageUrl = image?.preview || "";

      // Only upload if it's a new image
      if (image && !image.isExisting && image.file) {
        const uploadResult = await uploadFile(image.file, token);
        if (!uploadResult.success || !uploadResult.data?.url) {
          toast.error("Failed to upload image");
          setIsSubmitting(false);
          return;
        }
        imageUrl = uploadResult.data.url;
      }

      // Handle video upload if video file is provided
      let finalVideoUrl = videoUrl || existingVideoUrl;
      if (mediaType === "video" && videoFile) {
        const videoUploadResult = await uploadVideoFile(videoFile, token);
        if (!videoUploadResult.success || !videoUploadResult.data?.url) {
          toast.error("Failed to upload video");
          setIsSubmitting(false);
          return;
        }
        finalVideoUrl = videoUploadResult.data.url;
      }

      const bannerData = {
        title,
        subtitle,
        image: imageUrl,
        link,
        position,
        isActive,
        // ===== NEW VIDEO FIELDS =====
        mediaType,
        videoUrl: mediaType === "video" ? finalVideoUrl : "",
      };

      const response = await putData(
        `/api/banners/${bannerId}`,
        bannerData,
        token,
      );

      if (response.success) {
        toast.success("Banner updated successfully!");
        router.push("/banners");
      } else {
        toast.error(response.message || "Failed to update banner");
      }
    } catch (error) {
      console.error("Error updating banner:", error);
      toast.error("Failed to update banner");
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <section className="w-full py-3 px-5">
      <h2 className="text-[18px] text-gray-700 font-[600]">Edit Banner</h2>
      <form
        onSubmit={handleSubmit}
        className="mt-5 bg-white p-5 shadow-md rounded-md"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Banner Title
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter banner title (optional)"
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
            />
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Subtitle
            </span>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Enter subtitle (optional)"
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
            />
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Link URL
            </span>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="e.g., /products or https://..."
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
            />
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Position
            </span>
            <Select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              size="small"
              className="bg-white"
            >
              <MenuItem value="home-top">Home Top</MenuItem>
              <MenuItem value="home-middle">Home Middle</MenuItem>
              <MenuItem value="home-bottom">Home Bottom</MenuItem>
              <MenuItem value="sidebar">Sidebar</MenuItem>
              <MenuItem value="category">Category Page</MenuItem>
              <MenuItem value="product">Product Page</MenuItem>
            </Select>
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Active Status
            </span>
            <div className="flex items-center gap-2">
              <Switch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                color="primary"
              />
              <span className="text-sm text-gray-600">
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        {/* ===== MEDIA TYPE SELECTOR ===== */}
        <div className="flex flex-col gap-2 mt-5 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-[16px] text-gray-700 font-[600] flex items-center gap-2">
            Media Type
          </h3>
          <RadioGroup
            row
            value={mediaType}
            onChange={(e) => {
              setMediaType(e.target.value);
              // Reset video fields when switching to image
              if (e.target.value === "image") {
                setVideoUrl("");
                setVideoFile(null);
                setVideoPreview("");
              }
            }}
          >
            <FormControlLabel
              value="image"
              control={<Radio />}
              label={
                <span className="flex items-center gap-2">
                  <FiImage /> Image Banner
                </span>
              }
            />
            <FormControlLabel
              value="video"
              control={<Radio />}
              label={
                <span className="flex items-center gap-2">
                  <FiVideo /> Video Banner
                </span>
              }
            />
          </RadioGroup>
          <p className="text-xs text-gray-500">
            {mediaType === "image"
              ? "Standard image banner (existing behavior)"
              : "Autoplaying video banner with image fallback"}
          </p>
        </div>

        {/* ===== VIDEO INPUT (Only shown when mediaType is "video") ===== */}
        {mediaType === "video" && (
          <div className="flex flex-col gap-4 mt-5 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="text-[16px] text-gray-700 font-[600] flex items-center gap-2">
              <FiVideo className="text-purple-600" /> Video Source
            </h3>

            {/* Video Input Method Toggle */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setVideoInputMethod("url")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                  videoInputMethod === "url"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                <FiLink /> Video URL
              </button>
              <button
                type="button"
                onClick={() => setVideoInputMethod("upload")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                  videoInputMethod === "upload"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                <FiVideo /> Upload Video
              </button>
            </div>

            {/* Video URL Input */}
            {videoInputMethod === "url" && (
              <div className="form-group flex flex-col gap-1">
                <span className="text-[14px] text-gray-700 font-medium">
                  Video URL (MP4/WebM)
                </span>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => {
                    setVideoUrl(e.target.value);
                    setVideoFile(null);
                    setVideoPreview("");
                  }}
                  placeholder="https://example.com/video.mp4"
                  className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-purple-500 px-3 text-[14px]"
                />
                {(videoUrl || existingVideoUrl) && (
                  <div className="mt-2 relative">
                    <video
                      src={videoUrl || existingVideoUrl}
                      className="w-full max-w-[400px] h-[150px] object-cover rounded-md bg-black"
                      muted
                      loop
                      playsInline
                      autoPlay
                    />
                    <button
                      type="button"
                      onClick={removeVideo}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                    >
                      <IoMdClose size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Video File Upload */}
            {videoInputMethod === "upload" && (
              <div className="form-group flex flex-col gap-1">
                <span className="text-[14px] text-gray-700 font-medium">
                  Upload Video File
                </span>
                {!videoPreview ? (
                  <label className="w-[250px] h-[150px] rounded-md bg-gray-100 border-2 border-dashed border-purple-300 flex flex-col items-center justify-center cursor-pointer hover:bg-purple-50 transition-all">
                    <FiVideo size={32} className="text-purple-500 mb-2" />
                    <span className="text-sm text-gray-600">
                      Click to upload
                    </span>
                    <span className="text-xs text-gray-400">
                      MP4, WebM (max 50MB)
                    </span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm"
                      onChange={handleVideoFileUpload}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative w-fit">
                    <video
                      src={videoPreview}
                      className="w-[300px] h-[150px] object-cover rounded-md bg-black"
                      muted
                      loop
                      playsInline
                      autoPlay
                    />
                    <button
                      type="button"
                      onClick={removeVideo}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                    >
                      <IoMdClose size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Video Specs Helper */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800 font-medium">
                📹 Recommended Video Specs:
              </p>
              <ul className="text-xs text-yellow-700 mt-1 list-disc list-inside">
                <li>Resolution: 1920×400 (wide banner format)</li>
                <li>Duration: ≤10 seconds for best UX</li>
                <li>Format: MP4 (H.264) or WebM</li>
                <li>Size: Under 10MB for fast loading</li>
                <li>Videos auto-play muted for browser compatibility</li>
              </ul>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-5">
          <h3 className="text-[16px] text-gray-700 font-[600]">
            {mediaType === "video"
              ? "Poster Image (Optional)"
              : "Banner Image *"}
          </h3>

          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {image && (
              <div className="w-[250px] h-[150px] rounded-md bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden">
                <img
                  src={image.preview}
                  alt="banner preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                >
                  <IoMdClose size={16} />
                </button>
              </div>
            )}

            {!image && <UploadBox onChange={handleImageUpload} />}
          </div>
          <p className="text-sm text-gray-500">
            {mediaType === "video"
              ? "Optional: Shows while video loads. Recommended: 1920x400px. Max 5MB."
              : "Recommended size: 1920x400px for top banners. Max 5MB."}
          </p>
        </div>

        <div className="mt-8 flex gap-3">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="!bg-blue-600 !text-white !px-8 !py-2.5 hover:!bg-blue-700 disabled:!opacity-50 !font-medium"
          >
            {isSubmitting ? "Updating..." : "Update Banner"}
          </Button>
          <Button
            type="button"
            onClick={() => router.push("/banners")}
            className="!border !border-gray-300 !text-gray-700 !px-8 !py-2.5 hover:!bg-gray-50"
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
};

export default EditBanner;
