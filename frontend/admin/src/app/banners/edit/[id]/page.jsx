"use client";

import UploadBox from "@/components/UploadBox";
import { useAdmin } from "@/context/AdminContext";
import { getData, putData, uploadFile, uploadVideoFile } from "@/utils/api";
import { Button, FormControlLabel, Radio, RadioGroup } from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { FiImage, FiLink, FiVideo } from "react-icons/fi";
import { IoMdClose } from "react-icons/io";

const BANNER_POSITIONS = [
  { value: "home-top", label: "Home Top" },
  { value: "home-middle", label: "Home Middle" },
  { value: "home-bottom", label: "Home Bottom" },
  { value: "sidebar", label: "Sidebar" },
  { value: "category", label: "Category Page" },
  { value: "product", label: "Product Page" },
];

const validateImageFile = ({
  file,
  minWidth,
  minHeight,
  targetRatio,
  minRatioMultiplier,
  maxRatioMultiplier,
  errorMessage,
}) =>
  new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Please choose an image."));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Image size should be less than 5MB."));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      const img = new window.Image();

      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const ratio = width / Math.max(height, 1);

        if (
          width < minWidth ||
          height < minHeight ||
          ratio < targetRatio * minRatioMultiplier ||
          ratio > targetRatio * maxRatioMultiplier
        ) {
          reject(new Error(errorMessage));
          return;
        }

        resolve({
          file,
          preview: dataUrl,
          isExisting: false,
        });
      };

      img.onerror = () => reject(new Error("Invalid image file."));
      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  });

