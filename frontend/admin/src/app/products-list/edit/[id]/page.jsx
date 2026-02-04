"use client";
import UploadBox from "@/components/UploadBox";
import { useAdmin } from "@/context/AdminContext";
import { getData, putData, uploadFile } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import { Button } from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import Rating from "@mui/material/Rating";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { IoMdClose } from "react-icons/io";

const EditProduct = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const params = useParams();
  const productId = params.id;

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [categoryVal, setCategoryVal] = useState("");
  const [subCategoryVal, setSubCategoryVal] = useState("");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [isNewArrival, setIsNewArrival] = useState(false);
  const [demandStatus, setDemandStatus] = useState("NORMAL");
  const [stock, setStock] = useState("");
  const [brand, setBrand] = useState("");
  const [discount, setDiscount] = useState("");
  const [rating, setRating] = useState(4);
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("g");
  const [tags, setTags] = useState("");
  const [newImages, setNewImages] = useState([]); // { file, preview }
  const [existingImages, setExistingImages] = useState([]); // URLs
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubCategories = useCallback(
    async (parentId) => {
      try {
        const response = await getData("/api/categories", token);
        if (response.success) {
          const subs = (response.data || []).filter(
            (cat) => cat.parent && cat.parent._id === parentId,
          );
          setSubCategories(subs);
        }
      } catch (error) {
        console.error("Failed to fetch subcategories:", error);
      }
    },
    [token],
  );

  const fetchCategories = useCallback(async () => {
    try {
      const response = await getData("/api/categories", token);
      if (response.success) {
        const parentCategories = (response.data || []).filter(
          (cat) => !cat.parent,
        );
        setCategories(parentCategories);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }, [token]);

  const fetchProduct = useCallback(async () => {
    if (!productId || !token) {
      console.log("Missing productId or token:", { productId, token: !!token });
      return;
    }

    setIsLoading(true);
    try {
      console.log("Fetching product:", productId);
      const response = await getData(`/api/products/${productId}`, token);
      console.log("Product response:", response);

      if (response.success && response.data) {
        const product = response.data;
        setProductName(product.name || "");
        setDescription(product.description || "");
        setShortDescription(product.shortDescription || "");
        const catId = product.category?._id || product.category || "";
        setCategoryVal(catId);
        if (catId) {
          await fetchSubCategories(catId);
        }
        setSubCategoryVal(
          product.subCategory?._id || product.subCategory || "",
        );
        setPrice(product.price || "");
        setOldPrice(product.originalPrice || product.oldPrice || "");
        setIsFeatured(product.isFeatured || false);
        setIsNewArrival(product.isNewArrival || false);
        setDemandStatus(product.demandStatus || "NORMAL");
        setStock(product.stock || "");
        setBrand(product.brand || "");
        setDiscount(product.discount || "");
        setRating(product.rating || 4);
        setWeight(product.weight || "");
        setUnit(product.unit || "g");
        setTags(product.tags ? product.tags.join(", ") : "");
        setExistingImages(product.images || []);
      } else {
        console.error("Product fetch failed:", response);
        toast.error(response.message || "Product not found");
      }
    } catch (error) {
      console.error("Failed to fetch product:", error);
      toast.error("Failed to load product");
    }
    setIsLoading(false);
  }, [productId, token, fetchSubCategories]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token && productId) {
      fetchCategories();
      fetchProduct();
    }
  }, [isAuthenticated, token, productId, fetchCategories, fetchProduct]);

  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    setCategoryVal(catId);
    setSubCategoryVal("");
    if (catId) {
      fetchSubCategories(catId);
    } else {
      setSubCategories([]);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewImages((prev) => [...prev, { file, preview: reader.result }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeNewImage = (index) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!productName.trim()) {
      toast.error("Please enter a product name");
      return;
    }
    if (!categoryVal) {
      toast.error("Please select a category");
      return;
    }
    if (!price || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    if (existingImages.length === 0 && newImages.length === 0) {
      toast.error("Please have at least one image");
      return;
    }

    // Check if token exists
    console.log("EditProduct handleSubmit:", {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      isAuthenticated,
      newImagesCount: newImages.length,
    });

    if (!token) {
      toast.error("Authentication token is missing. Please login again.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload new images first
      const uploadedImageUrls = [];

      for (const img of newImages) {
        const uploadResult = await uploadFile(img.file, token);
        if (uploadResult.success && uploadResult.data?.url) {
          uploadedImageUrls.push(uploadResult.data.url);
        } else {
          toast.error(
            "Failed to upload image: " +
              (uploadResult.message || "Unknown error"),
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Combine existing and new images
      const allImages = [...existingImages, ...uploadedImageUrls];

      const productData = {
        name: productName,
        description,
        shortDescription,
        category: categoryVal,
        subCategory: subCategoryVal || undefined,
        price: Number(price),
        originalPrice: oldPrice ? Number(oldPrice) : undefined,
        isFeatured,
        isNewArrival,
        demandStatus,
        stock: stock ? Number(stock) : 0,
        brand,
        discount: discount ? Number(discount) : 0,
        rating,
        weight: weight ? Number(weight) : undefined,
        unit,
        tags: tags ? tags.split(",").map((t) => t.trim()) : [],
        images: allImages,
        thumbnail: allImages[0] || "",
      };

      const response = await putData(
        `/api/products/${productId}`,
        productData,
        token,
      );

      if (response.success) {
        toast.success("Product updated successfully!");
        router.push("/products-list");
      } else {
        toast.error(response.message || "Failed to update product");
      }
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Failed to update product");
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

  const totalImages = existingImages.length + newImages.length;

  return (
    <div className="px-5 py-4">
      <div className="bg-white shadow-md rounded-md p-5">
        <h2 className="text-[18px] text-gray-700 font-[600]">Edit Product</h2>

        <form onSubmit={handleSubmit} className="mt-5">
          {/* Basic Info */}
          <div className="form-group mb-4 flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Product Name *
            </span>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Enter product name"
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px] bg-white text-gray-900"
            />
          </div>

          <div className="form-group mb-4 flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Short Description
            </span>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Brief product description (shown in listings)"
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px] bg-white text-gray-900"
            />
          </div>

          <div className="form-group mb-4 flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Full Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter detailed product description"
              rows={5}
              className="w-full border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 py-3 text-[14px] bg-white text-gray-900"
            />
          </div>

          {/* Categories & Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Category *
              </span>
              <Select
                value={categoryVal}
                onChange={handleCategoryChange}
                displayEmpty
                size="small"
                className="bg-white"
              >
                <MenuItem value="">
                  <em>Select Category</em>
                </MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat._id} value={cat._id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </div>

            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Sub Category
              </span>
              <Select
                value={subCategoryVal}
                onChange={(e) => setSubCategoryVal(e.target.value)}
                displayEmpty
                size="small"
                className="bg-white"
                disabled={!categoryVal || subCategories.length === 0}
              >
                <MenuItem value="">
                  <em>Select Sub Category</em>
                </MenuItem>
                {subCategories.map((cat) => (
                  <MenuItem key={cat._id} value={cat._id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </div>

            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Price (₹) *
              </span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
              />
            </div>

            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Original Price (₹)
              </span>
              <input
                type="number"
                value={oldPrice}
                onChange={(e) => setOldPrice(e.target.value)}
                placeholder="0.00 (for strikethrough)"
                min="0"
                step="0.01"
                className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
              />
            </div>
          </div>

          {/* Stock & Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Stock Quantity
              </span>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
              />
            </div>

            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Brand
              </span>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Brand name"
                className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
              />
            </div>

            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Discount (%)
              </span>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                min="0"
                max="100"
                className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
              />
            </div>

            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Rating
              </span>
              <Rating
                name="product-rating"
                value={rating}
                onChange={(event, newValue) => setRating(newValue)}
                size="large"
              />
            </div>
          </div>

          {/* Weight & Tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Weight
              </span>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="flex-1 h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
                />
                <Select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  size="small"
                  className="w-20"
                >
                  <MenuItem value="g">g</MenuItem>
                  <MenuItem value="kg">kg</MenuItem>
                  <MenuItem value="ml">ml</MenuItem>
                  <MenuItem value="L">L</MenuItem>
                  <MenuItem value="pcs">pcs</MenuItem>
                </Select>
              </div>
            </div>

            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Tags
              </span>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="organic, healthy, natural (comma separated)"
                className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
              />
            </div>

            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Featured Product
              </span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  color="primary"
                />
                <span className="text-sm text-gray-600">
                  {isFeatured ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                New Arrival
              </span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={isNewArrival}
                  onChange={(e) => setIsNewArrival(e.target.checked)}
                  color="primary"
                />
                <span className="text-sm text-gray-600">
                  {isNewArrival ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                🔥 High Demand Status
              </span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={demandStatus === "HIGH"}
                  onChange={(e) =>
                    setDemandStatus(e.target.checked ? "HIGH" : "NORMAL")
                  }
                  color="warning"
                />
                <span
                  className={`text-sm ${demandStatus === "HIGH" ? "text-orange-600 font-medium" : "text-gray-600"}`}
                >
                  {demandStatus === "HIGH" ? "High Demand" : "Normal"}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Shows "High Traffic" badge on this product
              </p>
            </div>
          </div>

          {/* Images */}
          <div className="flex flex-col gap-2 mt-5">
            <h3 className="text-[16px] text-gray-700 font-[600]">
              Product Images *{" "}
              <span className="text-sm font-normal text-gray-500">
                (First image will be the thumbnail)
              </span>
            </h3>

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {/* Existing Images */}
              {existingImages.map((img, index) => (
                <div
                  key={`existing-${index}`}
                  className="w-[150px] h-[150px] rounded-md bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden"
                >
                  <img
                    src={getImageUrl(img)}
                    alt={`product ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {index === 0 && newImages.length === 0 && (
                    <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                      Thumbnail
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeExistingImage(index)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                  >
                    <IoMdClose size={16} />
                  </button>
                </div>
              ))}

              {/* New Images */}
              {newImages.map((img, index) => (
                <div
                  key={`new-${index}`}
                  className="w-[150px] h-[150px] rounded-md bg-gray-100 border-2 border-dashed border-green-400 flex items-center justify-center relative overflow-hidden"
                >
                  <img
                    src={img.preview}
                    alt={`preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded">
                    New
                  </span>
                  <button
                    type="button"
                    onClick={() => removeNewImage(index)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                  >
                    <IoMdClose size={16} />
                  </button>
                </div>
              ))}

              {totalImages < 10 && (
                <UploadBox onChange={handleImageUpload} multiple />
              )}
            </div>
            <p className="text-sm text-gray-500">
              Max 10 images, 5MB each. Supported: JPG, PNG, WebP
            </p>
          </div>

          {/* Submit */}
          <div className="mt-8 flex gap-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="!bg-blue-600 !text-white !px-8 !py-2.5 hover:!bg-blue-700 disabled:!opacity-50 !font-medium"
            >
              {isSubmitting ? "Updating Product..." : "Update Product"}
            </Button>
            <Button
              type="button"
              onClick={() => router.push("/products-list")}
              className="!border !border-gray-300 !text-gray-700 !px-8 !py-2.5 hover:!bg-gray-50"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProduct;
