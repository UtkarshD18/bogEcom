"use client";

import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useState } from "react";
import {
  IoIosStar,
  IoIosStarHalf,
  IoMdCart,
  IoMdHeart,
  IoMdHeartEmpty,
} from "react-icons/io";

/**
 * ProductItem Component
 *
 * @param {Object} props
 * @param {string|number} props.id - Product ID
 * @param {string} props.name - Product name
 * @param {string} props.brand - Brand name
 * @param {number} props.price - Current price
 * @param {number} props.originalPrice - Original price (before discount)
 * @param {number} props.discount - Discount percentage
 * @param {number} props.rating - Product rating (0-5)
 * @param {string} props.image - Product image URL
 * @param {boolean} props.inStock - Stock status
 * @param {Object} props.product - Full product object for cart/wishlist
 */
const ProductItem = ({
  id = 1,
  name = "Classic Peanut Butter - Crunchy",
  brand = "Buy One Gram",
  price = 349,
  originalPrice = 499,
  discount = 30,
  rating = 4.5,
  image = "/product_1.png",
  inStock = true,
  product = null,
}) => {
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { addToCart, isInCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const productId = id || product?._id;
  const isWishlisted = isInWishlist(productId);
  const alreadyInCart = isInCart(productId);

  // Create product object for cart/wishlist
  const productData = product || {
    _id: id,
    name,
    brand,
    price,
    originalPrice,
    images: [image],
  };

  // Handle wishlist click
  const handleWishlistClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleWishlist(productData);
  };

  // Handle add to cart
  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!inStock || isAddingToCart) return;

    setIsAddingToCart(true);
    try {
      await addToCart(productData, 1);
    } catch (error) {
      console.error("Error adding to cart:", error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Render rating stars
  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<IoIosStar key={`full-${i}`} />);
    }
    if (hasHalfStar) {
      stars.push(<IoIosStarHalf key="half" />);
    }
    return stars;
  };

  return (
    <Link href={`/product/${productId}`} className="block w-full">
      <div className="group relative bg-white w-full rounded-2xl border border-gray-100 p-3 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 cursor-pointer">
        {/* ================= IMAGE SECTION ================= */}
        <div className="relative h-52 w-full overflow-hidden rounded-xl bg-[#F3F4F6] flex items-center justify-center">
          {/* Discount Badge */}
          {discount > 0 && (
            <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-red-600 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-10 border border-red-100">
              {discount}% OFF
            </span>
          )}

          {/* Out of Stock Badge */}
          {!inStock && (
            <span className="absolute top-3 left-3 bg-gray-900/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-10">
              Out of Stock
            </span>
          )}

          {/* Wishlist Button */}
          <button
            onClick={handleWishlistClick}
            className={`absolute top-3 right-3 p-2 rounded-full shadow-sm opacity-0 transform translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 z-10 ${
              isWishlisted
                ? "bg-red-500 text-white"
                : "bg-white text-gray-400 hover:text-red-500 hover:bg-red-50"
            }`}
          >
            {isWishlisted ? (
              <IoMdHeart size={18} />
            ) : (
              <IoMdHeartEmpty size={18} />
            )}
          </button>

          {/* Product Image */}
          <img
            src={getImageUrl(image)}
            alt={name}
            className={`h-full w-full object-contain mix-blend-multiply p-4 transition-transform duration-500 ease-in-out group-hover:scale-110 ${
              !inStock ? "opacity-50 grayscale" : ""
            }`}
          />
        </div>

        {/* ================= CONTENT SECTION ================= */}
        <div className="mt-4 px-1">
          {/* Brand */}
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            {brand}
          </p>

          {/* Title */}
          <h3 className="text-[14px] font-bold text-gray-800 leading-snug line-clamp-2 group-hover:text-[#c1591c] transition-colors min-h-[40px]">
            {name}
          </h3>

          {/* Ratings */}
          <div className="flex items-center gap-1 mt-2">
            <div className="flex text-yellow-400 text-xs">{renderStars()}</div>
            <span className="text-xs text-gray-400 font-medium ml-1">
              ({rating})
            </span>
          </div>

          {/* Price Row */}
          <div className="flex items-end justify-between mt-3">
            <div className="flex flex-col">
              {originalPrice > price && (
                <span className="text-xs text-gray-400 line-through font-medium">
                  ₹{originalPrice}
                </span>
              )}
              <span className="text-lg font-extrabold text-gray-900">
                ₹{price}
              </span>
            </div>

            {/* Add Button */}
            <button
              onClick={handleAddToCart}
              disabled={!inStock || isAddingToCart}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-300 active:scale-95 ${
                alreadyInCart
                  ? "bg-green-600 text-white"
                  : inStock
                    ? "bg-gray-900 text-white hover:bg-[#c1591c] hover:shadow-lg"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              {isAddingToCart ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : alreadyInCart ? (
                <>
                  <IoMdCart size={16} />
                  Added
                </>
              ) : (
                <>
                  <IoMdCart size={16} />
                  Add
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductItem;