const EditBanner = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const params = useParams();
  const bannerId = params.id;

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [link, setLink] = useState("");
  const [buttonText, setButtonText] = useState("Shop Now");
  const [position, setPosition] = useState("home-top");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [desktopImage, setDesktopImage] = useState(null);
  const [mobileImage, setMobileImage] = useState(null);
  const [mediaType, setMediaType] = useState("image");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [videoInputMethod, setVideoInputMethod] = useState("url");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBanner = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getData(`/api/banners/${bannerId}`, token);
      if (!response.success || !response.data) {
        toast.error("Banner not found.");
        router.push("/banners");
        return;
      }

      const banner = response.data;
      setTitle(banner.title || "");
      setSubtitle(banner.subtitle || "");
      setLink(banner.link || "");
      setButtonText(banner.buttonText || banner.linkText || "Shop Now");
      setPosition(banner.position || "home-top");
      setSortOrder(Number(banner.sortOrder) || 0);
      setIsActive(banner.isActive !== false);
      setMediaType(banner.mediaType || "image");
      setVideoUrl(banner.videoUrl || "");
      setVideoPreview(banner.videoUrl || "");
      setVideoInputMethod("url");

      setDesktopImage(
        banner.image
          ? { preview: banner.image, isExisting: true }
          : null,
      );
      setMobileImage(
        banner.mobileImage
          ? { preview: banner.mobileImage, isExisting: true }
          : null,
      );
    } catch (error) {
      console.error("Failed to fetch banner:", error);
      toast.error("Failed to load banner.");
      router.push("/banners");
    } finally {
      setIsLoading(false);
    }
  }, [bannerId, router, token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token && bannerId) {
      void fetchBanner();
    }
  }, [bannerId, fetchBanner, isAuthenticated, token]);

  const handleDesktopImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const preparedImage = await validateImageFile({
        file,
        minWidth: 1200,
        minHeight: 300,
        targetRatio: 1920 / 400,
        minRatioMultiplier: 0.8,
        maxRatioMultiplier: 1.2,
        errorMessage:
          "Desktop banner should be close to 1920x400px. Wider images work best.",
      });
      setDesktopImage(preparedImage);
    } catch (error) {
      toast.error(error.message);
    } finally {
      event.target.value = "";
    }
  };

  const handleMobileImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const preparedImage = await validateImageFile({
        file,
        minWidth: 600,
        minHeight: 250,
        targetRatio: 900 / 400,
        minRatioMultiplier: 0.7,
        maxRatioMultiplier: 1.5,
        errorMessage:
          "Mobile banner should be close to 900x400px for the best fit.",
      });
      setMobileImage(preparedImage);
    } catch (error) {
      toast.error(error.message);
    } finally {
      event.target.value = "";
    }
  };

  const handleVideoFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ["video/mp4", "video/webm"];
    if (!validTypes.includes(file.type)) {
      toast.error("Only MP4 and WebM video formats are supported.");
      event.target.value = "";
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video size should be less than 50MB.");
      event.target.value = "";
      return;
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setVideoUrl("");
    event.target.value = "";
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreview("");
    setVideoUrl("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!String(title || "").trim()) {
      toast.error("Banner title is required.");
      return;
    }

    if (mediaType === "image" && !desktopImage) {
      toast.error("Please upload a desktop banner image.");
      return;
    }

    if (mediaType === "image" && !mobileImage) {
      toast.error("Please upload a mobile banner image.");
      return;
    }

    if (mediaType === "video" && !videoUrl && !videoFile) {
      toast.error("Please provide a video URL or upload a video file.");
      return;
    }

    setIsSubmitting(true);

    try {
      let desktopImageUrl = desktopImage?.preview || "";
      let mobileImageUrl = mobileImage?.preview || "";

      if (desktopImage?.file) {
        const uploadResult = await uploadFile(desktopImage.file, token);
        if (!uploadResult.success || !uploadResult.data?.url) {
          toast.error("Failed to upload desktop image.");
          setIsSubmitting(false);
          return;
        }
        desktopImageUrl = uploadResult.data.url;
      }

      if (mobileImage?.file) {
        const uploadResult = await uploadFile(mobileImage.file, token);
        if (!uploadResult.success || !uploadResult.data?.url) {
          toast.error("Failed to upload mobile image.");
          setIsSubmitting(false);
          return;
        }
        mobileImageUrl = uploadResult.data.url;
      }

      let finalVideoUrl = videoUrl;
      if (mediaType === "video" && videoFile) {
        const uploadResult = await uploadVideoFile(videoFile, token);
        if (!uploadResult.success || !uploadResult.data?.url) {
          toast.error("Failed to upload video.");
          setIsSubmitting(false);
          return;
        }
        finalVideoUrl = uploadResult.data.url;
      }

      const safeButtonText = String(buttonText || "").trim() || "Shop Now";
      const response = await putData(
        `/api/banners/${bannerId}`,
        {
          title: String(title || "").trim(),
          subtitle: String(subtitle || "").trim(),
          image: desktopImageUrl,
          mobileImage: mobileImageUrl,
          link: String(link || "").trim(),
          buttonText: safeButtonText,
          linkText: safeButtonText,
          position,
          sortOrder: Number(sortOrder) || 0,
          isActive,
          mediaType,
          videoUrl: mediaType === "video" ? finalVideoUrl : "",
        },
        token,
      );

      if (response.success) {
        toast.success("Banner updated successfully!");
        router.push("/banners");
      } else {
        toast.error(response.message || "Failed to update banner.");
      }
    } catch (error) {
      console.error("Error updating banner:", error);
      toast.error("Failed to update banner.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <section className="w-full py-3 px-5">
      <h2 className="text-[18px] text-gray-700 font-[600]">Edit Banner</h2>
      <p className="mt-1 text-sm text-gray-500">
        Update text, CTA, order, poster images, or switch between image and
        video.
      </p>

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
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter banner title"
              required
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
              onChange={(event) => setSubtitle(event.target.value)}
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
              onChange={(event) => setLink(event.target.value)}
              placeholder="e.g. /products or https://..."
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
            />
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Button Text
            </span>
            <input
              type="text"
              value={buttonText}
              onChange={(event) => setButtonText(event.target.value)}
              placeholder="Shop Now"
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
            />
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Position
            </span>
            <Select
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              size="small"
              className="bg-white"
            >
              {BANNER_POSITIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Sort Order
            </span>
            <input
              type="number"
              min="0"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              placeholder="0"
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
            />
            <span className="text-xs text-gray-500">
              Lower numbers appear first.
            </span>
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Active Status
            </span>
            <div className="flex items-center gap-2">
              <Switch
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                color="primary"
              />
              <span className="text-sm text-gray-600">
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-5 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-[16px] text-gray-700 font-[600]">Media Type</h3>
          <RadioGroup
            row
            value={mediaType}
            onChange={(event) => setMediaType(event.target.value)}
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
            Switch between static and video cards without leaving the editor.
          </p>
        </div>

        {mediaType === "video" ? (
          <div className="flex flex-col gap-4 mt-5 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="text-[16px] text-gray-700 font-[600] flex items-center gap-2">
              <FiVideo className="text-purple-600" /> Video Source
            </h3>

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

            {videoInputMethod === "url" ? (
              <div className="form-group flex flex-col gap-1">
                <span className="text-[14px] text-gray-700 font-medium">
                  Video URL
                </span>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(event) => {
                    setVideoUrl(event.target.value);
                    setVideoFile(null);
                    setVideoPreview("");
                  }}
                  placeholder="https://example.com/video.mp4"
                  className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-purple-500 px-3 text-[14px]"
                />
                {videoUrl ? (
                  <div className="mt-2 relative">
                    <video
                      src={videoUrl}
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
                ) : null}
              </div>
            ) : (
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
                      MP4 or WebM, max 50MB
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

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800 font-medium">
                Recommended video specs:
              </p>
              <ul className="text-xs text-yellow-700 mt-1 list-disc list-inside">
                <li>Resolution around 1920x400 for a wide desktop fit</li>
                <li>Short clips work best for fast loading and clean UX</li>
                <li>Use MP4 (H.264) or WebM</li>
                <li>Keep file size under 10MB when possible</li>
              </ul>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 mt-5">
          <h3 className="text-[16px] text-gray-700 font-[600]">
            {mediaType === "video"
              ? "Poster Images (Optional)"
              : "Banner Images"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label className="text-sm font-medium">Desktop Image</label>
              <div className="mt-2 flex items-center gap-4 flex-wrap">
                {desktopImage ? (
                  <div className="w-[250px] h-[150px] rounded-md bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden">
                    <Image
                      src={desktopImage.preview}
                      alt="Desktop banner preview"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setDesktopImage(null)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                    >
                      <IoMdClose size={16} />
                    </button>
                  </div>
                ) : (
                  <UploadBox onChange={handleDesktopImageUpload} />
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Recommended desktop size: 1920x400px. Max 5MB.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Mobile Image</label>
              <div className="mt-2 flex items-center gap-4 flex-wrap">
                {mobileImage ? (
                  <div className="w-[180px] h-[150px] rounded-md bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden">
                    <Image
                      src={mobileImage.preview}
                      alt="Mobile banner preview"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setMobileImage(null)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                    >
                      <IoMdClose size={16} />
                    </button>
                  </div>
                ) : (
                  <UploadBox onChange={handleMobileImageUpload} />
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Recommended mobile size: 900x400px. Max 5MB.
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Video banners can still use these images as poster fallbacks across
            devices.
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
