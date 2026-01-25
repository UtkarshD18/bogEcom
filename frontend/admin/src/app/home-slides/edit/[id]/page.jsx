"use client";
import UploadBox from "@/components/UploadBox";
import { useAdmin } from "@/context/AdminContext";
import { getData, putData, uploadFile } from "@/utils/api";
import { Button } from "@mui/material";
import Switch from "@mui/material/Switch";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { IoMdClose } from "react-icons/io";

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
  const [isActive, setIsActive] = useState(true);
  const [image, setImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token && slideId) {
      fetchSlide();
    }
  }, [isAuthenticated, token, slideId]);

  const fetchSlide = async () => {
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
        setIsActive(slide.isActive !== false);
        if (slide.image) {
          setImage({ preview: slide.image, isExisting: true });
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
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image) {
      toast.error("Please upload a slide image");
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

      const slideData = {
        title,
        subtitle,
        description,
        buttonText,
        image: imageUrl,
        link,
        buttonLink: link,
        sortOrder: Number(order) || 0,
        isActive,
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

        <div className="flex flex-col gap-2 mt-5">
          <h3 className="text-[16px] text-gray-700 font-[600]">
            Slide Image *
          </h3>

          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {image && (
              <div className="w-[300px] h-[150px] rounded-md bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden">
                <img
                  src={image.preview}
                  alt="slide preview"
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
            Recommended size: 1920x600px. Max 5MB.
          </p>
        </div>

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
