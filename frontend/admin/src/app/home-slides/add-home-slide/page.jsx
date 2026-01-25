"use client";
import UploadBox from "@/components/UploadBox";
import { useAdmin } from "@/context/AdminContext";
import { postData, uploadFile } from "@/utils/api";
import { Button } from "@mui/material";
import Switch from "@mui/material/Switch";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { IoMdClose } from "react-icons/io";

const AddHomeSlide = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [link, setLink] = useState("");
  const [order, setOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [images, setImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages([{ file, preview: reader.result }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImages([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length === 0) {
      toast.error("Please upload a slide image");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload image first
      const uploadResult = await uploadFile(images[0].file, token);
      if (!uploadResult.success || !uploadResult.data?.url) {
        toast.error("Failed to upload image");
        setIsSubmitting(false);
        return;
      }

      const slideData = {
        title,
        subtitle,
        image: uploadResult.data.url,
        link,
        order: Number(order) || 0,
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

        <div className="flex flex-col gap-2 mt-5">
          <h3 className="text-[16px] text-gray-700 font-[600]">
            Slide Image *
          </h3>

          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {images.map((img, index) => (
              <div
                key={index}
                className="w-[300px] h-[150px] rounded-md bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden"
              >
                <img
                  src={img.preview}
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
            ))}

            {images.length === 0 && <UploadBox onChange={handleImageUpload} />}
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
