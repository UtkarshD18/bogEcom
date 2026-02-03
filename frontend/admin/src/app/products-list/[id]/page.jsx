"use client";
import { useAdmin } from "@/context/AdminContext";
import { getData } from "@/utils/api";
import { Button } from "@mui/material";
import Rating from "@mui/material/Rating";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import { RiEdit2Line } from "react-icons/ri";

const ViewProduct = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const params = useParams();
  const productId = params.id;

  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);

  const fetchProduct = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getData(`/api/products/${productId}`, token);
      if (response.success && response.data) {
        setProduct(response.data);
      } else {
        router.push("/products-list");
      }
    } catch (error) {
      console.error("Failed to fetch product:", error);
      router.push("/products-list");
    }
    setIsLoading(false);
  }, [productId, token, router]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token && productId) {
      fetchProduct();
    }
  }, [isAuthenticated, token, productId, fetchProduct]);

  if (loading || !isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <section className="w-full py-3 px-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push("/products-list")}
            className="!min-w-0 !p-2 !rounded-full"
          >
            <IoArrowBack size={20} />
          </Button>
          <h2 className="text-[18px] text-gray-700 font-[600]">
            Product Details
          </h2>
        </div>
        <Link href={`/products-list/edit/${productId}`}>
          <Button className="!bg-blue-600 !text-white !px-4 !py-2 !rounded-md hover:!bg-blue-700 flex items-center gap-2">
            <RiEdit2Line size={18} />
            Edit Product
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Images Section */}
          <div>
            <div className="w-full h-[400px] bg-gray-100 rounded-lg overflow-hidden mb-4">
              <img
                src={
                  product.images?.[selectedImage] ||
                  product.thumbnail ||
                  "/placeholder.png"
                }
                alt={product.name}
                className="w-full h-full object-contain"
              />
            </div>
            {product.images?.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-[80px] h-[80px] rounded-lg overflow-hidden border-2 flex-shrink-0 ${
                      selectedImage === index
                        ? "border-blue-500"
                        : "border-gray-200"
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              {product.isFeatured && (
                <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-medium">
                  Featured
                </span>
              )}
              {product.isNewArrival && (
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">
                  New Arrival
                </span>
              )}
              {product.isBestSeller && (
                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-medium">
                  Best Seller
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              {product.name}
            </h1>

            <p className="text-sm text-gray-500 mb-4">{product.brand}</p>

            <div className="flex items-center gap-3 mb-4">
              <Rating value={product.rating || 0} readOnly precision={0.5} />
              <span className="text-gray-600">
                ({product.numReviews || 0} reviews)
              </span>
            </div>

            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-bold text-red-600">
                ₹{product.price}
              </span>
              {product.originalPrice &&
                product.originalPrice > product.price && (
                  <>
                    <span className="text-xl text-gray-400 line-through">
                      ₹{product.originalPrice}
                    </span>
                    <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-sm font-medium">
                      {product.discount ||
                        Math.round(
                          ((product.originalPrice - product.price) /
                            product.originalPrice) *
                            100,
                        )}
                      % OFF
                    </span>
                  </>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Stock</p>
                <p
                  className={`font-bold ${product.stock > 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {product.stock > 0
                    ? `${product.stock} units`
                    : "Out of Stock"}
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Category</p>
                <p className="font-medium text-gray-800">
                  {product.category?.name || "Uncategorized"}
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Weight</p>
                <p className="font-medium text-gray-800">
                  {product.weight || "N/A"} {product.unit || ""}
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Views</p>
                <p className="font-medium text-gray-800">
                  {product.viewCount || 0}
                </p>
              </div>
            </div>

            {product.shortDescription && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">
                  Short Description
                </h3>
                <p className="text-gray-600">{product.shortDescription}</p>
              </div>
            )}

            {product.tags?.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description Section */}
        {product.description && (
          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">
              Full Description
            </h3>
            <p className="text-gray-600 whitespace-pre-wrap">
              {product.description}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default ViewProduct;
