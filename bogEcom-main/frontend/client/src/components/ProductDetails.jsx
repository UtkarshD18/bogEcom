"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Rating from "@mui/material/Rating";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { useRef, useState } from "react";
import { FaHeart, FaRegHeart, FaShare, FaUserCircle } from "react-icons/fa";
import { HiOutlineFire, HiOutlineLightningBolt } from "react-icons/hi";
import { IoCartOutline } from "react-icons/io5";
import ProductZoom from "./ProductZoom";
import QtyBox from "./QtyBox";

/**
 * Product Details Component
 *
 * @param {Object} props
 * @param {Object} props.product - Product data object
 */
const ProductDetails = ({
  product = {
    id: 1,
    name: "Buy One Gram Peanut Butter 500g",
    brand: "Buy One Gram",
    price: 349,
    originalPrice: 499,
    discount: 30,
    rating: 4.5,
    reviewCount: 128,
    images: ["/product_1.png", "/product_1.png", "/product_1.png"],
    demandStatus: "NORMAL",
    description:
      "Fuel your day the natural way with Buy One Gram Peanut Butter crafted from 100% premium roasted peanuts and absolutely nothing else. No added sugar, no palm oil, no preservatives—just pure, protein-packed goodness in every spoon.",
    features: [
      "100% Natural Ingredients",
      "No Added Sugar",
      "No Palm Oil",
      "High Protein",
      "No Preservatives",
    ],
  },
}) => {
  const [isActiveTab, setIsActiveTab] = useState(0);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [loadingCart, setLoadingCart] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const [reviews, setReviews] = useState([
    {
      id: 1,
      user: "John Doe",
      rating: 5,
      date: "2023-10-25",
      comment: "Absolutely love this peanut butter! Tastes pure and natural.",
    },
    {
      id: 2,
      user: "Sarah M.",
      rating: 4,
      date: "2023-10-20",
      comment: "Great taste and quality. Will buy again!",
    },
  ]);

  const reviewsRef = useRef(null);

  const handleCloseToast = () => {
    setToast({ ...toast, open: false });
  };

  const handleAddToCart = () => {
    setLoadingCart(true);
    setTimeout(() => {
      setLoadingCart(false);
      setToast({
        open: true,
        message: `Added ${quantity} item(s) to cart!`,
        severity: "success",
      });
    }, 800);
  };

  const handleBuyNow = () => {
    setToast({
      open: true,
      message: "Proceeding to Checkout...",
      severity: "info",
    });
    // router.push('/checkout');
  };

  const toggleWishlist = () => {
    const newState = !isInWishlist;
    setIsInWishlist(newState);
    setToast({
      open: true,
      message: newState ? "Added to Wishlist" : "Removed from Wishlist",
      severity: newState ? "success" : "info",
    });
  };

  const scrollToReviews = () => {
    setIsActiveTab(1);
    setTimeout(() => {
      reviewsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSubmitReview = (e) => {
    e.preventDefault();
    if (!reviewText.trim()) return;

    const newReview = {
      id: Date.now(),
      user: "Guest User",
      rating: ratingValue,
      date: new Date().toLocaleDateString(),
      comment: reviewText,
    };

    setReviews([newReview, ...reviews]);
    setReviewText("");
    setRatingValue(5);
    setToast({ open: true, message: "Review Submitted!", severity: "success" });
  };

  return (
    <div className="pt-[160px] px-4 pb-20">
      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleCloseToast}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      {/* Product Top Section */}
      <div className="container mx-auto">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Product Images */}
          <ProductZoom images={product.images} />

          {/* Product Info */}
          <div className="flex-1">
            {/* Breadcrumb */}
            <p className="text-sm text-gray-500 mb-2">
              Home / Products / {product.name}
            </p>

            {/* Brand */}
            <span className="text-xs font-bold uppercase tracking-wider text-[#059669] bg-[#059669]/10 px-3 py-1 rounded-full">
              {product.brand}
            </span>

            {/* Title */}
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 mt-4">
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-4 mt-4">
              <Rating
                name="read-only"
                value={product.rating}
                precision={0.5}
                readOnly
              />
              <span
                onClick={scrollToReviews}
                className="text-sm text-gray-600 cursor-pointer hover:text-[#059669] underline transition-colors"
              >
                {product.reviewCount} Reviews
              </span>
            </div>

            {/* Price */}
            <div className="flex items-center gap-4 mt-6">
              <span className="text-3xl font-bold text-gray-900">
                ₹{product.price}
              </span>
              {product.originalPrice > product.price && (
                <>
                  <span className="text-xl text-gray-400 line-through">
                    ₹{product.originalPrice}
                  </span>
                  <span className="bg-green-100 text-green-700 text-sm font-bold px-3 py-1 rounded-full">
                    {product.discount}% OFF
                  </span>
                </>
              )}
            </div>

            {/* Demand Status Badge */}
            <div className="mt-4">
              {product.demandStatus === "HIGH" ? (
                <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 text-sm font-bold px-3 py-1.5 rounded-full">
                  <HiOutlineFire size={16} /> High Demand
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-sm font-medium px-3 py-1.5 rounded-full">
                  Available
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-600 leading-relaxed mt-6 pr-4">
              {product.description}
            </p>

            {/* Features */}
            {product.features && (
              <ul className="mt-4 space-y-2">
                {product.features.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2 text-sm text-gray-700"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#059669]" />
                    {feature}
                  </li>
                ))}
              </ul>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-4 mt-8">
              <QtyBox value={1} onChange={setQuantity} size="lg" />

              <Button
                onClick={handleAddToCart}
                disabled={loadingCart}
                className={`!px-8 !py-3 !rounded-xl !font-bold !text-white !normal-case ${
                  loadingCart
                    ? "!bg-gray-400"
                    : "!bg-gray-900 hover:!bg-[#059669]"
                }`}
              >
                {loadingCart ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <IoCartOutline className="mr-2" size={22} />
                    Add to Cart
                  </>
                )}
              </Button>

              <Button
                onClick={handleBuyNow}
                variant="outlined"
                className="!px-8 !py-3 !rounded-xl !font-bold !border-gray-900 !text-gray-900 !normal-case hover:!bg-gray-100"
              >
                <HiOutlineLightningBolt className="mr-2" size={20} />
                Buy Now
              </Button>

              <Tooltip
                title={
                  isInWishlist ? "Remove from Wishlist" : "Add to Wishlist"
                }
              >
                <Button
                  onClick={toggleWishlist}
                  className={`!min-w-[52px] !w-[52px] !h-[52px] !rounded-xl ${
                    isInWishlist
                      ? "!bg-red-500 !text-white"
                      : "!bg-gray-100 !text-gray-600 hover:!text-red-500"
                  }`}
                >
                  {isInWishlist ? (
                    <FaHeart size={20} />
                  ) : (
                    <FaRegHeart size={20} />
                  )}
                </Button>
              </Tooltip>

              <Tooltip title="Share">
                <Button className="!min-w-[52px] !w-[52px] !h-[52px] !rounded-xl !bg-gray-100 !text-gray-600">
                  <FaShare size={18} />
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mt-16" ref={reviewsRef}>
          <div className="flex border-b border-gray-200">
            {["Description", "Reviews"].map((tab, index) => (
              <button
                key={tab}
                onClick={() => setIsActiveTab(index)}
                className={`px-6 py-3 font-semibold text-sm transition-colors ${
                  isActiveTab === index
                    ? "text-[#059669] border-b-2 border-[#059669]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="py-8">
            {isActiveTab === 0 && (
              <div className="prose max-w-none">
                <p className="text-gray-600 leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {isActiveTab === 1 && (
              <div className="space-y-8">
                {/* Write Review Form */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">
                    Write a Review
                  </h3>
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">
                        Your Rating:
                      </span>
                      <Rating
                        value={ratingValue}
                        onChange={(e, newValue) => setRatingValue(newValue)}
                      />
                    </div>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      placeholder="Share your experience..."
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                    />
                    <Button
                      type="submit"
                      className="!bg-[#059669] !text-white !px-6 !py-2 !rounded-lg !normal-case !font-semibold"
                    >
                      Submit Review
                    </Button>
                  </form>
                </div>

                {/* Reviews List */}
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-xl p-5 border"
                      style={{
                        backgroundColor: "var(--flavor-card-bg, #fffbf5)",
                        borderColor:
                          "color-mix(in srgb, var(--flavor-color, #a7f3d0) 20%, transparent)",
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <FaUserCircle className="text-gray-300" size={40} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-gray-800">
                              {review.user}
                            </h4>
                            <span className="text-xs text-gray-400">
                              {review.date}
                            </span>
                          </div>
                          <Rating
                            value={review.rating}
                            size="small"
                            readOnly
                            className="mt-1"
                          />
                          <p className="text-gray-600 mt-2">{review.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
