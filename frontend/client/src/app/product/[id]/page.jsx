"use client";

import ProductItem from "@/components/ProductItem";
import ProductZoom from "@/components/ProductZoom";
import QtyBox from "@/components/QtyBox";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { fetchDataFromApi } from "@/utils/api";
import { sanitizeHTML } from "@/utils/sanitize";
import {
  Alert,
  Button,
  CircularProgress,
  Rating,
  Snackbar,
} from "@mui/material";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HiOutlineFire } from "react-icons/hi";
import { IoMdCart, IoMdHeart, IoMdHeartEmpty } from "react-icons/io";
import { MdLocalShipping, MdPolicy, MdVerified } from "react-icons/md";

/**
 * Product Detail Page
 *
 * Displays single product details fetched from API (admin-managed products).
 * Features: Image gallery, pricing, add to cart, wishlist, reviews, related products.
 */
const ProductDetailPage = () => {
  const { id } = useParams();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [customerReviews, setCustomerReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeTab, setActiveTab] = useState("description");
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Compute active price/stock based on selected variant
  const activePrice = selectedVariant ? selectedVariant.price : product?.price;
  const activeOriginalPrice = selectedVariant
    ? selectedVariant.originalPrice
    : product?.originalPrice;
  const activeStock = selectedVariant
    ? Math.max(
        Number(selectedVariant.stock_quantity ?? selectedVariant.stock ?? 0) -
          Number(selectedVariant.reserved_quantity ?? 0),
        0,
      )
    : null;

  const availableQty =
    activeStock !== null
      ? activeStock
      : product
        ? Math.max(
            typeof product.available_quantity === "number"
              ? product.available_quantity
              : Number(product.stock_quantity ?? product.stock ?? 0) -
                  Number(product.reserved_quantity ?? 0),
            0,
          )
        : 0;
  const maxQty = availableQty > 0 ? availableQty : 1;
  const selectedVariantId = selectedVariant?._id || null;
  const productRating = Number(product?.adminStarRating ?? product?.rating ?? 0);
  const customerReviewCount = customerReviews.length;

  const fetchProductReviews = async (productId) => {
    if (!productId) {
      setCustomerReviews([]);
      return;
    }
    try {
      setReviewsLoading(true);
      const response = await fetchDataFromApi(`/api/reviews/${productId}`);
      if (response?.success && Array.isArray(response?.data)) {
        setCustomerReviews(response.data);
      } else {
        setCustomerReviews([]);
      }
    } catch (error) {
      console.error("Error fetching product reviews:", error);
      setCustomerReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  // Fetch product details from API
  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await fetchDataFromApi(`/api/products/${id}`);

      if (response?.error !== true && response?.data) {
        setProduct(response.data);
        const resolvedProductId = response.data?._id || response.data?.id;
        fetchProductReviews(resolvedProductId);

        // Auto-select default variant (or first) if product has variants
        if (
          response.data.hasVariants &&
          response.data.variants?.length > 0
        ) {
          const defaultVariant = response.data.variants.find((v) => v.isDefault) || response.data.variants[0];
          setSelectedVariant(defaultVariant);
        }

        // Fetch related products by category
        if (response.data.category) {
          const relatedResponse = await fetchDataFromApi(
            `/api/products?category=${response.data.category._id || response.data.category}&limit=5&exclude=${id}&excludeExclusive=true`,
          );
          if (relatedResponse?.error !== true) {
            setRelatedProducts(
              relatedResponse?.data || relatedResponse?.products || [],
            );
          }
        }
      } else if (response) {
        // Handle different API response formats
        setProduct(response);
        fetchProductReviews(response?._id || response?.id);
      } else {
        setCustomerReviews([]);
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      setCustomerReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchProduct();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [id]);

  // Handle Add to Cart or Remove from Cart (toggle)
  const handleAddToCart = async () => {
    try {
      if (!product) return;

      const productId = product._id || product.id;

      // Check if already in cart (variant-aware for size/weight products)
      if (isInCart(productId, selectedVariantId)) {
        // Remove from cart
        await removeFromCart(productId, selectedVariantId);
        setSnackbar({
          open: true,
          message: "Removed from cart!",
          severity: "success",
        });
      } else {
        if (availableQty < quantity) {
          setSnackbar({
            open: true,
            message:
              availableQty > 0
                ? `Only ${availableQty} left in stock`
                : "This product is currently out of stock",
            severity: "error",
          });
          return;
        }
        // Add to cart - pass variant-adjusted product data
        const cartProduct = selectedVariant
          ? {
              ...product,
              price: selectedVariant.price,
              originalPrice: selectedVariant.originalPrice || product.originalPrice,
              selectedVariant: {
                _id: selectedVariant._id,
                name: selectedVariant.name,
                sku: selectedVariant.sku,
                price: selectedVariant.price,
                weight: selectedVariant.weight,
                unit: selectedVariant.unit,
              },
              variantId: selectedVariant._id,
            }
          : product;
        await addToCart(cartProduct, quantity);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to update cart",
        severity: "error",
      });
    }
  };

  // Handle Wishlist Toggle
  const handleWishlistToggle = async () => {
    try {
      if (!product) return;
      const productId = product._id || product.id;
      const wasWishlisted = productId ? isInWishlist(productId) : false;
      const wishlistProduct = selectedVariant
        ? {
            ...product,
            price: selectedVariant.price,
            originalPrice:
              selectedVariant.originalPrice || product.originalPrice || 0,
            selectedVariant: {
              _id: selectedVariant._id,
              name: selectedVariant.name,
              sku: selectedVariant.sku,
              price: selectedVariant.price,
              originalPrice:
                selectedVariant.originalPrice || product.originalPrice || 0,
              weight: selectedVariant.weight,
              unit: selectedVariant.unit,
            },
            variantId: selectedVariant._id,
            variantName: selectedVariant.name || "",
            quantity,
          }
        : {
            ...product,
            quantity,
          };

      await toggleWishlist(wishlistProduct);

      setSnackbar({
        open: true,
        message: wasWishlisted ? "Removed from wishlist" : "Added to wishlist!",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to update wishlist",
        severity: "error",
      });
    }
  };

  // Calculate discount
  const calculateDiscount = () => {
    const p = activePrice || product?.price;
    const op = activeOriginalPrice || product?.originalPrice;
    if (op && p && op > p) {
      return Math.round(((op - p) / op) * 100);
    }
    return product?.discount || 0;
  };

  // Format weight for display
  const formatWeight = (w, u) => {
    if (!w || w <= 0) return null;
    if (u === "g" && w >= 1000) return `${w / 1000} kg`;
    return `${w}${u && u !== "piece" ? " " + u : " g"}`;
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <CircularProgress style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  // Product Not Found
  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <svg
          className="w-24 h-24 text-gray-300 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h2 className="text-2xl font-bold text-gray-700 mb-2">
          Product Not Found
        </h2>
        <p className="text-gray-500 mb-4">
          The product you are looking for does not exist or has been removed.
        </p>
        <Link href="/products">
          <Button variant="contained" style={{ backgroundColor: "var(--primary)" }}>
            Browse Products
          </Button>
        </Link>
      </div>
    );
  }

  const discount = calculateDiscount();
  const images =
    product.images || (product.image ? [product.image] : ["/product_1.png"]);
  const productId = product?._id || product?.id;
  const isCurrentVariantInCart = productId
    ? isInCart(productId, selectedVariantId)
    : false;
  const isWishlisted = productId ? isInWishlist(productId) : false;
  const activeSku = selectedVariant?.sku || product?.sku || "";

  return (
    <section className="py-4 sm:py-10 min-h-screen bg-[radial-gradient(circle_at_top_left,var(--flavor-glass),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),_transparent_40%),linear-gradient(180deg,#f8fbff_0%,#eef9f2_100%)]">
      <div
        className="container px-3 sm:px-4"
        style={{ fontFamily: "'Sora', 'Segoe UI', sans-serif" }}
      >
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap pb-2">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:text-primary">
            Products
          </Link>
          <span>/</span>
          {product.category && (
            <>
              <Link
                href={`/products?category=${product.category._id || product.category}`}
                className="hover:text-primary"
              >
                {product.category.name || product.categoryName || "Category"}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-800 font-medium truncate max-w-[200px]">
            {product.name || product.title}
          </span>
        </nav>

        {/* Main Product Section */}
        <div className="bg-white/75 backdrop-blur-xl border border-white/70 rounded-2xl sm:rounded-3xl shadow-[0_30px_80px_-55px_rgba(15,23,42,0.45)] p-4 sm:p-6 md:p-8 transition-all duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Product Images */}
            <div className="relative">
              {discount > 0 && (
                <span className="absolute top-4 left-4 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full z-10">
                  {discount}% OFF
                </span>
              )}
              <ProductZoom images={images} productId={productId} />
            </div>

            {/* Product Info */}
            <div className="flex flex-col">
              {/* Brand */}
              {product.brand && (
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  {product.brand}
                </p>
              )}

              {/* Title */}
              <h1 className="text-xl sm:text-2xl md:text-4xl font-semibold tracking-tight text-gray-900 mb-3">
                {product.name || product.title}
              </h1>

              {/* Weight Badge (only when no variants) */}
              {!product.hasVariants && product.weight > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 mb-3 w-fit">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l3 9a5.002 5.002 0 006.001 0M18 7l-3 9m0-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                  {product.weight}{product.unit && product.unit !== "piece" ? product.unit : "g"}
                </span>
              )}

              {/* Rating */}
              <div className="flex items-center gap-3 mb-4">
                <Rating
                  value={productRating}
                  precision={0.5}
                  readOnly
                  size="small"
                />
                <span className="text-sm text-gray-500">
                  ({customerReviewCount} reviews)
                </span>
              </div>

              {/* Size / Weight Variant Selector */}
              {product.hasVariants && product.variants?.length > 0 && (
                <div className="mb-5">
                  <p className="text-sm text-gray-500 mb-2">
                    Size: <span className="font-bold text-gray-900">{selectedVariant?.name || "Select"}</span>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {product.variants.map((variant, idx) => {
                      const isSelected = selectedVariant?._id === variant._id;
                      const vStock = Math.max(
                        Number(variant.stock_quantity ?? variant.stock ?? 0) -
                          Number(variant.reserved_quantity ?? 0),
                        0,
                      );
                      const vDiscount = variant.discountPercent ||
                        (variant.originalPrice && variant.price && variant.originalPrice > variant.price
                          ? Math.round(((variant.originalPrice - variant.price) / variant.originalPrice) * 100)
                          : 0);
                      return (
                        <button
                          key={variant._id || idx}
                          type="button"
                          onClick={() => { setSelectedVariant(variant); setQuantity(1); }}
                          className={`relative flex flex-col items-start rounded-xl border-2 px-4 py-3 min-w-[140px] transition-all duration-200 text-left ${
                            isSelected
                              ? "border-primary bg-[var(--flavor-glass)] shadow-md"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                          } ${vStock === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                          disabled={vStock === 0}
                        >
                          {vDiscount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {vDiscount}%
                            </span>
                          )}
                          {variant.isDefault && (
                            <span className="absolute -top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              Popular
                            </span>
                          )}
                          <span className={`text-sm font-bold ${isSelected ? "text-primary" : "text-gray-900"}`}>
                            {variant.name}
                          </span>
                          <span className="text-base font-extrabold text-gray-900 mt-1">
                            ₹{variant.price}
                          </span>
                          {variant.originalPrice && variant.originalPrice > variant.price && (
                            <span className="text-xs text-gray-400 line-through">
                              ₹{variant.originalPrice}
                            </span>
                          )}
                          <span className={`text-[11px] font-semibold mt-1 ${vStock > 0 ? "text-green-600" : "text-red-500"}`}>
                            {vStock > 0 ? "In stock" : "Out of stock"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price */}
              <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                  ₹{activePrice || product.salePrice}
                </span>
                {(activeOriginalPrice || product.regularPrice) &&
                  (activeOriginalPrice || product.regularPrice) > (activePrice || 0) && (
                  <span className="text-lg sm:text-xl text-gray-400 line-through">
                    ₹{activeOriginalPrice || product.regularPrice}
                  </span>
                )}
                {discount > 0 && (
                  <span className="text-sm font-bold text-primary bg-[var(--flavor-glass)] px-2 py-1 rounded">
                    Save ₹
                    {(activeOriginalPrice || product.regularPrice || 0) -
                      (activePrice || product.salePrice || 0)}
                  </span>
                )}
              </div>

              {/* High Traffic Alert Banner - Prominent notice for high demand products */}
              {product.demandStatus === "HIGH" && (
                <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <HiOutlineFire className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-800 text-sm">
                        High Traffic Product
                      </h4>
                      <p className="text-amber-700 text-sm mt-0.5">
                        This product is in high demand. Stock availability may
                        vary. Your order will be confirmed once processed.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Short Description */}
              {product.shortDescription && (
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {product.shortDescription}
                </p>
              )}

              {/* Demand Status Badge */}
              <div className="flex items-center gap-2 mb-6">
                {product.demandStatus === "HIGH" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-600">
                    <HiOutlineFire className="w-4 h-4" />
                    High Demand
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-[var(--flavor-glass)] text-primary">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Available
                  </span>
                )}
              </div>

              {/* Quantity & Add to Cart */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                {!isCurrentVariantInCart && (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-700 font-medium">Qty:</span>
                    <div className="flex flex-col">
                      <QtyBox
                        value={quantity}
                        onChange={setQuantity}
                        max={maxQty}
                      />
                      {availableQty === 0 ? (
                        <span className="text-xs text-red-500 mt-1">
                          Out of stock
                        </span>
                      ) : availableQty <= 10 ? (
                        <span className="text-xs text-orange-600 mt-1">
                          Only {availableQty} left
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}

                <Button
                  variant="contained"
                  size="large"
                  startIcon={<IoMdCart />}
                  onClick={handleAddToCart}
                  disabled={!isCurrentVariantInCart && availableQty === 0}
                  sx={{
                    backgroundColor: isCurrentVariantInCart
                      ? "#dc2626"
                      : "var(--primary)",
                    "&:hover": {
                      backgroundColor: isCurrentVariantInCart
                        ? "#b91c1c"
                        : "var(--flavor-hover)",
                    },
                    padding: "12px 32px",
                    borderRadius: "14px",
                    fontWeight: "bold",
                    textTransform: "none",
                    fontSize: "16px",
                    boxShadow: isCurrentVariantInCart
                      ? "0 16px 30px -20px rgba(220,38,38,0.85)"
                      : "0 16px 30px -20px rgba(var(--flavor-badge),0.85)",
                  }}
                >
                  {isCurrentVariantInCart
                    ? "Remove from Cart"
                    : "Add to Cart"}
                </Button>

                <Button
                  variant={isWishlisted ? "contained" : "outlined"}
                  size="large"
                  startIcon={
                    isWishlisted ? (
                      <IoMdHeart size={20} />
                    ) : (
                      <IoMdHeartEmpty size={20} />
                    )
                  }
                  onClick={handleWishlistToggle}
                  sx={{
                    borderColor: isWishlisted ? "#ef4444" : "#d1d5db",
                    color: isWishlisted ? "#fff" : "#6b7280",
                    backgroundColor: isWishlisted ? "#ef4444" : "transparent",
                    "&:hover": {
                      borderColor: "#ef4444",
                      backgroundColor: isWishlisted
                        ? "#dc2626"
                        : "rgba(239, 68, 68, 0.04)",
                    },
                    padding: "12px 16px",
                    borderRadius: "14px",
                    textTransform: "none",
                    fontWeight: 600,
                  }}
                >
                  {isWishlisted ? "Wishlisted" : "Add to Wishlist"}
                </Button>
              </div>

              {/* Features */}
              <div className="grid grid-cols-2 gap-4 py-6 border-t border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <MdLocalShipping className="text-2xl text-primary" />
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">
                      Free Delivery
                    </p>
                    <p className="text-xs text-gray-500">On all orders</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MdVerified className="text-2xl text-primary" />
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">
                      Quality Products
                    </p>
                    <p className="text-xs text-gray-500">
                      Fresh & authentic items
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MdVerified className="text-2xl text-primary" />
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">
                      100% Authentic
                    </p>
                    <p className="text-xs text-gray-500">Quality guaranteed</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MdPolicy className="text-2xl text-primary" />
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">
                      Secure Payment
                    </p>
                    <p className="text-xs text-gray-500">
                      100% secure checkout
                    </p>
                  </div>
                </div>
              </div>

              {/* SKU & Category */}
              <div className="mt-6 text-sm text-gray-500">
                {activeSku && (
                  <p>
                    <span className="font-medium">SKU:</span> {activeSku}
                  </p>
                )}
                {product.category && (
                  <p>
                    <span className="font-medium">Category:</span>{" "}
                    <Link
                      href={`/products?category=${product.category._id || product.category}`}
                      className="text-primary hover:underline"
                    >
                      {product.category.name ||
                        product.categoryName ||
                        "View Category"}
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="bg-white/75 backdrop-blur-xl border border-white/70 rounded-2xl sm:rounded-3xl shadow-[0_24px_70px_-50px_rgba(30,41,59,0.55)] mt-8 p-6 md:p-8">
          {/* Tab Headers */}
          <div className="flex border-b border-gray-200">
            {["description", "reviews", "shipping"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 font-semibold text-sm capitalize transition-colors ${activeTab === tab
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                {tab === "reviews"
                  ? `Reviews (${customerReviewCount})`
                  : tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="py-6">
            {activeTab === "description" && (
              <div className="prose max-w-none text-gray-600">
                {product.description ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHTML(product.description),
                    }}
                  />
                ) : (
                  <p>
                    {product.shortDescription || "No description available."}
                  </p>
                )}
              </div>
            )}

            {activeTab === "reviews" && (
              <div>
                {reviewsLoading ? (
                  <p className="text-gray-500">Loading reviews...</p>
                ) : customerReviews.length > 0 ? (
                  <div className="space-y-4">
                    {customerReviews.map((review) => (
                      <div
                        key={review._id}
                        className="border-b border-gray-100 pb-4"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Rating value={review.rating} size="small" readOnly />
                          <span className="font-medium">
                            {review.userName || "Customer"}
                            {review.city ? (
                              <span className="text-gray-400 text-xs ml-2">
                                {review.city}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-600">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">
                    No reviews yet. Be the first to review this product!
                  </p>
                )}
              </div>
            )}

            {activeTab === "shipping" && (
              <div className="text-gray-600 space-y-4">
                <p>
                  <strong>Delivery:</strong> Standard delivery within 3-5
                  business days.
                </p>
                <p>
                  <strong>Free Shipping:</strong> On orders above ₹499.
                </p>
                <p>
                  <strong>Packaging:</strong> Eco-friendly packaging to ensure
                  product safety.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Related Products
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {relatedProducts.slice(0, 5).map((item) => (
                <ProductItem
                  key={item._id || item.id}
                  id={item._id || item.id}
                  name={item.name || item.title}
                  brand={item.brand || "Buy One Gram"}
                  price={item.price || item.salePrice}
                  originalPrice={item.originalPrice || item.regularPrice}
                  discount={item.discount || 0}
                  rating={item.rating || 4.5}
                  image={item.image || item.images?.[0] || "/product_1.png"}
                  product={item}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </section>
  );
};

export default ProductDetailPage;
