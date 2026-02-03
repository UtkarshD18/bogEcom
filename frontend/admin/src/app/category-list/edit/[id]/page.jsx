"use client";
import UploadBox from "@/components/UploadBox";
import { useAdmin } from "@/context/AdminContext";
import { getData, putData, uploadFile } from "@/utils/api";
import { Button } from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { IoMdClose } from "react-icons/io";

const EditCategory = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const params = useParams();
  const categoryId = params.id;

  const [categoryName, setCategoryName] = useState("");
  const [parentCategory, setParentCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [color, setColor] = useState("#3b82f6");
  const [images, setImages] = useState([]); // { file?, preview, isExisting? }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCategory, setIsLoadingCategory] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await getData("/api/categories", token);
      if (response.success) {
        // Only show parent categories (no parent), and exclude current category
        const parentCategories = (response.data || []).filter(
          (cat) => !cat.parent && cat._id !== categoryId,
        );
        setCategories(parentCategories);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }, [token, categoryId]);

  const fetchCategoryDetails = useCallback(async () => {
    setIsLoadingCategory(true);
    try {
      const response = await getData(`/api/categories/${categoryId}`, token);
      if (response.success && response.data) {
        const cat = response.data;
        setCategoryName(cat.name || "");
        setParentCategory(cat.parent?._id || cat.parent || "");
        setColor(cat.color || "#3b82f6");
        if (cat.image) {
          setImages([{ preview: cat.image, isExisting: true }]);
        }
      } else {
        toast.error("Category not found");
        router.push("/category-list");
      }
    } catch (error) {
      console.error("Failed to fetch category:", error);
      toast.error("Failed to load category");
      router.push("/category-list");
    }
    setIsLoadingCategory(false);
  }, [categoryId, token, router]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token && categoryId) {
      fetchCategories();
      fetchCategoryDetails();
    }
  }, [
    isAuthenticated,
    token,
    categoryId,
    fetchCategories,
    fetchCategoryDetails,
  ]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages([{ file, preview: reader.result, isExisting: false }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImages([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      toast.error("Please enter a category name");
      return;
    }
    if (images.length === 0) {
      toast.error("Please upload a category image");
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = images[0].preview;

      // Only upload if it's a new image (not existing)
      if (!images[0].isExisting && images[0].file) {
        const uploadResult = await uploadFile(images[0].file, token);
        if (!uploadResult.success || !uploadResult.data?.url) {
          toast.error("Failed to upload image");
          setIsSubmitting(false);
          return;
        }
        imageUrl = uploadResult.data.url;
      }

      const categoryData = {
        name: categoryName,
        image: imageUrl,
        color,
        parent: parentCategory || null,
      };

      const response = await putData(
        `/api/categories/${categoryId}`,
        categoryData,
        token,
      );

      if (response.success) {
        toast.success("Category updated successfully!");
        router.push("/category-list");
      } else {
        toast.error(response.message || "Failed to update category");
      }
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error("Failed to update category");
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

  if (isLoadingCategory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <section className="w-full py-3 px-5">
      <h2 className="text-[18px] text-gray-700 font-[600]">Edit Category</h2>
      <form
        onSubmit={handleSubmit}
        className="mt-5 bg-white p-5 shadow-md rounded-md"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Category Name *
            </span>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Enter category name"
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
            />
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Parent Category (Optional)
            </span>
            <Select
              value={parentCategory}
              onChange={(e) => setParentCategory(e.target.value)}
              displayEmpty
              size="small"
              className="bg-white"
            >
              <MenuItem value="">
                <em>None (Top Level)</em>
              </MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat._id} value={cat._id}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Category Color
            </span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-[50px] h-[40px] border border-gray-300 rounded cursor-pointer"
              />
              <span className="text-sm text-gray-600">{color}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-5">
          <h3 className="text-[16px] text-gray-700 font-[600]">
            Category Image *
          </h3>

          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {images.map((img, index) => (
              <div
                key={index}
                className="w-[150px] h-[150px] rounded-md bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden"
              >
                <img
                  src={img.preview}
                  alt="category preview"
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
            Max 5MB. Supported: JPG, PNG, WebP
          </p>
        </div>

        <div className="mt-8 flex gap-3">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="!bg-blue-600 !text-white !px-8 !py-2.5 hover:!bg-blue-700 disabled:!opacity-50 !font-medium"
          >
            {isSubmitting ? "Updating..." : "Update Category"}
          </Button>
          <Button
            type="button"
            onClick={() => router.push("/category-list")}
            className="!border !border-gray-300 !text-gray-700 !px-8 !py-2.5 hover:!bg-gray-50"
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
};

export default EditCategory;
