"use client";
import HomeSlideImageField from "@/components/HomeSlideImageField";
import { useAdmin } from "@/context/AdminContext";
import { postData, uploadFile } from "@/utils/api";
import {
  buildHomeSlideImageAsset,
  HOME_SLIDE_DESKTOP_SPEC,
  HOME_SLIDE_MOBILE_SPEC,
} from "@/utils/homeSlideImage";
import { Button } from "@mui/material";
import Switch from "@mui/material/Switch";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

const AddHomeSlide = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [link, setLink] = useState("");
  const [order, setOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [image, setImage] = useState(null);
  const [mobileImage, setMobileImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

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

    setIsSubmitting(true);

    try {
      const uploadResult = await uploadFile(image.file, token);
      if (!uploadResult.success || !uploadResult.data?.url) {
        toast.error("Failed to upload image");
        setIsSubmitting(false);
        return;
      }

      let mobileImageUrl = "";
      if (mobileImage?.file) {
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
        image: uploadResult.data.url,
        mobileImage: mobileImageUrl,
        link,
        buttonLink: link,
        sortOrder: Number(order) || 0,
        isActive,
      };

      const response = await postData("/api/home-slides", slideData, token);

      if (response.success) {
        toast.success("Home slide created successfully!");
        router.push("/home-slides");
      } else {
        toast.error(response.message || "Failed to create slide");
      }
    } catch (error) {
      console.error("Error creating slide:", error);
      toast.error("Failed to create slide");
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
    <section className="w-full py-3 px-5">
      <h2 className="text-[18px] text-gray-700 font-[600]">Add Home Slide</h2>
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
              placeholder="Enter slide title (optional)"
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
              Display Order
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

        <HomeSlideImageField
          label="Desktop Slide Image"
          asset={image}
          onChange={handleImageUpload}
          onRemove={removeImage}
          spec={HOME_SLIDE_DESKTOP_SPEC}
          required
          hint="Use this for desktop and tablet hero banners. If the ratio is very different, it will be stretched to fill the banner."
        />

        <HomeSlideImageField
          label="Mobile Slide Image"
          asset={mobileImage}
          onChange={handleMobileImageUpload}
          onRemove={removeMobileImage}
          spec={HOME_SLIDE_MOBILE_SPEC}
          hint="Optional, but strongly recommended for phones if the desktop image is wide. Without it, the desktop image will be stretched to fit the mobile banner."
        />

        <div className="mt-8 flex gap-3">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="!bg-blue-600 !text-white !px-8 !py-2.5 hover:!bg-blue-700 disabled:!opacity-50 !font-medium"
          >
            {isSubmitting ? "Creating..." : "Publish Slide"}
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

export default AddHomeSlide;
