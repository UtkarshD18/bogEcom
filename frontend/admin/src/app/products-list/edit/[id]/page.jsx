"use client";
import ProductPageSettingsSection from "@/components/ProductPageSettingsSection";
import UploadBox from "@/components/UploadBox";
import { useAdmin } from "@/context/AdminContext";
import { getData, putData, uploadFile, uploadVideoFile } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import {
  buildProductImageAsset,
  formatImageDimensions,
  getProductImageDimensionError,
  getProductImageQualityLabel,
  PRODUCT_IMAGE_DESKTOP_SPEC,
  PRODUCT_IMAGE_MAX_FILES,
  PRODUCT_IMAGE_MAX_SIZE_BYTES,
  PRODUCT_IMAGE_MOBILE_SPEC,
  PRODUCT_IMAGE_MIN_SPEC,
} from "@/utils/productImageUpload";
import {
  PRODUCT_VIDEO_ACCEPT,
  PRODUCT_VIDEO_MAX_FILES,
  buildProductVideoAsset,
  formatProductVideoSize,
} from "@/utils/productVideoUpload";
import {
  createDefaultProductPageConfig,
  mergeProductPageConfig,
} from "@/utils/productPageConfig";
import { normalizeVariantWeight } from "@/utils/weightNormalization";
import { Button } from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
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
  const [productStory, setProductStory] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [categoryVal, setCategoryVal] = useState("");
  const [isNewArrival, setIsNewArrival] = useState(false);
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [isExclusive, setIsExclusive] = useState(false);
  const [demandStatus, setDemandStatus] = useState("NORMAL");
  const [brand, setBrand] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [tags, setTags] = useState("");
  const [newImages, setNewImages] = useState([]); // { file, preview }
  const [existingImages, setExistingImages] = useState([]); // URLs
  const [newVideos, setNewVideos] = useState([]); // { file, preview, name, size }
  const [existingVideos, setExistingVideos] = useState([]); // URLs
  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [productPage, setProductPage] = useState(() =>
    createDefaultProductPageConfig(),
  );
  const [showStorefrontSettings, setShowStorefrontSettings] = useState(true);

  // Variants
  const hasVariants = true;
  const [variants, setVariants] = useState([]);

  const addVariant = () => {
    setVariants([
      ...variants,
      {
        name: "",
        price: "",
        originalPrice: "",
        stock: "",
        sku: "",
        weight: "",
        unit: "g",
        isDefault: variants.length === 0,
      },
    ]);
  };

  const updateVariant = (index, field, value) => {
    const updated = [...variants];
    updated[index][field] = value;
    // Keep names explicit by appending weight/unit, while preserving manual naming.
    if (field === "weight" || field === "unit") {
      const w = field === "weight" ? value : updated[index].weight;
      const u = field === "unit" ? value : updated[index].unit;
      if (w) {
        let normalizedWeight = "";
        try {
          normalizedWeight = normalizeVariantWeight({
            weight: w,
            unit: u,
          }).label;
        } catch {
          normalizedWeight = `${w}${u}`;
        }
        const rawName = String(updated[index].name || "").trim();
        const baseName = rawName.replace(/\s*-\s*[\d.]+\s*(kg|g)$/i, "").trim();
        updated[index].name = baseName
          ? `${baseName} - ${normalizedWeight}`
          : normalizedWeight;
      }
    }
    // Handle isDefault — only one can be default
    if (field === "isDefault" && value) {
      updated.forEach((v, i) => {
        if (i !== index) v.isDefault = false;
      });
    }
    setVariants(updated);
  };

  const removeVariant = (index) => {
    if (variants.length <= 1 && hasVariants) {
      toast.error("Must have at least one variant");
      return;
    }
    const removed = variants[index];
    const updated = variants.filter((_, i) => i !== index);
    // If we removed the default, make first remaining the default
    if (removed.isDefault && updated.length > 0) {
      updated[0].isDefault = true;
    }
    setVariants(updated);
  };

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
        setProductStory(product.productStory || "");
        setShortDescription(product.shortDescription || "");
        const catId = product.category?._id || product.category || "";
        setCategoryVal(catId);
        setIsNewArrival(product.isNewArrival || false);
        setIsBestSeller(product.isBestSeller || false);
        setIsExclusive(Boolean(product.isExclusive));
        setDemandStatus(product.demandStatus || "NORMAL");
        setBrand(product.brand || "");
        setHsnCode(product.hsnCode || "");
        setTags(product.tags ? product.tags.join(", ") : "");
        setExistingImages(product.images || []);
        setExistingVideos(product.videos || []);
        setProductPage(mergeProductPageConfig(product.productPage));

        // Load variants
        if (product.hasVariants && product.variants?.length > 0) {
          setVariants(
            product.variants.map((v) => {
              const parsedUnit =
                String(v.unit || "g")
                  .trim()
                  .toLowerCase() === "kg"
                  ? "kg"
                  : "g";
              const parsedWeight = Number(v.weight || 0);
              const variantPrice = Number.isFinite(Number(v.price))
                ? Math.round(Number(v.price))
                : "";
              const variantOriginalPrice = Number.isFinite(
                Number(v.originalPrice),
              )
                ? Math.round(Number(v.originalPrice))
                : "";
              return {
                _id: v._id,
                name: v.name || "",
                price: variantPrice,
                originalPrice: variantOriginalPrice,
                stock: v.stock_quantity ?? v.stock ?? "",
                sku: v.sku || "",
                weight: parsedWeight || "",
                label: v.label || "",
                unit: parsedUnit,
                isDefault: v.isDefault || false,
              };
            }),
          );
          // Ensure at least one default
          setVariants((prev) => {
            if (prev.length > 0 && !prev.some((v) => v.isDefault)) {
              const updated = [...prev];
              updated[0].isDefault = true;
              return updated;
            }
            return prev;
          });
        } else {
          setVariants([
            {
              name: "",
              price: Number.isFinite(Number(product.price))
                ? Math.round(Number(product.price))
                : "",
              originalPrice: Number.isFinite(
                Number(product.originalPrice || product.oldPrice),
              )
                ? Math.round(Number(product.originalPrice || product.oldPrice))
                : "",
              stock: product.stock_quantity ?? product.stock ?? "",
              sku: product.sku || "",
              weight: product.weight || "",
              unit: product.unit || "g",
              isDefault: true,
            },
          ]);
        }
      } else {
        console.error("Product fetch failed:", response);
        toast.error(response.message || "Product not found");
      }
    } catch (error) {
      console.error("Failed to fetch product:", error);
      toast.error("Failed to load product");
    }
    setIsLoading(false);
  }, [productId, token]);

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
    setCategoryVal(e.target.value);
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = Math.max(
      PRODUCT_IMAGE_MAX_FILES - (existingImages.length + newImages.length),
      0,
    );

    if (remainingSlots === 0) {
      toast.error(`You can upload up to ${PRODUCT_IMAGE_MAX_FILES} images only`);
      e.target.value = "";
      return;
    }

    if (files.length > remainingSlots) {
      toast.error(`Only ${remainingSlots} more image slots are available`);
    }

    const assets = await Promise.all(
      files.slice(0, remainingSlots).map(async (file) => {
        if (file.size > PRODUCT_IMAGE_MAX_SIZE_BYTES) {
          toast.error(`${file.name}: image size should be less than 5MB`);
          return null;
        }

        const asset = await buildProductImageAsset({ file });
        const dimensionError = getProductImageDimensionError(asset?.dimensions);
        if (dimensionError) {
          toast.error(`${file.name}: ${dimensionError}`);
          return null;
        }

        return asset;
      }),
    );

    const nextAssets = assets.filter(Boolean);
    if (nextAssets.length > 0) {
      setNewImages((prev) => [...prev, ...nextAssets]);
    }

    e.target.value = "";
  };

  const removeNewImage = (index) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const handleVideoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = Math.max(
      PRODUCT_VIDEO_MAX_FILES - (existingVideos.length + newVideos.length),
      0,
    );

    if (remainingSlots === 0) {
      toast.error(`You can upload up to ${PRODUCT_VIDEO_MAX_FILES} videos only`);
      e.target.value = "";
      return;
    }

    if (files.length > remainingSlots) {
      toast.error(`Only ${remainingSlots} more video slots are available`);
    }

    const nextVideos = [];
    for (const file of files.slice(0, remainingSlots)) {
      try {
        const asset = buildProductVideoAsset(file);
        if (asset) nextVideos.push(asset);
      } catch (error) {
        toast.error(error.message || "Invalid product video");
      }
    }

    if (nextVideos.length > 0) {
      setNewVideos((prev) => [...prev, ...nextVideos]);
    }

    e.target.value = "";
  };

  const removeNewVideo = (index) => {
    const video = newVideos[index];
    if (video?.preview) {
      URL.revokeObjectURL(video.preview);
    }
    setNewVideos(newVideos.filter((_, i) => i !== index));
  };

  const removeExistingVideo = (index) => {
    setExistingVideos(existingVideos.filter((_, i) => i !== index));
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
    if (existingImages.length === 0 && newImages.length === 0) {
      toast.error("Please have at least one image");
      return;
    }

    let variantData = [];
    try {
      variantData = variants
        .filter((v) => v.price)
        .map((v, i) => {
          const normalizedWeight = normalizeVariantWeight(v);
          return {
            _id: v._id || undefined,
            name: v.name || normalizedWeight.label,
            label: normalizedWeight.label,
            sku:
              v.sku || `${productName.substring(0, 3).toUpperCase()}-V${i + 1}`,
            price: Math.round(Number(v.price)),
            originalPrice: v.originalPrice
              ? Math.round(Number(v.originalPrice))
              : undefined,
            weight: Number(v.weight),
            unit: String(v.unit || "g").toLowerCase() === "kg" ? "kg" : "g",
            isDefault: !!v.isDefault,
            stock: v.stock ? Number(v.stock) : 0,
            stock_quantity: v.stock ? Number(v.stock) : 0,
          };
        });
    } catch (error) {
      toast.error(error.message || "Invalid weight format");
      return;
    }

    if (
      variantData.length === 0 ||
      variantData.some((v) => !v.price || v.price <= 0)
    ) {
      toast.error("Please add at least one variant with a valid price");
      return;
    }

    const defaultVariant =
      variantData.find((variant) => variant.isDefault) || variantData[0];

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
        const uploadResult = await uploadFile(img.file, token, {
          folder: "products",
          preserveQuality: true,
        });
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

      const uploadedVideoUrls = [];

      for (const video of newVideos) {
        const uploadResult = await uploadVideoFile(video.file, token, {
          folder: "products",
        });
        if (uploadResult.success && uploadResult.data?.url) {
          uploadedVideoUrls.push(uploadResult.data.url);
        } else {
          toast.error(
            "Failed to upload video: " +
              (uploadResult.message || "Unknown error"),
          );
          setIsSubmitting(false);
          return;
        }
      }

      const allVideos = [...existingVideos, ...uploadedVideoUrls];

      const productData = {
        name: productName,
        description,
        productStory,
        shortDescription,
        category: categoryVal,
        price: defaultVariant.price,
        originalPrice: defaultVariant.originalPrice,
        isNewArrival,
        isBestSeller,
        isExclusive,
        demandStatus,
        brand,
        hsnCode: String(hsnCode || "").trim(),
        tags: tags ? tags.split(",").map((t) => t.trim()) : [],
        images: allImages,
        videos: allVideos,
        thumbnail: allImages[0] || "",
        hasVariants,
        variants: variantData,
        variantType: hasVariants ? "weight" : "",
        weight: defaultVariant.weight || undefined,
        unit: defaultVariant.unit || "g",
        productPage,
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

          <div className="form-group mb-4 flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Product Story
            </span>
            <textarea
              value={productStory}
              onChange={(e) => setProductStory(e.target.value)}
              placeholder="Add a story or narrative for this product"
              rows={4}
              className="w-full border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 py-3 text-[14px] bg-white text-gray-900"
            />
          </div>

          {/* Categories & Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
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
          </div>

          {/* Product Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
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
                HSN Code
              </span>
              <input
                type="text"
                value={hsnCode}
                onChange={(e) =>
                  setHsnCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))
                }
                placeholder="e.g., 2106"
                maxLength={12}
                className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
              />
            </div>
          </div>

          {/* Tags & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
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
                Best Seller
              </span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={isBestSeller}
                  onChange={(e) => setIsBestSeller(e.target.checked)}
                  color="primary"
                />
                <span className="text-sm text-gray-600">
                  {isBestSeller ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                Members Exclusive
              </span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={isExclusive}
                  onChange={(e) => setIsExclusive(e.target.checked)}
                  color="secondary"
                />
                <span className="text-sm text-gray-600">
                  {isExclusive ? "Members Only" : "Public"}
                </span>
              </div>
            </div>

            <div className="col flex flex-col gap-1">
              <span className="text-[15px] text-gray-800 font-medium">
                High Demand Status
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
                Shows &quot;High Traffic&quot; badge on this product
              </p>
            </div>
          </div>
          {/* Size / Weight Variants */}
          <div className="mt-6 mb-5 border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-[15px] text-gray-800 font-semibold">
                  📦 Size / Weight Variants
                </span>
                <span className="text-sm text-blue-600 font-medium">
                  Required
                </span>
              </div>
              <Button
                type="button"
                onClick={addVariant}
                className="!bg-blue-50 !text-blue-600 !text-sm !px-4 !py-1.5 hover:!bg-blue-100 !font-medium !normal-case"
              >
                + Add Size
              </Button>
            </div>

            <>
              <p className="text-xs text-gray-500 mb-4">
                Add different sizes/weights for this product (e.g., 500g, 1 Kg).
                Each variant has its own price & stock.
              </p>

              {variants.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                  <p className="text-gray-400 text-sm">
                    No variants added yet. Click &quot;+ Add Size&quot; to add
                    one.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {variants.map((v, i) => (
                  <div
                    key={v._id || i}
                    className={`grid grid-cols-1 sm:grid-cols-8 gap-3 items-end p-4 rounded-lg relative ${v.isDefault ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}
                  >
                    {v.isDefault && (
                      <span className="absolute -top-2 left-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        DEFAULT
                      </span>
                    )}
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <span className="text-xs text-gray-600 font-medium">
                        Weight *
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={v.weight}
                          onChange={(e) =>
                            updateVariant(i, "weight", e.target.value)
                          }
                          placeholder="500"
                          min="0"
                          step="0.01"
                          className="flex-1 min-w-0 h-[36px] border border-gray-300 rounded-md px-2 text-sm focus:border-blue-500 outline-none"
                        />
                        <select
                          value={v.unit || "g"}
                          onChange={(e) =>
                            updateVariant(i, "unit", e.target.value)
                          }
                          className="w-[68px] shrink-0 h-[36px] border border-gray-300 rounded-md px-1 text-sm focus:border-blue-500 outline-none"
                        >
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                        </select>
                      </div>
                    </div>
                    <div className="sm:col-span-1 flex flex-col gap-1">
                      <span className="text-xs text-gray-600 font-medium">
                        Price (₹) *
                      </span>
                      <input
                        type="number"
                        value={v.price}
                        onChange={(e) =>
                          updateVariant(i, "price", e.target.value)
                        }
                        placeholder="299"
                        min="0"
                        step="1"
                        className="w-full h-[36px] border border-gray-300 rounded-md px-2 text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-1 flex flex-col gap-1">
                      <span className="text-xs text-gray-600 font-medium">
                        Original Price
                      </span>
                      <input
                        type="number"
                        value={v.originalPrice}
                        onChange={(e) =>
                          updateVariant(i, "originalPrice", e.target.value)
                        }
                        placeholder="499"
                        min="0"
                        step="1"
                        className="w-full h-[36px] border border-gray-300 rounded-md px-2 text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-1 flex flex-col gap-1">
                      <span className="text-xs text-gray-600 font-medium">
                        Stock
                      </span>
                      <input
                        type="number"
                        value={v.stock}
                        onChange={(e) =>
                          updateVariant(i, "stock", e.target.value)
                        }
                        placeholder="50"
                        min="0"
                        className="w-full h-[36px] border border-gray-300 rounded-md px-2 text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-1 flex flex-col gap-1">
                      <span className="text-xs text-gray-600 font-medium">
                        SKU
                      </span>
                      <input
                        type="text"
                        value={v.sku}
                        onChange={(e) =>
                          updateVariant(i, "sku", e.target.value)
                        }
                        placeholder="Auto"
                        className="w-full h-[36px] border border-gray-300 rounded-md px-2 text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-1 flex flex-col gap-1">
                      <span className="text-xs text-gray-600 font-medium">
                        Default
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateVariant(i, "isDefault", !v.isDefault)
                        }
                        className={`h-[36px] w-full flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                          v.isDefault
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                        }`}
                      >
                        {v.isDefault ? "✓ Default" : "Set"}
                      </button>
                    </div>
                    <div className="sm:col-span-1 flex items-end">
                      <button
                        type="button"
                        onClick={() => removeVariant(i)}
                        disabled={variants.length <= 1 && hasVariants}
                        className="h-[36px] w-full flex items-center justify-center gap-1 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <IoMdClose size={16} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-gray-800">
                  Storefront Product Page
                </h3>
                <p className="text-sm text-gray-500">
                  Optional. Expand this when you want to control the custom live
                  product-page layout and supporting copy.
                </p>
              </div>
              <Button
                type="button"
                onClick={() =>
                  setShowStorefrontSettings((current) => !current)
                }
                className="!self-start !bg-white !text-gray-700 !normal-case"
              >
                {showStorefrontSettings ? "Hide customization" : "Customize page"}
              </Button>
            </div>

            {showStorefrontSettings ? (
              <ProductPageSettingsSection
                productPage={productPage}
                setProductPage={setProductPage}
                token={token}
              />
            ) : null}
          </div>

          {/* Images */}
          <div className="flex flex-col gap-2 mt-5">
            <h3 className="text-[16px] text-gray-700 font-[600]">
              Product Images *{" "}
              <span className="text-sm font-normal text-gray-500">
                (First image will be the thumbnail)
              </span>
            </h3>

            <div className="mt-2 rounded-2xl border border-[#d7e3f0] bg-[#f8fbff] p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Desktop quality
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {PRODUCT_IMAGE_DESKTOP_SPEC.width} x{" "}
                    {PRODUCT_IMAGE_DESKTOP_SPEC.height} or larger
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Mobile quality
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {PRODUCT_IMAGE_MOBILE_SPEC.width} x{" "}
                    {PRODUCT_IMAGE_MOBILE_SPEC.height} or larger
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Minimum accepted
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {PRODUCT_IMAGE_MIN_SPEC.width} x{" "}
                    {PRODUCT_IMAGE_MIN_SPEC.height}, square works best
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Existing images stay untouched. New uploads are screened for
                sharper desktop and mobile delivery before they reach the live
                product page.
              </p>
            </div>

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {/* Existing Images */}
              {existingImages.map((img, index) => (
                <div key={`existing-${index}`} className="w-[176px]">
                  <div className="w-[150px] h-[150px] rounded-md bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden">
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
                  <p className="mt-2 text-[11px] text-gray-500">
                    Existing image
                  </p>
                </div>
              ))}

              {/* New Images */}
              {newImages.map((img, index) => (
                <div key={`new-${index}`} className="w-[176px]">
                  <div className="w-[150px] h-[150px] rounded-md bg-gray-100 border-2 border-dashed border-green-400 flex items-center justify-center relative overflow-hidden">
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
                  <div className="mt-2 space-y-1">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getProductImageQualityLabel(img).className}`}
                    >
                      {getProductImageQualityLabel(img).label}
                    </span>
                    <p className="text-[11px] text-gray-600">
                      {formatImageDimensions(img.dimensions)}
                    </p>
                    {img.warnings?.[0] ? (
                      <p className="text-[11px] text-amber-700">
                        {img.warnings[0]}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}

              {totalImages < PRODUCT_IMAGE_MAX_FILES && (
                <UploadBox
                  onChange={handleImageUpload}
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                />
              )}
            </div>
            <p className="text-sm text-gray-500">
              Max {PRODUCT_IMAGE_MAX_FILES} images, 5MB each. Supported: JPG,
              PNG, WebP
            </p>
          </div>

          {/* Videos */}
          <div className="flex flex-col gap-2 mt-5">
            <h3 className="text-[16px] text-gray-700 font-[600]">
              Product Videos{" "}
              <span className="text-sm font-normal text-gray-500">
                (Optional, shown in the product gallery)
              </span>
            </h3>

            <div className="rounded-2xl border border-[#ead7c2] bg-[#fffaf3] p-4">
              <p className="text-sm font-semibold text-slate-800">
                Manage product demo videos
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Existing videos stay live unless removed. New MP4/WebM uploads
                are added after saving.
              </p>
            </div>

            <div className="flex items-start gap-4 mt-2 flex-wrap">
              {existingVideos.map((video, index) => (
                <div key={`existing-video-${index}`} className="w-[210px]">
                  <div className="relative h-[150px] overflow-hidden rounded-md border-2 border-dashed border-gray-300 bg-black">
                    <video
                      src={video}
                      className="h-full w-full object-cover"
                      muted
                      controls
                      playsInline
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingVideo(index)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                    >
                      <IoMdClose size={16} />
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500">
                    Existing video
                  </p>
                </div>
              ))}

              {newVideos.map((video, index) => (
                <div key={`${video.name}-${index}`} className="w-[210px]">
                  <div className="relative h-[150px] overflow-hidden rounded-md border-2 border-dashed border-green-400 bg-black">
                    <video
                      src={video.preview}
                      className="h-full w-full object-cover"
                      muted
                      controls
                      playsInline
                    />
                    <span className="absolute bottom-1 left-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded">
                      New
                    </span>
                    <button
                      type="button"
                      onClick={() => removeNewVideo(index)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                    >
                      <IoMdClose size={16} />
                    </button>
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold text-slate-700">
                    {video.name}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {formatProductVideoSize(video.size)}
                  </p>
                </div>
              ))}

              {existingVideos.length + newVideos.length < PRODUCT_VIDEO_MAX_FILES && (
                <UploadBox
                  onChange={handleVideoUpload}
                  multiple
                  accept={PRODUCT_VIDEO_ACCEPT}
                />
              )}
            </div>
            <p className="text-sm text-gray-500">
              Max {PRODUCT_VIDEO_MAX_FILES} videos, 100MB each. Supported: MP4,
              WebM
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
