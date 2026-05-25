"use client";
import HomeSlideImageField from "@/components/HomeSlideImageField";
import { useAdmin } from "@/context/AdminContext";
import { getData, putData, uploadFile } from "@/utils/api";
import {
  buildHomeSlideImageAsset,
  HOME_SLIDE_DESKTOP_SPEC,
  HOME_SLIDE_MOBILE_SPEC,
} from "@/utils/homeSlideImage";
import { Button } from "@mui/material";
import Switch from "@mui/material/Switch";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

const TIMER_POSITIONS = [
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
];

const formatDateTimeInputValue = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const timezoneOffsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

const EditHomeSlide = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const params = useParams();
  const slideId = params.id;

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [link, setLink] = useState("");
  const [order, setOrder] = useState(0);
  const [stayDurationSeconds, setStayDurationSeconds] = useState(6);
  const [isActive, setIsActive] = useState(true);
  const [offerEnabled, setOfferEnabled] = useState(false);
  const [offerBadgeText, setOfferBadgeText] = useState("Offer ends in");
  const [offerEndsAt, setOfferEndsAt] = useState("");
  const [offerTimerPosition, setOfferTimerPosition] = useState("top-right");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [image, setImage] = useState(null);
  const [mobileImage, setMobileImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleOfferToggle = (checked) => {
    setOfferEnabled(checked);
    if (!checked) {
      setOfferEndsAt("");
    }
  };

  const handleOfferEndsAtChange = (value) => {
    setOfferEndsAt(value);
    setOfferEnabled(Boolean(value));
  };

  const fetchSlide = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getData(`/api/home-slides/${slideId}`, token);
      if (response.success && response.data) {
        const slide = response.data;
        setTitle(slide.title || "");
        setSubtitle(slide.subtitle || "");
        setDescription(slide.description || "");
        setButtonText(slide.buttonText || "Shop Now");
        setLink(slide.link || slide.buttonLink || "");
        setOrder(slide.sortOrder || slide.order || 0);
        setStayDurationSeconds(
          Math.max(
            Math.round(
              Number(
                slide.stayDurationMs ||
                  (Number(slide.stayDuration || 0) > 0
                    ? Number(slide.stayDuration) * 1000
                    : 5600),
              ) / 1000,
            ),
            2,
          ),
        );
        setIsActive(slide.isActive !== false);
        setOfferEnabled(Boolean(slide.offerEnabled || slide.offerEndsAt));
        setOfferBadgeText(slide.offerBadgeText || "Offer ends in");
        setOfferEndsAt(formatDateTimeInputValue(slide.offerEndsAt));
        setOfferTimerPosition(slide.offerTimerPosition || "top-right");
        setStartDate(formatDateTimeInputValue(slide.startDate));
        setEndDate(formatDateTimeInputValue(slide.endDate));
        if (slide.image) {
          const desktopAsset = await buildHomeSlideImageAsset({
            src: slide.image,
            isExisting: true,
            spec: HOME_SLIDE_DESKTOP_SPEC,
          });
          setImage(desktopAsset);
        }
        if (slide.mobileImage) {
          const mobileAsset = await buildHomeSlideImageAsset({
            src: slide.mobileImage,
            isExisting: true,
            spec: HOME_SLIDE_MOBILE_SPEC,
          });
          setMobileImage(mobileAsset);
        }
      } else {
        toast.error("Slide not found");
        router.push("/home-slides");
      }
    } catch (error) {
      console.error("Failed to fetch slide:", error);
      toast.error("Failed to load slide");
      router.push("/home-slides");
    }
    setIsLoading(false);
  }, [slideId, token, router]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token && slideId) {
      fetchSlide();
    }
  }, [isAuthenticated, token, slideId, fetchSlide]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }

      try {
        const asset = await buildHomeSlideImageAsset({
          file,
          spec: HOME_SLIDE_DESKTOP_SPEC,
        });
        setImage(asset);
      } catch (error) {
        toast.error("Failed to load image preview");
      }
    }
  };

  const removeImage = () => {
    setImage(null);
  };

  const handleMobileImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }

      try {
        const asset = await buildHomeSlideImageAsset({
          file,
          spec: HOME_SLIDE_MOBILE_SPEC,
        });
        setMobileImage(asset);
      } catch (error) {
        toast.error("Failed to load mobile image preview");
      }
    }
  };

  const removeMobileImage = () => {
    setMobileImage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image) {
      toast.error("Please upload a slide image");
      return;
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast.error("End date must be after start date");
      return;
    }
    if (offerEnabled && !offerEndsAt) {
      toast.error("Please set when the offer ends");
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = image.preview;

      if (!image.isExisting && image.file) {
        const uploadResult = await uploadFile(image.file, token);
        if (!uploadResult.success || !uploadResult.data?.url) {
          toast.error("Failed to upload image");
          setIsSubmitting(false);
          return;
        }
        imageUrl = uploadResult.data.url;
      }

      let mobileImageUrl = mobileImage?.preview || "";
      if (mobileImage?.file && !mobileImage.isExisting) {
        const mobileUploadResult = await uploadFile(mobileImage.file, token);
        if (!mobileUploadResult.success || !mobileUploadResult.data?.url) {
          toast.error("Failed to upload mobile image");
          setIsSubmitting(false);
          return;
        }
        mobileImageUrl = mobileUploadResult.data.url;
      }

      const slideData = {
        title,
        subtitle,
        description,
        buttonText,
        image: imageUrl,
        mobileImage: mobileImageUrl,
        link,
        buttonLink: link,
        sortOrder: Number(order) || 0,
        stayDurationMs: Math.max(Number(stayDurationSeconds) || 6, 2) * 1000,
        offerEnabled: Boolean(offerEnabled && offerEndsAt),
        offerBadgeText,
        offerEndsAt: offerEndsAt || null,
        offerTimerPosition,
        isActive,
        startDate: startDate || null,
        endDate: endDate || null,
      };

      const response = await putData(
        `/api/home-slides/${slideId}`,
        slideData,
        token,
      );

      if (response.success) {
        toast.success("Home slide updated successfully!");
        router.push("/home-slides");
      } else {
        toast.error(response.message || "Failed to update slide");
      }
    } catch (error) {
      console.error("Error updating slide:", error);
      toast.error("Failed to update slide");
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
      <h2 className="text-[18px] text-gray-700 font-[600]">Edit Home Slide</h2>
      <form
        onSubmit={handleSubmit}
        className="mt-5 bg-white p-5 shadow-md rounded-md"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Slide Title
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter slide title"
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
              placeholder="Enter subtitle"
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
            />
          </div>

          <div className="form-group flex flex-col gap-1 md:col-span-2">
            <span className="text-[15px] text-gray-800 font-medium">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description"
              rows={3}
              className="w-full border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 py-2 text-[14px]"
            />
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Button Text
            </span>
            <input
              type="text"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder="e.g., Shop Now"
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
              placeholder="e.g., /products"
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
            />
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Slide Priority
            </span>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
            />
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Stay Duration (seconds)
            </span>
            <input
              type="number"
              value={stayDurationSeconds}
              onChange={(e) => setStayDurationSeconds(e.target.value)}
              placeholder="6"
              min="2"
              max="60"
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
            />
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

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Start Date
            </span>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
            />
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              End Date
            </span>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
            />
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-semibold text-gray-800">
                Time Limited Offer On This Slide
              </h3>
              <p className="text-sm text-gray-500">
                Show a live offer timer on this slide and control where it appears.
              </p>
            </div>
            <Switch
              checked={offerEnabled}
              onChange={(e) => handleOfferToggle(e.target.checked)}
              color="warning"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="form-group flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Offer Label
              </span>
              <input
                type="text"
                value={offerBadgeText}
                onChange={(e) => setOfferBadgeText(e.target.value)}
                placeholder="Offer ends in"
                className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
              />
            </div>
            <div className="form-group flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Offer Ends At
              </span>
              <input
                type="datetime-local"
                value={offerEndsAt}
                onChange={(e) => handleOfferEndsAtChange(e.target.value)}
                className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
              />
            </div>
            <div className="form-group flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Timer Position
              </span>
              <select
                value={offerTimerPosition}
                onChange={(e) => setOfferTimerPosition(e.target.value)}
                className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
              >
                {TIMER_POSITIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <HomeSlideImageField
          label="Desktop Slide Image"
          asset={image}
          onChange={handleImageUpload}
          onRemove={removeImage}
          spec={HOME_SLIDE_DESKTOP_SPEC}
          required
          hint="Use a 16:9 image here. The homepage hero now behaves like a media player frame, so wide landscape slides will fit best."
        />

        <HomeSlideImageField
          label="Mobile Slide Image"
          asset={mobileImage}
          onChange={handleMobileImageUpload}
          onRemove={removeMobileImage}
          spec={HOME_SLIDE_MOBILE_SPEC}
          hint="Optional, but recommended if you want a separately cropped 16:9 mobile-safe composition."
        />

        <div className="mt-8 flex gap-3">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="!bg-blue-600 !text-white !px-8 !py-2.5 hover:!bg-blue-700 disabled:!opacity-50 !font-medium"
          >
            {isSubmitting ? "Updating..." : "Update Slide"}
          </Button>
          <Button
            type="button"
            onClick={() => router.push("/home-slides")}
            className="!border !border-gray-300 !text-gray-700 !px-8 !py-2.5 hover:!bg-gray-50"
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
};

export default EditHomeSlide;
