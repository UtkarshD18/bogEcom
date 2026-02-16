"use client";
import UploadBox from "@/components/UploadBox";
import { useAdmin } from "@/context/AdminContext";
import { getData, postData, uploadFile } from "@/utils/api";
import { Button } from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import Rating from "@mui/material/Rating";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { IoMdClose } from "react-icons/io";

const AddProduct = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [categoryVal, setCategoryVal] = useState("");
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
  const [images, setImages] = useState([]); // { file, preview }
  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Variants
  const [hasVariants, setHasVariants] = useState(false);
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
    // Auto-generate name from weight+unit
    if (field === "weight" || field === "unit") {
      const w = field === "weight" ? value : updated[index].weight;
      const u = field === "unit" ? value : updated[index].unit;
      if (w) {
        updated[index].name =
          Number(w) >= 1000 && u === "g"
            ? `${Number(w) / 1000} Kg`
            : `${w}${u}`;
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
    setVariants(variants.filter((_, i) => i !== index));
  };

  const fetchCategories = useCallback(async () => {
    try {
      const response = await getData("/api/categories", token);
      if (response.success) {
        // Filter to get only parent categories (no parent or parent is null)
        const parentCategories = (response.data || []).filter(
          (cat) => !cat.parent,
        );
        setCategories(parentCategories);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }, [token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchCategories();
    }
  }, [isAuthenticated, token, fetchCategories]);

  const handleCategoryChange = (e) => {
    setCategoryVal(e.target.value);
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
        setImages((prev) => [...prev, { file, preview: reader.result }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
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
    if (images.length === 0) {
      toast.error("Please upload at least one image");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload images first
      const uploadedImageUrls = [];

      for (const img of images) {
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

      // Build variants array
      const variantData = hasVariants
        ? variants
            .filter((v) => v.price)
            .map((v, i) => ({
              name: v.name || `${v.weight}${v.unit || "g"}`,
              sku:
                v.sku ||
                `${productName.substring(0, 3).toUpperCase()}-V${i + 1}`,
              price: Number(v.price),
              originalPrice: v.originalPrice
                ? Number(v.originalPrice)
                : undefined,
              discountPercent:
                v.originalPrice && Number(v.originalPrice) > Number(v.price)
                  ? Math.round(
                      ((Number(v.originalPrice) - Number(v.price)) /
                        Number(v.originalPrice)) *
                        100,
                    )
                  : 0,
              weight: Number(v.weight) || 0,
              unit: v.unit || "g",
              isDefault: !!v.isDefault,
              stock: v.stock ? Number(v.stock) : 0,
              stock_quantity: v.stock ? Number(v.stock) : 0,
            }))
        : [];

      // Create product with uploaded image URLs
      const productData = {
        name: productName,
        description,
        shortDescription,
        category: categoryVal,
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
        images: uploadedImageUrls,
        thumbnail: uploadedImageUrls[0] || "",
        hasVariants,
        variants: variantData,
        variantType: hasVariants ? "weight" : "",
      };

      const response = await postData("/api/products", productData, token);

      if (response.success) {
        toast.success("Product created successfully!");
        router.push("/products-list");
      } else {
        toast.error(
          response.message || response.details || "Failed to create product",
        );
      }
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to create product",
      );
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
    <div className="px-5 py-4">
      <div className="bg-white shadow-md rounded-md p-5">
        <h2 className="text-[18px] text-gray-700 font-[600]">
          Add New Product
        </h2>

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
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
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
              className="w-full h-[40px] border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 text-[14px]"
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
              className="w-full border border-[rgba(0,0,0,0.2)] outline-none rounded-md focus:border-blue-500 px-3 py-3 text-[14px]"
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
                <Switch
                  checked={hasVariants}
                  onChange={(e) => {
                    setHasVariants(e.target.checked);
                    if (!e.target.checked) setVariants([]);
                  }}
                  color="primary"
                  size="small"
                />
                <span className="text-sm text-gray-500">
                  {hasVariants ? "Enabled" : "Disabled"}
                </span>
              </div>
              {hasVariants && (
                <Button
                  type="button"
                  onClick={addVariant}
                  className="!bg-blue-50 !text-blue-600 !text-sm !px-4 !py-1.5 hover:!bg-blue-100 !font-medium !normal-case"
                >
                  + Add Size
                </Button>
              )}
            </div>

            {hasVariants && (
              <>
                <p className="text-xs text-gray-500 mb-4">
                  Add different sizes/weights for this product (e.g., 500g, 1
                  Kg). Each variant has its own price & stock.
                </p>

                {variants.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                    <p className="text-gray-400 text-sm">
                      No variants added yet. Click &quot;+ Add Size&quot; to
                      add one.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {variants.map((v, i) => (
                    <div
                      key={i}
                      className={`grid grid-cols-1 sm:grid-cols-7 gap-3 items-end p-4 rounded-lg relative ${v.isDefault ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}
                    >
                      {v.isDefault && (
                        <span className="absolute -top-2 left-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          DEFAULT
                        </span>
                      )}
                      <div className="sm:col-span-1 flex flex-col gap-1">
                        <span className="text-xs text-gray-600 font-medium">
                          Weight *
                        </span>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={v.weight}
                            onChange={(e) =>
                              updateVariant(i, "weight", e.target.value)
                            }
                            placeholder="500"
                            min="0"
                            className="flex-1 h-[36px] border border-gray-300 rounded-md px-2 text-sm focus:border-blue-500 outline-none"
                          />
                          <select
                            value={v.unit || "g"}
                            onChange={(e) =>
                              updateVariant(i, "unit", e.target.value)
                            }
                            className="w-14 h-[36px] border border-gray-300 rounded-md px-1 text-sm focus:border-blue-500 outline-none"
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="ml">ml</option>
                            <option value="L">L</option>
                            <option value="pcs">pcs</option>
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
            )}
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
              {images.map((img, index) => (
                <div
                  key={index}
                  className="w-[150px] h-[150px] rounded-md bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden"
                >
                  <img
                    src={img.preview}
                    alt={`preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {index === 0 && (
                    <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                      Thumbnail
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                  >
                    <IoMdClose size={16} />
                  </button>
                </div>
              ))}

              {images.length < 10 && (
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
              {isSubmitting ? "Creating Product..." : "Create Product"}
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

export default AddProduct;
