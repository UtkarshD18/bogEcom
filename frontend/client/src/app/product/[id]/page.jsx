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
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState("description");
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Fetch product details from API
  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await fetchDataFromApi(`/api/products/${id}`);

      if (response?.error !== true && response?.data) {
        setProduct(response.data);

        // Fetch related products by category
        if (response.data.category) {
          const relatedResponse = await fetchDataFromApi(
            `/api/products?category=${response.data.category._id || response.data.category}&limit=5&exclude=${id}`,
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
      }
    } catch (error) {
      console.error("Error fetching product:", error);
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

      // Check if already in cart
      if (isInCart(productId)) {
        // Remove from cart
        await removeFromCart(productId);
        setSnackbar({
          open: true,
          message: "Removed from cart!",
          severity: "success",
        });
      } else {
        // Add to cart
        await addToCart(product, quantity);
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
      await toggleWishlist(product);

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
    if (product?.originalPrice && product?.price) {
      return Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100,
      );
    }
    return product?.discount || 0;
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
  const isWishlisted = productId ? isInWishlist(productId) : false;

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
              <ProductZoom images={images} />
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

              {/* Rating */}
              <div className="flex items-center gap-3 mb-4">
                <Rating
                  value={product.rating || 4.5}
                  precision={0.5}
                  readOnly
                  size="small"
                />
                <span className="text-sm text-gray-500">
                  ({product.numReviews || product.reviews?.length || 0} reviews)
                </span>
              </div>

              {/* Price */}
              <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                  ₹{product.price || product.salePrice}
                </span>
                {(product.originalPrice || product.regularPrice) && (
                  <span className="text-lg sm:text-xl text-gray-400 line-through">
                    ₹{product.originalPrice || product.regularPrice}
                  </span>
                )}
                {discount > 0 && (
                  <span className="text-sm font-bold text-primary bg-[var(--flavor-glass)] px-2 py-1 rounded">
                    Save ₹
                    {(product.originalPrice || product.regularPrice) -
                      (product.price || product.salePrice)}
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
                {!isInCart(product._id || product.id) && (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-700 font-medium">Qty:</span>
                    <QtyBox
                      value={quantity}
                      onChange={setQuantity}
                      max={product.stock || 99}
                    />
                  </div>
                )}

                <Button
                  variant="contained"
                  size="large"
                  startIcon={<IoMdCart />}
                  onClick={handleAddToCart}
                  sx={{
                    backgroundColor: isInCart(product._id || product.id)
                      ? "#dc2626"
                      : "var(--primary)",
                    "&:hover": {
                      backgroundColor: isInCart(product._id || product.id)
                        ? "#b91c1c"
                        : "var(--flavor-hover)",
                    },
                    padding: "12px 32px",
                    borderRadius: "14px",
                    fontWeight: "bold",
                    textTransform: "none",
                    fontSize: "16px",
                    boxShadow: isInCart(product._id || product.id)
                      ? "0 16px 30px -20px rgba(220,38,38,0.85)"
                      : "0 16px 30px -20px rgba(var(--flavor-badge),0.85)",
                  }}
                >
                  {isInCart(product._id || product.id)
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
                    <p className="text-xs text-gray-500">Orders above ₹499</p>
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
                {product.sku && (
                  <p>
                    <span className="font-medium">SKU:</span> {product.sku}
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
                  ? `Reviews (${product.numReviews || product.reviews?.length || 0})`
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
                {product.reviews && product.reviews.length > 0 ? (
                  <div className="space-y-4">
                    {product.reviews.map((review, index) => (
                      <div
                        key={index}
                        className="border-b border-gray-100 pb-4"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Rating value={review.rating} size="small" readOnly />
                          <span className="font-medium">
                            {review.user?.name || "Customer"}
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
